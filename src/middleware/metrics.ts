import { Request, Response, NextFunction } from 'express';
import { getDbPoolMetrics } from '../db';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { getRedisClient } from '../services/redisService';

const MAX_CARDINALITY_KEYS = 1000;

let postgresUpGauge = 1;
let redisUpGauge = 1;

/**
 * Global latency histogram.
 *
 * Deliberately unlabelled: the HighHttpLatencyP95 rule aggregates with
 * `sum(rate(http_request_duration_seconds_bucket[5m])) by (le)`, and emitting
 * per-route buckets would multiply the series count by every path on an
 * appliance that may only have 2 GB of RAM.
 */
const HTTP_DURATION_BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const httpDurationBucketCounts: number[] = HTTP_DURATION_BUCKETS.map(() => 0);
let httpDurationSumTotal = 0;
let httpDurationCountTotal = 0;

export function setDependencyHealthMetrics(postgres: boolean, redis: boolean) {
  postgresUpGauge = postgres ? 1 : 0;
  redisUpGauge = redis ? 1 : 0;
}

/**
 * Durability signals derived from the backup volume.
 *
 * The app container mounts ./backups read-only, which is the same source the
 * super-admin health endpoint already reads. Nothing here ever writes.
 */
type BackupSnapshot = {
  present: boolean;
  latestTimestampSeconds: number | null;
  verificationStatus: number | null;
  restoreDrillTimestampSeconds: number | null;
  offsiteConfigured: boolean;
  offsiteStatus: number | null;
  offsiteTimestampSeconds: number | null;
};

const BACKUP_SNAPSHOT_TTL_MS = 15000;
let backupSnapshotCache: BackupSnapshot | null = null;
let backupSnapshotCachedAt = 0;

function resolveBackupDir(): string {
  if (process.env.BACKUP_DIR) return process.env.BACKUP_DIR;
  try {
    if (fs.existsSync('./backups')) return './backups';
  } catch {
    // Fall through to the container mount path.
  }
  return '/backups';
}

function toEpochSeconds(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return Math.floor(parsed / 1000);
}

function fileMtimeSeconds(filePath: string): number | null {
  try {
    return Math.floor(fs.statSync(filePath).mtimeMs / 1000);
  } catch {
    return null;
  }
}

function readTrimmed(filePath: string): string | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    return raw === '' ? null : raw;
  } catch {
    return null;
  }
}

