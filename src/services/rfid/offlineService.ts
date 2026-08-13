import { db } from '../../db';
import { rfidCredentials } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { ScanEnvelope, processScan } from './scanService';
import { getRedisClient } from '../redisService';
import crypto from 'crypto';

export async function generateOfflineRoster(schoolId: string) {
  const activeCredentials = await db
    .select({
      credentialDigest: rfidCredentials.credentialDigest,
      studentId: rfidCredentials.studentId,
      securityMode: rfidCredentials.securityMode,
      status: rfidCredentials.status,
    })
    .from(rfidCredentials)
    .where(and(eq(rfidCredentials.schoolId, schoolId), eq(rfidCredentials.status, 'ACTIVE')));

  const revokedCredentials = await db
    .select({
      credentialDigest: rfidCredentials.credentialDigest,
    })
    .from(rfidCredentials)
    .where(and(eq(rfidCredentials.schoolId, schoolId), eq(rfidCredentials.status, 'REVOKED')));

  const generatedAt = new Date();
  const maxAgeHours = parseInt(process.env.RFID_MAX_ROSTER_AGE_HOURS || '4', 10);
  const expiresAt = new Date(generatedAt.getTime() + maxAgeHours * 60 * 60 * 1000);

  const payload = {
    version: 1,
    schoolId,
    generatedAt: generatedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    activeCredentials,
    revokedDigests: revokedCredentials.map((c: any) => c.credentialDigest),
  };

  const secret = process.env.RFID_HMAC_SECRET || (process.env.NODE_ENV === 'test' ? 'test-secret-32-chars-length-environment' : undefined);
  if (!secret) {
    throw new Error('RFID_HMAC_SECRET is missing in server configuration for offline roster signing');
  }
  const signature = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');

  return {
    ...payload,
    signature,
  };
}

export function getOfflinePolicy(schoolId: string) {
  return {
    maxOfflineDurationHours: parseInt(process.env.RFID_MAX_OFFLINE_DURATION_HOURS || '24', 10),
    maxRosterAgeHours: parseInt(process.env.RFID_MAX_ROSTER_AGE_HOURS || '4', 10),
    maxClockDriftMs: parseInt(process.env.RFID_MAX_CLOCK_SKEW_MS || '30000', 10),
    queueCapacity: parseInt(process.env.RFID_OFFLINE_QUEUE_CAPACITY || '10000', 10),
    failMode: (process.env.RFID_OFFLINE_FAIL_MODE as 'OPEN' | 'CLOSED') || 'CLOSED',
  };
}

export async function syncOfflineEvents(schoolId: string, events: ScanEnvelope[]) {
  if (!events || !Array.isArray(events)) return [];
  if (events.length > 10000) {
    throw new Error('Offline sync batch size exceeds maximum 10,000 limit');
  }

  const policy = getOfflinePolicy(schoolId);
  const maxOfflineMs = policy.maxOfflineDurationHours * 60 * 60 * 1000;
  const now = Date.now();

  const results: any[] = [];
  const validEvents: ScanEnvelope[] = [];

  for (const event of events) {
    const eventTime = new Date(event.readerTimestamp).getTime();
    if (isNaN(eventTime) || now - eventTime > maxOfflineMs) {
      results.push({
        decision: 'CLOCK_SKEW',
        rejectionCode: 'OFFLINE_SCAN_EXPIRED',
        scanEventId: event.clientEventId,
        processingLatencyMs: 0,
      });
    } else {
      validEvents.push(event);
    }
  }

  const sortedEvents = validEvents.sort(
    (a, b) => new Date(a.readerTimestamp).getTime() - new Date(b.readerTimestamp).getTime()
  );

  const chunkSize = 100;
  for (let i = 0; i < sortedEvents.length; i += chunkSize) {
    const chunk = sortedEvents.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map(async (event) => {
        if (event.schoolId === schoolId) {
          return await processScan({ ...event, isOffline: true });
        }
        return { decision: 'WRONG_SCHOOL', rejectionCode: 'SCHOOL_MISMATCH', processingLatencyMs: 0 };
      })
    );
    results.push(...chunkResults);
  }
  return results;
}

export async function getOfflineQueueStatus(schoolId: string, readerId: string) {
  const redis = getRedisClient();
  if (!redis) return { size: 0, oldestEventAgeMs: 0 };
  const key = `rfid:offline_queue_status:${schoolId}:${readerId}`;
  const statusStr = await redis.get(key);
  if (!statusStr) return { size: 0, oldestEventAgeMs: 0 };

  try {
    return JSON.parse(statusStr);
  } catch {
    return { size: 0, oldestEventAgeMs: 0 };
  }
}

export const offlineService = {
  generateOfflineRoster,
  getOfflinePolicy,
  syncOfflineEvents,
  getOfflineQueueStatus,
};
