import { db } from '../../db';
import { rfidReaders } from '../../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { createAuditLog } from '../auditLogService';

export async function registerReader(params: {
  schoolId: string;
  deviceId: string;
  name: string;
  location?: string;
  directionMode?: 'ENTRY' | 'EXIT' | 'BIDIRECTIONAL' | 'NONE';
  readerModel?: string;
  firmwareVersion?: string;
  adapterType: 'GATEWAY' | 'USB_HID' | 'WEB_SERIAL' | 'NETWORK';
  securityCapability?: string;
  certificateFingerprint?: string;
  actorId?: string;
}) {
  const [existing] = await db
    .select()
    .from(rfidReaders)
    .where(
      and(
        eq(rfidReaders.deviceId, params.deviceId),
        inArray(rfidReaders.status, ['PENDING', 'ACTIVE', 'SUSPENDED'])
      )
    );

  if (existing && existing.schoolId !== params.schoolId) {
    throw new Error('Device claimed by another school');
  }

  const [inserted] = await db
    .insert(rfidReaders)
    .values({
      schoolId: params.schoolId,
      deviceId: params.deviceId,
      name: params.name,
      location: params.location,
      directionMode: params.directionMode || 'NONE',
      readerModel: params.readerModel,
      firmwareVersion: params.firmwareVersion,
      adapterType: params.adapterType,
      securityCapability: params.securityCapability || 'UID_ONLY',
      certificateFingerprint: params.certificateFingerprint,
      status: 'PENDING',
    })
    .returning();

  await createAuditLog({
    schoolId: params.schoolId,
    actorId: params.actorId || null,
    action: 'RFID_READER_REGISTERED',
    resourceId: inserted.id,
    resourceType: 'RFID_READER',
  });

  return inserted;
}

function sanitizeActorId(actorId?: string): string | null {
  if (!actorId || actorId === 'SYSTEM' || !/^[0-9a-fA-F-]{36}$/.test(actorId)) {
    return null;
  }
  return actorId;
}

export async function approveReader(readerId: string, schoolId: string, actorId?: string) {
  const [reader] = await db
    .update(rfidReaders)
    .set({ status: 'ACTIVE' })
    .where(and(eq(rfidReaders.id, readerId), eq(rfidReaders.schoolId, schoolId), eq(rfidReaders.status, 'PENDING')))
    .returning();

  if (!reader) throw new Error('Reader not found or not PENDING');
  await createAuditLog({ schoolId, actorId: sanitizeActorId(actorId), action: 'RFID_READER_APPROVED', resourceId: readerId, resourceType: 'RFID_READER' });
  return reader;
}

export async function suspendReader(readerId: string, schoolId: string, reason: string, actorId?: string) {
  const [reader] = await db
    .update(rfidReaders)
    .set({ status: 'SUSPENDED' })
    .where(and(eq(rfidReaders.id, readerId), eq(rfidReaders.schoolId, schoolId), eq(rfidReaders.status, 'ACTIVE')))
    .returning();

  if (reader) {
    await createAuditLog({ schoolId, actorId: sanitizeActorId(actorId), action: 'RFID_READER_SUSPENDED', resourceId: readerId, resourceType: 'RFID_READER', metadata: { reason } });
  }
  return reader;
}

export async function revokeReader(readerId: string, schoolId: string, reason: string, actorId?: string) {
  const [reader] = await db
    .update(rfidReaders)
    .set({ status: 'REVOKED' })
    .where(and(eq(rfidReaders.id, readerId), eq(rfidReaders.schoolId, schoolId)))
    .returning();

  if (reader) {
    await createAuditLog({ schoolId, actorId: sanitizeActorId(actorId), action: 'RFID_READER_REVOKED', resourceId: readerId, resourceType: 'RFID_READER', metadata: { reason } });
  }
  return reader;
}

export async function retireReader(readerId: string, schoolId: string) {
  const [reader] = await db
    .update(rfidReaders)
    .set({ status: 'RETIRED' })
    .where(and(eq(rfidReaders.id, readerId), eq(rfidReaders.schoolId, schoolId)))
    .returning();
  return reader;
}

export async function updateReaderConfig(
  readerId: string,
  schoolId: string,
  config: { name?: string; location?: string; directionMode?: 'ENTRY' | 'EXIT' | 'BIDIRECTIONAL' | 'NONE' }
) {
  const [reader] = await db
    .update(rfidReaders)
    .set({ ...config })
    .where(and(eq(rfidReaders.id, readerId), eq(rfidReaders.schoolId, schoolId)))
    .returning();
  return reader;
}

export async function recordHeartbeat(readerId: string, schoolId: string) {
  await db
    .update(rfidReaders)
    .set({ lastSeenAt: new Date() })
    .where(and(eq(rfidReaders.id, readerId), eq(rfidReaders.schoolId, schoolId)));
}

export async function detectClockDrift(readerId: string, schoolId: string, readerTimestamp: Date) {
  const now = new Date();
  const driftMs = now.getTime() - readerTimestamp.getTime();
  await db
    .update(rfidReaders)
    .set({ clockDriftMs: driftMs })
    .where(and(eq(rfidReaders.id, readerId), eq(rfidReaders.schoolId, schoolId)));
  return driftMs;
}

export async function getReaderById(readerId: string, schoolId: string) {
  const [reader] = await db
    .select()
    .from(rfidReaders)
    .where(and(eq(rfidReaders.id, readerId), eq(rfidReaders.schoolId, schoolId)));
  return reader || null;
}

export async function getReaderHealth(readerId: string, schoolId: string) {
  const reader = await getReaderById(readerId, schoolId);
  return reader;
}

export async function listReaders(schoolId: string, filters?: { status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'RETIRED' }) {
  const conditions = [eq(rfidReaders.schoolId, schoolId)];
  if (filters?.status) {
    conditions.push(eq(rfidReaders.status, filters.status));
  }
  return await db.select().from(rfidReaders).where(and(...conditions));
}

export async function isReaderAuthorized(readerId: string, schoolId: string) {
  const reader = await getReaderById(readerId, schoolId);
  return !!(reader && reader.status === 'ACTIVE');
}

export const readerService = {
  registerReader,
  approveReader,
  suspendReader,
  revokeReader,
  retireReader,
  updateReaderConfig,
  recordHeartbeat,
  detectClockDrift,
  getReaderById,
  getReaderHealth,
  listReaders,
  isReaderAuthorized,
};
