import crypto from 'node:crypto';
import { db, withTenantContext } from '../../db';
import {
  schools,
  rfidReaders,
  rfidCredentials,
  rfidScanEvents,
  attendanceSessions,
  attendanceRecords,
  attendanceEvents,
  students,
  enrollments,
  academicYears,
  classSections,
  teacherAssignments,
} from '../../db/schema';
import { eq, and, gt, desc, inArray, sql } from 'drizzle-orm';
import {
  canonicalizeEpc,
  canonicalizeTid,
  computeEpcDigest,
  computeTidDigest,
  getEpcLastFour,
  verifyZebraHmacSignature,
  verifyBearerToken,
} from './cryptoService';
import { decryptReaderSecret } from './readerService';
import { getRedisClient } from '../redisService';

export const MAX_PAYLOAD_BYTES = 512 * 1024; // 512 KB
export const MAX_BATCH_READS = 250;

export interface ZebraTagReadRaw {
  epc?: string;
  idHex?: string;
  tag_id?: string;
  antenna?: number | string;
  antenna_port?: number | string;
  peakRssi?: number | string;
  rssi?: number | string;
  timestamp?: string | number;
  firstSeen?: string | number;
  lastSeen?: string | number;
  reads?: number;
  read_count?: number;
  count?: number;
  format?: string;
  tid?: string;
  tidHex?: string;
  vendorEventId?: string;
  eventId?: string;
}

export interface ZebraIotPayload {
  data?: ZebraTagReadRaw[];
  tag_reads?: ZebraTagReadRaw[];
  events?: ZebraTagReadRaw[];
  type?: string;
  timestamp?: string | number;
  reader_name?: string;
  hostname?: string;
  deviceId?: string;
  status?: string;
  [key: string]: any;
}

export interface IngestTagResult {
  epcDigest: string;
  epcLastFour: string;
  tidDigest?: string;
  decision: string;
  reason?: string;
  studentId?: string;
  studentName?: string;
  rollNumber?: string;
  classSectionId?: string;
  attendanceSessionId?: string;
  attendanceRecordId?: string;
  scanEventId?: string;
  duplicate?: boolean;
}

export interface ZebraIngestResponse {
  success: boolean;
  readerId: string;
  readerName: string;
  processedCount: number;
  acceptedCount: number;
  duplicateCount: number;
  rejectedCount: number;
  results: IngestTagResult[];
}

/**
 * Validates payload against prototype-pollution attacks.
 */
function sanitizePayloadObject(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return true;
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return false;
    }
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      if (!sanitizePayloadObject(obj[key])) return false;
    }
  }
  return true;
}

/**
 * Normalizes varied Zebra IoT Connector JSON shapes into a uniform array of tag reads.
 */
export function extractZebraTagReads(body: any): { reads: ZebraTagReadRaw[]; readerIdentifier?: string; eventType?: string } {
  if (!body) return { reads: [] };

  if (!sanitizePayloadObject(body)) {
    throw new Error('MALFORMED_PAYLOAD: Prototype pollution keys detected');
  }

  // Case 1: Root is an Array of tag reads
  if (Array.isArray(body)) {
    return { reads: body };
  }

  // Case 2: Standard Zebra IoT Connector format with "data", "tag_reads", or "events" array
  const reads = body.data || body.tag_reads || body.events || [];
  const readerIdentifier = body.reader_name || body.hostname || body.deviceId || body.readerId;
  const eventType = body.type || (body.status ? 'heartbeat' : 'tag_read');

  if (Array.isArray(reads) && reads.length > 0) {
    return { reads, readerIdentifier, eventType };
  }

  // Case 3: Single tag read at root
  if (body.epc || body.idHex || body.tag_id) {
    return { reads: [body], readerIdentifier, eventType };
  }

  return { reads: [], readerIdentifier, eventType };
}

/**
 * Ingests and processes a Zebra IoT Connector webhook payload.
 */
