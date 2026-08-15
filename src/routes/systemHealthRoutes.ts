import { Router, Response } from 'express';
import fs from 'node:fs';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { rateLimitPolicies } from '../middleware/distributedRateLimiter';
import { executeSql, db } from '../db';
import { getRedisClient } from '../services/redisService';
import { notificationJobs } from '../db/schema';
import { desc, isNotNull } from 'drizzle-orm';

export const systemHealthRouter = Router();

// GET /api/v1/system/health (SUPER_ADMIN only)
systemHealthRouter.get(
  '/health',
  rateLimitPolicies.generalApi,
  requireAuth,
  requireRole(['SUPER_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    let dbStatus: 'CONNECTED' | 'DISCONNECTED' = 'DISCONNECTED';
    try {
      await executeSql('SELECT 1');
      dbStatus = 'CONNECTED';
    } catch {
      dbStatus = 'DISCONNECTED';
    }

    let redisStatus: 'CONNECTED' | 'IN_MEMORY_FALLBACK' | 'DISCONNECTED' = 'IN_MEMORY_FALLBACK';
    try {
      const redis = getRedisClient();
      if (redis && typeof redis.ping === 'function') {
        const pingRes = await Promise.race([
          redis.ping(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 1500)),
        ]);
        redisStatus = pingRes === 'PONG' ? 'CONNECTED' : 'IN_MEMORY_FALLBACK';
      } else {
        redisStatus = process.env.ALLOW_IN_MEMORY_RATE_LIMITER === 'true' ? 'IN_MEMORY_FALLBACK' : 'DISCONNECTED';
      }
    } catch {
      redisStatus = process.env.ALLOW_IN_MEMORY_RATE_LIMITER === 'true' ? 'IN_MEMORY_FALLBACK' : 'DISCONNECTED';
    }

    // 1. Latest backup timestamp & manifest metadata
    let latestBackupTimestamp: string | null = null;
    let backupSizeBytes: number | null = null;
    let backupChecksumSha256: string | null = null;
    let backupAgeSeconds: number | null = null;

    const backupDir = process.env.BACKUP_DIR || (fs.existsSync('./backups') ? './backups' : '/backups');
    const backupLatestPath = `${backupDir}/LATEST`;
    const manifestLatestPath = `${backupDir}/LATEST_MANIFEST.json`;

    try {
      if (fs.existsSync(manifestLatestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestLatestPath, 'utf8'));
        if (manifest.timestamp) latestBackupTimestamp = manifest.timestamp;
        if (manifest.sizeBytes) backupSizeBytes = manifest.sizeBytes;
        if (manifest.checksumSha256) backupChecksumSha256 = manifest.checksumSha256;
      } else if (fs.existsSync(backupLatestPath)) {
        const rawTimestamp = fs.readFileSync(backupLatestPath, 'utf8').trim();
        if (rawTimestamp && !isNaN(Date.parse(rawTimestamp))) {
          latestBackupTimestamp = new Date(rawTimestamp).toISOString();
        }
      }
    } catch {
      // Non-filesystem fallback
    }
    if (!latestBackupTimestamp && process.env.LATEST_BACKUP_TIMESTAMP) {
      latestBackupTimestamp = process.env.LATEST_BACKUP_TIMESTAMP;
    }

    if (latestBackupTimestamp) {
      backupAgeSeconds = Math.max(0, Math.floor((Date.now() - new Date(latestBackupTimestamp).getTime()) / 1000));
    }

    // 2. Latest Restore Verification Status
    let latestRestoreVerifiedTimestamp: string | null = null;
    let restoreVerificationStatus: string | null = null;
    const restoreVerifiedPath = `${backupDir}/LATEST_RESTORE_VERIFIED`;
    try {
      if (fs.existsSync(restoreVerifiedPath)) {
        const restoreData = JSON.parse(fs.readFileSync(restoreVerifiedPath, 'utf8'));
        latestRestoreVerifiedTimestamp = restoreData.verifiedAt || null;
        restoreVerificationStatus = restoreData.status || null;
      }
    } catch {
      // Fallback
    }

    // 3. Migration journal version
    const migrationJournalVersion = process.env.SCHEMA_VERSION || '0014_school_slug_tenancy';

    // 4. KMS Provider Mode (Never returns key material)
    const kmsProviderMode = process.env.KMS_PROVIDER
      ? process.env.KMS_PROVIDER
      : process.env.KMS_MASTER_KEY
      ? 'LOCAL_AES_256_GCM'
      : 'LOCAL_SOFTWARE_DERIVED';

    // 5. RFID Card Proof Enforcement State
    const rfidCardProofEnforced = process.env.STRICT_CARD_PROOF !== 'false';

    // 6. Worker Heartbeat age in seconds (from heartbeat file or claimed notification jobs)
    let workerHeartbeatAgeSeconds: number | null = null;
    const heartbeatPath = process.env.WORKER_HEARTBEAT_FILE || '/tmp/worker-heartbeat';
    try {
      if (fs.existsSync(heartbeatPath)) {
        const stats = fs.statSync(heartbeatPath);
        workerHeartbeatAgeSeconds = Math.max(0, Math.floor((Date.now() - stats.mtimeMs) / 1000));
      }
    } catch {
      // Fallback to notification jobs
    }

    if (workerHeartbeatAgeSeconds === null) {
      try {
        const [latestJob] = await db
          .select({ claimedAt: notificationJobs.claimedAt })
          .from(notificationJobs)
          .where(isNotNull(notificationJobs.claimedAt))
          .orderBy(desc(notificationJobs.claimedAt))
          .limit(1);

        if (latestJob?.claimedAt) {
          workerHeartbeatAgeSeconds = Math.max(0, Math.floor((Date.now() - new Date(latestJob.claimedAt).getTime()) / 1000));
        }
      } catch {
        workerHeartbeatAgeSeconds = null;
      }
    }

    // Calculate honest system degradation:
    // Degraded when: DB down, Redis disconnected, backup older than 36h, worker heartbeat older than 120s
    let backupIsStale = false;
    if (backupAgeSeconds !== null) {
      if (backupAgeSeconds > 36 * 3600) {
        backupIsStale = true;
      }
    } else if (process.env.NODE_ENV === 'production') {
      backupIsStale = true;
    }

    let workerIsStale = false;
    if (workerHeartbeatAgeSeconds !== null && workerHeartbeatAgeSeconds > 120) {
      workerIsStale = true;
    }

    const isDegraded =
      dbStatus !== 'CONNECTED' ||
      redisStatus === 'DISCONNECTED' ||
      backupIsStale ||
      workerIsStale;

    const overallStatus: 'HEALTHY' | 'DEGRADED' = isDegraded ? 'DEGRADED' : 'HEALTHY';

    return res.json({
      success: true,
      status: overallStatus,
      telemetry: {
        db: dbStatus,
        redis: redisStatus,
        latestBackupTimestamp,
        backupAgeSeconds,
        backupSizeBytes,
        backupChecksumSha256,
        latestRestoreVerifiedTimestamp,
        restoreVerificationStatus,
        migrationJournalVersion,
        kmsProviderMode,
        rfidCardProofEnforced,
        workerHeartbeatAgeSeconds,
      },
      timestamp: new Date().toISOString(),
    });
  }
);
