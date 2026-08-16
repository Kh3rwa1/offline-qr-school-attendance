import crypto from 'node:crypto';
import { db, withTenantContext } from '../../db';
import {
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
import { eq, and, gt, desc, inArray } from 'drizzle-orm';
import {
  canonicalizeEpc,
  computeEpcDigest,
  getEpcLastFour,
  verifyZebraHmacSignature,
  verifyBearerToken,
} from './cryptoService';
import { decryptReaderSecret } from './readerService';
import { getRedisClient } from '../redisService';

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
  format?: string;
  tid?: string;
  tidHex?: string;
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
 * Normalizes varied Zebra IoT Connector JSON shapes into a uniform array of tag reads.
 */
export function extractZebraTagReads(body: any): { reads: ZebraTagReadRaw[]; readerIdentifier?: string; eventType?: string } {
  if (!body) return { reads: [] };

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

  // 1. Identify Reader from Headers or Payload
  const headerReaderId =
    (headers['x-reader-id'] as string) ||
    (headers['x-zebra-reader-id'] as string) ||
    (headers['x-device-id'] as string);

  const { reads, readerIdentifier, eventType } = extractZebraTagReads(parsedBody);
  const readerSearchKey = headerReaderId || readerIdentifier;

  if (!readerSearchKey) {
    throw new Error('UNAUTHORIZED_READER: Missing reader identification in headers or payload');
  }

  // 2. Query Reader from Database
  const reader = await withTenantContext(schoolId, async (tx) => {
    const [byUuid] = /^[0-9a-fA-F-]{36}$/.test(readerSearchKey)
      ? await tx
          .select()
          .from(rfidReaders)
          .where(and(eq(rfidReaders.id, readerSearchKey), eq(rfidReaders.schoolId, schoolId)))
      : [];
    if (byUuid) return byUuid;

    const [byDeviceId] = await tx
      .select()
      .from(rfidReaders)
      .where(and(eq(rfidReaders.deviceId, readerSearchKey), eq(rfidReaders.schoolId, schoolId)));
    return byDeviceId;
  });

  if (!reader) {
    throw new Error(`UNAUTHORIZED_READER: Reader '${readerSearchKey}' not registered to school '${schoolId}'`);
  }

  if (reader.status !== 'ACTIVE') {
    throw new Error(`FORBIDDEN_READER: Reader status is '${reader.status}'`);
  }

  // 3. Authenticate Reader (HMAC Signature or Bearer Token)
  const readerSecret =
    (reader.sharedSecretEncrypted ? decryptReaderSecret(reader.sharedSecretEncrypted) : null) ||
    process.env.RFID_HMAC_SECRET;

  if (!readerSecret) {
    throw new Error('CONFIG_ERROR: No cryptographic secret or token configured for reader authentication');
  }

  const signatureHeader =
    (headers['x-zebra-signature'] as string) ||
    (headers['x-reader-signature'] as string) ||
    (headers['x-signature'] as string) ||
    (headers['x-hub-signature-256'] as string);

  const authHeader = headers['authorization'] as string;

  let isAuthValid = false;

  if (signatureHeader) {
    isAuthValid = verifyZebraHmacSignature(rawBody, signatureHeader, readerSecret);
  } else if (authHeader) {
    isAuthValid = verifyBearerToken(authHeader, readerSecret);
  }

  if (!isAuthValid) {
    throw new Error('UNAUTHORIZED_READER: Invalid or missing HMAC signature or Bearer token');
  }

  // 4. Update Reader Heartbeat / Last Seen
  await withTenantContext(schoolId, async (tx) => {
    await tx
      .update(rfidReaders)
      .set({
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(rfidReaders.id, reader.id));
  });

  // If this is solely a heartbeat / keepalive payload with no tag reads
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

  // 5. Process Tag Reads
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

    try {
      canonicalEpcHex = canonicalizeEpc(rawEpc);
      epcDigest = computeEpcDigest(canonicalEpcHex);
      epcLast4 = getEpcLastFour(canonicalEpcHex);
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
    const clientEventId = `${reader.id}-${epcDigest}-${truncatedSecond}`;

    // 6. Lookup Active Credential by Digest
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
      // Record rejected event for security monitoring (never storing raw EPC)
      await withTenantContext(schoolId, async (tx) => {
        await tx.insert(rfidScanEvents).values({
          schoolId,
          readerId: reader.id,
          clientEventId,
          scanTimestamp: new Date(scanTimeMs),
          decision: 'UNKNOWN_CARD',
          rejectionCode: 'UNKNOWN_EPC_TAG',
          captureMethod: 'RFID_GATE',
          securityMode: 'UHF_EPC',
          payloadHash,
        });
      });

      results.push({
        epcDigest,
        epcLastFour: epcLast4,
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
        await tx.insert(rfidScanEvents).values({
          schoolId,
          readerId: reader.id,
          credentialId: credential.id,
          clientEventId,
          scanTimestamp: new Date(scanTimeMs),
          decision: rejectionDecision,
          rejectionCode: `CARD_${credential.status}`,
          captureMethod: 'RFID_GATE',
          securityMode: 'UHF_EPC',
          payloadHash,
        });
      });

      results.push({
        epcDigest,
        epcLastFour: epcLast4,
        decision: rejectionDecision,
        reason: `CREDENTIAL_${credential.status}`,
      });
      continue;
    }

    // 7. Debounce / Duplicate Walk Check
    const debounceKey = `rfid:debounce:${schoolId}:${reader.id}:${epcDigest}`;
    let isDebounced = false;

    if (redis) {
      try {
        const cached = await redis.get(debounceKey);
        if (cached) isDebounced = true;
      } catch {
        // Fall back to database query
      }
    }

    if (!isDebounced) {
      const cooldownThreshold = new Date(Date.now() - cooldownMs);
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
      results.push({
        epcDigest,
        epcLastFour: epcLast4,
        decision: 'DUPLICATE',
        reason: 'ALREADY_PROCESSED_COOLDOWN_ACTIVE',
        duplicate: true,
      });
      continue;
    }

    // 8. Lookup Student & Active Class Section Enrollment
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
        decision: 'SUSPENDED_CARD',
        reason: 'STUDENT_INACTIVE_OR_UNENROLLED',
      });
      continue;
    }

    // 9. Find or Resolve Today's Attendance Session
    const todayDate = new Date().toISOString().slice(0, 10);
    let targetClassSectionId = studentInfo.classSectionId;

    let session = await withTenantContext(schoolId, async (tx) => {
      const [s] = await tx
        .select()
        .from(attendanceSessions)
        .where(
          and(
            eq(attendanceSessions.schoolId, schoolId),
            eq(attendanceSessions.classSectionId, targetClassSectionId),
            eq(attendanceSessions.sessionDate, todayDate),
            inArray(attendanceSessions.status, ['DRAFT', 'OPEN', 'REOPENED'])
          )
        )
        .limit(1);
      return s;
    });

    // If no open session exists today, auto-create an OPEN session for today's gate attendance
    if (!session) {
      // Find assigned teacher for this class section
      const assignment = await withTenantContext(schoolId, async (tx) => {
        const [a] = await tx
          .select({ teacherId: teacherAssignments.teacherId })
          .from(teacherAssignments)
          .where(
            and(
              eq(teacherAssignments.schoolId, schoolId),
              eq(teacherAssignments.classSectionId, targetClassSectionId)
            )
          )
          .limit(1);
        return a;
      });

      if (!assignment?.teacherId) {
        rejectedCount++;
        await withTenantContext(schoolId, async (tx) => {
          await tx.insert(rfidScanEvents).values({
            schoolId,
            readerId: reader.id,
            credentialId: credential.id,
            clientEventId,
            scanTimestamp: new Date(scanTimeMs),
            decision: 'NO_ACTIVE_SESSION',
            rejectionCode: 'NO_OPEN_SESSION_AND_NO_ASSIGNED_TEACHER',
            captureMethod: 'RFID_GATE',
            securityMode: 'UHF_EPC',
            payloadHash,
          });
        });

        results.push({
          epcDigest,
          epcLastFour: epcLast4,
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
            teacherId: assignment.teacherId,
            sessionDate: todayDate,
            sessionType: 'DAILY',
            status: 'OPEN',
          })
          .returning();
        return newSession;
      });
    }

    // 10. Atomically Record Attendance & Scan Event
    const recordResult = await withTenantContext(schoolId, async (tx) => {
      // Check existing attendance record in this session
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
        if (existingRecord.status !== 'PRESENT') {
          await tx
            .update(attendanceRecords)
            .set({
              status: 'PRESENT',
              captureMethod: 'RFID',
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
            captureMethod: 'RFID',
            firstScannedAt: new Date(scanTimeMs),
            lastUpdatedAt: new Date(),
          })
          .returning();
        recordId = insertedRecord.id;
      }

      // Record Attendance Event Audit Log
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
          antenna: read.antenna || read.antenna_port || 1,
          peakRssi: read.peakRssi || read.rssi || null,
          method: 'UHF_GATE_FX9600',
        },
      });

      // Record RFID Scan Event (with zero raw EPC)
      const [scanEvent] = await tx
        .insert(rfidScanEvents)
        .values({
          schoolId,
          readerId: reader.id,
          credentialId: credential.id,
          attendanceSessionId: session!.id,
          clientEventId,
          scanTimestamp: new Date(scanTimeMs),
          decision: 'ACCEPTED',
          captureMethod: 'RFID_GATE',
          securityMode: 'UHF_EPC',
          payloadHash,
        })
        .returning();

      return { recordId, scanEventId: scanEvent.id };
    });

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
