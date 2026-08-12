import { eq, and, inArray, sql, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  attendanceSessions,
  attendanceSessionRoster,
  attendanceEvents,
  attendanceRecords,
  attendanceCorrections,
  classSections,
  teacherAssignments,
  enrollments,
  students,
  qrCredentials,
  schools,
  users,
} from '../db/schema';
import { createAuditLog } from './auditLogService';
import { createAbsenceNotificationJobs } from './notificationService';
import crypto from 'crypto';

export type SessionStatus = 'DRAFT' | 'OPEN' | 'REVIEW' | 'FINALIZED' | 'REOPENED';
export type AttendanceStatus = 'UNMARKED' | 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | 'LEAVE';

export async function verifyTeacherAssignment(params: {
  schoolId: string;
  classSectionId: string;
  actorId: string;
  userRole: string;
}) {
  const { schoolId, classSectionId, actorId, userRole } = params;
  if (['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(userRole)) return;

  const [assignment] = await db
    .select({ id: teacherAssignments.id })
    .from(teacherAssignments)
    .where(
      and(
        eq(teacherAssignments.schoolId, schoolId),
        eq(teacherAssignments.teacherId, actorId),
        eq(teacherAssignments.classSectionId, classSectionId)
      )
    );

  if (!assignment) {
    throw new Error('UNAUTHORIZED_TEACHER_NOT_ASSIGNED');
  }
}

export async function getTeacherAssignedClasses(params: {
  schoolId: string;
  teacherId: string;
  userRole: string;
}) {
  const { schoolId, teacherId, userRole } = params;

  if (['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(userRole)) {
    // Admins see all class sections in the school
    return db
      .select({
        classSectionId: classSections.id,
        className: classSections.className,
        sectionName: classSections.sectionName,
        academicYearId: classSections.academicYearId,
      })
      .from(classSections)
      .where(eq(classSections.schoolId, schoolId));
  }

  // Teachers see only assigned class sections
  const assignments = await db
    .select({
      classSectionId: classSections.id,
      className: classSections.className,
      sectionName: classSections.sectionName,
      academicYearId: classSections.academicYearId,
    })
    .from(teacherAssignments)
    .innerJoin(classSections, eq(teacherAssignments.classSectionId, classSections.id))
    .where(
      and(
        eq(teacherAssignments.schoolId, schoolId),
        eq(teacherAssignments.teacherId, teacherId)
      )
    );

  return assignments;
}

export async function createAttendanceSession(params: {
  schoolId: string;
  classSectionId: string;
  teacherId: string;
  sessionDate: string; // YYYY-MM-DD
  sessionType?: string;
  actorId: string;
  userRole: string;
}) {
  const { schoolId, classSectionId, teacherId, sessionDate, sessionType = 'DAILY', actorId, userRole } = params;

  // Enforce teacher assignment permission check unless Admin
  await verifyTeacherAssignment({ schoolId, classSectionId, actorId, userRole });

  // Check if session already exists for date + classSectionId + sessionType
  const [existingSession] = await db
    .select()
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.schoolId, schoolId),
        eq(attendanceSessions.classSectionId, classSectionId),
        eq(attendanceSessions.sessionDate, sessionDate),
        eq(attendanceSessions.sessionType, sessionType)
      )
    );

  if (existingSession) {
    // Return existing session with its current roster and records
    const sessionDetails = await getAttendanceSessionDetails(schoolId, existingSession.id, actorId, userRole);
    return { session: existingSession, ...sessionDetails, isNew: false };
  }

  // Create session and roster snapshot transactionally
  const result = await db.transaction(async (tx: any) => {
    // 1. Insert Attendance Session
    const [session] = await tx
      .insert(attendanceSessions)
      .values({
        schoolId,
        classSectionId,
        teacherId,
        sessionDate,
        sessionType,
        status: 'OPEN',
      })
      .returning();

    // 2. Fetch active students enrolled in classSectionId
    const activeEnrollments = await tx
      .select({
        enrollmentId: enrollments.id,
        studentId: students.id,
        rollNumber: enrollments.rollNumber,
        studentName: students.name,
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

    if (activeEnrollments.length > 0) {
      // 3. Insert Historical Roster Snapshot
      const rosterValues = activeEnrollments.map((e: any) => ({
        schoolId,
        attendanceSessionId: session.id,
        studentId: e.studentId,
        enrollmentId: e.enrollmentId,
        rollNumberSnapshot: e.rollNumber,
        studentNameSnapshot: e.studentName,
        isExpected: true,
      }));
      await tx.insert(attendanceSessionRoster).values(rosterValues);

      // 4. Initialize UNMARKED Records Projection
      const recordValues = activeEnrollments.map((e: any) => ({
        schoolId,
        attendanceSessionId: session.id,
        studentId: e.studentId,
        status: 'UNMARKED',
      }));
      await tx.insert(attendanceRecords).values(recordValues);
    }

    return session;
  });

  await createAuditLog({
    schoolId,
    actorId,
    action: 'CREATE_ATTENDANCE_SESSION',
    resourceType: 'ATTENDANCE_SESSION',
    resourceId: result.id,
    metadata: { classSectionId, sessionDate, sessionType },
  });

  const sessionDetails = await getAttendanceSessionDetails(schoolId, result.id);
  return { session: result, ...sessionDetails, isNew: true };
}

export async function finalizeAttendanceSession(params: {
  schoolId: string;
  sessionId: string;
  actorId: string;
  userRole: string;
  reason?: string;
  autoMarkAbsentForUnmarked?: boolean;
}) {
  return updateSessionStatus({ ...params, newStatus: 'FINALIZED' });
}

export async function updateSessionStatus(params: {
  schoolId: string;
  sessionId: string;
  actorId: string;
  userRole: string;
  newStatus: SessionStatus;
  reason?: string;
  autoMarkAbsentForUnmarked?: boolean;
}) {
  const { schoolId, sessionId, actorId, userRole, newStatus, reason, autoMarkAbsentForUnmarked = false } = params;

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.schoolId, schoolId), eq(attendanceSessions.id, sessionId)));

  if (!session) {
    throw new Error('SESSION_NOT_FOUND');
  }

  await verifyTeacherAssignment({ schoolId, classSectionId: session.classSectionId, actorId, userRole });

  const currentStatus = session.status as SessionStatus;

  // Enforce State Machine Invariants
  if (currentStatus === 'FINALIZED' && newStatus !== 'REOPENED') {
    throw new Error('FINALIZED_SESSION_LOCKED');
  }

  if (newStatus === 'REOPENED') {
    // Require SUPER_ADMIN or SCHOOL_ADMIN and explicit reason
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(userRole)) {
      throw new Error('REOPEN_REQUIRES_ADMIN_ROLE');
    }
    if (!reason || reason.trim().length === 0) {
      throw new Error('REOPEN_REASON_REQUIRED');
    }
  }

  // Handle finalization logic
  if (newStatus === 'FINALIZED') {
    if (autoMarkAbsentForUnmarked) {
      // Find all UNMARKED records for this session
      const unmarked = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.schoolId, schoolId),
            eq(attendanceRecords.attendanceSessionId, sessionId),
            eq(attendanceRecords.status, 'UNMARKED')
          )
        );

      for (const rec of unmarked) {
        const clientEventId = `auto-absent-${sessionId}-${rec.studentId}-${Date.now()}`;
        await db.insert(attendanceEvents).values({
          schoolId,
          clientEventId,
          attendanceSessionId: sessionId,
          studentId: rec.studentId,
          eventType: 'FINALIZATION_AUTO_ABSENT',
          statusValue: 'ABSENT',
          clientTimestamp: new Date(),
          serverReceivedAt: new Date(),
          actorId,
          metadata: { note: 'Auto-marked ABSENT upon session finalization' },
        });

        await db
          .update(attendanceRecords)
          .set({
            status: 'ABSENT',
            lastUpdatedAt: new Date(),
          })
          .where(eq(attendanceRecords.id, rec.id));
      }
    }
  }

  const updateData: any = {
    status: newStatus,
    updatedAt: new Date(),
  };

  if (newStatus === 'FINALIZED') {
    updateData.finalizedAt = new Date();
    updateData.finalizedBy = actorId;
  }

  const [updatedSession] = await db
    .update(attendanceSessions)
    .set(updateData)
    .where(and(eq(attendanceSessions.schoolId, schoolId), eq(attendanceSessions.id, sessionId)))
    .returning();

  await createAuditLog({
    schoolId,
    actorId,
    action: `SESSION_STATUS_${newStatus}`,
    resourceType: 'ATTENDANCE_SESSION',
    resourceId: sessionId,
    metadata: { previousStatus: currentStatus, newStatus, reason },
  });

  if (newStatus === 'FINALIZED') {
    // This runs inside the request tenant transaction. If queue creation
    // fails, the finalization and its audit entry must roll back together so
    // the API cannot report a finalized session with missing notifications.
    await createAbsenceNotificationJobs({
      schoolId,
      attendanceSessionId: sessionId,
      actorId,
    });
  }

  return updatedSession;
}

