import { Router, Response } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { tenantRoute } from '../http/tenantRoute';
import { readerAuthMiddleware, ReaderAuthenticatedRequest } from '../middleware/readerAuthMiddleware';
import { scanService } from '../services/rfid/scanService';
import { credentialService } from '../services/rfid/credentialService';
import { readerService } from '../services/rfid/readerService';
import { offlineService } from '../services/rfid/offlineService';
import { db, withTenantContext } from '../db';
import { rfidScanEvents, rfidReaders, rfidCredentials, students } from '../db/schema';
import { eq, and, desc, ne, sql } from 'drizzle-orm';
import { rateLimitPolicies } from '../middleware/distributedRateLimiter';

import { processZebraIotWebhook } from '../services/rfid/zebraIotConnector';
import { processZebraBatch } from '../services/rfid/ingest';
import { canonicalizeEpc, canonicalizeTid, computeEpcDigest, computeTidDigest, getEpcLastFour } from '../services/rfid/cryptoService';
import type { RawBodyRequest } from '../middleware/bodyParsers';
import { AppError, toAppError } from '../errors/AppError';
import { logError } from '../errors/logError';
import { generateReaderToken } from '../services/rfid/readerTokens';
import { writeAuditLog } from '../services/auditLogService';

export const rfidRouter = Router();



// ============================================================================
// ZEBRA FX9600 IOT CONNECTOR WEBHOOK INGEST ENDPOINT
// ============================================================================
rfidRouter.post(
  '/:schoolId/rfid/zebra/reads',
  rateLimitPolicies.rfidScan,
  async (req: any, res: Response) => {
    try {
      const rawBody = (req as RawBodyRequest).rawBody;
      if (!rawBody) throw new AppError('MALFORMED_BODY', 400, 'Request body required');
      if (process.env.RFID_INGEST_V2 === 'true') {
        const result = await processZebraBatch({
          schoolId: req.params.schoolId,
          rawBody,
          parsedBody: req.body,
          headers: req.headers,
        });
        return res.status(200).json(result);
      }
      const result = await processZebraIotWebhook({
        schoolId: req.params.schoolId,
        rawBody,
        parsedBody: req.body,
        headers: req.headers,
      });
      return res.status(200).json(result);
    } catch (err) {
      const e = toAppError(err);
      logError(req as any, e);
      return res.status(e.status).json({
        success: false,
        error: e.code,
        message: e.publicMessage,
        requestId: (req as any).id,
      });
    }
  }
);

// ============================================================================
// SCAN ENDPOINT (Reader-authenticated, Normalized Envelope)
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
        cardProof: req.body.cardProof,
        cardUid: req.body.cardUid,
        readerChallenge: req.body.readerChallenge,
        transactionCounter: req.body.transactionCounter,
      };

      const result = await scanService.processScan(envelope);
      return res.status(result.decision === 'ACCEPTED' ? 200 : 400).json(result);
    } catch (error: any) {
      console.error('Scan processing API error:', error);
      const message = process.env.NODE_ENV === 'production' ? 'An unexpected scan processing error occurred' : error.message;
      return res.status(500).json({ error: 'SCAN_PROCESSING_FAILED', message });
    }
  }
);

// ============================================================================
// CREDENTIAL MANAGEMENT (User-authenticated, tenant-scoped)
// ============================================================================
rfidRouter.post(
  '/:schoolId/rfid/credentials/enroll-epc',
  rateLimitPolicies.rfidEnrollment,
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR'],
    handler: async ({ req, schoolId, user }) => {
    try {
      const { studentId, epc, tid, expiresAt } = req.body;
      if (!studentId || !epc) {
        return { status: 400, body: { success: false, error: 'studentId and epc are required' } };
      }
      const canonical = canonicalizeEpc(epc);
      const credentialDigest = computeEpcDigest(canonical);
      const epcLastFour = getEpcLastFour(canonical);
      let tidDigest: string | undefined;
      if (tid && typeof tid === 'string') {
        const canonicalTid = canonicalizeTid(tid);
        tidDigest = computeTidDigest(canonicalTid);
      }

      const credential = await credentialService.enrollCredential({
        schoolId,
        studentId,
        credentialType: 'UHF_EPC_GEN2',
        credentialDigest,
        epcLastFour,
        tidDigest,
        securityMode: 'UHF_EPC',
        keyVersion: 1,
        operatorUserId: user.id,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      // Auto-activate for immediate use
      const activeCred = await credentialService.activateCredential(credential.id, schoolId, user.id);

      return {
        status: 201,
        body: {
          success: true,
          credential: {
            ...activeCred,
            epcLastFour,
          },
        },
      };
    } catch (error: any) {
      return { status: 400, body: { success: false, error: error.message } };
    }
      },
  })
);

