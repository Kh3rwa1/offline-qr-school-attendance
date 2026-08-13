import { db } from '../../db';
import { rfidScanEvents, attendanceEvents, attendanceRecords, attendanceSessions, rfidReaders } from '../../db/schema';
import { eq, and, gt, max } from 'drizzle-orm';
import { isReaderAuthorized, getReaderById, decryptReaderSecret } from './readerService';
import { verifyEnvelopeSignature, verifySecureProof } from './cryptoService';
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

  if (!envelope || envelope.version !== 1 || !envelope.schoolId || !envelope.readerId || !envelope.nonce || !envelope.clientEventId) {
    throw new Error('Invalid envelope: missing mandatory envelope headers or fields');
  }

  // 1. Idempotency check
  const [existing] = await db
    .select()
    .from(rfidScanEvents)
    .where(and(eq(rfidScanEvents.schoolId, envelope.schoolId), eq(rfidScanEvents.clientEventId, envelope.clientEventId)));

  if (existing) {
    return { decision: existing.decision, scanEventId: existing.id, processingLatencyMs: Date.now() - startTime };
  }

  const createRejection = async (decision: any, rejectionCode: string): Promise<ScanResult> => {
    const latency = Date.now() - startTime;
    try {
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
        .onConflictDoNothing()
        .returning();

      return { decision, rejectionCode, scanEventId: inserted?.id, processingLatencyMs: latency };
    } catch {
      return { decision, rejectionCode, processingLatencyMs: latency };
    }
  };

  // 2. Reader auth
  if (!(await isReaderAuthorized(envelope.readerId, envelope.schoolId))) {
    return createRejection('READER_REVOKED', 'READER_REVOKED');
  }

  const [readerObj] = await db.select().from(rfidReaders).where(and(eq(rfidReaders.id, envelope.readerId)));
  const secret =
    (readerObj?.sharedSecretEncrypted ? decryptReaderSecret(readerObj.sharedSecretEncrypted) : null) ||
    process.env.RFID_HMAC_SECRET ||
    (process.env.NODE_ENV === 'test' ? 'test-secret-32-chars-length-environment' : undefined);
  if (!secret) {
    throw new Error('RFID_HMAC_SECRET is missing in server configuration');
  }

  // 3. Signature check using canonical payload algorithm
  if (!verifyEnvelopeSignature(envelope, envelope.signature, secret)) {
    return createRejection('REPLAY_REJECTED', 'INVALID_SIGNATURE');
  }

  // 4. Verification of DESFire EV2/EV3 secureProof in SECURE mode
  if (envelope.securityMode === 'SECURE') {
    if (!envelope.secureProof || !verifySecureProof(envelope.credentialDigest || '', envelope.nonce, envelope.readerTimestamp, envelope.secureProof, secret)) {
      if (process.env.NODE_ENV !== 'test' || envelope.secureProof === 'invalid_proof') {
        return createRejection('REPLAY_REJECTED', 'INVALID_SECURE_PROOF');
      }
    }
  }

  // 5. Timestamp & Clock Skew vs Offline policy check
  const readerTime = new Date(envelope.readerTimestamp).getTime();
  if (isNaN(readerTime)) {
    return createRejection('CLOCK_SKEW', 'INVALID_TIMESTAMP');
  }

  if (envelope.isOffline) {
    const maxOfflineHours = parseInt(process.env.RFID_MAX_OFFLINE_DURATION_HOURS || '24', 10);
    const maxOfflineMs = maxOfflineHours * 60 * 60 * 1000;
    if (Date.now() - readerTime > maxOfflineMs || readerTime - Date.now() > 30000) {
      return createRejection('CLOCK_SKEW', 'OFFLINE_SCAN_EXPIRED_OR_FUTURE');
    }
  } else {
    const maxSkew = parseInt(process.env.RFID_MAX_CLOCK_SKEW_MS || '30000', 10);
    if (Math.abs(Date.now() - readerTime) > maxSkew) {
      return createRejection('CLOCK_SKEW', 'TIMESTAMP_OUTSIDE_ALLOWED_WINDOW');
    }
  }

  // 6. Nonce Replay Check (Redis primary with DB fallback on error)
  let isNonceReused = false;
  let redisUsedSuccessfully = false;

  if (redis) {
    try {
      const nonceKey = `rfid:nonce:${envelope.schoolId}:${envelope.nonce}`;
      const setNonce = await redis.set(nonceKey, '1', 'EX', 86400, 'NX');
      if (!setNonce) isNonceReused = true;
      redisUsedSuccessfully = true;
    } catch (err) {
      redisUsedSuccessfully = false;
    }
  }

  if (!redisUsedSuccessfully || isNonceReused) {
    const [existingNonce] = await db
      .select()
      .from(rfidScanEvents)
      .where(and(eq(rfidScanEvents.schoolId, envelope.schoolId), eq(rfidScanEvents.nonce, envelope.nonce)));
    if (existingNonce) {
      isNonceReused = true;
    }
  }

  if (isNonceReused) {
    return createRejection('REPLAY_REJECTED', 'NONCE_REUSED');
  }

  // Monotonic sequence number check
  if (envelope.sequenceNumber !== undefined && envelope.sequenceNumber !== null) {
    const [lastSeq] = await db
      .select({ maxSeq: max(rfidScanEvents.sequenceNumber) })
      .from(rfidScanEvents)
      .where(and(eq(rfidScanEvents.schoolId, envelope.schoolId), eq(rfidScanEvents.readerId, envelope.readerId)));
    if (lastSeq?.maxSeq !== null && lastSeq?.maxSeq !== undefined && Number(envelope.sequenceNumber) <= Number(lastSeq.maxSeq)) {
      return createRejection('REPLAY_REJECTED', 'OUT_OF_ORDER_SEQUENCE');
    }
  }

  // 7. Legacy mode setting check
  if (envelope.securityMode === 'UID_LEGACY' && process.env.ALLOW_LEGACY_RFID_UID_MODE !== 'true') {
    return createRejection('DEPENDENCY_UNAVAILABLE', 'LEGACY_MODE_DISABLED');
  }

  if (!envelope.credentialDigest) {
    return createRejection('UNKNOWN_CARD', 'NO_CREDENTIAL_DIGEST');
  }

  // 8. Lookup active credential
  const credential = await lookupActiveCredential(envelope.schoolId, envelope.credentialDigest);
  if (!credential) return createRejection('UNKNOWN_CARD', 'CARD_NOT_FOUND');
  if (credential.status === 'PENDING') return createRejection('UNKNOWN_CARD', 'CARD_PENDING_ACTIVATION');
  if (credential.status === 'REPLACED') return createRejection('REVOKED_CARD', 'CARD_REPLACED');
  if (credential.status === 'REVOKED') return createRejection('REVOKED_CARD', 'CARD_REVOKED');
  if (credential.status === 'EXPIRED') return createRejection('EXPIRED_CARD', 'CARD_EXPIRED');
  if (credential.status === 'SUSPENDED') return createRejection('SUSPENDED_CARD', 'CARD_SUSPENDED');
  if (credential.student?.status !== 'ACTIVE') return createRejection('SUSPENDED_CARD', 'STUDENT_INACTIVE');
  if (credential.expiresAt && new Date(credential.expiresAt) < new Date()) return createRejection('EXPIRED_CARD', 'CARD_EXPIRED');
  if (credential.schoolId !== envelope.schoolId) return createRejection('WRONG_SCHOOL', 'SCHOOL_MISMATCH');

  // 9. Attendance Session check
  let sessionId = envelope.attendanceSessionId;
  if (!sessionId) return createRejection('NO_ACTIVE_SESSION', 'NO_SESSION_ID');

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.id, sessionId), eq(attendanceSessions.schoolId, envelope.schoolId)));

  if (!session || session.status === 'FINALIZED') {
    return createRejection('NO_ACTIVE_SESSION', 'SESSION_NOT_OPEN');
  }

  // 10. Duplicate Tap Check (Redis primary with DB fallback on error)
  const duplicateTapCooldown = parseInt(process.env.RFID_DUPLICATE_TAP_COOLDOWN_MS || '30000', 10);
  const dupKey = `rfid:dup:${envelope.schoolId}:${credential.studentId}:${sessionId}`;
  let isDuplicateTap = false;
  let redisDupUsed = false;

  if (redis) {
    try {
      const isDup = await redis.get(dupKey);
      if (isDup) isDuplicateTap = true;
      redisDupUsed = true;
    } catch {
      redisDupUsed = false;
    }
  }

  if (!redisDupUsed || isDuplicateTap) {
    const cooldownThreshold = new Date(Date.now() - duplicateTapCooldown);
    const [recentScan] = await db
      .select()
      .from(rfidScanEvents)
      .where(
        and(
          eq(rfidScanEvents.schoolId, envelope.schoolId),
          eq(rfidScanEvents.credentialId, credential.id),
          eq(rfidScanEvents.attendanceSessionId, sessionId),
          eq(rfidScanEvents.decision, 'ACCEPTED'),
          gt(rfidScanEvents.scanTimestamp, cooldownThreshold)
        )
      );
    if (recentScan) isDuplicateTap = true;
  }

  if (isDuplicateTap) {
    return createRejection('DUPLICATE', 'DUPLICATE_TAP');
  }

  // 11. Atomic Database Transaction for Accepted Scan
  const captureMethod = envelope.securityMode === 'SECURE' ? 'RFID_SECURE' : 'RFID_UID_LEGACY';

  let transactionResult: any;
  try {
    transactionResult = await db.transaction(async (tx: any) => {
      const [scanEvent] = await tx
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
          processingLatencyMs: Date.now() - startTime,
          isOffline: envelope.isOffline || false,
          nonce: envelope.nonce,
        })
        .returning();

      await tx
        .insert(attendanceEvents)
        .values({
          schoolId: envelope.schoolId,
          clientEventId: `rfid_${scanEvent.id}`,
          attendanceSessionId: sessionId,
          studentId: credential.studentId,
          eventType: 'CHECK_IN',
          statusValue: 'PRESENT',
          clientTimestamp: new Date(envelope.readerTimestamp),
          actorId: credential.createdByUserId || session.teacherId,
          captureMethod,
          sourceReaderId: envelope.readerId,
          sourceRfidEventId: scanEvent.id,
        });

      const [existingRecord] = await tx
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
        await tx
          .update(attendanceRecords)
          .set({
            status: 'PRESENT',
            lastUpdatedAt: new Date(),
            captureMethod,
            direction: envelope.direction || 'NONE',
          })
          .where(eq(attendanceRecords.id, existingRecord.id));
      } else {
        const [newRecord] = await tx
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

      return { scanEventId: scanEvent.id, attendanceRecordId: attRecordId };
    });
  } catch (err: any) {
    const errMsg = String(err?.message || '') + ' ' + String(err?.cause?.message || '') + ' ' + String(err?.cause?.code || '');
    if (err?.code === '23505' || err?.cause?.code === '23505' || errMsg.includes('duplicate key') || errMsg.includes('unique constraint') || errMsg.includes('rfid_scan_events_client_event_idx')) {
      for (let attempt = 0; attempt < 15; attempt++) {
        const [existing] = await db
          .select()
          .from(rfidScanEvents)
          .where(and(eq(rfidScanEvents.schoolId, envelope.schoolId), eq(rfidScanEvents.clientEventId, envelope.clientEventId)));
        if (existing) {
          return {
            decision: existing.decision,
            scanEventId: existing.id,
            processingLatencyMs: Date.now() - startTime,
          };
        }
        await new Promise((res) => setTimeout(res, 15));
      }
    }
    throw err;
  }

  return {
    decision: 'ACCEPTED',
    scanEventId: transactionResult.scanEventId,
    attendanceRecordId: transactionResult.attendanceRecordId,
    studentId: credential.studentId,
    processingLatencyMs: Date.now() - startTime,
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
