import { Router, Response } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { tenantHandler } from '../middleware/tenantHandler';
import { readerAuthMiddleware, ReaderAuthenticatedRequest } from '../middleware/readerAuthMiddleware';
import { scanService } from '../services/rfid/scanService';
import { credentialService } from '../services/rfid/credentialService';
import { readerService } from '../services/rfid/readerService';
import { offlineService } from '../services/rfid/offlineService';
import { db } from '../db';
import { rfidScanEvents, rfidReaders } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { rateLimitPolicies } from '../middleware/distributedRateLimiter';

export const rfidRouter = Router();

// ============================================================================
// SCAN ENDPOINT (Reader-authenticated)
// ============================================================================
rfidRouter.post(
  '/:schoolId/rfid/scans',
  readerAuthMiddleware,
  rateLimitPolicies.rfidScan,
  async (req: ReaderAuthenticatedRequest, res: Response) => {
    try {
      const clientEventId = req.body.clientEventId;
      const nonce = req.body.nonce;
      const readerTimestamp = (req.headers['x-reader-timestamp'] as string) || req.body.readerTimestamp;
      const signature = (req.headers['x-reader-signature'] as string) || req.body.signature;

      if (!clientEventId || !nonce || !readerTimestamp || !signature) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing mandatory signed envelope fields (clientEventId, nonce, readerTimestamp, signature)' });
      }

      const envelope = {
        version: req.body.version || 1,
        schoolId: req.params.schoolId,
        readerId: (req.headers['x-reader-id'] as string) || req.body.readerId,
        credentialDigest: req.body.credentialDigest,
        secureProof: req.body.secureProof,
        readerTimestamp,
        sequenceNumber: req.body.sequenceNumber,
        nonce,
        direction: req.body.direction || 'NONE',
        attendanceSessionId: req.body.attendanceSessionId,
        securityMode: req.body.securityMode || 'SECURE',
        signature,
        clientEventId,
        isOffline: req.body.isOffline || false,
      };

      const result = await scanService.processScan(envelope);
      return res.status(result.decision === 'ACCEPTED' ? 200 : 400).json(result);
    } catch (error: any) {
      console.error('Scan processing API error:', error);
      return res.status(500).json({ error: 'SCAN_PROCESSING_FAILED', message: error.message });
    }
  }
);

// ============================================================================
// CREDENTIAL MANAGEMENT (User-authenticated, tenant-scoped)
// ============================================================================
rfidRouter.post(
  '/:schoolId/rfid/credentials/enroll',
  rateLimitPolicies.rfidEnrollment,
  requireAuth,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR']),
  tenantHandler(async ({ req, schoolId, user }) => {
    try {
      const { studentId, credentialDigest, securityMode, keyVersion, expiresAt } = req.body;
      const credential = await credentialService.enrollCredential({
        schoolId,
        studentId,
        credentialDigest,
        securityMode: securityMode || 'SECURE',
        keyVersion: keyVersion || 1,
        operatorUserId: user.id,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });
      return { status: 201, body: { success: true, credential } };
    } catch (error: any) {
      return { status: 400, body: { success: false, error: error.message } };
    }
  })
);

rfidRouter.get(
  '/:schoolId/rfid/credentials',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR']),
  tenantHandler(async ({ req, schoolId }) => {
    try {
      const studentId = req.query.studentId as string;
      if (studentId) {
        const credentials = await credentialService.getCredentialHistory(schoolId, studentId);
        return { status: 200, body: { success: true, credentials } };
      }
      return { status: 200, body: { success: true, credentials: [] } };
    } catch (error: any) {
      return { status: 500, body: { success: false, error: error.message } };
    }
  })
);

rfidRouter.get(
  '/:schoolId/rfid/credentials/:credentialId',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR']),
  tenantHandler(async ({ req, schoolId }) => {
    try {
      const credential = await credentialService.getCredentialById(req.params.credentialId, schoolId);
      if (!credential) return { status: 404, body: { success: false, error: 'Credential not found' } };
      return { status: 200, body: { success: true, credential } };
    } catch (error: any) {
      return { status: 500, body: { success: false, error: error.message } };
    }
  })
);

rfidRouter.post(
  '/:schoolId/rfid/credentials/:credentialId/activate',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR']),
  tenantHandler(async ({ req, schoolId, user }) => {
    try {
      const credential = await credentialService.activateCredential(
        req.params.credentialId,
        schoolId,
        user.id
      );
      return { status: 200, body: { success: true, credential } };
    } catch (error: any) {
      return { status: 400, body: { success: false, error: error.message } };
    }
  })
);

rfidRouter.post(
  '/:schoolId/rfid/credentials/:credentialId/suspend',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR']),
  tenantHandler(async ({ req, schoolId, user }) => {
    try {
      const { reason } = req.body;
      const credential = await credentialService.suspendCredential(
        req.params.credentialId,
        schoolId,
        reason || 'Suspended by admin',
        user.id
      );
      return { status: 200, body: { success: true, credential } };
    } catch (error: any) {
      return { status: 400, body: { success: false, error: error.message } };
    }
  })
);