rfidRouter.post(
  '/:schoolId/rfid/credentials/enroll',
  rateLimitPolicies.rfidEnrollment,
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR'],
    handler: async ({ req, schoolId, user }) => {
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
      },
  })
);

import { encodeCursor, decodeCursor, parseLimit } from '../services/paginationHelper';

rfidRouter.get(
  '/:schoolId/rfid/credentials',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR'],
    writes: false,
    handler: async ({ req, schoolId }) => {
    try {
      const studentId = req.query.studentId as string;
      if (studentId) {
        const credentials = await credentialService.getCredentialHistory(schoolId, studentId);
        return { status: 200, body: { success: true, credentials } };
      }
      const limit = parseLimit(req.query.limit as string, 50, 200);
      const cursor = req.query.cursor as string | undefined;
      const result = await credentialService.listAllCredentials(schoolId, { limit, cursor });
      return {
        status: 200,
        body: {
          success: true,
          credentials: (result as any).items || result,
          nextCursor: (result as any).nextCursor || null,
          hasMore: !!(result as any).hasMore,
          limit,
        },
      };
    } catch (error: any) {
      if (error.message === "INVALID_PAGINATION_CURSOR") {
        throw new AppError("INVALID_PAGINATION_CURSOR", 400, "The provided pagination cursor is invalid or malformed");
      }
      throw error;
    }
      },
  })
);

rfidRouter.get(
  '/:schoolId/rfid/credentials/:credentialId',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR'],
    writes: false,
    handler: async ({ req, schoolId }) => {
    const credential = await credentialService.getCredentialById(req.params.credentialId, schoolId);
      if (!credential) return { status: 404, body: { success: false, error: "Credential not found" } };
      return { status: 200, body: { success: true, credential } };
      },
  })
);

rfidRouter.post(
  '/:schoolId/rfid/credentials/:credentialId/activate',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR'],
    handler: async ({ req, schoolId, user }) => {
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
      },
  })
);

rfidRouter.post(
  '/:schoolId/rfid/credentials/:credentialId/suspend',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR'],
    handler: async ({ req, schoolId, user }) => {
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
      },
  })
);

rfidRouter.post(
  '/:schoolId/rfid/credentials/:credentialId/reactivate',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR'],
    handler: async ({ req, schoolId, user }) => {
    try {
      const { reason } = req.body || {};
      const credential = await credentialService.reactivateCredential(
        req.params.credentialId,
        schoolId,
        reason || 'Reactivated by operator/admin',
        user.id
      );
      return { status: 200, body: { success: true, credential } };
    } catch (error: any) {
      const statusCode = error.statusCode || 400;
      return { status: statusCode, body: { success: false, error: error.message } };
    }
      },
  })
);

rfidRouter.post(
  '/:schoolId/rfid/credentials/:credentialId/revoke',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR'],
    handler: async ({ req, schoolId, user }) => {
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
      },
  })
);

rfidRouter.post(
  '/:schoolId/rfid/credentials/:credentialId/replace',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR'],
    handler: async ({ req, schoolId, user }) => {
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
      },
  })
);

rfidRouter.post(
  '/:schoolId/rfid/credentials/bulk-enroll',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR'],
    handler: async ({ req, schoolId, user }) => {
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
      },
  })
);

rfidRouter.get(
  '/:schoolId/rfid/credentials/student/:studentId/history',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR'],
    writes: false,
    handler: async ({ req, schoolId }) => {
    const credentials = await credentialService.getCredentialHistory(schoolId, req.params.studentId);
      return { status: 200, body: { success: true, credentials } };
      },
  })
);

// ============================================================================
// READER MANAGEMENT (User-authenticated, tenant-scoped)
// ============================================================================
rfidRouter.post(
  '/:schoolId/rfid/readers/register',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR'],
    handler: async ({ req, schoolId, user }) => {
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
      },
  })
);

