import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import { validateRequest, commonSchemas } from '../middleware/validate';
import { getOfflineRosterPackage, syncAttendanceEvents } from '../services/syncService';
import { validateDeviceStatus } from '../services/deviceService';

const router = Router({ mergeParams: true });

const syncBatchSchema = z.object({
  deviceIdentifier: z.string().min(1, 'DEVICE_IDENTIFIER_REQUIRED'),
  sessions: z
    .array(
      z.object({
        clientSessionId: commonSchemas.uuid,
        classSectionId: commonSchemas.uuid,
        sessionDate: commonSchemas.isoDate,
        sessionType: commonSchemas.sessionType.optional(),
      })
    )
    .max(20, 'Maximum 20 session payloads allowed per sync batch')
    .optional(),
  events: z
    .array(
      z.object({
        clientEventId: z.string().min(1, 'clientEventId required'),
        sessionId: commonSchemas.uuid.optional(),
        clientSessionId: commonSchemas.uuid.optional(),
        studentId: commonSchemas.uuid.optional(),
        rawToken: z.string().optional(),
        eventType: z.string().optional().default('QR_SCANNED'),
        statusValue: commonSchemas.attendanceStatus.optional().default('PRESENT'),
        clientTimestamp: commonSchemas.isoTimestamp,
        source: commonSchemas.scanSource.optional().default('CAMERA'),
        metadata: z.record(z.string(), z.any()).optional(),
      })
    )
    .min(1, 'At least 1 event required')
    .max(100, 'SYNC_BATCH_SIZE_EXCEEDED'),
});

// 1. Download Offline Roster Package
router.get(
  '/classes/:classSectionId/offline-roster',
  requireAuth,
  requireTenant,
  validateRequest({
    params: z.object({
      schoolId: commonSchemas.uuid,
      classSectionId: commonSchemas.uuid,
    }),
  }) as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { schoolId, classSectionId } = req.params;
      const deviceIdentifier = req.headers['x-device-identifier'] as string;
      if (!deviceIdentifier) return res.status(400).json({ success: false, error: 'DEVICE_IDENTIFIER_REQUIRED' });
      const device = await validateDeviceStatus(schoolId, deviceIdentifier);
      if (!device.valid) return res.status(403).json({ success: false, error: device.reason || 'DEVICE_REVOKED' });

      const rosterPackage = await getOfflineRosterPackage(schoolId, classSectionId, req.user!.id, req.userRole);

      res.json({ success: true, data: rosterPackage });
    } catch (error: any) {
      console.error('Error fetching offline roster package:', error);
      res.status(500).json({ success: false, error: error.message || 'FAILED_TO_FETCH_ROSTER' });
    }
  }
);

// 2. Batch Sync Attendance Events Endpoint
router.post(
  '/attendance-events',
  requireAuth,
  requireTenant,
  validateRequest({
    params: z.object({
      schoolId: commonSchemas.uuid,
    }),
    body: syncBatchSchema,
  }) as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schoolId = req.params.schoolId;
      const user = (req as any).user;
      const { events, sessions, deviceIdentifier } = req.body;

      const syncResult = await syncAttendanceEvents({
        schoolId,
        actorId: user.id,
        userRole: req.userRole,
        deviceIdentifier,
        events,
        sessions,
      });

      res.json({ success: true, data: syncResult });
    } catch (error: any) {
      console.error('Error processing batch attendance sync:', error);
      if (error.message === 'DEVICE_REVOKED') {
        res.status(403).json({ success: false, error: 'DEVICE_REVOKED' });
        return;
      }
      if (error.message === 'DEVICE_IDENTIFIER_REQUIRED') {
        res.status(400).json({ success: false, error: 'DEVICE_IDENTIFIER_REQUIRED' });
        return;
      }
      if (error.message === 'USER_SUSPENDED' || error.message === 'UNAUTHORIZED_TEACHER_NOT_ASSIGNED') {
        res.status(403).json({ success: false, error: error.message });
        return;
      }
      res.status(500).json({ success: false, error: error.message || 'SYNC_FAILED' });
    }
  }
);

export default router;
