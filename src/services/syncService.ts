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
  attendanceSessionRoster,
  attendanceEvents,
  attendanceRecords,
  schoolMemberships,
  devices,
  teacherAssignments,
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
  clientSessionId?: string;
}

export interface SyncSessionPayload {
  clientSessionId: string;
  classSectionId: string;
  sessionDate: string;
  sessionType: string;
}

export interface SyncBatchResultItem {
  clientEventId: string;
  status: 'ACCEPTED' | 'ALREADY_PROCESSED' | 'REJECTED';
  eventId?: string;
  error?: string;
  duplicateScan?: boolean;
}

export async function getOfflineRosterPackage(schoolId: string, classSectionId: string, actorId?: string, userRole?: string) {
  // 1. Get Class Section info
  const [section] = await db
    .select()
    .from(classSections)
    .where(and(eq(classSections.id, classSectionId), eq(classSections.schoolId, schoolId)));

  if (!section) {
    throw new Error('CLASS_SECTION_NOT_FOUND');
  }

  if (actorId && userRole && !['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(userRole)) {
    const [assignment] = await db.select({ id: teacherAssignments.id }).from(teacherAssignments).where(and(
      eq(teacherAssignments.schoolId, schoolId),
      eq(teacherAssignments.teacherId, actorId),
      eq(teacherAssignments.classSectionId, classSectionId)
    ));
    if (!assignment) throw new Error('UNAUTHORIZED_TEACHER_NOT_ASSIGNED');
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
      .where(and(eq(qrCredentials.schoolId, schoolId), eq(qrCredentials.status, 'ACTIVE'), inArray(qrCredentials.studentId, studentIds)));

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
  deviceIdentifier: string;
  userRole?: string;
  events: SyncEventPayload[];
  sessions?: SyncSessionPayload[];
}): Promise<{ processedCount: number; results: SyncBatchResultItem[]; sessionMappings: { clientSessionId: string; serverSessionId: string }[] }> {
  const { schoolId, actorId, deviceIdentifier, userRole = 'TEACHER', events, sessions = [] } = params;
  if (!deviceIdentifier) throw new Error('DEVICE_IDENTIFIER_REQUIRED');

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

  // 2. Device authorization is mandatory for synchronization.
  const devValidation = await validateDeviceStatus(schoolId, deviceIdentifier);
  if (!devValidation.valid) {
    throw new Error(devValidation.reason === 'DEVICE_NOT_FOUND' ? 'DEVICE_IDENTIFIER_REQUIRED' : 'DEVICE_REVOKED');
  }
  const deviceId = devValidation.device?.id;

  const results: SyncBatchResultItem[] = [];
  const serverSessionIds = new Map<string, string>();

  const isUuid = (value: string | undefined): value is string =>
    !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  const sessionPayloads = new Map<string, SyncSessionPayload>();
  for (const session of sessions) sessionPayloads.set(session.clientSessionId, session);
  for (const event of events) {
    const metadata = event.metadata as Partial<SyncSessionPayload> | undefined;
    if (event.clientSessionId && metadata?.classSectionId) {
      sessionPayloads.set(event.clientSessionId, {
        clientSessionId: event.clientSessionId,
        classSectionId: metadata.classSectionId,
        sessionDate: metadata.sessionDate || new Date().toISOString().slice(0, 10),
        sessionType: metadata.sessionType || 'DAILY',
      });
    }
  }

  // Reconcile all offline sessions before processing events. The client UUID is
  // never compared to attendance_sessions.id; it is resolved through the
  // dedicated client_session_id column.
  for (const [clientSessionId, sessionPayload] of sessionPayloads) {
    if (!isUuid(clientSessionId)) throw new Error('INVALID_CLIENT_SESSION_ID');

    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(userRole)) {
      const [assignment] = await db.select({ id: teacherAssignments.id }).from(teacherAssignments).where(and(
        eq(teacherAssignments.schoolId, schoolId),
        eq(teacherAssignments.teacherId, actorId),
        eq(teacherAssignments.classSectionId, sessionPayload.classSectionId)
      ));
      if (!assignment) throw new Error('UNAUTHORIZED_TEACHER_NOT_ASSIGNED');
    }

    const existingByClient = await db
      .select()
      .from(attendanceSessions)
      .where(and(eq(attendanceSessions.schoolId, schoolId), eq(attendanceSessions.clientSessionId, clientSessionId)));
    let serverSession = existingByClient[0];

    // A teacher may have started the same class/date online before this
    // device reconnects. The natural session key is the safe fallback; the
    // client UUID still maps to that server UUID without mutating the online
    // session's identity.
    if (!serverSession) {
      const [existingByNaturalKey] = await db
        .select()
        .from(attendanceSessions)
        .where(and(
          eq(attendanceSessions.schoolId, schoolId),
          eq(attendanceSessions.classSectionId, sessionPayload.classSectionId),
          eq(attendanceSessions.sessionDate, sessionPayload.sessionDate),
          eq(attendanceSessions.sessionType, sessionPayload.sessionType || 'DAILY')
        ));
      serverSession = existingByNaturalKey;
    }

    if (!serverSession) {
      serverSession = await db.transaction(async (tx: any) => {
        const [created] = await tx
          .insert(attendanceSessions)
          .values({
            schoolId,
            clientSessionId,
            classSectionId: sessionPayload.classSectionId,
            teacherId: actorId,
            sessionDate: sessionPayload.sessionDate,
            sessionType: sessionPayload.sessionType || 'DAILY',
            status: 'OPEN',
          })
          .onConflictDoNothing({ target: [attendanceSessions.schoolId, attendanceSessions.clientSessionId] })
          .returning();

        const [located] = created
          ? [created]
          : await tx
              .select()
              .from(attendanceSessions)
              .where(and(eq(attendanceSessions.schoolId, schoolId), eq(attendanceSessions.clientSessionId, clientSessionId)));
        if (!located) throw new Error('SESSION_RECONCILIATION_FAILED');

        const roster = await tx
          .select({
            enrollmentId: enrollments.id,
            studentId: students.id,
            rollNumber: enrollments.rollNumber,
            studentName: students.name,
          })
          .from(enrollments)
          .innerJoin(students, eq(enrollments.studentId, students.id))
          .where(and(
            eq(enrollments.schoolId, schoolId),
            eq(enrollments.classSectionId, sessionPayload.classSectionId),
            eq(enrollments.status, 'ACTIVE'),
            eq(students.status, 'ACTIVE')
          ));

        if (created && roster.length > 0) {
          await tx.insert(attendanceSessionRoster).values(roster.map((student: any) => ({
            schoolId,
            attendanceSessionId: located.id,
            studentId: student.studentId,
            enrollmentId: student.enrollmentId,
            rollNumberSnapshot: student.rollNumber,
            studentNameSnapshot: student.studentName,
            isExpected: true,
          })));
          await tx.insert(attendanceRecords).values(roster.map((student: any) => ({
            schoolId,
            attendanceSessionId: located.id,
            studentId: student.studentId,
            status: 'UNMARKED',
          })));
        }
        return located;
      });
    }
    serverSessionIds.set(clientSessionId, serverSession.id);
  }

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

      const clientSessionId = event.clientSessionId || event.metadata?.clientSessionId;
      const resolvedSessionId = clientSessionId
        ? serverSessionIds.get(clientSessionId)
        : event.sessionId;
      if (!resolvedSessionId || !isUuid(resolvedSessionId)) throw new Error('SESSION_NOT_FOUND');

      // 5. Process event
      const processRes = await processQRCode({
        schoolId,
        sessionId: resolvedSessionId,
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
    sessionMappings: Array.from(serverSessionIds.entries()).map(([clientSessionId, serverSessionId]) => ({ clientSessionId, serverSessionId })),
  };
}
