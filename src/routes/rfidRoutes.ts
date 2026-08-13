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

export const rfidRouter = Router();

// ============================================================================
// SCAN ENDPOINT (Reader-authenticated)
// ============================================================================
rfidRouter.post(
  '/:schoolId/rfid/scans',
  readerAuthMiddleware,
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
  requireAuth,
  tenantHandler,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { studentId, credentialDigest, securityMode, keyVersion, expiresAt } = req.body;
      const credential = await credentialService.enrollCredential({
        schoolId: req.params.schoolId,
        studentId,
        credentialDigest,
        securityMode: securityMode || 'SECURE',
        keyVersion: keyVersion || 1,
        operatorUserId: req.user!.id,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });
      return res.status(201).json({ success: true, credential });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
);

rfidRouter.get(
  '/:schoolId/rfid/credentials',
  requireAuth,
  tenantHandler,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const studentId = req.query.studentId as string;
      if (studentId) {
        const credentials = await credentialService.getCredentialHistory(req.params.schoolId, studentId);
        return res.json({ success: true, credentials });
      }
      return res.json({ success: true, credentials: [] });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

rfidRouter.get(
  '/:schoolId/rfid/credentials/:credentialId',
  requireAuth,
  tenantHandler,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const credential = await credentialService.getCredentialById(req.params.credentialId, req.params.schoolId);
      if (!credential) return res.status(404).json({ success: false, error: 'Credential not found' });
      return res.json({ success: true, credential });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

rfidRouter.post(
  '/:schoolId/rfid/credentials/:credentialId/activate',
  requireAuth,
  tenantHandler,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const credential = await credentialService.activateCredential(
        req.params.credentialId,
        req.params.schoolId,
        req.user!.id
      );
      return res.json({ success: true, credential });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
);

rfidRouter.post(
  '/:schoolId/rfid/credentials/:credentialId/suspend',
  requireAuth,
  tenantHandler,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { reason } = req.body;
      const credential = await credentialService.suspendCredential(
        req.params.credentialId,
        req.params.schoolId,
        reason || 'Suspended by admin',
        req.user!.id
      );
      return res.json({ success: true, credential });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
);

rfidRouter.post(
  '/:schoolId/rfid/credentials/:credentialId/reactivate',
  requireAuth,
  tenantHandler,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const credential = await credentialService.reactivateCredential(
        req.params.credentialId,
        req.params.schoolId,
        req.user!.id
      );
      return res.json({ success: true, credential });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
);

rfidRouter.post(
  '/:schoolId/rfid/credentials/:credentialId/revoke',
  requireAuth,
  tenantHandler,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { reason } = req.body;
      const credential = await credentialService.revokeCredential(
        req.params.credentialId,
        req.params.schoolId,
        reason || 'Revoked by admin',
        req.user!.id
      );
      return res.json({ success: true, credential });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
);

rfidRouter.post(
  '/:schoolId/rfid/credentials/:credentialId/replace',
  requireAuth,
  tenantHandler,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { newCredentialDigest, securityMode, keyVersion } = req.body;
      const credential = await credentialService.replaceCredential({
        oldCredentialId: req.params.credentialId,
        newCredentialDigest,
        schoolId: req.params.schoolId,
        securityMode: securityMode || 'SECURE',
        keyVersion: keyVersion || 1,
        operatorUserId: req.user!.id,
      });
      return res.json({ success: true, credential });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
);

rfidRouter.post(
  '/:schoolId/rfid/credentials/bulk-enroll',
  requireAuth,
  tenantHandler,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { entries } = req.body;
      const results = await credentialService.bulkEnroll({
        schoolId: req.params.schoolId,
        entries: entries || [],
        operatorUserId: req.user!.id,
      });
      return res.json({ success: true, results });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
);

rfidRouter.get(
  '/:schoolId/rfid/credentials/student/:studentId/history',
  requireAuth,
  tenantHandler,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const credentials = await credentialService.getCredentialHistory(req.params.schoolId, req.params.studentId);
      return res.json({ success: true, credentials });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ============================================================================
// READER MANAGEMENT (User-authenticated, tenant-scoped)
// ============================================================================
rfidRouter.post(
  '/:schoolId/rfid/readers/register',
  requireAuth,
  tenantHandler,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reader = await readerService.registerReader({
        schoolId: req.params.schoolId,
        deviceId: req.body.deviceId,
        name: req.body.name,
        location: req.body.location,
        directionMode: req.body.directionMode,
        readerModel: req.body.readerModel,
        firmwareVersion: req.body.firmwareVersion,
        adapterType: req.body.adapterType || 'GATEWAY',
        securityCapability: req.body.securityCapability,
        certificateFingerprint: req.body.certificateFingerprint,
        actorId: req.user!.id,
      });
      return res.status(201).json({ success: true, reader });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
);

rfidRouter.get(
  '/:schoolId/rfid/readers',
  requireAuth,
  tenantHandler,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const readers = await readerService.listReaders(req.params.schoolId, {
        status: req.query.status as any,
      });
      return res.json({ success: true, readers });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

rfidRouter.get(
  '/:schoolId/rfid/readers/:readerId',
  requireAuth,
  tenantHandler,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reader = await readerService.getReaderById(req.params.readerId, req.params.schoolId);
      if (!reader) return res.status(404).json({ success: false, error: 'Reader not found' });
      return res.json({ success: true, reader });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

rfidRouter.post(
  '/:schoolId/rfid/readers/:readerId/approve',
  requireAuth,
  tenantHandler,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reader = await readerService.approveReader(req.params.readerId, req.params.schoolId, req.user!.id);
      return res.json({ success: true, reader });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
);

rfidRouter.post(
  '/:schoolId/rfid/readers/:readerId/suspend',
  requireAuth,
  tenantHandler,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reader = await readerService.suspendReader(
        req.params.readerId,
        req.params.schoolId,
        req.body.reason || 'Suspended by admin',
        req.user!.id
      );
      return res.json({ success: true, reader });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
);

rfidRouter.post(
  '/:schoolId/rfid/readers/:readerId/revoke',
  requireAuth,
  tenantHandler,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reader = await readerService.revokeReader(
        req.params.readerId,
        req.params.schoolId,
        req.body.reason || 'Revoked by admin',
        req.user!.id
      );
      return res.json({ success: true, reader });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
);

rfidRouter.patch(
  '/:schoolId/rfid/readers/:readerId',
  requireAuth,
  tenantHandler,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reader = await readerService.updateReaderConfig(req.params.readerId, req.params.schoolId, req.body);
      return res.json({ success: true, reader });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error.message });
    }
  }
);

rfidRouter.get(
  '/:schoolId/rfid/readers/:readerId/health',
  requireAuth,
  tenantHandler,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const health = await readerService.getReaderHealth(req.params.readerId, req.params.schoolId);
      return res.json({ success: true, health });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
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
  tenantHandler,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const scans = await db
        .select()
        .from(rfidScanEvents)
        .where(eq(rfidScanEvents.schoolId, req.params.schoolId))
        .orderBy(desc(rfidScanEvents.scanTimestamp))
        .limit(100);

      return res.json({ success: true, report: scans });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

rfidRouter.get(
  '/:schoolId/rfid/reports/readers',
  requireAuth,
  tenantHandler,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const readers = await db
        .select()
        .from(rfidReaders)
        .where(eq(rfidReaders.schoolId, req.params.schoolId));

      return res.json({ success: true, report: readers });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

rfidRouter.get(
  '/:schoolId/rfid/reports/rejections',
  requireAuth,
  tenantHandler,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const rejections = await db
        .select()
        .from(rfidScanEvents)
        .where(and(eq(rfidScanEvents.schoolId, req.params.schoolId)))
        .orderBy(desc(rfidScanEvents.scanTimestamp))
        .limit(100);

      const filtered = rejections.filter((r: any) => r.decision !== 'ACCEPTED');
      return res.json({ success: true, report: filtered });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);