function collectBackupSnapshot(): BackupSnapshot {
  const dir = resolveBackupDir();
  const snapshot: BackupSnapshot = {
    present: false,
    latestTimestampSeconds: null,
    verificationStatus: null,
    restoreDrillTimestampSeconds: null,
    offsiteConfigured: false,
    offsiteStatus: null,
    offsiteTimestampSeconds: null,
  };

  const latestPath = `${dir}/LATEST`;
  const manifestPath = `${dir}/LATEST_MANIFEST.json`;

  let manifestChecksum: string | null = null;
  const rawManifest = readTrimmed(manifestPath);
  if (rawManifest !== null) {
    snapshot.present = true;
    try {
      const manifest = JSON.parse(rawManifest);
      snapshot.latestTimestampSeconds = toEpochSeconds(manifest?.timestamp);
      if (typeof manifest?.checksumSha256 === 'string' && manifest.checksumSha256.trim() !== '') {
        manifestChecksum = manifest.checksumSha256.trim();
      }
    } catch {
      // A manifest that exists but will not parse is a real integrity problem.
      // Leaving manifestChecksum null reports it below instead of hiding it.
      manifestChecksum = null;
    }
  }

  const latestRaw = readTrimmed(latestPath);
  if (latestRaw !== null) {
    snapshot.present = true;
    if (snapshot.latestTimestampSeconds === null) {
      snapshot.latestTimestampSeconds = toEpochSeconds(latestRaw) ?? fileMtimeSeconds(latestPath);
    }
  }

  if (snapshot.present) {
    snapshot.verificationStatus = manifestChecksum !== null ? 1 : 0;
    if (snapshot.latestTimestampSeconds === null) {
      snapshot.latestTimestampSeconds = fileMtimeSeconds(manifestPath) ?? fileMtimeSeconds(latestPath);
    }
  }

  const restoreDrillPath = `${dir}/LATEST_RESTORE_VERIFIED`;
  const rawDrill = readTrimmed(restoreDrillPath);
  if (rawDrill !== null) {
    let verifiedAt: unknown = null;
    try {
      verifiedAt = JSON.parse(rawDrill)?.verifiedAt ?? null;
    } catch {
      verifiedAt = null;
    }
    snapshot.restoreDrillTimestampSeconds =
      toEpochSeconds(verifiedAt) ?? fileMtimeSeconds(restoreDrillPath);
  }

  const offsiteStatusRaw = readTrimmed(`${dir}/OFFSITE_STATUS`);
  if (offsiteStatusRaw !== null) {
    const state = offsiteStatusRaw.split(/\s+/)[0]?.toUpperCase();
    // DISABLED means replication was never configured. Staying unconfigured
    // keeps the off-site rules absent so they cannot fire on QR-only schools
    // that deliberately keep backups local.
    if (state === 'SUCCESS' || state === 'FAILED') {
      snapshot.offsiteConfigured = true;
      snapshot.offsiteStatus = state === 'SUCCESS' ? 1 : 0;
    }
  }

  if (snapshot.offsiteConfigured) {
    const markerPath = `${dir}/LATEST_OFFSITE`;
    const markerRaw = readTrimmed(markerPath);
    if (markerRaw !== null) {
      // Written by the uploader as "<iso> <epochSeconds>". The epoch field
      // exists because BusyBox date in the backup container cannot parse
      // ISO-8601, so nothing downstream should depend on parsing the string.
      const fields = markerRaw.split(/\s+/);
      const epochField = fields[1];
      const epoch = epochField !== undefined && /^[0-9]+$/.test(epochField) ? Number(epochField) : null;
      snapshot.offsiteTimestampSeconds =
        epoch ?? toEpochSeconds(fields[0]) ?? fileMtimeSeconds(markerPath);
    }
  }

  return snapshot;
}

function getBackupSnapshot(): BackupSnapshot {
  const now = Date.now();
  if (backupSnapshotCache !== null && now - backupSnapshotCachedAt < BACKUP_SNAPSHOT_TTL_MS) {
    return backupSnapshotCache;
  }
  backupSnapshotCache = collectBackupSnapshot();
  backupSnapshotCachedAt = now;
  return backupSnapshotCache;
}

/** Clears the cached durability snapshot. Intended for tests. */
export function resetBackupSnapshotCache() {
  backupSnapshotCache = null;
  backupSnapshotCachedAt = 0;
}

/**
 * Normalizes request paths to prevent high-cardinality metric map growth and memory exhaustion.
 */
function normalizePath(rawPath: unknown): string {
  const str = typeof rawPath === 'string' ? rawPath : (Array.isArray(rawPath) ? rawPath.join('_') : String(rawPath || ''));
  return str
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+/g, '/:id');
}

/**
 * Redis key prefix for Prometheus counters/gauges.
 * Each metric key is stored as a Redis string (INCRBYFLOAT / INCR).
 */
const METRICS_KEY_PREFIX = 'metrics:';

async function redisIncr(key: string, by: number = 1): Promise<void> {
  try {
    const client = getRedisClient();
    if (client && client.status === 'ready') {
      if (Number.isInteger(by)) {
        await client.incrby(`${METRICS_KEY_PREFIX}${key}`, by);
      } else {
        await client.incrbyfloat(`${METRICS_KEY_PREFIX}${key}`, by);
      }
    } else {
      // No Redis available (dev / test) — fall back to in-process map
      inProcessFallback.set(key, (inProcessFallback.get(key) || 0) + by);
    }
  } catch {
    // Metric recording is non-fatal; always fall through
    inProcessFallback.set(key, (inProcessFallback.get(key) || 0) + by);
  }
}