export async function processQRCode(params: {
  schoolId: string;
  sessionId: string;
  actorId: string;
  userRole: string;
  clientEventId: string;
  rawToken?: string;
  studentId?: string;
  statusValue?: AttendanceStatus;
  clientTimestamp: string | Date;
  deviceId?: string;
  source?: 'CAMERA' | 'USB' | 'MANUAL';
  metadata?: any;
}) {
  const {
    schoolId,
    sessionId,
    actorId,
    userRole,
    clientEventId,
    rawToken,
    studentId,
    statusValue = 'PRESENT',
    clientTimestamp,
    deviceId,
    source = 'CAMERA',
    metadata = {},
  } = params;

  if (!userRole || !actorId) {
    throw new Error('UNAUTHORIZED_ACTOR_CONTEXT');
  }

  // 1. Validate Attendance Session & Authorization FIRST
  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.schoolId, schoolId), eq(attendanceSessions.id, sessionId)));

  if (!session) {
    throw new Error('SESSION_NOT_FOUND');
  }

  await verifyTeacherAssignment({ schoolId, classSectionId: session.classSectionId, actorId, userRole });

  // 2. Idempotency Check: Client event ID processed only once within this specific session & school
  const [existingEvent] = await db
    .select()
    .from(attendanceEvents)
    .where(
      and(
        eq(attendanceEvents.schoolId, schoolId),
        eq(attendanceEvents.attendanceSessionId, sessionId),
        eq(attendanceEvents.clientEventId, clientEventId)
      )
    );

  if (existingEvent) {
    // Event was already processed — fetch student and record to return idempotent response
    const [existingRecord] = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.schoolId, schoolId),
          eq(attendanceRecords.attendanceSessionId, sessionId),
          eq(attendanceRecords.studentId, existingEvent.studentId)
        )
      );

    const [student] = await db
      .select()
      .from(students)
      .where(and(eq(students.schoolId, schoolId), eq(students.id, existingEvent.studentId)));

    return {
      success: true,
      duplicateScan: false,
      idempotentDuplicate: true,
      event: existingEvent,
      record: existingRecord,
      student,
    };
  }

  if (session.status === 'FINALIZED') {
    throw new Error('FINALIZED_SESSION_LOCKED');
  }

  // Enforce QR Proof requirement for scanner sources
  if (!rawToken && source !== 'MANUAL') {
    throw new Error('MISSING_QR_PROOF');
  }

  // 3. Resolve Target Student ID & QR Credential Validation
  let targetStudentId = studentId;

  if (rawToken) {
    const tokenDigest = crypto.createHash('sha256').update(rawToken).digest('hex');

    const [credential] = await db
      .select()
      .from(qrCredentials)
      .where(eq(qrCredentials.tokenDigest, tokenDigest));

    if (!credential) {
      throw new Error('INVALID_QR_TOKEN');
    }

    if (credential.schoolId !== schoolId) {
      throw new Error('WRONG_SCHOOL_QR');
    }

    if (credential.status === 'REVOKED') {
      throw new Error('REVOKED_QR_TOKEN');
    }

    targetStudentId = credential.studentId;
  }

  if (!targetStudentId) {
    throw new Error('MISSING_STUDENT_IDENTIFIER');
  }

  // 4. Verify Student in Session Roster Snapshot
  const [rosterEntry] = await db
    .select()
    .from(attendanceSessionRoster)
    .where(
      and(
        eq(attendanceSessionRoster.attendanceSessionId, sessionId),
        eq(attendanceSessionRoster.studentId, targetStudentId)
      )
    );

  if (!rosterEntry) {
    throw new Error('STUDENT_NOT_IN_ROSTER');
  }

  // Fetch full student details for visual verification
  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.schoolId, schoolId), eq(students.id, targetStudentId)));

  if (!student) {
    throw new Error('STUDENT_NOT_FOUND');
  }

  // 5. Check Existing Attendance Record for Duplicate Scan Detection
  const [existingRecord] = await db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.schoolId, schoolId),
        eq(attendanceRecords.attendanceSessionId, sessionId),
        eq(attendanceRecords.studentId, targetStudentId)
      )
    );

  const isAlreadyMarkedPresentOrLate =
    existingRecord && ['PRESENT', 'LATE'].includes(existingRecord.status);

  if (isAlreadyMarkedPresentOrLate && statusValue === 'PRESENT') {
    // Log duplicate scan attempt into append-only event log
    await db.insert(attendanceEvents).values({
      schoolId,
      clientEventId,
      attendanceSessionId: sessionId,
      studentId: targetStudentId,
      eventType: 'DUPLICATE_QR_SCANNED',
      statusValue: existingRecord.status,
      clientTimestamp: clientTimestamp ? new Date(clientTimestamp) : new Date(),
      serverReceivedAt: new Date(),
      deviceId: deviceId || null,
      actorId,
      metadata: { source, previousScannedAt: existingRecord.firstScannedAt },
    });

    return {
      success: false,
      duplicateScan: true,
      error: 'DUPLICATE_SCAN_DETECTED',
      message: `Student ${student.name} was already marked ${existingRecord.status}`,
      student: {
        id: student.id,
        name: student.name,
        nameBn: student.nameBn,
        studentCode: student.studentCode,
        photoUrl: student.photoUrl,
        rollNumber: rosterEntry.rollNumberSnapshot,
      },
      record: existingRecord,
    };
  }

  // 6. Append Event & Project Current Record State
  const clientTs = clientTimestamp ? new Date(clientTimestamp) : new Date();
  const serverReceivedAt = new Date();

  await db.insert(attendanceEvents).values({
    schoolId,
    clientEventId,
    attendanceSessionId: sessionId,
    studentId: targetStudentId,
    eventType: source === 'USB' ? 'USB_BARCODE_SCANNED' : 'QR_SCANNED',
    statusValue,
    clientTimestamp: clientTs,
    serverReceivedAt,
    deviceId: deviceId || null,
    actorId,
    metadata: { source, ...metadata },
  });

  let updatedRecord: any;

  if (existingRecord) {
    const [updated] = await db
      .update(attendanceRecords)
      .set({
        status: statusValue,
        firstScannedAt: existingRecord.firstScannedAt || serverReceivedAt,
        lastUpdatedAt: serverReceivedAt,
      })
      .where(eq(attendanceRecords.id, existingRecord.id))
      .returning();
    updatedRecord = updated;
  } else {
    const [created] = await db
      .insert(attendanceRecords)
      .values({
        schoolId,
        attendanceSessionId: sessionId,
        studentId: targetStudentId,
        status: statusValue,
        firstScannedAt: serverReceivedAt,
        lastUpdatedAt: serverReceivedAt,
      })
      .returning();
    updatedRecord = created;
  }

  return {
    success: true,
    duplicateScan: false,
    record: updatedRecord,
    student: {
      id: student.id,
      name: student.name,
      nameBn: student.nameBn,
      studentCode: student.studentCode,
      photoUrl: student.photoUrl,
      rollNumber: rosterEntry.rollNumberSnapshot,
    },
    scannedAt: updatedRecord.lastUpdatedAt,
  };
}