export async function processZebraIotWebhook(params: {
  schoolId: string;
  rawBody: string | Buffer;
  parsedBody: any;
  headers: Record<string, string | string[] | undefined>;
}): Promise<ZebraIngestResponse> {
  const { schoolId, rawBody, parsedBody, headers } = params;

  // 1. Enforce Payload Size Bounds
  const rawBytesLength = Buffer.isBuffer(rawBody) ? rawBody.length : Buffer.byteLength(rawBody || '', 'utf8');
  if (rawBytesLength > MAX_PAYLOAD_BYTES) {
    throw new Error(`OVERSIZED_PAYLOAD: Payload size ${rawBytesLength} exceeds maximum limit of ${MAX_PAYLOAD_BYTES} bytes`);
  }

  // 2. Identify Reader from Headers or Payload
  const headerReaderId =
    (headers['x-reader-id'] as string) ||
    (headers['x-zebra-reader-id'] as string) ||
    (headers['x-device-id'] as string);

  const { reads, readerIdentifier, eventType } = extractZebraTagReads(parsedBody);
  const readerSearchKey = headerReaderId || readerIdentifier;

  if (!readerSearchKey) {
    throw new Error('UNAUTHORIZED_READER: Missing reader identification in headers or payload');
  }

  // Enforce batch size limit
  if (reads.length > MAX_BATCH_READS) {
    throw new Error(`OVERSIZED_BATCH: Batch contains ${reads.length} reads, maximum permitted is ${MAX_BATCH_READS}`);
  }

  // 3. Query Reader and School Timezone from Database with Tenant Isolation
  const { reader, schoolTimezone } = await withTenantContext(schoolId, async (tx) => {
    const [byUuid] = /^[0-9a-fA-F-]{36}$/.test(readerSearchKey)
      ? await tx
          .select()
          .from(rfidReaders)
          .where(and(eq(rfidReaders.id, readerSearchKey), eq(rfidReaders.schoolId, schoolId)))
      : [];

    let foundReader = byUuid;
    if (!foundReader) {
      const [byDeviceId] = await tx
        .select()
        .from(rfidReaders)
        .where(and(eq(rfidReaders.deviceId, readerSearchKey), eq(rfidReaders.schoolId, schoolId)));
      foundReader = byDeviceId;
    }

    const [sc] = await tx
      .select({ timezone: schools.timezone })
      .from(schools)
      .where(eq(schools.id, schoolId))
      .limit(1);

    return {
      reader: foundReader,
      schoolTimezone: sc?.timezone || 'Asia/Kolkata',
    };
  });

  if (!reader) {
    throw new Error(`UNAUTHORIZED_READER: Reader '${readerSearchKey}' not registered to school '${schoolId}'`);
  }

  if (reader.status !== 'ACTIVE') {
    throw new Error(`FORBIDDEN_READER: Reader status is '${reader.status}'`);
  }

  // 4. Authenticate Reader (Strict per-reader fail-closed HMAC Signature or Bearer Token)
  const readerSecret = reader.sharedSecretEncrypted
    ? decryptReaderSecret(reader.sharedSecretEncrypted)
    : null;

  if (!readerSecret && !reader.bearerTokenDigest) {
    throw new Error('CONFIG_ERROR: Reader has no provisioned shared secret or bearer token digest (fail-closed)');
  }

  const signatureHeader =
    (headers['x-zebra-signature'] as string) ||
    (headers['x-reader-signature'] as string) ||
    (headers['x-signature'] as string) ||
    (headers['x-hub-signature-256'] as string);

  const authHeader = headers['authorization'] as string;

  let isAuthValid = false;

  if (signatureHeader && readerSecret) {
    isAuthValid = verifyZebraHmacSignature(rawBody, signatureHeader, readerSecret);
  } else if (authHeader) {
    // Check bearer token against bearerTokenDigest if stored, or readerSecret
    if (reader.bearerTokenDigest) {
      isAuthValid = verifyBearerToken(authHeader, reader.bearerTokenDigest);
    } else if (readerSecret) {
      isAuthValid = verifyBearerToken(authHeader, readerSecret);
    }
  }

  if (!isAuthValid) {
    throw new Error('UNAUTHORIZED_READER: Invalid or missing HMAC signature or Bearer token');
  }

  // 5. Update Reader Heartbeat / Last Seen
  await withTenantContext(schoolId, async (tx) => {
    await tx
      .update(rfidReaders)
      .set({
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(rfidReaders.id, reader.id));
  });

  // Heartbeat / keepalive payload with no tag reads
  if (reads.length === 0 && (eventType === 'heartbeat' || parsedBody.type === 'heartbeat')) {
    return {
      success: true,
      readerId: reader.id,
      readerName: reader.name,
      processedCount: 0,
      acceptedCount: 0,
      duplicateCount: 0,
      rejectedCount: 0,
      results: [],
    };
  }

  const results: IngestTagResult[] = [];
  let acceptedCount = 0;
  let duplicateCount = 0;
  let rejectedCount = 0;

  const redis = getRedisClient();
  const cooldownMs = parseInt(process.env.RFID_DUPLICATE_TAP_COOLDOWN_MS || '30000', 10);
  const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');

  // 6. Process Tag Reads
  for (const read of reads) {
    const rawEpc = read.epc || read.idHex || read.tag_id;
    if (!rawEpc) {
      rejectedCount++;
      results.push({
        epcDigest: '',
        epcLastFour: '****',
        decision: 'REJECTED',
        reason: 'MISSING_EPC_IN_READ_EVENT',
      });
      continue;
    }

    let canonicalEpcHex: string;
    let epcDigest: string;
    let epcLast4: string;
    let tidDigest: string | undefined;

    try {
      canonicalEpcHex = canonicalizeEpc(rawEpc);
      epcDigest = computeEpcDigest(canonicalEpcHex);
      epcLast4 = getEpcLastFour(canonicalEpcHex);

      const rawTid = read.tid || read.tidHex;
      if (rawTid && typeof rawTid === 'string') {
        const canonicalTidHex = canonicalizeTid(rawTid);
        tidDigest = computeTidDigest(canonicalTidHex);
      }
    } catch (err: any) {
      rejectedCount++;
      results.push({
        epcDigest: '',
        epcLastFour: '****',
        decision: 'REJECTED',
        reason: `INVALID_EPC_FORMAT: ${err.message}`,
      });
      continue;
    }

    const timestampVal = read.timestamp || read.firstSeen || read.lastSeen || Date.now();
    const scanDate = typeof timestampVal === 'number' ? new Date(timestampVal) : new Date(timestampVal);
    const scanTimeMs = isNaN(scanDate.getTime()) ? Date.now() : scanDate.getTime();
    const truncatedSecond = Math.floor(scanTimeMs / 1000);
    const antennaPort = typeof read.antenna === 'number' ? read.antenna : typeof read.antenna_port === 'number' ? read.antenna_port : parseInt(String(read.antenna || read.antenna_port || '1'), 10) || 1;
    const peakRssi = typeof read.peakRssi === 'number' ? Math.round(read.peakRssi) : typeof read.rssi === 'number' ? Math.round(read.rssi) : parseInt(String(read.peakRssi || read.rssi || '-60'), 10) || -60;
    const readCount = typeof read.reads === 'number' ? read.reads : typeof read.read_count === 'number' ? read.read_count : typeof read.count === 'number' ? read.count : 1;
    const vendorEventId = read.vendorEventId || read.eventId || undefined;

    // Stable, deterministic client event ID and idempotency key
    const clientEventId = `${reader.id}-${epcDigest}-${truncatedSecond}`;
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${schoolId}:${reader.id}:${vendorEventId || `${epcDigest}:${truncatedSecond}:${antennaPort}`}`)
      .digest('hex');

    // 7. Lookup Active Credential by Digest
    const credential = await withTenantContext(schoolId, async (tx) => {
      const [cred] = await tx
        .select()
        .from(rfidCredentials)
        .where(
          and(
            eq(rfidCredentials.schoolId, schoolId),
            eq(rfidCredentials.credentialDigest, epcDigest)
          )
        )
        .orderBy(desc(rfidCredentials.createdAt))
        .limit(1);
      return cred;
    });

    if (!credential) {
      rejectedCount++;
      // Record rejected event with idempotency check
      await withTenantContext(schoolId, async (tx) => {
        await tx
          .insert(rfidScanEvents)
          .values({
            schoolId,
            readerId: reader.id,
            clientEventId,
            idempotencyKey,
            vendorEventId,
            epcDigest,
            epcLastFour: epcLast4,
            tidDigest,
            antennaPort,
            peakRssi,
            readCount,
            scanTimestamp: new Date(scanTimeMs),
            decision: 'UNKNOWN_CARD',
            rejectionCode: 'UNKNOWN_EPC_TAG',
            captureMethod: 'RFID_GATE',
            securityMode: 'UHF_EPC',
            payloadHash,
          })
          .onConflictDoNothing();
      });

      results.push({
        epcDigest,
        epcLastFour: epcLast4,
        tidDigest,
        decision: 'UNKNOWN_CARD',
        reason: 'UNREGISTERED_EPC_BADGE',
      });
      continue;
    }

    if (credential.status !== 'ACTIVE') {
      rejectedCount++;
      const rejectionDecision =
        credential.status === 'REVOKED'
          ? 'REVOKED_CARD'
          : credential.status === 'SUSPENDED'
          ? 'SUSPENDED_CARD'
          : credential.status === 'EXPIRED'
          ? 'EXPIRED_CARD'
          : 'UNKNOWN_CARD';

      await withTenantContext(schoolId, async (tx) => {
        await tx
          .insert(rfidScanEvents)
          .values({
            schoolId,
            readerId: reader.id,
            credentialId: credential.id,
            clientEventId,
            idempotencyKey,
            vendorEventId,
            epcDigest,
            epcLastFour: epcLast4,
            tidDigest,
            antennaPort,
            peakRssi,
            readCount,
            scanTimestamp: new Date(scanTimeMs),
            decision: rejectionDecision,
            rejectionCode: `CARD_${credential.status}`,
            captureMethod: 'RFID_GATE',
            securityMode: 'UHF_EPC',
            payloadHash,
          })
          .onConflictDoNothing();
      });

      results.push({
        epcDigest,
        epcLastFour: epcLast4,
        tidDigest,
        decision: rejectionDecision,
        reason: `CREDENTIAL_${credential.status}`,
      });
      continue;
    }

    // 8. Debounce / Duplicate Walk Check
    const debounceKey = `rfid:debounce:${schoolId}:${reader.id}:${epcDigest}`;
    let isDebounced = false;

    if (redis) {
      try {
        // Atomic acquire lock in Redis (NX = only set if not exists, PX = millisecond TTL)
        // If acquired is null, key already exists within cooldown window -> atomic duplicate!
        const acquired = await redis.set(debounceKey, '1', 'PX', cooldownMs, 'NX');
        if (!acquired) {
          isDebounced = true;
        }
      } catch {
        // Fall back to database query
      }
    }

    if (!isDebounced) {
      const cooldownThreshold = new Date(scanTimeMs - cooldownMs);
      const recent = await withTenantContext(schoolId, async (tx) => {
        const [event] = await tx
          .select({ id: rfidScanEvents.id })
          .from(rfidScanEvents)
          .innerJoin(rfidCredentials, eq(rfidScanEvents.credentialId, rfidCredentials.id))
          .where(
            and(
              eq(rfidScanEvents.schoolId, schoolId),
              eq(rfidScanEvents.readerId, reader.id),
              eq(rfidScanEvents.decision, 'ACCEPTED'),
              gt(rfidScanEvents.scanTimestamp, cooldownThreshold),
              eq(rfidCredentials.credentialDigest, epcDigest)
            )
          )
          .limit(1);
        return event;
      });
      if (recent) isDebounced = true;
    }

    if (isDebounced) {
      duplicateCount++;
      // Record debounced scan event
      await withTenantContext(schoolId, async (tx) => {
        await tx
          .insert(rfidScanEvents)
          .values({
            schoolId,
            readerId: reader.id,
            credentialId: credential.id,
            clientEventId: `${clientEventId}-debounced-${Date.now()}`,
            idempotencyKey,
            vendorEventId,
            epcDigest,
            epcLastFour: epcLast4,
            tidDigest,
            antennaPort,
            peakRssi,
            readCount,
            scanTimestamp: new Date(scanTimeMs),
            decision: 'DUPLICATE',
            rejectionCode: 'DEBOUNCE_COOLDOWN_ACTIVE',
            captureMethod: 'RFID_GATE',
            securityMode: 'UHF_EPC',
            payloadHash,
          })
          .onConflictDoNothing();
      });

      results.push({
        epcDigest,
        epcLastFour: epcLast4,
        tidDigest,
        decision: 'DUPLICATE',
        reason: 'ALREADY_PROCESSED_COOLDOWN_ACTIVE',
        duplicate: true,
      });
      continue;
    }

    // 9. Lookup Student & Active Class Section Enrollment
    const studentInfo = await withTenantContext(schoolId, async (tx) => {
      const [st] = await tx
        .select({
          studentId: students.id,
          fullName: students.name,
          rollNumber: enrollments.rollNumber,
          status: students.status,
          classSectionId: enrollments.classSectionId,
          academicYearId: enrollments.academicYearId,
        })
        .from(students)
        .innerJoin(enrollments, and(eq(enrollments.studentId, students.id), eq(enrollments.status, 'ACTIVE')))
        .innerJoin(academicYears, and(eq(academicYears.id, enrollments.academicYearId), eq(academicYears.isCurrent, true)))
        .where(and(eq(students.id, credential.studentId), eq(students.schoolId, schoolId)))
        .limit(1);
      return st;
    });

    if (!studentInfo || studentInfo.status !== 'ACTIVE') {
      rejectedCount++;
      results.push({
        epcDigest,
        epcLastFour: epcLast4,
        tidDigest,
        decision: 'SUSPENDED_CARD',
        reason: 'STUDENT_INACTIVE_OR_UNENROLLED',
      });
      continue;
    }

    // 10. Find or Resolve Today's Attendance Session (using school's configured timezone)
    const todayDate = new Intl.DateTimeFormat('en-CA', { timeZone: schoolTimezone }).format(scanDate);
    // Use reader's assigned classSection if configured, otherwise student's active enrolled classSection
    let targetClassSectionId = reader.assignedClassSectionId || studentInfo.classSectionId;

    let session = await withTenantContext(schoolId, async (tx) => {
      const [s] = await tx
        .select()
        .from(attendanceSessions)
        .where(
          and(
            eq(attendanceSessions.schoolId, schoolId),
            eq(attendanceSessions.classSectionId, targetClassSectionId),
            eq(attendanceSessions.sessionDate, todayDate)
          )
        )
        .limit(1);
      return s;
    });

    // Check if session is already finalized
    if (session && session.status === 'FINALIZED') {
      rejectedCount++;
      await withTenantContext(schoolId, async (tx) => {
        await tx
          .insert(rfidScanEvents)
          .values({
            schoolId,
            readerId: reader.id,
            credentialId: credential.id,
            clientEventId: `${clientEventId}-finalized-${Date.now()}`,
            idempotencyKey,
            vendorEventId,
            epcDigest,
            epcLastFour: epcLast4,
            tidDigest,
            antennaPort,
            peakRssi,
            readCount,
            scanTimestamp: new Date(scanTimeMs),
            decision: 'UNREGISTERED_CARD',
            rejectionCode: 'SESSION_ALREADY_FINALIZED',
            captureMethod: 'RFID_GATE',
            securityMode: 'UHF_EPC',
            payloadHash,
          })
          .onConflictDoNothing();
      });

      results.push({
        epcDigest,
        epcLastFour: epcLast4,
        tidDigest,
        decision: 'UNREGISTERED_CARD',
        reason: 'SESSION_ALREADY_FINALIZED',
      });
      continue;
    }

    // If no session exists for today, resolve assigned teacher and auto-open session
    if (!session) {
      const teacherAssignment = await withTenantContext(schoolId, async (tx) => {
        const [ta] = await tx
          .select({
            teacherId: teacherAssignments.teacherId,
          })
          .from(teacherAssignments)
          .where(
            and(
              eq(teacherAssignments.schoolId, schoolId),
              eq(teacherAssignments.classSectionId, targetClassSectionId)
            )
          )
          .limit(1);
        return ta;
      });

      const assignedTeacherId = teacherAssignment?.teacherId;

      if (!assignedTeacherId) {
        rejectedCount++;
        await withTenantContext(schoolId, async (tx) => {
          await tx
            .insert(rfidScanEvents)
            .values({
              schoolId,
              readerId: reader.id,
              credentialId: credential.id,
              clientEventId: `${clientEventId}-no-teacher-${Date.now()}`,
              idempotencyKey,
              vendorEventId,
              epcDigest,
              epcLastFour: epcLast4,
              tidDigest,
              antennaPort,
              peakRssi,
              readCount,
              scanTimestamp: new Date(scanTimeMs),
              decision: 'NO_ACTIVE_SESSION',
              rejectionCode: 'NO_OPEN_SESSION_AND_NO_ASSIGNED_TEACHER',
              captureMethod: 'RFID_GATE',
              securityMode: 'UHF_EPC',
              payloadHash,
            })
            .onConflictDoNothing();
        });

        results.push({
          epcDigest,
          epcLastFour: epcLast4,
          tidDigest,
          decision: 'REJECTED',
          reason: 'NO_OPEN_SESSION_AND_NO_ASSIGNED_TEACHER',
        });
        continue;
      }

      session = await withTenantContext(schoolId, async (tx) => {
        const [newSession] = await tx
          .insert(attendanceSessions)
          .values({
            schoolId,
            classSectionId: targetClassSectionId,
            teacherId: assignedTeacherId,
            sessionDate: todayDate,
            status: 'OPEN',
            startedAt: new Date(scanTimeMs),
            sourceMode: 'RFID_GATE',
          })
          .onConflictDoNothing()
          .returning();

        if (newSession) return newSession;

        // In case of race condition inserting session
        const [winner] = await tx
          .select()
          .from(attendanceSessions)
          .where(
            and(
              eq(attendanceSessions.schoolId, schoolId),
              eq(attendanceSessions.classSectionId, targetClassSectionId),
              eq(attendanceSessions.sessionDate, todayDate)
            )
          )
          .limit(1);
        return winner;
      });
    }

    if (!session) {
      rejectedCount++;
      continue;
    }

    // 11. Atomically Claim Scan Event & Record Attendance
    const recordResult = await withTenantContext(schoolId, async (tx) => {
      // 11a. Row-level serialization lock on credential to eliminate check-then-insert race conditions
      await tx.execute(sql`SELECT id FROM rfid_credentials WHERE id = ${credential.id} FOR UPDATE`);

      // 11b. Check for recent ACCEPTED event within cooldown threshold
      const cooldownThreshold = new Date(scanTimeMs - cooldownMs);
      const [recentAccepted] = await tx
        .select({ id: rfidScanEvents.id })
        .from(rfidScanEvents)
        .where(
          and(
            eq(rfidScanEvents.schoolId, schoolId),
            eq(rfidScanEvents.readerId, reader.id),
            eq(rfidScanEvents.credentialId, credential.id),
            eq(rfidScanEvents.decision, 'ACCEPTED'),
            gt(rfidScanEvents.scanTimestamp, cooldownThreshold)
          )
        )
        .limit(1);

      if (recentAccepted) {
        return { isDuplicate: true, isExisting: false, scanEventId: recentAccepted.id, recordId: undefined };
      }

      // 11c. Insert Scan Event with Idempotency Key Claim
      const [claimedEvent] = await tx
        .insert(rfidScanEvents)
        .values({
          schoolId,
          readerId: reader.id,
          credentialId: credential.id,
          attendanceSessionId: session!.id,
          clientEventId,
          idempotencyKey,
          vendorEventId,
          epcDigest,
          epcLastFour: epcLast4,
          tidDigest,
          antennaPort,
          peakRssi,
          readCount,
          scanTimestamp: new Date(scanTimeMs),
          decision: 'ACCEPTED',
          captureMethod: 'RFID_GATE',
          securityMode: 'UHF_EPC',
          payloadHash,
        })
        .onConflictDoNothing()
        .returning();

      // If already claimed concurrently with exact same idempotencyKey, fetch existing event
      if (!claimedEvent) {
        const [existingEvent] = await tx
          .select()
          .from(rfidScanEvents)
          .where(and(eq(rfidScanEvents.schoolId, schoolId), eq(rfidScanEvents.idempotencyKey, idempotencyKey)))
          .limit(1);
        return { isDuplicate: false, isExisting: true, scanEventId: existingEvent?.id || clientEventId, recordId: undefined };
      }

      // 11d. Check existing attendance record in this session
      const [existingRecord] = await tx
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.schoolId, schoolId),
            eq(attendanceRecords.attendanceSessionId, session!.id),
            eq(attendanceRecords.studentId, studentInfo.studentId)
          )
        );

      let recordId = existingRecord?.id;

      if (existingRecord) {
        // Protect manual attendance records:
        // If marked with captureMethod === 'MANUAL' or status is already PRESENT or EXCUSED,
        // NEVER overwrite teacher's manual decision with RFID_GATE!
        const isManual = existingRecord.captureMethod === 'MANUAL';
        if (!isManual && existingRecord.status !== 'PRESENT' && existingRecord.status !== 'EXCUSED') {
          await tx
            .update(attendanceRecords)
            .set({
              status: 'PRESENT',
              captureMethod: 'RFID_GATE',
              lastUpdatedAt: new Date(),
            })
            .where(eq(attendanceRecords.id, existingRecord.id));
        }
      } else {
        const [insertedRecord] = await tx
          .insert(attendanceRecords)
          .values({
            schoolId,
            attendanceSessionId: session!.id,
            studentId: studentInfo.studentId,
            status: 'PRESENT',
            captureMethod: 'RFID_GATE',
            firstScannedAt: new Date(scanTimeMs),
            lastUpdatedAt: new Date(),
          })
          .onConflictDoNothing()
          .returning();
        recordId = insertedRecord?.id;
      }

      // 11e. Record Attendance Event Audit Log (strictly no raw EPC/TID)
      await tx.insert(attendanceEvents).values({
        schoolId,
        clientEventId,
        attendanceSessionId: session!.id,
        studentId: studentInfo.studentId,
        eventType: 'ATTENDANCE_EVENT',
        statusValue: 'PRESENT',
        clientTimestamp: new Date(scanTimeMs),
        serverReceivedAt: new Date(),
        actorId: session!.teacherId,
        captureMethod: 'RFID_GATE',
        sourceReaderId: reader.id,
        metadata: {
          antenna: antennaPort,
          peakRssi,
          method: 'UHF_GATE_FX9600',
        },
      });

      return { isDuplicate: false, isExisting: false, scanEventId: claimedEvent.id, recordId };
    });

    if (recordResult.isDuplicate) {
      duplicateCount++;
      await withTenantContext(schoolId, async (tx) => {
        await tx
          .insert(rfidScanEvents)
          .values({
            schoolId,
            readerId: reader.id,
            credentialId: credential.id,
            clientEventId: `${clientEventId}-debounced-${Date.now()}`,
            idempotencyKey,
            vendorEventId,
            epcDigest,
            epcLastFour: epcLast4,
            tidDigest,
            antennaPort,
            peakRssi,
            readCount,
            scanTimestamp: new Date(scanTimeMs),
            decision: 'DUPLICATE',
            rejectionCode: 'DEBOUNCE_COOLDOWN_ACTIVE',
            captureMethod: 'RFID_GATE',
            securityMode: 'UHF_EPC',
            payloadHash,
          })
          .onConflictDoNothing();
      });

      results.push({
        epcDigest,
        epcLastFour: epcLast4,
        tidDigest,
        decision: 'DUPLICATE',
        reason: 'ALREADY_PROCESSED_COOLDOWN_ACTIVE',
        duplicate: true,
        scanEventId: recordResult.scanEventId,
      });
      continue;
    }

    if (recordResult.isExisting) {
      duplicateCount++;
      results.push({
        epcDigest,
        epcLastFour: epcLast4,
        tidDigest,
        decision: 'DUPLICATE',
        reason: 'IDEMPOTENT_TRANSACTION_RETRY',
        duplicate: true,
        scanEventId: recordResult.scanEventId,
      });
      continue;
    }

    // Set Redis Debounce Cache
    if (redis) {
      try {
        await redis.set(debounceKey, '1', 'PX', cooldownMs);
      } catch {
        // Non-fatal if Redis cache write fails
      }
    }

    acceptedCount++;
    results.push({
      epcDigest,
      epcLastFour: epcLast4,
      tidDigest,
      decision: 'ACCEPTED',
      studentId: studentInfo.studentId,
      studentName: studentInfo.fullName,
      rollNumber: studentInfo.rollNumber || undefined,
      classSectionId: targetClassSectionId,
      attendanceSessionId: session.id,
      attendanceRecordId: recordResult.recordId,
      scanEventId: recordResult.scanEventId,
    });
  }

  return {
    success: true,
    readerId: reader.id,
    readerName: reader.name,
    processedCount: reads.length,
    acceptedCount,
    duplicateCount,
    rejectedCount,
    results,
  };
}
