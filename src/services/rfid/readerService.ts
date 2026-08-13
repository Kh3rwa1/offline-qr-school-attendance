import { db } from '../../db';
import { rfidReaders } from '../../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { createAuditLog } from '../auditLogService';
import crypto from 'crypto';

export function encryptReaderSecret(secret: string): string {
  const masterKeyHex = process.env.RFID_HMAC_SECRET || 'test-secret-32-chars-length-environment';
  const masterKey = crypto.createHash('sha256').update(masterKeyHex).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptReaderSecret(encryptedStr: string): string {
  if (!encryptedStr || !encryptedStr.includes(':')) return encryptedStr;
  try {
    const masterKeyHex = process.env.RFID_HMAC_SECRET || 'test-secret-32-chars-length-environment';
    const masterKey = crypto.createHash('sha256').update(masterKeyHex).digest();
    const [ivHex, tagHex, cipherHex] = encryptedStr.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const cipherText = Buffer.from(cipherHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
    decipher.setAuthTag(tag);
    return decipher.update(cipherText).toString('utf8') + decipher.final('utf8');
  } catch {
    return encryptedStr;
  }
}

export function sanitizeReader(reader: any): any {
  if (!reader) return reader;
  if (Array.isArray(reader)) {
    return reader.map(sanitizeReader);
  }
  const { sharedSecretEncrypted, ...rest } = reader;
  return rest;
}

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
  sharedSecret?: string;
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

  const rawSecret = params.sharedSecret || crypto.randomBytes(32).toString('hex');
  const encryptedSecret = encryptReaderSecret(rawSecret);

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
      sharedSecretEncrypted: encryptedSecret,
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

  return sanitizeReader(inserted);
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
  return sanitizeReader(reader);
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
  return sanitizeReader(reader);
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
  return sanitizeReader(reader);
}

export async function retireReader(readerId: string, schoolId: string) {
  const [reader] = await db
    .update(rfidReaders)
    .set({ status: 'RETIRED' })
    .where(and(eq(rfidReaders.id, readerId), eq(rfidReaders.schoolId, schoolId)))
    .returning();
  return sanitizeReader(reader);
}

export async function provisionReader(readerId: string, schoolId: string, actorId?: string) {
  const [reader] = await db
    .select()
    .from(rfidReaders)
    .where(and(eq(rfidReaders.id, readerId), eq(rfidReaders.schoolId, schoolId)));

  if (!reader) throw new Error('Reader not found');
  if (reader.status !== 'PENDING' && reader.status !== 'ACTIVE') {
    throw new Error('Reader is not in a provisionable state');
  }

  const rawSecret = crypto.randomBytes(32).toString('hex');
  const encryptedSecret = encryptReaderSecret(rawSecret);

  await db
    .update(rfidReaders)
    .set({ sharedSecretEncrypted: encryptedSecret, status: 'ACTIVE', keyVersion: (reader.keyVersion || 1) + 1 })
    .where(eq(rfidReaders.id, readerId));

  await createAuditLog({
    schoolId,
    actorId: sanitizeActorId(actorId),
    action: 'RFID_READER_PROVISIONED',
    resourceId: readerId,
    resourceType: 'RFID_READER',
  });

  return {
    readerId,
    schoolId,
    deviceId: reader.deviceId,
    keyVersion: (reader.keyVersion || 1) + 1,
    provisionedSecret: rawSecret,
    certificateFingerprint: reader.certificateFingerprint,
    provisionedAt: new Date().toISOString(),
  };
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
  return sanitizeReader(reader);
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
  return sanitizeReader(reader || null);
}

export async function getReaderHealth(readerId: string, schoolId: string) {
  const reader = await getReaderById(readerId, schoolId);
  return sanitizeReader(reader);
}

export async function listReaders(schoolId: string, filters?: { status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'RETIRED' }) {
  const conditions = [eq(rfidReaders.schoolId, schoolId)];
  if (filters?.status) {
    conditions.push(eq(rfidReaders.status, filters.status));
  }
  const readers = await db.select().from(rfidReaders).where(and(...conditions));
  return sanitizeReader(readers);
}

export async function isReaderAuthorized(readerId: string, schoolId: string) {
  const [reader] = await db
    .select()
    .from(rfidReaders)
    .where(and(eq(rfidReaders.id, readerId), eq(rfidReaders.schoolId, schoolId)));
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
  decryptReaderSecret,
  encryptReaderSecret,
  sanitizeReader,
};
