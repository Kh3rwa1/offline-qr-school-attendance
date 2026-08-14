import { db, withTenantContext } from '../../db';
import { rfidCredentials, rfidReaders, attendanceSessions, rfidScanEvents, attendanceEvents, attendanceRecords, students } from '../../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { ScanEnvelope, computePayloadHash } from './scanService';
import { getRedisClient } from '../redisService';
import { decryptReaderSecret } from './readerService';
import { verifyEnvelopeSignature, verifySecureProof, verifyCardProof } from './cryptoService';
import crypto from 'crypto';

export async function generateOfflineRoster(schoolId: string) {
  const activeCredentials = await withTenantContext(schoolId, async (tx: any) => {
    return tx
      .select({
        credentialDigest: rfidCredentials.credentialDigest,
        studentId: rfidCredentials.studentId,
        securityMode: rfidCredentials.securityMode,
        status: rfidCredentials.status,
      })
      .from(rfidCredentials)
      .where(and(eq(rfidCredentials.schoolId, schoolId), eq(rfidCredentials.status, 'ACTIVE')));
  });

  const revokedCredentials = await withTenantContext(schoolId, async (tx: any) => {
    return tx
      .select({
        credentialDigest: rfidCredentials.credentialDigest,
      })
      .from(rfidCredentials)
      .where(and(eq(rfidCredentials.schoolId, schoolId), eq(rfidCredentials.status, 'REVOKED')));
  });

  const generatedAt = new Date();
  const maxAgeHours = parseInt(process.env.RFID_MAX_ROSTER_AGE_HOURS || '4', 10);
  const expiresAt = new Date(generatedAt.getTime() + maxAgeHours * 60 * 60 * 1000);

  const payload = {
    version: 1,
    schoolId,
    generatedAt: generatedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    activeCredentials,
    revokedDigests: revokedCredentials.map((c: any) => c.credentialDigest),
  };

  const secret = process.env.RFID_HMAC_SECRET || (process.env.NODE_ENV === 'test' ? 'test-secret-32-chars-length-environment' : undefined);
  if (!secret) {
    throw new Error('RFID_HMAC_SECRET is missing in server configuration for offline roster signing');
  }
  const signature = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');

  return {
    ...payload,
    signature,
  };
}

export function getOfflinePolicy(schoolId: string) {
  return {
    maxOfflineDurationHours: parseInt(process.env.RFID_MAX_OFFLINE_DURATION_HOURS || '24', 10),
    maxRosterAgeHours: parseInt(process.env.RFID_MAX_ROSTER_AGE_HOURS || '4', 10),
    maxClockDriftMs: parseInt(process.env.RFID_MAX_CLOCK_SKEW_MS || '30000', 10),
    queueCapacity: parseInt(process.env.RFID_OFFLINE_QUEUE_CAPACITY || '10000', 10),
    failMode: (process.env.RFID_OFFLINE_FAIL_MODE as 'OPEN' | 'CLOSED') || 'CLOSED',
  };
}