/** In-process fallback used when Redis is unavailable (dev/test). */
const inProcessFallback = new Map<string, number>();

async function redisGet(key: string): Promise<number> {
  try {
    const client = getRedisClient();
    if (client && client.status === 'ready') {
      const val = await client.get(`${METRICS_KEY_PREFIX}${key}`);
      return val ? parseFloat(val) : 0;
    }
  } catch {
    // fall through to in-process
  }
  return inProcessFallback.get(key) || 0;
}

/**
 * Retrieves all metric keys matching a prefix pattern from Redis (or in-process map).
 * Uses SCAN cursor loop instead of KEYS to avoid blocking the Redis server.
 */
async function redisGetByPattern(prefix: string): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  try {
    const client = getRedisClient();
    if (client && client.status === 'ready') {
      const pattern = `${METRICS_KEY_PREFIX}${prefix}*`;
      const allKeys: string[] = [];
      let cursor = '0';
      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        allKeys.push(...keys);
      } while (cursor !== '0');

      if (allKeys.length > 0) {
        const values = await client.mget(...allKeys);
        for (let i = 0; i < allKeys.length; i++) {
          const shortKey = allKeys[i].replace(`${METRICS_KEY_PREFIX}`, '');
          result.set(shortKey, values[i] ? parseFloat(values[i]!) : 0);
        }
        return result;
      }
    }
  } catch {
    // fall through to in-process
  }
  // In-process fallback
  for (const [k, v] of inProcessFallback.entries()) {
    if (k.startsWith(prefix)) result.set(k, v);
  }
  return result;
}

/** Per-request cardinality guard: prevent unbounded Redis key growth. */
const seenKeys = new Set<string>();

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const durationSec = (Date.now() - start) / 1000;
    const routePath: unknown = (req.route as { path?: unknown } | undefined)?.path;
    const path = normalizePath(routePath || req.path);
    const key = `http:${req.method}:${path}:${res.statusCode}`;

    if (seenKeys.size < MAX_CARDINALITY_KEYS || seenKeys.has(key)) {
      seenKeys.add(key);
      void redisIncr(`${key}:count`);
      void redisIncr(`${key}:duration`, durationSec);
    }

    // Unbounded by path, so latency stays observable even past the cardinality cap.
    httpDurationSumTotal += durationSec;
    httpDurationCountTotal += 1;
    for (let i = 0; i < HTTP_DURATION_BUCKETS.length; i += 1) {
      if (durationSec <= HTTP_DURATION_BUCKETS[i]) {
        httpDurationBucketCounts[i] += 1;
      }
    }
  });

  next();
}

// --- RFID Metrics (async helpers) ---

export const rfidMetrics = {
  recordScan(decision: string, securityMode: string, durationSec: number) {
    void redisIncr(`rfid:scans:${decision}:${securityMode}`);
    void redisIncr('rfid:scan_duration_sum', durationSec);
    void redisIncr('rfid:scan_duration_count');
  },
  recordReplayAttempt() {
    void redisIncr('rfid:replay_attempts');
  },
  recordUnknownCard() {
    void redisIncr('rfid:unknown_card_attempts');
  },
  recordAttendanceByMethod(method: string) {
    void redisIncr(`rfid:attendance_method:${method}`);
  },
  setOfflineQueueDepth(depth: number) {
    const client = getRedisClient();
    if (client && client.status === 'ready') {
      void client.set(`${METRICS_KEY_PREFIX}rfid:offline_queue_depth`, depth);
    } else {
      inProcessFallback.set('rfid:offline_queue_depth', depth);
    }
  },
  setOfflineEventAge(ageSeconds: number) {
    const client = getRedisClient();
    if (client && client.status === 'ready') {
      void client.set(`${METRICS_KEY_PREFIX}rfid:offline_event_age`, ageSeconds);
    } else {
      inProcessFallback.set('rfid:offline_event_age', ageSeconds);
    }
  },
  setReaderClockDrift(driftSeconds: number) {
    const client = getRedisClient();
    if (client && client.status === 'ready') {
      void client.set(`${METRICS_KEY_PREFIX}rfid:reader_clock_drift`, driftSeconds);
    } else {
      inProcessFallback.set('rfid:reader_clock_drift', driftSeconds);
    }
  },
  recordSync(durationSec: number) {
    void redisIncr('rfid:sync_duration_sum', durationSec);
    void redisIncr('rfid:sync_duration_count');
  },
  recordReaderStatus(status: string) {
    void redisIncr(`rfid:readers:${status}`);
  },
  recordCredential(status: string) {
    void redisIncr(`rfid:credentials:${status}`);
  },
};