export async function manualStatusUpdate(params: {
  schoolId: string;
  sessionId: string;
  recordId?: string;
  studentId?: string;
  newStatus: AttendanceStatus;
  reason?: string;
  actorId: string;
  userRole: string;
  clientEventId?: string;
}) {
  const {
    schoolId,
    sessionId,
    recordId,
    studentId,
    newStatus,
    reason,
    actorId,
    userRole,
    clientEventId = `manual-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  } = params;

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.schoolId, schoolId), eq(attendanceSessions.id, sessionId)));

  if (!session) {
    throw new Error('SESSION_NOT_FOUND');
  }

  await verifyTeacherAssignment({ schoolId, classSectionId: session.classSectionId, actorId, userRole });

  if (session.status === 'FINALIZED') {
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(userRole)) {
      throw new Error('FINALIZED_SESSION_LOCKED');
    }
    if (!reason || reason.trim().length === 0) {
      throw new Error('CORRECTION_REASON_REQUIRED');
    }
  }

  // Resolve record (strictly scoped to sessionId)
  let record: any;
  if (recordId) {
    const [rec] = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.schoolId, schoolId),
          eq(attendanceRecords.attendanceSessionId, sessionId),
          eq(attendanceRecords.id, recordId)
        )
      );
    record = rec;
  } else if (studentId) {
    const [rec] = await db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.schoolId, schoolId),
          eq(attendanceRecords.attendanceSessionId, sessionId),
          eq(attendanceRecords.studentId, studentId)
        )
      );
    record = rec;
  }

  if (!record) {
    if (studentId) {
      const [rosterEntry] = await db
        .select()
        .from(attendanceSessionRoster)
        .where(
          and(
            eq(attendanceSessionRoster.attendanceSessionId, sessionId),
            eq(attendanceSessionRoster.studentId, studentId)
          )
        );

      if (!rosterEntry) {
        throw new Error('STUDENT_NOT_IN_SESSION_ROSTER');
      }

      const [newRec] = await db
        .insert(attendanceRecords)
        .values({
          schoolId,
          attendanceSessionId: sessionId,
          studentId,
          status: newStatus,
          firstScannedAt: new Date(),
          lastUpdatedAt: new Date(),
        })
        .returning();

      if (reason) {
        await db.insert(attendanceCorrections).values({
          schoolId,
          attendanceRecordId: newRec.id,
          previousStatus: 'UNMARKED',
          newStatus,
          reason: reason || 'Manual adjustment',
          correctedBy: actorId,
          correctedAt: new Date(),
        });
      }

      await db.insert(attendanceEvents).values({
        schoolId,
        clientEventId,
        attendanceSessionId: sessionId,
        studentId,
        eventType: 'MANUAL_STATUS_CHANGE',
        statusValue: newStatus,
        clientTimestamp: new Date(),
        serverReceivedAt: new Date(),
        actorId,
        metadata: { previousStatus: 'UNMARKED', newStatus, reason },
      });

      return newRec;
    } else {
      throw new Error('ATTENDANCE_RECORD_NOT_FOUND');
    }
  }

  const previousStatus = record.status as AttendanceStatus;

  // Audit trail correction log if record status is changed and session is finalized or explicitly corrected
  if (previousStatus !== newStatus) {
    if (session.status === 'FINALIZED' || reason) {
      await db.insert(attendanceCorrections).values({
        schoolId,
        attendanceRecordId: record.id,
        previousStatus,
        newStatus,
        reason: reason || 'Manual adjustment',
        correctedBy: actorId,
        correctedAt: new Date(),
      });
    }

    // Append event to event log
    await db.insert(attendanceEvents).values({
      schoolId,
      clientEventId,
      attendanceSessionId: sessionId,
      studentId: record.studentId,
      eventType: 'MANUAL_STATUS_CHANGE',
      statusValue: newStatus,
      clientTimestamp: new Date(),
      serverReceivedAt: new Date(),
      actorId,
      metadata: { previousStatus, newStatus, reason },
    });

    // Update projected record
    const [updated] = await db
      .update(attendanceRecords)
      .set({
        status: newStatus,
        lastUpdatedAt: new Date(),
      })
      .where(eq(attendanceRecords.id, record.id))
      .returning();

    return updated;
  }

  return record;
}

export async function getAttendanceSessionDetails(schoolId: string, sessionId: string, actorId?: string, userRole?: string) {
  const [session] = await db
    .select({
      id: attendanceSessions.id,
      schoolId: attendanceSessions.schoolId,
      classSectionId: attendanceSessions.classSectionId,
      teacherId: attendanceSessions.teacherId,
      sessionDate: attendanceSessions.sessionDate,
      sessionType: attendanceSessions.sessionType,
      status: attendanceSessions.status,
      finalizedAt: attendanceSessions.finalizedAt,
      finalizedBy: attendanceSessions.finalizedBy,
      className: classSections.className,
      sectionName: classSections.sectionName,
    })
    .from(attendanceSessions)
    .innerJoin(classSections, eq(attendanceSessions.classSectionId, classSections.id))
    .where(and(eq(attendanceSessions.schoolId, schoolId), eq(attendanceSessions.id, sessionId)));

  if (!session) {
    return null;
  }

  if (actorId && userRole) {
    await verifyTeacherAssignment({ schoolId, classSectionId: session.classSectionId, actorId, userRole });
  }

  // Fetch roster snapshot with current attendance records
  const rosterRecords = await db
    .select({
      rosterId: attendanceSessionRoster.id,
      studentId: attendanceSessionRoster.studentId,
      rollNumber: attendanceSessionRoster.rollNumberSnapshot,
      studentName: attendanceSessionRoster.studentNameSnapshot,
      studentNameBn: students.nameBn,
      studentCode: students.studentCode,
      photoUrl: students.photoUrl,
      recordId: attendanceRecords.id,
      status: attendanceRecords.status,
      firstScannedAt: attendanceRecords.firstScannedAt,
      lastUpdatedAt: attendanceRecords.lastUpdatedAt,
    })
    .from(attendanceSessionRoster)
    .innerJoin(students, eq(attendanceSessionRoster.studentId, students.id))
    .leftJoin(
      attendanceRecords,
      and(
        eq(attendanceRecords.attendanceSessionId, sessionId),
        eq(attendanceRecords.studentId, attendanceSessionRoster.studentId)
      )
    )
    .where(eq(attendanceSessionRoster.attendanceSessionId, sessionId))
    .orderBy(attendanceSessionRoster.rollNumberSnapshot);

  const stats = {
    total: rosterRecords.length,
    present: rosterRecords.filter((r: { status: string | null }) => r.status === 'PRESENT').length,
    late: rosterRecords.filter((r: { status: string | null }) => r.status === 'LATE').length,
    absent: rosterRecords.filter((r: { status: string | null }) => r.status === 'ABSENT').length,
    excused: rosterRecords.filter((r: { status: string | null }) => r.status === 'EXCUSED').length,
    leave: rosterRecords.filter((r: { status: string | null }) => r.status === 'LEAVE').length,
    unmarked: rosterRecords.filter((r: { status: string | null }) => !r.status || r.status === 'UNMARKED').length,
  };

  return {
    session,
    roster: rosterRecords,
    stats,
  };
}

export async function getDailyClassReport(schoolId: string, classSectionId: string, sessionDate: string) {
  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.schoolId, schoolId),
        eq(attendanceSessions.classSectionId, classSectionId),
        eq(attendanceSessions.sessionDate, sessionDate)
      )
    );

  if (!session) {
    return null;
  }

  return getAttendanceSessionDetails(schoolId, session.id);
}