rfidRouter.post(
  '/:schoolId/rfid/credentials/:credentialId/reactivate',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR']),
  tenantHandler(async ({ req, schoolId, user }) => {
    try {
      const credential = await credentialService.reactivateCredential(
        req.params.credentialId,
        schoolId,
        user.id
      );
      return { status: 200, body: { success: true, credential } };
    } catch (error: any) {
      return { status: 400, body: { success: false, error: error.message } };
    }
  })
);

rfidRouter.post(
  '/:schoolId/rfid/credentials/:credentialId/revoke',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR']),
  tenantHandler(async ({ req, schoolId, user }) => {
    try {
      const { reason } = req.body;
      const credential = await credentialService.revokeCredential(
        req.params.credentialId,
        schoolId,
        reason || 'Revoked by admin',
        user.id
      );
      return { status: 200, body: { success: true, credential } };
    } catch (error: any) {
      return { status: 400, body: { success: false, error: error.message } };
    }
  })
);

rfidRouter.post(
  '/:schoolId/rfid/credentials/:credentialId/replace',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR']),
  tenantHandler(async ({ req, schoolId, user }) => {
    try {
      const { newCredentialDigest, securityMode, keyVersion } = req.body;
      const credential = await credentialService.replaceCredential({
        oldCredentialId: req.params.credentialId,
        newCredentialDigest,
        schoolId,
        securityMode: securityMode || 'SECURE',
        keyVersion: keyVersion || 1,
        operatorUserId: user.id,
      });
      return { status: 200, body: { success: true, credential } };
    } catch (error: any) {
      return { status: 400, body: { success: false, error: error.message } };
    }
  })
);

rfidRouter.post(
  '/:schoolId/rfid/credentials/bulk-enroll',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR']),
  tenantHandler(async ({ req, schoolId, user }) => {
    try {
      const { entries } = req.body;
      const results = await credentialService.bulkEnroll({
        schoolId,
        entries: entries || [],
        operatorUserId: user.id,
      });
      return { status: 200, body: { success: true, results } };
    } catch (error: any) {
      return { status: 400, body: { success: false, error: error.message } };
    }
  })
);

rfidRouter.get(
  '/:schoolId/rfid/credentials/student/:studentId/history',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR']),
  tenantHandler(async ({ req, schoolId }) => {
    try {
      const credentials = await credentialService.getCredentialHistory(schoolId, req.params.studentId);
      return { status: 200, body: { success: true, credentials } };
    } catch (error: any) {
      return { status: 500, body: { success: false, error: error.message } };
    }
  })
);

// ============================================================================
// READER MANAGEMENT (User-authenticated, tenant-scoped)
// ============================================================================
rfidRouter.post(
  '/:schoolId/rfid/readers/register',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  tenantHandler(async ({ req, schoolId, user }) => {
    try {
      const reader = await readerService.registerReader({
        schoolId,
        deviceId: req.body.deviceId,
        name: req.body.name,
        location: req.body.location,
        directionMode: req.body.directionMode,
        readerModel: req.body.readerModel,
        firmwareVersion: req.body.firmwareVersion,
        adapterType: req.body.adapterType || 'GATEWAY',
        securityCapability: req.body.securityCapability,
        certificateFingerprint: req.body.certificateFingerprint,
        actorId: user.id,
      });
      return { status: 201, body: { success: true, reader } };
    } catch (error: any) {
      return { status: 400, body: { success: false, error: error.message } };
    }
  })
);

rfidRouter.get(
  '/:schoolId/rfid/readers',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  tenantHandler(async ({ req, schoolId }) => {
    try {
      const readers = await readerService.listReaders(schoolId, {
        status: req.query.status as any,
      });
      return { status: 200, body: { success: true, readers } };
    } catch (error: any) {
      return { status: 500, body: { success: false, error: error.message } };
    }
  })
);

rfidRouter.get(
  '/:schoolId/rfid/readers/:readerId',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  tenantHandler(async ({ req, schoolId }) => {
    try {
      const reader = await readerService.getReaderById(req.params.readerId, schoolId);
      if (!reader) return { status: 404, body: { success: false, error: 'Reader not found' } };
      return { status: 200, body: { success: true, reader } };
    } catch (error: any) {
      return { status: 500, body: { success: false, error: error.message } };
    }
  })
);

rfidRouter.post(
  '/:schoolId/rfid/readers/:readerId/approve',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  tenantHandler(async ({ req, schoolId, user }) => {
    try {
      const reader = await readerService.approveReader(req.params.readerId, schoolId, user.id);
      return { status: 200, body: { success: true, reader } };
    } catch (error: any) {
      return { status: 400, body: { success: false, error: error.message } };
    }
  })
);