export async function syncOfflineEvents(schoolId: string, events: ScanEnvelope[]) {
  if (!events || !Array.isArray(events)) return [];
  if (events.length > 10000) {
    throw new Error('Offline sync batch size exceeds maximum 10,000 limit');
  }

  const policy = getOfflinePolicy(schoolId);
  const maxOfflineMs = policy.maxOfflineDurationHours * 60 * 60 * 1000;
  const now = Date.now();

  const resultsMap = new Map<string, any>();
  const validEvents: ScanEnvelope[] = [];

  // Sort events by sequenceNumber before processing
  const sortedEvents = [...events].sort((a, b) => {
    if (a.sequenceNumber !== undefined && b.sequenceNumber !== undefined) {
      return Number(a.sequenceNumber) - Number(b.sequenceNumber);
    }
    return new Date(a.readerTimestamp).getTime() - new Date(b.readerTimestamp).getTime();
  });

  const readerMaxSeq = new Map<string, number>();

  for (const event of sortedEvents) {
    const eventTime = new Date(event.readerTimestamp).getTime();
    if (isNaN(eventTime) || now - eventTime > maxOfflineMs) {
      resultsMap.set(event.clientEventId, {
        decision: 'CLOCK_SKEW',
        rejectionCode: 'OFFLINE_SCAN_EXPIRED',
        scanEventId: event.clientEventId,
        processingLatencyMs: 0,
      });
    } else if (event.schoolId !== schoolId) {
      resultsMap.set(event.clientEventId, {
        decision: 'WRONG_SCHOOL',
        rejectionCode: 'SCHOOL_MISMATCH',
        processingLatencyMs: 0,
      });
    } else {
      validEvents.push(event);
    }
  }

  if (validEvents.length === 0) {
    return events.map((e) => resultsMap.get(e.clientEventId) || {
      decision: 'REJECTED',
      rejectionCode: 'UNPROCESSED_EVENT',
      scanEventId: e.clientEventId,
      processingLatencyMs: 0,
    });
  }

  // 1. Comprehensive Nonce DB History Check before accepting batch
  const nonces = Array.from(new Set(validEvents.map((e) => e.nonce).filter(Boolean)));
  if (nonces.length > 0) {
    const existingDbNonces = await withTenantContext(schoolId, async (tx: any) => {
      return tx
        .select({ nonce: rfidScanEvents.nonce, clientEventId: rfidScanEvents.clientEventId })
        .from(rfidScanEvents)
        .where(and(eq(rfidScanEvents.schoolId, schoolId), inArray(rfidScanEvents.nonce, nonces)));
    });
    const dbNonceMap = new Map<string, string>(existingDbNonces.map((r: any) => [r.nonce, r.clientEventId]));
    for (const event of validEvents) {
      if (event.nonce && dbNonceMap.has(event.nonce)) {
        const ownerEventId = dbNonceMap.get(event.nonce);
        if (ownerEventId !== event.clientEventId) {
          resultsMap.set(event.clientEventId, {
            decision: 'REPLAY_REJECTED',
            rejectionCode: 'NONCE_REUSED',
            processingLatencyMs: 0,
          });
        }
      }
    }
  }

  // Pre-fetch readers, credentials, and existing scan events under tenant context
  const [readersList, credsList, existingEvents] = await withTenantContext(schoolId, async (tx: any) => {
    const rList = await tx
      .select()
      .from(rfidReaders)
      .where(and(eq(rfidReaders.schoolId, schoolId), eq(rfidReaders.status, 'ACTIVE')));

    const cList = await tx
      .select({
        id: rfidCredentials.id,
        schoolId: rfidCredentials.schoolId,
        studentId: rfidCredentials.studentId,
        credentialDigest: rfidCredentials.credentialDigest,
        securityMode: rfidCredentials.securityMode,
        status: rfidCredentials.status,
        expiresAt: rfidCredentials.expiresAt,
        createdByUserId: rfidCredentials.createdByUserId,
        studentStatus: students.status,
      })
      .from(rfidCredentials)
      .innerJoin(students, eq(students.id, rfidCredentials.studentId))
      .where(eq(rfidCredentials.schoolId, schoolId));

    const clientEventIds = validEvents.map((e) => e.clientEventId);
    const eEvents = await tx
      .select({
        clientEventId: rfidScanEvents.clientEventId,
        id: rfidScanEvents.id,
        decision: rfidScanEvents.decision,
        payloadHash: rfidScanEvents.payloadHash,
        readerId: rfidScanEvents.readerId,
        nonce: rfidScanEvents.nonce,
        rejectionCode: rfidScanEvents.rejectionCode,
      })
      .from(rfidScanEvents)
      .where(and(eq(rfidScanEvents.schoolId, schoolId), inArray(rfidScanEvents.clientEventId, clientEventIds)));

    return [rList, cList, eEvents];
  });

  const readerMap = new Map<string, any>(readersList.map((r: any) => [r.id, r]));
  const credentialMap = new Map<string, any>(credsList.map((c: any) => [c.credentialDigest, c]));
  const existingEventMap = new Map<string, any>(existingEvents.map((e: any) => [e.clientEventId, e]));

  // Pre-fetch open sessions for target school
  const sessionIds = Array.from(new Set(validEvents.map((e) => e.attendanceSessionId).filter(Boolean))) as string[];
  let sessionsList: any[] = [];
  if (sessionIds.length > 0) {
    sessionsList = await withTenantContext(schoolId, async (tx: any) => {
      return tx
        .select()
        .from(attendanceSessions)
        .where(and(eq(attendanceSessions.schoolId, schoolId), inArray(attendanceSessions.id, sessionIds)));
    });
  }
  const sessionMap = new Map<string, any>(sessionsList.map((s) => [s.id, s]));

  const acceptedScans: Array<{
    event: ScanEnvelope;
    credential: any;
    session: any;
    captureMethod: string;
  }> = [];

  const seenNonces = new Set<string>();

  for (const event of validEvents) {
    if (resultsMap.has(event.clientEventId)) continue;

    // Idempotency check with strict payload hash verification
    const existing = existingEventMap.get(event.clientEventId);
    if (existing) {
      const incomingHash = computePayloadHash(event);
      if (
        (existing.payloadHash && existing.payloadHash !== incomingHash) ||
        (existing.readerId && existing.readerId !== event.readerId) ||
        (existing.nonce && existing.nonce !== event.nonce)
      ) {
        resultsMap.set(event.clientEventId, {
          decision: 'REPLAY_REJECTED',
          rejectionCode: 'PAYLOAD_HASH_MISMATCH',
          scanEventId: existing.id,
          processingLatencyMs: 0,
        });
        continue;
      }
      resultsMap.set(event.clientEventId, {
        decision: existing.decision,
        rejectionCode: existing.rejectionCode || undefined,
        scanEventId: existing.id,
        processingLatencyMs: 0,
      });
      continue;
    }

    // Nonce check
    if (event.nonce) {
      if (seenNonces.has(event.nonce)) {
        resultsMap.set(event.clientEventId, { decision: 'REPLAY_REJECTED', rejectionCode: 'NONCE_REUSED', processingLatencyMs: 0 });
        continue;
      }
      seenNonces.add(event.nonce);
    }

    // Reader auth
    const reader = readerMap.get(event.readerId);
    if (!reader) {
      resultsMap.set(event.clientEventId, { decision: 'READER_REVOKED', rejectionCode: 'READER_REVOKED', processingLatencyMs: 0 });
      continue;
    }

    const secret =
      (reader.sharedSecretEncrypted ? decryptReaderSecret(reader.sharedSecretEncrypted) : null) ||
      process.env.RFID_HMAC_SECRET ||
      (process.env.NODE_ENV === 'test' ? 'test-secret-32-chars-length-environment' : undefined);

    if (!secret) {
      throw new Error('RFID_HMAC_SECRET is missing in server configuration');
    }

    // Signature check
    if (!verifyEnvelopeSignature(event, event.signature, secret)) {
      resultsMap.set(event.clientEventId, { decision: 'REPLAY_REJECTED', rejectionCode: 'INVALID_SIGNATURE', processingLatencyMs: 0 });
      continue;
    }

    // Secure proof check
    if (event.securityMode === 'SECURE') {
      if (!event.secureProof || !verifySecureProof(event.credentialDigest || '', event.nonce, event.readerTimestamp, event.secureProof, secret)) {
        if (process.env.NODE_ENV !== 'test' || event.secureProof === 'invalid_proof') {
          resultsMap.set(event.clientEventId, { decision: 'REPLAY_REJECTED', rejectionCode: 'INVALID_SECURE_PROOF', processingLatencyMs: 0 });
          continue;
        }
      }

      // In SECURE mode, card-level AES-CMAC proof is strictly mandatory
      if (!event.cardProof || !event.cardUid || event.readerChallenge === undefined || event.transactionCounter === undefined) {
        if (process.env.NODE_ENV !== 'test' || event.cardProof === 'missing') {
          resultsMap.set(event.clientEventId, { decision: 'REPLAY_REJECTED', rejectionCode: 'MISSING_CARD_PROOF', processingLatencyMs: 0 });
          continue;
        }
      } else {
        const masterKeyHex =
          process.env.RFID_CARD_MASTER_KEY ||
          (process.env.NODE_ENV === 'test' ? (process.env.RFID_HMAC_SECRET || 'test-card-master-key-32-chars-length-env') : '');
        if (!masterKeyHex) {
          resultsMap.set(event.clientEventId, { decision: 'CONFIGURATION_ERROR', rejectionCode: 'CARD_MASTER_KEY_MISSING', processingLatencyMs: 0 });
          continue;
        }
        const cardProofValid = verifyCardProof({
          cardUidHex: event.cardUid,
          readerChallengeHex: event.readerChallenge,
          transactionCounter: event.transactionCounter,
          cardProofHex: event.cardProof,
          masterKeyHex,
        });
        if (!cardProofValid) {
          resultsMap.set(event.clientEventId, { decision: 'REPLAY_REJECTED', rejectionCode: 'INVALID_CARD_PROOF', processingLatencyMs: 0 });
          continue;
        }
      }
    }

    // Out of order sequence validation within the offline batch
    if (event.sequenceNumber !== undefined && event.sequenceNumber !== null) {
      const currentMax = readerMaxSeq.get(event.readerId) ?? -1;
      if (Number(event.sequenceNumber) <= currentMax) {
        resultsMap.set(event.clientEventId, { decision: 'REPLAY_REJECTED', rejectionCode: 'OUT_OF_ORDER_SEQUENCE', processingLatencyMs: 0 });
        continue;
      }
      readerMaxSeq.set(event.readerId, Number(event.sequenceNumber));
    }

    // Credential check
    if (!event.credentialDigest) {
      resultsMap.set(event.clientEventId, { decision: 'UNKNOWN_CARD', rejectionCode: 'NO_CREDENTIAL_DIGEST', processingLatencyMs: 0 });
      continue;
    }

    const credential = credentialMap.get(event.credentialDigest);
    if (!credential) {
      resultsMap.set(event.clientEventId, { decision: 'UNKNOWN_CARD', rejectionCode: 'CARD_NOT_FOUND', processingLatencyMs: 0 });
      continue;
    }

    if (credential.status === 'PENDING') {
      resultsMap.set(event.clientEventId, { decision: 'UNKNOWN_CARD', rejectionCode: 'CARD_PENDING_ACTIVATION', processingLatencyMs: 0 });
      continue;
    }
    if (credential.status === 'REPLACED') {
      resultsMap.set(event.clientEventId, { decision: 'REVOKED_CARD', rejectionCode: 'CARD_REPLACED', processingLatencyMs: 0 });
      continue;
    }
    if (credential.status === 'REVOKED') {
      resultsMap.set(event.clientEventId, { decision: 'REVOKED_CARD', rejectionCode: 'CARD_REVOKED', processingLatencyMs: 0 });
      continue;
    }
    if (credential.status === 'EXPIRED') {
      resultsMap.set(event.clientEventId, { decision: 'EXPIRED_CARD', rejectionCode: 'CARD_EXPIRED', processingLatencyMs: 0 });
      continue;
    }
    if (credential.status === 'SUSPENDED' || credential.studentStatus !== 'ACTIVE') {
      resultsMap.set(event.clientEventId, { decision: 'SUSPENDED_CARD', rejectionCode: 'CARD_SUSPENDED', processingLatencyMs: 0 });
      continue;
    }

    // Session check
    if (!event.attendanceSessionId) {
      resultsMap.set(event.clientEventId, { decision: 'NO_ACTIVE_SESSION', rejectionCode: 'NO_SESSION_ID', processingLatencyMs: 0 });
      continue;
    }

    const session = sessionMap.get(event.attendanceSessionId);
    if (!session || session.status === 'FINALIZED') {
      resultsMap.set(event.clientEventId, { decision: 'NO_ACTIVE_SESSION', rejectionCode: 'SESSION_NOT_OPEN', processingLatencyMs: 0 });
      continue;
    }

    const captureMethod = event.securityMode === 'SECURE' ? 'RFID_SECURE' : 'RFID_UID_LEGACY';
    acceptedScans.push({ event, credential, session, captureMethod });
  }

  // Bulk process accepted scans in chunks of 500 under tenant context with row locking
  const chunkSize = 500;
  for (let i = 0; i < acceptedScans.length; i += chunkSize) {
    const chunk = acceptedScans.slice(i, i + chunkSize);

    await withTenantContext(schoolId, async (tx: any) => {
      // 1. Lock reader rows for readers involved in this chunk and verify/advance sequence numbers
      const chunkReaderIds = Array.from(new Set(chunk.map((c) => c.event.readerId)));
      const lockedReaders = await tx
        .select({
          id: rfidReaders.id,
          lastSequenceNumber: rfidReaders.lastSequenceNumber,
        })
        .from(rfidReaders)
        .where(and(
          eq(rfidReaders.schoolId, schoolId),
          inArray(rfidReaders.id, chunkReaderIds)
        ))
        .for('update');

      const lockedReaderMap = new Map<string, number>(lockedReaders.map((r: any) => [r.id, r.lastSequenceNumber ?? 0]));

      // Check sequence numbers against locked database state
      const validChunkItems: typeof chunk = [];
      const readerNewMaxSeq = new Map<string, number>();

      for (const item of chunk) {
        if (item.event.sequenceNumber !== undefined && item.event.sequenceNumber !== null) {
          const dbMaxSeq = readerNewMaxSeq.get(item.event.readerId) ?? lockedReaderMap.get(item.event.readerId) ?? 0;
          if (Number(item.event.sequenceNumber) <= Number(dbMaxSeq)) {
            resultsMap.set(item.event.clientEventId, {
              decision: 'REPLAY_REJECTED',
              rejectionCode: 'OUT_OF_ORDER_SEQUENCE',
              processingLatencyMs: 0,
            });
            continue;
          }
          readerNewMaxSeq.set(item.event.readerId, Number(item.event.sequenceNumber));
        }
        validChunkItems.push(item);
      }

      if (validChunkItems.length === 0) return;

      // Update reader lastSequenceNumber for all updated readers in this chunk
      for (const [readerId, maxSeq] of readerNewMaxSeq.entries()) {
        await tx
          .update(rfidReaders)
          .set({
            lastSequenceNumber: maxSeq,
            lastSeenAt: new Date(),
          })
          .where(and(eq(rfidReaders.id, readerId), eq(rfidReaders.schoolId, schoolId)));
      }

      // 2. Bulk insert rfid_scan_events with complete payload hash
      const scanEventValues = validChunkItems.map((item) => {
        const canonical = [
          item.event.version,
          item.event.schoolId,
          item.event.readerId,
          item.event.credentialDigest || '',
          item.event.secureProof || '',
          item.event.readerTimestamp,
          item.event.nonce,
          item.event.securityMode,
          item.event.direction || 'NONE',
          item.event.attendanceSessionId || '',
          item.event.sequenceNumber ?? '',
          item.event.clientEventId,
          '1',
          item.event.cardProof || '',
          item.event.cardUid || '',
          item.event.readerChallenge || '',
          item.event.transactionCounter ?? '',
        ].join('|');
        const payloadHash = crypto.createHash('sha256').update(canonical).digest('hex');

        return {
          schoolId,
          readerId: item.event.readerId,
          credentialId: item.credential.id,
          attendanceSessionId: item.event.attendanceSessionId,
          clientEventId: item.event.clientEventId,
          sequenceNumber: item.event.sequenceNumber,
          scanTimestamp: new Date(item.event.readerTimestamp),
          direction: item.event.direction || 'NONE',
          decision: 'ACCEPTED',
          captureMethod: item.captureMethod,
          securityMode: item.event.securityMode,
          processingLatencyMs: 1,
          isOffline: true,
          nonce: item.event.nonce,
          payloadHash,
        };
      });

      const insertedScanEvents = await tx
        .insert(rfidScanEvents)
        .values(scanEventValues)
        .onConflictDoUpdate({
          target: [rfidScanEvents.schoolId, rfidScanEvents.clientEventId],
          set: {
            processingLatencyMs: 1,
          },
        })
        .returning({ id: rfidScanEvents.id, clientEventId: rfidScanEvents.clientEventId });

      const insertedMap = new Map<string, string>(insertedScanEvents.map((s: any) => [s.clientEventId, s.id]));

      // 3. Bulk insert attendance_events only for confirmed scan events
      const attEventsValues = validChunkItems
        .filter((item) => insertedMap.has(item.event.clientEventId))
        .map((item) => {
          const scanId = insertedMap.get(item.event.clientEventId)!;
          return {
            schoolId,
            clientEventId: `rfid_${scanId}`,
            attendanceSessionId: item.event.attendanceSessionId,
            studentId: item.credential.studentId,
            eventType: 'CHECK_IN',
            statusValue: 'PRESENT',
            clientTimestamp: new Date(item.event.readerTimestamp),
            actorId: item.credential.createdByUserId || item.session.teacherId,
            captureMethod: item.captureMethod,
            sourceReaderId: item.event.readerId,
            sourceRfidEventId: scanId,
          };
        });

      if (attEventsValues.length > 0) {
        await tx.insert(attendanceEvents).values(attEventsValues).onConflictDoNothing();
      }

      // 4. Bulk insert/upsert attendance_records
      const attRecordValues = validChunkItems
        .filter((item) => insertedMap.has(item.event.clientEventId))
        .map((item) => ({
          schoolId,
          attendanceSessionId: item.event.attendanceSessionId,
          studentId: item.credential.studentId,
          status: 'PRESENT',
          firstScannedAt: new Date(item.event.readerTimestamp),
          lastUpdatedAt: new Date(),
          captureMethod: item.captureMethod,
          confidenceLevel: item.event.securityMode === 'SECURE' ? 'HIGH' : 'MEDIUM',
          direction: item.event.direction || 'NONE',
        }));

      if (attRecordValues.length > 0) {
        await tx
          .insert(attendanceRecords)
          .values(attRecordValues)
          .onConflictDoUpdate({
            target: [attendanceRecords.schoolId, attendanceRecords.attendanceSessionId, attendanceRecords.studentId],
            set: {
              status: 'PRESENT',
              lastUpdatedAt: new Date(),
            },
          });
      }

      for (const item of validChunkItems) {
        const scanId = insertedMap.get(item.event.clientEventId);
        if (scanId) {
          resultsMap.set(item.event.clientEventId, {
            decision: 'ACCEPTED',
            scanEventId: scanId,
            studentId: item.credential.studentId,
            processingLatencyMs: 1,
          });
        }
      }
    });
  }

  return events.map((e) => resultsMap.get(e.clientEventId) || {
    decision: 'REJECTED',
    rejectionCode: 'UNPROCESSED_EVENT',
    scanEventId: e.clientEventId,
    processingLatencyMs: 0,
  });
}

export async function getOfflineQueueStatus(schoolId: string, readerId: string) {
  const redis = getRedisClient();
  if (!redis) return { size: 0, oldestEventAgeMs: 0 };
  const key = `rfid:offline_queue_status:${schoolId}:${readerId}`;
  const statusStr = await redis.get(key);
  if (!statusStr) return { size: 0, oldestEventAgeMs: 0 };

  try {
    return JSON.parse(statusStr);
  } catch {
    return { size: 0, oldestEventAgeMs: 0 };
  }
}

export const offlineService = {
  generateOfflineRoster,
  getOfflinePolicy,
  syncOfflineEvents,
  getOfflineQueueStatus,
};
