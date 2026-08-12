import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import { registerDevice, revokeDevice } from '../services/deviceService';

export const deviceRouter = Router({ mergeParams: true });

const registerSchema = z.object({
  deviceIdentifier: z.string().min(1),
  deviceModel: z.string().optional(),
});

// POST /api/v1/schools/:schoolId/devices/register
deviceRouter.post(
  '/register',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'INVALID_INPUT', details: parsed.error.format() });
    }

    try {
      const device = await registerDevice({
        schoolId: req.activeSchoolId!,
        userId: req.user!.id,
        deviceIdentifier: parsed.data.deviceIdentifier,
        deviceModel: parsed.data.deviceModel,
      });

      return res.json({ device });
    } catch (err: any) {
      if (err.message === 'DEVICE_REVOKED') {
        return res.status(403).json({ error: 'DEVICE_REVOKED', message: 'Device has been revoked' });
      }
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message });
    }
  }
);

// POST /api/v1/schools/:schoolId/devices/:deviceId/revoke
deviceRouter.post(
  '/:deviceId/revoke',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const { deviceId } = req.params;

    const updated = await revokeDevice(
      req.activeSchoolId!,
      deviceId,
      req.user!.id
    );

    if (!updated) {
      return res.status(404).json({ error: 'DEVICE_NOT_FOUND' });
    }

    return res.json({ status: 'ok', device: updated });
  }
);
