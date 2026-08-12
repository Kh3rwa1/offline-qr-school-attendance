import { Router, Request, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import { getOfflineRosterPackage, syncAttendanceEvents } from '../services/syncService';
import { validateDeviceStatus } from '../services/deviceService';

const router = Router({ mergeParams: true });

// 1. Download Offline Roster Package
router.get(
  '/classes/:classSectionId/offline-roster',
  requireAuth,
  requireTenant,
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schoolId = req.params.schoolId;
      const user = (req as any).user;
      const { events, sessions, deviceIdentifier } = req.body;

      if (!Array.isArray(events)) {
        res.status(400).json({ success: false, error: 'EVENTS_MUST_BE_ARRAY' });
        return;
      }
      if (typeof deviceIdentifier !== 'string' || !deviceIdentifier.trim()) {
        res.status(400).json({ success: false, error: 'DEVICE_IDENTIFIER_REQUIRED' });
        return;
      }

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
