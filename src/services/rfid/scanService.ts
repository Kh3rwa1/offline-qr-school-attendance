import { db } from '../../db';
import { rfidScanEvents, attendanceEvents, attendanceRecords, attendanceSessions } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { isReaderAuthorized } from './readerService';
import { verifyEnvelopeSignature } from './cryptoService';
import { lookupActiveCredential } from './credentialService';
import { getRedisClient } from '../redisService';

export interface ScanEnvelope {
  version: number;
  schoolId: string;
  readerId: string;
  credentialDigest?: string;
  secureProof?: string;
  readerTimestamp: string;
  sequenceNumber?: number;
  nonce: string;
  direction?: 'ENTRY' | 'EXIT' | 'NONE';
  attendanceSessionId?: string;
  securityMode: 'SECURE' | 'UID_LEGACY';
  signature: string;
  clientEventId: string;
  isOffline?: boolean;
}

export interface ScanResult {
  decision: string;
  scanEventId?: string;
  attendanceRecordId?: string;
  studentId?: string;
  rejectionCode?: string;
  processingLatencyMs: number;
}

export async function processScan(envelope: ScanEnvelope): Promise<ScanResult> {
  const startTime = Date.now();
  const redis = getRedisClient();

  if (envelope.version !== 1 || !envelope.schoolId || !envelope.readerId || !envelope.nonce || !envelope.clientEventId) {
    throw new Error('Invalid envelope');
  }

  // Idempotency check
  const [existing] = await db
    .select()
    .from(rfidScanEvents)
    .where(and(eq(rfidScanEvents.schoolId, envelope.schoolId), eq(rfidScanEvents.clientEventId, envelope.clientEventId)));

  if (existing) {
    return { decision: existing.decision, scanEventId: existing.id, processingLatencyMs: Date.now() - startTime };
  }

  const createRejection = async (decision: any, rejectionCode: string): Promise<ScanResult> => {
    const latency = Date.now() - startTime;
    const [inserted] = await db
      .insert(rfidScanEvents)
      .values({
        schoolId: envelope.schoolId,
        readerId: envelope.readerId,
        clientEventId: envelope.clientEventId,
        scanTimestamp: new Date(envelope.readerTimestamp),
        decision,
        rejectionCode,
        captureMethod: envelope.securityMode === 'SECURE' ? 'RFID_SECURE' : 'RFID_UID_LEGACY',
        securityMode: envelope.securityMode,
        processingLatencyMs: latency,
        isOffline: envelope.isOffline || false,
        nonce: envelope.nonce,
      })
      .returning();

    return { decision, rejectionCode, scanEventId: inserted.id, processingLatencyMs: latency };
  };

  // Reader auth
  if (!(await isReaderAuthorized(envelope.readerId, envelope.schoolId))) {
    return createRejection('READER_REVOKED', 'READER_REVOKED');
  }

  // Signature
  if (!verifyEnvelopeSignature(envelope, envelope.signature, process.env.RFID_HMAC_SECRET || 'fallback-secret')) {
    return createRejection('REPLAY_REJECTED', 'INVALID_SIGNATURE');
  }

  // Clock skew
  const maxSkew = parseInt(process.env.RFID_MAX_CLOCK_SKEW_MS || '30000', 10);
  const readerTime = new Date(envelope.readerTimestamp).getTime();
  if (isNaN(readerTime) || Math.abs(Date.now() - readerTime) > maxSkew) {
    return createRejection('CLOCK_SKEW', 'TIMESTAMP_OUTSIDE_ALLOWED_WINDOW');
  }

  // Nonce replay check via Redis
  if (redis) {
    const nonceKey = `rfid:nonce:${envelope.schoolId}:${envelope.nonce}`;
    const setNonce = await redis.set(nonceKey, '1', 'EX', 60, 'NX');
    if (!setNonce) {
      return createRejection('REPLAY_REJECTED', 'NONCE_REUSED');
    }
  }

  // Legacy mode setting check
  if (envelope.securityMode === 'UID_LEGACY' && process.env.ALLOW_LEGACY_RFID_UID_MODE !== 'true') {
    return createRejection('DEPENDENCY_UNAVAILABLE', 'LEGACY_MODE_DISABLED');
  }

  if (!envelope.credentialDigest) {
    return createRejection('UNKNOWN_CARD', 'NO_CREDENTIAL_DIGEST');
  }

  // Lookup credential
  const credential = await lookupActiveCredential(envelope.schoolId, envelope.credentialDigest);
  if (!credential) return createRejection('UNKNOWN_CARD', 'CARD_NOT_FOUND');
  if (credential.status === 'REVOKED') return createRejection('REVOKED_CARD', 'CARD_REVOKED');
  if (credential.status === 'EXPIRED') return createRejection('EXPIRED_CARD', 'CARD_EXPIRED');
  if (credential.status === 'SUSPENDED') return createRejection('SUSPENDED_CARD', 'CARD_SUSPENDED');
  if (credential.schoolId !== envelope.schoolId) return createRejection('WRONG_SCHOOL', 'SCHOOL_MISMATCH');

  // Attendance Session
  let sessionId = envelope.attendanceSessionId;
  if (!sessionId) return createRejection('NO_ACTIVE_SESSION', 'NO_SESSION_ID');

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.id, sessionId), eq(attendanceSessions.schoolId, envelope.schoolId)));

  if (!session || session.status === 'FINALIZED') {
    return createRejection('NO_ACTIVE_SESSION', 'SESSION_NOT_OPEN');
  }

  // Duplicate tap cooldown check via Redis
  const duplicateTapCooldown = parseInt(process.env.RFID_DUPLICATE_TAP_COOLDOWN_MS || '30000', 10);
  const dupKey = `rfid:dup:${envelope.schoolId}:${credential.studentId}:${sessionId}`;
  if (redis) {
    const isDup = await redis.get(dupKey);
    if (isDup) {
      return createRejection('DUPLICATE', 'DUPLICATE_TAP');
    }
  }

  const latency = Date.now() - startTime;
  const captureMethod = envelope.securityMode === 'SECURE' ? 'RFID_SECURE' : 'RFID_UID_LEGACY';

  // Record accepted scan event
  const [scanEvent] = await db
    .insert(rfidScanEvents)
    .values({
      schoolId: envelope.schoolId,
      readerId: envelope.readerId,
      credentialId: credential.id,
      attendanceSessionId: sessionId,
      clientEventId: envelope.clientEventId,
      sequenceNumber: envelope.sequenceNumber,
      scanTimestamp: new Date(envelope.readerTimestamp),
      direction: envelope.direction || 'NONE',
      decision: 'ACCEPTED',
      captureMethod,
      securityMode: envelope.securityMode,
      processingLatencyMs: latency,
      isOffline: envelope.isOffline || false,
      nonce: envelope.nonce,
    })
    .returning();

  // Create attendance event
  const [attEvent] = await db
    .insert(attendanceEvents)
    .values({
      schoolId: envelope.schoolId,
      clientEventId: `rfid_${scanEvent.id}`,
      attendanceSessionId: sessionId,
      studentId: credential.studentId,
      eventType: 'CHECK_IN',
      statusValue: 'PRESENT',
      clientTimestamp: new Date(envelope.readerTimestamp),
      actorId: credential.studentId, // system/student event
      captureMethod,
      sourceReaderId: envelope.readerId,
      sourceRfidEventId: scanEvent.id,
    })
    .returning();

  // Upsert attendance record
  const [existingRecord] = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.schoolId, envelope.schoolId),
        eq(attendanceRecords.attendanceSessionId, sessionId),
        eq(attendanceRecords.studentId, credential.studentId)
      )
    );

  let attRecordId: string;
  if (existingRecord) {
    attRecordId = existingRecord.id;
    await db
      .update(attendanceRecords)
      .set({
        status: 'PRESENT',
        lastUpdatedAt: new Date(),
        captureMethod,
        direction: envelope.direction || 'NONE',
      })
      .where(eq(attendanceRecords.id, existingRecord.id));
  } else {
    const [newRecord] = await db
      .insert(attendanceRecords)
      .values({
        schoolId: envelope.schoolId,
        attendanceSessionId: sessionId,
        studentId: credential.studentId,
        status: 'PRESENT',
        firstScannedAt: new Date(envelope.readerTimestamp),
        captureMethod,
        confidenceLevel: envelope.securityMode === 'SECURE' ? 'HIGH' : 'MEDIUM',
        direction: envelope.direction || 'NONE',
      })
      .returning();
    attRecordId = newRecord.id;
  }

  // Set duplicate tap cooldown in Redis
  if (redis) {
    await redis.set(dupKey, '1', 'PX', duplicateTapCooldown);
  }

  return {
    decision: 'ACCEPTED',
    scanEventId: scanEvent.id,
    attendanceRecordId: attRecordId,
    studentId: credential.studentId,
    processingLatencyMs: latency,
  };
}

export async function processOfflineScans(schoolId: string, scans: ScanEnvelope[]): Promise<ScanResult[]> {
  const sorted = [...scans].sort(
    (a, b) => new Date(a.readerTimestamp).getTime() - new Date(b.readerTimestamp).getTime()
  );
  const results: ScanResult[] = [];
  for (const scan of sorted) {
    if (scan.schoolId !== schoolId) continue;
    try {
      const res = await processScan({ ...scan, isOffline: true });
      results.push(res);
    } catch (e: any) {
      results.push({ decision: 'DEPENDENCY_UNAVAILABLE', rejectionCode: e.message, processingLatencyMs: 0 });
    }
  }
  return results;
}

export const scanService = {
  processScan,
  processOfflineScans,
};