rfidRouter.get(
  '/:schoolId/rfid/readers',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR'],
    writes: false,
    handler: async ({ req, schoolId }) => {
    const readers = await readerService.listReaders(schoolId, {
        status: req.query.status as any,
      });
      return { status: 200, body: { success: true, readers } };
      },
  })
);

rfidRouter.get(
  '/:schoolId/rfid/readers/:readerId',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR'],
    writes: false,
    handler: async ({ req, schoolId }) => {
    const reader = await readerService.getReaderById(req.params.readerId, schoolId);
      if (!reader) return { status: 404, body: { success: false, error: "Reader not found" } };
      return { status: 200, body: { success: true, reader } };
      },
  })
);

rfidRouter.post(
  '/:schoolId/rfid/readers/:readerId/approve',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR'],
    handler: async ({ req, schoolId, user }) => {
    try {
      const reader = await readerService.approveReader(req.params.readerId, schoolId, user.id);
      return { status: 200, body: { success: true, reader } };
    } catch (error: any) {
      return { status: 400, body: { success: false, error: error.message } };
    }
      },
  })
);

rfidRouter.post(
  '/:schoolId/rfid/readers/:readerId/suspend',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR'],
    handler: async ({ req, schoolId, user }) => {
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
      },
  })
);

rfidRouter.post(
  '/:schoolId/rfid/readers/:readerId/revoke',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR'],
    handler: async ({ req, schoolId, user }) => {
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
      },
  })
);

rfidRouter.patch(
  '/:schoolId/rfid/readers/:readerId',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR'],
    handler: async ({ req, schoolId }) => {
    try {
      const reader = await readerService.updateReaderConfig(req.params.readerId, schoolId, req.body);
      return { status: 200, body: { success: true, reader } };
    } catch (error: any) {
      return { status: 400, body: { success: false, error: error.message } };
    }
      },
  })
);

rfidRouter.get(
  '/:schoolId/rfid/readers/:readerId/health',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR'],
    writes: false,
    handler: async ({ req, schoolId }) => {
    const health = await readerService.getReaderHealth(req.params.readerId, schoolId);
      return { status: 200, body: { success: true, health } };
      },
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
      return res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
      });
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
      return res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
      });
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
      return res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
      });
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
      return res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
      });
    }
  }
);

// ============================================================================
// REPORTS (User-authenticated)
// ============================================================================
rfidRouter.get(
  '/:schoolId/rfid/reports/scans',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR', 'TEACHER', 'REPORT_VIEWER'],
    writes: false,
    handler: async ({ req, schoolId }) => {
    try {
      const limit = parseLimit(req.query.limit as string, 50, 200);
      const cursor = req.query.cursor as string | undefined;
      const decoded = decodeCursor(cursor);

      const conditions: any[] = [eq(rfidScanEvents.schoolId, schoolId)];
      if (decoded) {
        const cursorTime = decoded.timestamp ? new Date(decoded.timestamp) : new Date(0);
        conditions.push(
          sql`(${rfidScanEvents.scanTimestamp} < ${cursorTime} OR (${rfidScanEvents.scanTimestamp} = ${cursorTime} AND ${rfidScanEvents.id} < ${decoded.id}))`
        );
      }

      const query = db
        .select({
          id: rfidScanEvents.id,
          scanTimestamp: rfidScanEvents.scanTimestamp,
          credentialId: rfidScanEvents.credentialId,
          studentId: rfidCredentials.studentId,
          readerId: rfidScanEvents.readerId,
          decision: rfidScanEvents.decision,
          antennaPort: rfidScanEvents.antennaPort,
          peakRssi: rfidScanEvents.peakRssi,
          epcLastFour: rfidScanEvents.epcLastFour,
          studentName: students.name,
          studentNameBn: students.nameBn,
          studentCode: students.studentCode,
          readerName: rfidReaders.name,
          readerLocation: rfidReaders.location,
        })
        .from(rfidScanEvents)
        .leftJoin(rfidCredentials, eq(rfidScanEvents.credentialId, rfidCredentials.id))
        .leftJoin(students, eq(rfidCredentials.studentId, students.id))
        .leftJoin(rfidReaders, eq(rfidScanEvents.readerId, rfidReaders.id))
        .where(and(...conditions))
        .orderBy(desc(rfidScanEvents.scanTimestamp), desc(rfidScanEvents.id))
        .limit(limit + 1);

      const rows = await query;
      const hasMore = rows.length > limit;
      const scans = hasMore ? rows.slice(0, limit) : rows;

      const formattedScans = scans.map((s: any) => ({
        id: s.id,
        time: s.scanTimestamp ? new Date(s.scanTimestamp).toISOString() : new Date().toISOString(),
        student: s.studentName || (s.epcLastFour ? `Badge •••• ${s.epcLastFour}` : 'Unknown Student'),
        studentName: s.studentName,
        studentNameBn: s.studentNameBn,
        studentCode: s.studentCode,
        studentId: s.studentId,
        decision: s.decision,
        method: 'Gate attendance',
        reader: s.readerName || 'Gate Reader',
        location: s.readerLocation || 'Main Gate',
        antennaPort: s.antennaPort,
        epcLastFour: s.epcLastFour,
      }));

      let nextCursor: string | null = null;
      if (hasMore && scans.length > 0) {
        const last = scans[scans.length - 1];
        nextCursor = encodeCursor({
          id: last.id,
          timestamp: last.scanTimestamp ? new Date(last.scanTimestamp).toISOString() : undefined,
        });
      }

      return {
        status: 200,
        body: {
          success: true,
          report: formattedScans,
          recentScans: formattedScans,
          scans: formattedScans,
          nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error: any) {
      if (error.message === "INVALID_PAGINATION_CURSOR") {
        throw new AppError("INVALID_PAGINATION_CURSOR", 400, "The provided pagination cursor is invalid or malformed");
      }
      throw error;
    }
      },
  })
);

