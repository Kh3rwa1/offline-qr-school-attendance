import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db';
import {
  schools,
  classSections,
  enrollments,
  students,
  users,
  qrCredentials,
  attendanceSessions,
  attendanceEvents,
  attendanceRecords,
  schoolMemberships,
  devices,
} from '../db/schema';
import { processQRCode } from './attendanceService';
import { validateDeviceStatus } from './deviceService';
import { createAuditLog } from './auditLogService';

export interface SyncEventPayload {
  clientEventId: string;
  sessionId: string;
  rawToken?: string;
  studentId?: string;
  statusValue?: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | 'LEAVE';
  clientTimestamp: string;
  source?: 'CAMERA' | 'USB' | 'MANUAL';
  metadata?: any;
}

export interface SyncBatchResultItem {
  clientEventId: string;
  status: 'ACCEPTED' | 'ALREADY_PROCESSED' | 'REJECTED';
  eventId?: string;
  error?: string;
  duplicateScan?: boolean;
}

export async function getOfflineRosterPackage(schoolId: string, classSectionId: string) {
  // 1. Get Class Section info
  const [section] = await db
    .select()
    .from(classSections)
    .where(and(eq(classSections.id, classSectionId), eq(classSections.schoolId, schoolId)));

  if (!section) {
    throw new Error('CLASS_SECTION_NOT_FOUND');
  }

  // 2. Get active enrollments with student data
  const enrolledStudents = await db
    .select({
      studentId: students.id,
      studentCode: students.studentCode,
      banglarShikshaId: students.banglarShikshaId,
      name: students.name,
      nameBn: students.nameBn,
      rollNumber: enrollments.rollNumber,
      photoUrl: students.photoUrl,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .where(
      and(
        eq(enrollments.schoolId, schoolId),
        eq(enrollments.classSectionId, classSectionId),
        eq(enrollments.status, 'ACTIVE'),
        eq(students.status, 'ACTIVE')
      )
    );

  const studentIds = enrolledStudents.map((s: any) => s.studentId);

  // 3. Get active QR credential digests for these students
  let qrMap: Record<string, { tokenDigest: string; isRevoked: boolean }> = {};
  if (studentIds.length > 0) {
    const credentials = await db
      .select({
        studentId: qrCredentials.studentId,
        tokenDigest: qrCredentials.tokenDigest,
        status: qrCredentials.status,
      })
      .from(qrCredentials)
      .where(and(eq(qrCredentials.schoolId, schoolId), inArray(qrCredentials.studentId, studentIds)));

    for (const cred of credentials) {
      qrMap[cred.studentId] = {
        tokenDigest: cred.tokenDigest,
        isRevoked: cred.status === 'REVOKED',
      };
    }
  }

  const rosterPackage = enrolledStudents.map((s: any) => ({
    ...s,
    sha256TokenHash: qrMap[s.studentId]?.tokenDigest || null,
    isRevoked: qrMap[s.studentId]?.isRevoked || false,
  }));

  return {
    schoolId,
    classSectionId,
    className: section.className,
    sectionName: section.sectionName,
    downloadedAt: new Date().toISOString(),
    students: rosterPackage,
  };
}

export async function syncAttendanceEvents(params: {
  schoolId: string;
  actorId: string;
  deviceIdentifier?: string;
  events: SyncEventPayload[];
}): Promise<{ processedCount: number; results: SyncBatchResultItem[] }> {
  const { schoolId, actorId, deviceIdentifier, events } = params;

  // 1. Check user status and membership status
  const [userRec] = await db.select().from(users).where(eq(users.id, actorId));
  if (!userRec || userRec.status === 'SUSPENDED') {
    throw new Error('USER_SUSPENDED');
  }

  const [membership] = await db
    .select()
    .from(schoolMemberships)
    .where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.userId, actorId)));

  if (membership && membership.status === 'SUSPENDED') {
    throw new Error('USER_SUSPENDED');
  }

  // 2. Check device revocation status if deviceIdentifier is provided
  let deviceId: string | undefined;
  if (deviceIdentifier) {
    const devValidation = await validateDeviceStatus(schoolId, deviceIdentifier);
    if (!devValidation.valid) {
      throw new Error('DEVICE_REVOKED');
    }
    deviceId = devValidation.device?.id;
  }

  const results: SyncBatchResultItem[] = [];

  for (const event of events) {
    try {
      // 3. Idempotency Check: Check if clientEventId already processed
      const [existingEvent] = await db
        .select()
        .from(attendanceEvents)
        .where(eq(attendanceEvents.clientEventId, event.clientEventId));

      if (existingEvent) {
        results.push({
          clientEventId: event.clientEventId,
          status: 'ALREADY_PROCESSED',
          eventId: existingEvent.id,
        });
        continue;
      }

      // 4. Session Reconciliation: Ensure offline session ID exists on server
      const [existingSession] = await db
        .select()
        .from(attendanceSessions)
        .where(and(eq(attendanceSessions.schoolId, schoolId), eq(attendanceSessions.id, event.sessionId)));

      if (!existingSession) {
        const classSectionId = event.metadata?.classSectionId;
        const sessionDate = event.metadata?.sessionDate || new Date().toISOString().split('T')[0];

        if (classSectionId) {
          try {
            await db.insert(attendanceSessions).values({
              id: event.sessionId,
              schoolId,
              classSectionId,
              teacherId: actorId,
              sessionDate,
              sessionType: 'DAILY',
              status: 'OPEN',
            });
          } catch (err) {
            // Ignore if created concurrently
          }
        }
      }

      // 5. Process event
      const processRes = await processQRCode({
        schoolId,
        sessionId: event.sessionId,
        actorId,
        clientEventId: event.clientEventId,
        rawToken: event.rawToken,
        studentId: event.studentId,
        statusValue: event.statusValue || 'PRESENT',
        clientTimestamp: event.clientTimestamp,
        deviceId,
        source: event.source || 'CAMERA',
        metadata: event.metadata,
      });

      results.push({
        clientEventId: event.clientEventId,
        status: 'ACCEPTED',
        eventId: processRes.event?.id || processRes.record?.id,
        duplicateScan: processRes.duplicateScan || false,
      });
    } catch (error: any) {
      // Check for concurrent conflict or specific error reasons
      const errMessage = error.message || 'SYNC_ERROR';

      // Handle conflict preservation scenario (Scenario 14):
      if (errMessage === 'FINALIZED_SESSION_LOCKED') {
        // Log the event with a conflict flag if studentId is present
        if (event.studentId) {
          const [rec] = await db
            .select()
            .from(attendanceRecords)
            .where(
              and(
                eq(attendanceRecords.schoolId, schoolId),
                eq(attendanceRecords.attendanceSessionId, event.sessionId),
                eq(attendanceRecords.studentId, event.studentId)
              )
            );

          if (rec) {
            await db
              .update(attendanceRecords)
              .set({ hasConflict: true })
              .where(eq(attendanceRecords.id, rec.id));
          }
        }
      }

      results.push({
        clientEventId: event.clientEventId,
        status: 'REJECTED',
        error: errMessage,
      });
    }
  }

  await createAuditLog({
    schoolId,
    actorId,
    action: 'BATCH_ATTENDANCE_SYNC',
    resourceType: 'ATTENDANCE_SESSION',
    metadata: {
      totalEvents: events.length,
      acceptedCount: results.filter((r) => r.status === 'ACCEPTED').length,
      duplicateCount: results.filter((r) => r.status === 'ALREADY_PROCESSED').length,
      rejectedCount: results.filter((r) => r.status === 'REJECTED').length,
    },
  });

  return {
    processedCount: results.length,
    results,
  };
}