/**
 * Authenticated Prometheus metrics endpoint renderer.
 * Aggregates counters from Redis so values are accurate across replicas.
 * Strictly requires Authorization: Bearer <METRICS_AUTH_TOKEN> header in production.
 */
export async function renderPrometheusMetrics(req?: Request): Promise<{ authorized: boolean; content: string }> {
  const requiredToken = process.env.METRICS_AUTH_TOKEN;

  if (process.env.NODE_ENV === 'production') {
    if (!requiredToken) {
      return { authorized: false, content: 'METRICS_AUTH_TOKEN_REQUIRED_IN_PRODUCTION' };
    }
    const authHeader = req?.headers.authorization;
    const providedToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    if (!providedToken || providedToken.length !== requiredToken.length || !crypto.timingSafeEqual(Buffer.from(providedToken), Buffer.from(requiredToken))) {
      return { authorized: false, content: 'UNAUTHORIZED_METRICS_ACCESS' };
    }
  }

  const lines: string[] = [];
  const pool = getDbPoolMetrics();

  lines.push('# HELP app_postgres_up PostgreSQL database connectivity health state (1=up, 0=down)');
  lines.push('# TYPE app_postgres_up gauge');
  lines.push(`app_postgres_up ${postgresUpGauge}`);

  lines.push('# HELP app_redis_up Redis cluster connectivity health state (1=up, 0=down)');
  lines.push('# TYPE app_redis_up gauge');
  lines.push(`app_redis_up ${redisUpGauge}`);

  lines.push('# HELP db_pool_connections_total Total active database pool connections');
  lines.push('# TYPE db_pool_connections_total gauge');
  lines.push(`db_pool_connections_total ${pool.totalCount}`);

  lines.push('# HELP db_pool_connections_idle Idle database pool connections');
  lines.push('# TYPE db_pool_connections_idle gauge');
  lines.push(`db_pool_connections_idle ${pool.idleCount}`);

  lines.push('# HELP db_pool_connections_waiting Waiting connection requests');
  lines.push('# TYPE db_pool_connections_waiting gauge');
  lines.push(`db_pool_connections_waiting ${pool.waitingCount}`);

  // Names required by the DbPoolSaturation rule. The gauges above are retained
  // for any existing dashboard that already references them.
  lines.push('# HELP app_db_pool_active_connections Active (non-idle) pooled database connections');
  lines.push('# TYPE app_db_pool_active_connections gauge');
  lines.push(`app_db_pool_active_connections ${Math.max(0, pool.totalCount - pool.idleCount)}`);

  lines.push('# HELP app_db_pool_max_connections Configured maximum size of the application database pool');
  lines.push('# TYPE app_db_pool_max_connections gauge');
  lines.push(`app_db_pool_max_connections ${pool.maxAllowed}`);

  // HTTP request counters (aggregated across replicas via Redis)
  lines.push('# HELP http_requests_total Total HTTP requests (aggregated across replicas via Redis)');
  lines.push('# TYPE http_requests_total counter');
  const httpKeys = await redisGetByPattern('http:');
  for (const [key, count] of httpKeys.entries()) {
    if (!key.endsWith(':count')) continue;
    const parts = key.replace(/^http:/, '').replace(/:count$/, '').split(':');
    if (parts.length >= 3) {
      const [method, ...rest] = parts;
      const status = rest[rest.length - 1];
      const path = rest.slice(0, -1).join(':');
      lines.push(`http_requests_total{method="${method}",path="${path}",status="${status}"} ${count}`);
    }
  }

  lines.push('# HELP http_request_duration_seconds HTTP request latency in seconds');
  lines.push('# TYPE http_request_duration_seconds histogram');
  for (let i = 0; i < HTTP_DURATION_BUCKETS.length; i += 1) {
    lines.push(`http_request_duration_seconds_bucket{le="${HTTP_DURATION_BUCKETS[i]}"} ${httpDurationBucketCounts[i]}`);
  }
  lines.push(`http_request_duration_seconds_bucket{le="+Inf"} ${httpDurationCountTotal}`);
  lines.push(`http_request_duration_seconds_sum ${httpDurationSumTotal}`);
  lines.push(`http_request_duration_seconds_count ${httpDurationCountTotal}`);

  // --- Durability Metrics ---
  // Absent rather than zero-filled when the underlying artefact does not exist,
  // so a freshly installed appliance does not raise alarms before its first
  // backup cycle completes.
  const backup = getBackupSnapshot();

  lines.push('# HELP app_backup_present Whether any local encrypted backup exists (1=yes, 0=no)');
  lines.push('# TYPE app_backup_present gauge');
  lines.push(`app_backup_present ${backup.present ? 1 : 0}`);

  if (backup.latestTimestampSeconds !== null) {
    lines.push('# HELP app_backup_latest_timestamp_seconds Unix timestamp of the newest local encrypted backup');
    lines.push('# TYPE app_backup_latest_timestamp_seconds gauge');
    lines.push(`app_backup_latest_timestamp_seconds ${backup.latestTimestampSeconds}`);
  }

  if (backup.verificationStatus !== null) {
    lines.push('# HELP app_backup_verification_status Integrity state of the newest backup (1=checksum recorded, 0=manifest missing or unreadable)');
    lines.push('# TYPE app_backup_verification_status gauge');
    lines.push(`app_backup_verification_status ${backup.verificationStatus}`);
  }

  if (backup.restoreDrillTimestampSeconds !== null) {
    lines.push('# HELP app_restore_drill_latest_timestamp_seconds Unix timestamp of the last completed restore drill');
    lines.push('# TYPE app_restore_drill_latest_timestamp_seconds gauge');
    lines.push(`app_restore_drill_latest_timestamp_seconds ${backup.restoreDrillTimestampSeconds}`);
  }

  lines.push('# HELP app_backup_offsite_configured Whether off-site replication is configured (1=yes, 0=no)');
  lines.push('# TYPE app_backup_offsite_configured gauge');
  lines.push(`app_backup_offsite_configured ${backup.offsiteConfigured ? 1 : 0}`);

  if (backup.offsiteStatus !== null) {
    lines.push('# HELP app_backup_offsite_status Result of the most recent off-site replication attempt (1=success, 0=failed)');
    lines.push('# TYPE app_backup_offsite_status gauge');
    lines.push(`app_backup_offsite_status ${backup.offsiteStatus}`);
  }

  if (backup.offsiteTimestampSeconds !== null) {
    lines.push('# HELP app_backup_offsite_latest_timestamp_seconds Unix timestamp of the newest verified off-site copy');
    lines.push('# TYPE app_backup_offsite_latest_timestamp_seconds gauge');
    lines.push(`app_backup_offsite_latest_timestamp_seconds ${backup.offsiteTimestampSeconds}`);
  }

  // --- RFID Metrics (aggregated across replicas via Redis) ---
  lines.push('# HELP rfid_scans_total Total RFID scans (aggregated across replicas via Redis)');
  lines.push('# TYPE rfid_scans_total counter');
  const rfidScanKeys = await redisGetByPattern('rfid:scans:');
  for (const [key, count] of rfidScanKeys.entries()) {
    const parts = key.replace(/^rfid:scans:/, '').split(':');
    if (parts.length >= 2) {
      lines.push(`rfid_scans_total{decision="${parts[0]}",security_mode="${parts[1]}"} ${count}`);
    }
  }

  const scanDurSum = await redisGet('rfid:scan_duration_sum');
  const scanDurCount = await redisGet('rfid:scan_duration_count');
  lines.push('# HELP rfid_scan_duration_seconds RFID scan processing duration');
  lines.push('# TYPE rfid_scan_duration_seconds histogram');
  lines.push(`rfid_scan_duration_seconds_sum ${scanDurSum}`);
  lines.push(`rfid_scan_duration_seconds_count ${scanDurCount}`);

  const readerClockDrift = await redisGet('rfid:reader_clock_drift');
  lines.push('# HELP rfid_reader_clock_drift_seconds Reader clock drift in seconds');
  lines.push('# TYPE rfid_reader_clock_drift_seconds gauge');
  lines.push(`rfid_reader_clock_drift_seconds ${readerClockDrift}`);

  const offlineQueueDepth = await redisGet('rfid:offline_queue_depth');
  lines.push('# HELP rfid_offline_queue_depth Number of events in offline queues');
  lines.push('# TYPE rfid_offline_queue_depth gauge');
  lines.push(`rfid_offline_queue_depth ${offlineQueueDepth}`);

  const offlineEventAge = await redisGet('rfid:offline_event_age');
  lines.push('# HELP rfid_offline_event_age_seconds Age of oldest offline event');
  lines.push('# TYPE rfid_offline_event_age_seconds gauge');
  lines.push(`rfid_offline_event_age_seconds ${offlineEventAge}`);

  const syncDurSum = await redisGet('rfid:sync_duration_sum');
  const syncDurCount = await redisGet('rfid:sync_duration_count');
  lines.push('# HELP rfid_sync_duration_seconds Duration of offline sync operations');
  lines.push('# TYPE rfid_sync_duration_seconds histogram');
  lines.push(`rfid_sync_duration_seconds_sum ${syncDurSum}`);
  lines.push(`rfid_sync_duration_seconds_count ${syncDurCount}`);

  const rfidCredKeys = await redisGetByPattern('rfid:credentials:');
  lines.push('# HELP rfid_credentials_total Total credentials by status');
  lines.push('# TYPE rfid_credentials_total gauge');
  for (const [key, count] of rfidCredKeys.entries()) {
    const status = key.replace(/^rfid:credentials:/, '');
    lines.push(`rfid_credentials_total{status="${status}"} ${count}`);
  }

  const replayAttempts = await redisGet('rfid:replay_attempts');
  lines.push('# HELP rfid_replay_attempts_total Total replay attempts detected');
  lines.push('# TYPE rfid_replay_attempts_total counter');
  lines.push(`rfid_replay_attempts_total ${replayAttempts}`);

  const unknownCardAttempts = await redisGet('rfid:unknown_card_attempts');
  lines.push('# HELP rfid_unknown_card_attempts_total Total unknown card attempts');
  lines.push('# TYPE rfid_unknown_card_attempts_total counter');
  lines.push(`rfid_unknown_card_attempts_total ${unknownCardAttempts}`);

  const methodKeys = await redisGetByPattern('rfid:attendance_method:');
  lines.push('# HELP attendance_by_capture_method_total Attendance events by method');
  lines.push('# TYPE attendance_by_capture_method_total counter');
  for (const [key, count] of methodKeys.entries()) {
    const method = key.replace(/^rfid:attendance_method:/, '');
    lines.push(`attendance_by_capture_method_total{method="${method}"} ${count}`);
  }

  return { authorized: true, content: lines.join('\n') + '\n' };
}