rfidRouter.post(
  '/:schoolId/rfid/readers/:readerId/suspend',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  tenantHandler(async ({ req, schoolId, user }) => {
    try {
      const reader = await readerService.suspendReader(
        req.params.readerId,
        schoolId,
        req.body.reason || 'Suspended by admin',
        user.id
      );
      return { status: 200, body: { success: true, reader } };
    } catch (error: any) {
      return { status: 400, body: { success: false, error: error.message } };
    }
  })
);

rfidRouter.post(
  '/:schoolId/rfid/readers/:readerId/revoke',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  tenantHandler(async ({ req, schoolId, user }) => {
    try {
      const reader = await readerService.revokeReader(
        req.params.readerId,
        schoolId,
        req.body.reason || 'Revoked by admin',
        user.id
      );
      return { status: 200, body: { success: true, reader } };
    } catch (error: any) {
      return { status: 400, body: { success: false, error: error.message } };
    }
  })
);

rfidRouter.patch(
  '/:schoolId/rfid/readers/:readerId',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  tenantHandler(async ({ req, schoolId }) => {
    try {
      const reader = await readerService.updateReaderConfig(req.params.readerId, schoolId, req.body);
      return { status: 200, body: { success: true, reader } };
    } catch (error: any) {
      return { status: 400, body: { success: false, error: error.message } };
    }
  })
);

rfidRouter.get(
  '/:schoolId/rfid/readers/:readerId/health',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  tenantHandler(async ({ req, schoolId }) => {
    try {
      const health = await readerService.getReaderHealth(req.params.readerId, schoolId);
      return { status: 200, body: { success: true, health } };
    } catch (error: any) {
      return { status: 500, body: { success: false, error: error.message } };
    }
  })
);

// Reader-authenticated heartbeat
rfidRouter.post(
  '/:schoolId/rfid/readers/:readerId/heartbeat',
  readerAuthMiddleware,
  async (req: ReaderAuthenticatedRequest, res: Response) => {
    try {
      await readerService.recordHeartbeat(req.params.readerId, req.params.schoolId);
      return res.json({ success: true, status: 'ok' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ============================================================================
// OFFLINE SYNC (Reader-authenticated)
// ============================================================================
rfidRouter.get(
  '/:schoolId/rfid/offline/roster',
  readerAuthMiddleware,
  async (req: ReaderAuthenticatedRequest, res: Response) => {
    try {
      const roster = await offlineService.generateOfflineRoster(req.params.schoolId);
      return res.json({ success: true, roster });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

rfidRouter.post(
  '/:schoolId/rfid/offline/sync',
  readerAuthMiddleware,
  async (req: ReaderAuthenticatedRequest, res: Response) => {
    try {
      const results = await offlineService.syncOfflineEvents(req.params.schoolId, req.body.events || []);
      return res.json({ success: true, results });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

rfidRouter.get(
  '/:schoolId/rfid/offline/policy',
  readerAuthMiddleware,
  async (req: ReaderAuthenticatedRequest, res: Response) => {
    try {
      const policy = offlineService.getOfflinePolicy(req.params.schoolId);
      return res.json({ success: true, policy });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ============================================================================
// REPORTS (User-authenticated)
// ============================================================================
rfidRouter.get(
  '/:schoolId/rfid/reports/scans',
  requireAuth,
  tenantHandler(async ({ schoolId }) => {
    try {
      const scans = await db
        .select()
        .from(rfidScanEvents)
        .where(eq(rfidScanEvents.schoolId, schoolId))
        .orderBy(desc(rfidScanEvents.scanTimestamp))
        .limit(100);

      return { status: 200, body: { success: true, report: scans } };
    } catch (error: any) {
      return { status: 500, body: { success: false, error: error.message } };
    }
  })
);

rfidRouter.post(
  '/:schoolId/rfid/readers/:readerId/provision',
  requireAuth,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  tenantHandler(async ({ req, schoolId, user }) => {
    try {
      const provisioning = await readerService.provisionReader(req.params.readerId, schoolId, user.id);
      return { status: 200, body: { success: true, provisioning } };
    } catch (error: any) {
      return { status: 400, body: { success: false, error: error.message } };
    }
  })
);

rfidRouter.get(
  '/:schoolId/rfid/reports/readers',
  requireAuth,
  tenantHandler(async ({ schoolId }) => {
    try {
      const readers = await readerService.listReaders(schoolId);
      return { status: 200, body: { success: true, report: readers } };
    } catch (error: any) {
      return { status: 500, body: { success: false, error: error.message } };
    }
  })
);

rfidRouter.get(
  '/:schoolId/rfid/reports/rejections',
  requireAuth,
  tenantHandler(async ({ schoolId }) => {
    try {
      const rejections = await db
        .select()
        .from(rfidScanEvents)
        .where(and(eq(rfidScanEvents.schoolId, schoolId)))
        .orderBy(desc(rfidScanEvents.scanTimestamp))
        .limit(100);

      const filtered = rejections.filter((r: any) => r.decision !== 'ACCEPTED');
      return { status: 200, body: { success: true, report: filtered } };
    } catch (error: any) {
      return { status: 500, body: { success: false, error: error.message } };
    }
  })
);
