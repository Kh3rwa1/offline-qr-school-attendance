import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { devices } from '../db/schema';
import { createAuditLog } from './auditLogService';

export async function registerDevice(params: {
  schoolId: string;
  userId: string;
  deviceIdentifier: string;
  deviceModel?: string;
}) {
  const existing = await db
    .select()
    .from(devices)
    .where(
      and(
        eq(devices.schoolId, params.schoolId),
        eq(devices.deviceIdentifier, params.deviceIdentifier)
      )
    );

  if (existing.length > 0) {
    const dev = existing[0];
    if (dev.status === 'REVOKED') {
      throw new Error('DEVICE_REVOKED');
    }
    return dev;
  }

  const [newDevice] = await db
    .insert(devices)
    .values({
      schoolId: params.schoolId,
      userId: params.userId,
      deviceIdentifier: params.deviceIdentifier,
      deviceModel: params.deviceModel || 'Android PWA Device',
      status: 'AUTHORIZED',
    })
    .returning();

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.userId,
    action: 'REGISTER_DEVICE',
    resourceType: 'DEVICE',
    resourceId: newDevice.id,
    metadata: { deviceIdentifier: params.deviceIdentifier },
  });

  return newDevice;
}

export async function revokeDevice(
  schoolId: string,
  deviceId: string,
  actorId: string
) {
  const [updated] = await db
    .update(devices)
    .set({
      status: 'REVOKED',
      updatedAt: new Date(),
    })
    .where(and(eq(devices.id, deviceId), eq(devices.schoolId, schoolId)))
    .returning();

  if (updated) {
    await createAuditLog({
      schoolId,
      actorId,
      action: 'REVOKE_DEVICE',
      resourceType: 'DEVICE',
      resourceId: deviceId,
    });
  }

  return updated;
}

export async function validateDeviceStatus(schoolId: string, deviceIdentifier: string) {
  const [device] = await db
    .select()
    .from(devices)
    .where(
      and(
        eq(devices.schoolId, schoolId),
        eq(devices.deviceIdentifier, deviceIdentifier)
      )
    );

  if (!device) return { valid: false, reason: 'DEVICE_NOT_FOUND' };
  if (device.status === 'REVOKED') return { valid: false, reason: 'DEVICE_REVOKED' };

  return { valid: true, device };
}