rfidRouter.post(
  '/:schoolId/rfid/readers/:readerId/provision',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR'],
    handler: async ({ req, schoolId, user }) => {
    try {
      const provisioning = await readerService.provisionReader(req.params.readerId, schoolId, user.id);
      return { status: 200, body: { success: true, provisioning } };
    } catch (error: any) {
      return { status: 400, body: { success: false, error: error.message } };
    }
      },
  })
);

rfidRouter.post(
  '/:schoolId/rfid/readers/:readerId/rotate-token',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN'],
    handler: async ({ schoolId, req, user }) => {
    const { readerId } = req.params;
    const { token, hash, hint } = generateReaderToken();
    const updated = await withTenantContext(schoolId, (tx) =>
      tx
        .update(rfidReaders)
        .set({
          bearerTokenHash: hash,
          bearerTokenHint: hint,
          bearerTokenCreatedAt: new Date(),
        })
        .where(and(eq(rfidReaders.id, readerId), eq(rfidReaders.schoolId, schoolId)))
        .returning({ id: rfidReaders.id, name: rfidReaders.name })
    );

    if (!Array.isArray(updated) || !updated.length) return { status: 404, body: { success: false, error: 'READER_NOT_FOUND' } };

    await writeAuditLog({
      schoolId,
      actorId: user.id,
      action: 'RFID_READER_TOKEN_ROTATED',
      targetId: readerId,
    });

    return {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
      body: {
        success: true,
        readerId,
        token, // shown ONCE. Never retrievable again.
        tokenHint: hint,
        warning:
          'Copy this token into the Zebra IoT Connector now. It will not be shown again. The previous token is revoked immediately.',
      },
    };
      },
  })
);

rfidRouter.get(
  '/:schoolId/rfid/reports/readers',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR', 'TEACHER', 'REPORT_VIEWER'],
    writes: false,
    handler: async ({ schoolId }) => {
    const readers = await readerService.listReaders(schoolId);
      return { status: 200, body: { success: true, report: readers } };
      },
  })
);

