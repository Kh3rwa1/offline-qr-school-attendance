import { Router, Response } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { rateLimitPolicies } from '../middleware/distributedRateLimiter';
import { executeSql, db } from '../db';
import { getRedisClient } from '../services/redisService';
import { notificationJobs } from '../db/schema';
import { desc } from 'drizzle-orm';

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

    // Latest backup timestamp: read from environment or verified backup metadata
    const latestBackupTimestamp = process.env.LATEST_BACKUP_TIMESTAMP || null;

    // Migration journal version
    const migrationJournalVersion = process.env.SCHEMA_VERSION || '0009_strict_rls';

    // KMS Provider Mode (Never returns key material)
    const kmsProviderMode = process.env.KMS_PROVIDER
      ? process.env.KMS_PROVIDER
      : process.env.KMS_MASTER_KEY
      ? 'LOCAL_AES_256_GCM'
      : 'LOCAL_SOFTWARE_DERIVED';

    // RFID Card Proof Enforcement State
    const rfidCardProofEnforced = process.env.STRICT_CARD_PROOF !== 'false';

    // Worker Heartbeat age in seconds
    let workerHeartbeatAgeSeconds: number | null = null;
    try {
      const [latestJob] = await db
        .select({ claimedAt: notificationJobs.claimedAt, queuedAt: notificationJobs.queuedAt })
        .from(notificationJobs)
        .orderBy(desc(notificationJobs.claimedAt))
        .limit(1);

      if (latestJob?.claimedAt) {
        workerHeartbeatAgeSeconds = Math.max(0, Math.floor((Date.now() - new Date(latestJob.claimedAt).getTime()) / 1000));
      }
    } catch {
      workerHeartbeatAgeSeconds = null;
    }

    const isDegraded = dbStatus !== 'CONNECTED' || (redisStatus === 'DISCONNECTED');
    const overallStatus: 'HEALTHY' | 'DEGRADED' = isDegraded ? 'DEGRADED' : 'HEALTHY';

    return res.json({
      success: true,
      status: overallStatus,
      telemetry: {
        db: dbStatus,
        redis: redisStatus,
        latestBackupTimestamp,
        migrationJournalVersion,
        kmsProviderMode,
        rfidCardProofEnforced,
        workerHeartbeatAgeSeconds,
      },
      timestamp: new Date().toISOString(),
    });
  }
);