rfidRouter.get(
  '/:schoolId/rfid/reports/rejections',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR', 'TEACHER', 'REPORT_VIEWER'],
    writes: false,
    handler: async ({ req, schoolId }) => {
    try {
      const limit = parseLimit(req.query.limit as string, 50, 200);
      const cursor = req.query.cursor as string | undefined;
      const decoded = decodeCursor(cursor);

      const conditions: any[] = [
        eq(rfidScanEvents.schoolId, schoolId),
        ne(rfidScanEvents.decision, 'ACCEPTED'),
      ];

      if (decoded) {
        const cursorTime = decoded.timestamp ? new Date(decoded.timestamp) : new Date(0);
        conditions.push(
          sql`(${rfidScanEvents.scanTimestamp} < ${cursorTime} OR (${rfidScanEvents.scanTimestamp} = ${cursorTime} AND ${rfidScanEvents.id} < ${decoded.id}))`
        );
      }

      const query = db
        .select()
        .from(rfidScanEvents)
        .where(and(...conditions))
        .orderBy(desc(rfidScanEvents.scanTimestamp), desc(rfidScanEvents.id))
        .limit(limit + 1);

      const rows = await query;
      const hasMore = rows.length > limit;
      const rejections = hasMore ? rows.slice(0, limit) : rows;

      let nextCursor: string | null = null;
      if (hasMore && rejections.length > 0) {
        const last = rejections[rejections.length - 1];
        nextCursor = encodeCursor({
          id: last.id,
          timestamp: last.scanTimestamp ? new Date(last.scanTimestamp).toISOString() : undefined,
        });
      }

      return {
        status: 200,
        body: {
          success: true,
          report: rejections,
          nextCursor,
          hasMore,
          limit,
        },
      };
    } catch (error: any) {
      if (error.message === "INVALID_PAGINATION_CURSOR") {
        throw new AppError("INVALID_PAGINATION_CURSOR", 400, "The provided pagination cursor is invalid or malformed");
      }
      throw error;
    }
      },
  })
);

rfidRouter.get(
  '/:schoolId/rfid/reports/summary',
  requireAuth,
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'RFID_OPERATOR', 'TEACHER', 'REPORT_VIEWER'],
    writes: false,
    handler: async ({ schoolId }) => {
    return await withTenantContext(schoolId, async (tx) => {
        const scans = await tx
          .select({
            id: rfidScanEvents.id,
            time: rfidScanEvents.scanTimestamp,
            decision: rfidScanEvents.decision,
            direction: rfidScanEvents.direction,
            studentId: rfidCredentials.studentId,
            studentName: students.name,
            readerId: rfidScanEvents.readerId,
            readerName: rfidReaders.name,
            location: rfidReaders.location,
            isOffline: rfidScanEvents.isOffline,
          })
          .from(rfidScanEvents)
          .leftJoin(rfidCredentials, eq(rfidScanEvents.credentialId, rfidCredentials.id))
          .leftJoin(students, eq(rfidCredentials.studentId, students.id))
          .leftJoin(rfidReaders, eq(rfidScanEvents.readerId, rfidReaders.id))
          .where(eq(rfidScanEvents.schoolId, schoolId))
          .orderBy(desc(rfidScanEvents.scanTimestamp))
          .limit(100);

        const readers = await tx
          .select({ status: rfidReaders.status })
          .from(rfidReaders)
          .where(eq(rfidReaders.schoolId, schoolId));

        const cards = await tx
          .select({ status: rfidCredentials.status })
          .from(rfidCredentials)
          .where(eq(rfidCredentials.schoolId, schoolId));

        const readersOnline = readers.filter((r: any) => r.status === 'ACTIVE').length;
        const readersOffline = readers.filter((r: any) => r.status === 'SUSPENDED' || r.status === 'REVOKED').length;
        const readersPending = readers.filter((r: any) => r.status === 'PENDING').length;

        const activeCards = cards.filter((c: any) => c.status === 'ACTIVE').length;
        const suspendedCards = cards.filter((c: any) => c.status === 'SUSPENDED').length;
        const revokedCards = cards.filter((c: any) => c.status === 'REVOKED').length;

        return {
          status: 200,
          body: {
            success: true,
            readersOnline,
            readersOffline,
            readersPending,
            activeCards,
            suspendedCards,
            revokedCards,
            queueDepth: null,
            recentScans: scans.map((s: any) => ({
              id: s.id,
              time: s.time,
              student: s.studentName || (s.studentId ? `Student #${s.studentId.slice(0, 6)}` : 'Unknown Tap'),
              reader: s.readerName || 'Gate Reader',
              location: s.location || 'Entrance Gate',
              decision: s.decision,
              direction: s.direction,
              method: s.isOffline ? 'OFFLINE_BUFFER' : 'RFID_SECURE',
            })),
          },
        };
      });
      },
  })
);
