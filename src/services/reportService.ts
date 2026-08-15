import { eq, and, gte, lte, inArray, sql, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  schools,
  classSections,
  enrollments,
  students,
  attendanceSessions,
  attendanceSessionRoster,
  attendanceRecords,
  attendanceCorrections,
  attendanceEvents,
  users,
  guardians,
  studentGuardians,
  auditLogs,
} from '../db/schema';
import { createAuditLog } from './auditLogService';
import ExcelJS from 'exceljs';

// Utility for formula injection prevention
export function sanitizeSpreadsheetValue(val: any): any {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (['=', '+', '-', '@'].some((char) => trimmed.startsWith(char))) {
      return `'${val}`;
    }
  }
  return val;
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9_\-.]/g, '_');
}

// 1. Daily School Attendance Summary
export async function getDailySchoolReport(schoolId: string, dateStr: string) {
  const sections = await db
    .select()
    .from(classSections)
    .where(eq(classSections.schoolId, schoolId));

  const sessions = await db
    .select()
    .from(attendanceSessions)
    .where(and(eq(attendanceSessions.schoolId, schoolId), eq(attendanceSessions.sessionDate, dateStr)));

  const sessionIds = sessions.map((s: any) => s.id);

  let recordCounts: Record<string, { present: number; late: number; absent: number; leave: number; excused: number; unmarked: number; total: number }> = {};

  if (sessionIds.length > 0) {
    const records = await db
      .select({
        sessionId: attendanceRecords.attendanceSessionId,
        status: attendanceRecords.status,
        count: sql<number>`count(*)::int`,
      })
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.schoolId, schoolId), inArray(attendanceRecords.attendanceSessionId, sessionIds)))
      .groupBy(attendanceRecords.attendanceSessionId, attendanceRecords.status);

    for (const r of records) {
      if (!recordCounts[r.sessionId]) {
        recordCounts[r.sessionId] = { present: 0, late: 0, absent: 0, leave: 0, excused: 0, unmarked: 0, total: 0 };
      }
      const st = r.status.toLowerCase() as 'present' | 'late' | 'absent' | 'leave' | 'excused' | 'unmarked';
      if (recordCounts[r.sessionId][st] !== undefined) {
        recordCounts[r.sessionId][st] += r.count;
      }
      recordCounts[r.sessionId].total += r.count;
    }
  }

  const sectionSummaries = sections.map((sec: any) => {
    const session = sessions.find((s: any) => s.classSectionId === sec.id);
    const counts = session && recordCounts[session.id]
      ? recordCounts[session.id]
      : { present: 0, late: 0, absent: 0, leave: 0, excused: 0, unmarked: 0, total: 0 };

    const markedPresent = counts.present + counts.late;
    const attendancePercentage = counts.total > 0 ? Math.round((markedPresent / counts.total) * 10000) / 100 : 0;

    return {
      classSectionId: sec.id,
      className: sec.className,
      sectionName: sec.sectionName,
      sessionId: session?.id || null,
      sessionStatus: session?.status || 'NO_SESSION',
      ...counts,
      attendancePercentage,
    };
  });

  const totalEnrolled = sectionSummaries.reduce((acc: number, s: any) => acc + s.total, 0);
  const totalPresent = sectionSummaries.reduce((acc: number, s: any) => acc + s.present, 0);
  const totalLate = sectionSummaries.reduce((acc: number, s: any) => acc + s.late, 0);
  const totalAbsent = sectionSummaries.reduce((acc: number, s: any) => acc + s.absent, 0);
  const totalLeave = sectionSummaries.reduce((acc: number, s: any) => acc + s.leave, 0);
  const totalExcused = sectionSummaries.reduce((acc: number, s: any) => acc + s.excused, 0);

  const overallPercentage = totalEnrolled > 0 ? Math.round(((totalPresent + totalLate) / totalEnrolled) * 10000) / 100 : 0;

  return {
    schoolId,
    date: dateStr,
    summary: {
      totalEnrolled,
      totalPresent,
      totalLate,
      totalAbsent,
      totalLeave,
      totalExcused,
      overallPercentage,
    },
    sections: sectionSummaries,
  };
}

// 2. Daily Class Attendance Detail (using historical roster snapshot)
export async function getDailyClassReport(schoolId: string, classSectionId: string, dateStr: string) {
  const [section] = await db
    .select()
    .from(classSections)
    .where(and(eq(classSections.id, classSectionId), eq(classSections.schoolId, schoolId)));

  if (!section) {
    throw new Error('CLASS_SECTION_NOT_FOUND');
  }

  const [session] = await db
    .select()
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.schoolId, schoolId),
        eq(attendanceSessions.classSectionId, classSectionId),
        eq(attendanceSessions.sessionDate, dateStr)
      )
    );

  if (!session) {
    return {
      schoolId,
      classSectionId,
      className: section.className,
      sectionName: section.sectionName,
      date: dateStr,
      session: null,
      roster: [],
    };
  }

  // Fetch historical roster snapshot & join student details
  const snapshots = await db
    .select({
      studentId: attendanceSessionRoster.studentId,
      rollNumber: attendanceSessionRoster.rollNumberSnapshot,
      studentName: attendanceSessionRoster.studentNameSnapshot,
      studentCode: students.studentCode,
      studentNameBn: students.nameBn,
    })
    .from(attendanceSessionRoster)
    .innerJoin(students, eq(attendanceSessionRoster.studentId, students.id))
    .where(eq(attendanceSessionRoster.attendanceSessionId, session.id))
    .orderBy(attendanceSessionRoster.rollNumberSnapshot);

  const records = await db
    .select({
      id: attendanceRecords.id,
      studentId: attendanceRecords.studentId,
      status: attendanceRecords.status,
      firstScannedAt: attendanceRecords.firstScannedAt,
      hasConflict: attendanceRecords.hasConflict,
      correctionReason: attendanceCorrections.reason,
    })
    .from(attendanceRecords)
    .leftJoin(attendanceCorrections, eq(attendanceCorrections.attendanceRecordId, attendanceRecords.id))
    .where(eq(attendanceRecords.attendanceSessionId, session.id));

  const recMap = new Map<string, any>(records.map((r: any) => [r.studentId, r]));

  const roster = snapshots.map((snap: any) => {
    const rec = recMap.get(snap.studentId);
    return {
      studentId: snap.studentId,
      studentCode: snap.studentCode,
      rollNumber: snap.rollNumber,
      studentName: snap.studentName,
      studentNameBn: snap.studentNameBn,
      status: rec?.status || 'UNMARKED',
      firstScannedAt: rec?.firstScannedAt || null,
      correctionReason: rec?.correctionReason || null,
      hasConflict: rec?.hasConflict || false,
    };
  });

  return {
    schoolId,
    classSectionId,
    className: section.className,
    sectionName: section.sectionName,
    date: dateStr,
    session: {
      id: session.id,
      status: session.status,
      sessionDate: session.sessionDate,
    },
    roster,
  };
}

// 3. Monthly Class Register (1..31 day grid)
export async function getMonthlyClassRegister(schoolId: string, classSectionId: string, year: number, month: number) {
  const [section] = await db
    .select()
    .from(classSections)
    .where(and(eq(classSections.id, classSectionId), eq(classSections.schoolId, schoolId)));

  if (!section) {
    throw new Error('CLASS_SECTION_NOT_FOUND');
  }

  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const startDateStr = `${monthStr}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const endDateStr = `${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

  const sessions = await db
    .select()
    .from(attendanceSessions)
    .where(
      and(
        eq(attendanceSessions.schoolId, schoolId),
        eq(attendanceSessions.classSectionId, classSectionId),
        gte(attendanceSessions.sessionDate, startDateStr),
        lte(attendanceSessions.sessionDate, endDateStr)
      )
    );

  const sessionIds = sessions.map((s: any) => s.id);

  const enrolledStudents = await db
    .select({
      studentId: students.id,
      studentCode: students.studentCode,
      name: students.name,
      nameBn: students.nameBn,
      rollNumber: enrollments.rollNumber,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .where(
      and(
        eq(enrollments.schoolId, schoolId),
        eq(enrollments.classSectionId, classSectionId)
      )
    )
    .orderBy(enrollments.rollNumber);

  let recordsMap: Record<string, Record<string, string>> = {};
  if (sessionIds.length > 0) {
    const sessionDateMap = new Map<string, string>(sessions.map((s: any) => [s.id as string, s.sessionDate as string]));

    const records = await db
      .select({
        studentId: attendanceRecords.studentId,
        sessionId: attendanceRecords.attendanceSessionId,
        status: attendanceRecords.status,
      })
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.schoolId, schoolId), inArray(attendanceRecords.attendanceSessionId, sessionIds)));

    for (const r of records) {
      const date = sessionDateMap.get(r.sessionId);
      if (date) {
        if (!recordsMap[r.studentId]) recordsMap[r.studentId] = {};
        recordsMap[r.studentId][date] = r.status;
      }
    }
  }

  const daysList = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dateStr = `${monthStr}-${String(dayNum).padStart(2, '0')}`;
    const session = sessions.find((s: any) => s.sessionDate === dateStr);
    return { dayNum, dateStr, hasSession: !!session };
  });

  const studentRows = enrolledStudents.map((st: any) => {
    const attendanceGrid: Record<number, string> = {};
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let excusedCount = 0;
    let totalSessionsHeld = 0;

    daysList.forEach(({ dayNum, dateStr, hasSession }) => {
      const status = recordsMap[st.studentId]?.[dateStr] || (hasSession ? 'ABSENT' : '-');
      attendanceGrid[dayNum] = status;

      if (hasSession) {
        totalSessionsHeld++;
        if (status === 'PRESENT') presentCount++;
        else if (status === 'LATE') lateCount++;
        else if (status === 'ABSENT') absentCount++;
        else if (status === 'LEAVE') leaveCount++;
        else if (status === 'EXCUSED') excusedCount++;
      }
    });

    const totalAttended = presentCount + lateCount;
    const attendancePercentage = totalSessionsHeld > 0 ? Math.round((totalAttended / totalSessionsHeld) * 10000) / 100 : 0;

    return {
      studentId: st.studentId,
      studentCode: st.studentCode,
      rollNumber: st.rollNumber,
      name: st.name,
      nameBn: st.nameBn,
      attendanceGrid,
      summary: {
        presentCount,
        lateCount,
        absentCount,
        leaveCount,
        excusedCount,
        totalSessionsHeld,
        attendancePercentage,
      },
    };
  });

  return {
    schoolId,
    classSectionId,
    className: section.className,
    sectionName: section.sectionName,
    year,
    month,
    daysInMonth,
    daysList,
    students: studentRows,
  };
}

import { encodeCursor, decodeCursor, parseLimit } from './paginationHelper';
import {
  academicYears,
  teacherProfiles,
  teacherAssignments,
  devices,
  schoolSmsSettings,
  notificationJobs,
  rfidReaders,
  rfidKeyVersions,
  rfidCredentials,
  importJobs,
} from '../db/schema';

// 4. Individual Student History (Deterministic Cursor Pagination)
export async function getStudentAttendanceHistory(
  schoolId: string,
  studentId: string,
  startDate?: string,
  endDate?: string,
  pagination?: { limit?: number | string; offset?: number; cursor?: string | null }
) {
  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.id, studentId), eq(students.schoolId, schoolId)));

  if (!student) {
    throw new Error('STUDENT_NOT_FOUND');
  }

  const limit = parseLimit(pagination?.limit, 50, 200);
  const decoded = decodeCursor(pagination?.cursor);

  let queryConditions = [
    eq(attendanceRecords.schoolId, schoolId),
    eq(attendanceRecords.studentId, studentId),
  ];

  if (startDate) {
    queryConditions.push(gte(attendanceSessions.sessionDate, startDate));
  }
  if (endDate) {
    queryConditions.push(lte(attendanceSessions.sessionDate, endDate));
  }

  if (decoded) {
    const cursorDate = decoded.timestamp || '';
    queryConditions.push(
      sql`(${attendanceSessions.sessionDate} < ${cursorDate} OR (${attendanceSessions.sessionDate} = ${cursorDate} AND ${attendanceRecords.id} < ${decoded.id}))`
    );
  }

  const query = db
    .select({
      recordId: attendanceRecords.id,
      sessionId: attendanceSessions.id,
      sessionDate: attendanceSessions.sessionDate,
      sessionType: attendanceSessions.sessionType,
      status: attendanceRecords.status,
      firstScannedAt: attendanceRecords.firstScannedAt,
    })
    .from(attendanceRecords)
    .innerJoin(attendanceSessions, eq(attendanceRecords.attendanceSessionId, attendanceSessions.id))
    .where(and(...queryConditions))
    .orderBy(desc(attendanceSessions.sessionDate), desc(attendanceRecords.id))
    .limit(limit + 1);

  if (!decoded && pagination?.offset && pagination.offset > 0) {
    query.offset(pagination.offset);
  }

  const rows = await query;
  const hasMore = rows.length > limit;
  const history = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor: string | null = null;
  if (hasMore && history.length > 0) {
    const last = history[history.length - 1];
    nextCursor = encodeCursor({
      id: last.recordId,
      timestamp: last.sessionDate,
    });
  }

  let present = 0, late = 0, absent = 0, leave = 0, excused = 0;
  for (const item of history) {
    if (item.status === 'PRESENT') present++;
    else if (item.status === 'LATE') late++;
    else if (item.status === 'ABSENT') absent++;
    else if (item.status === 'LEAVE') leave++;
    else if (item.status === 'EXCUSED') excused++;
  }

  const total = history.length;
  const attendancePercentage = total > 0 ? Math.round(((present + late) / total) * 10000) / 100 : 0;

  return {
    student: {
      id: student.id,
      studentCode: student.studentCode,
      name: student.name,
      nameBn: student.nameBn,
      banglarShikshaId: student.banglarShikshaId,
    },
    summary: {
      totalSessions: total,
      present,
      late,
      absent,
      leave,
      excused,
      attendancePercentage,
    },
    history,
    nextCursor,
    hasMore,
    limit,
  };
}

// 5. Absent-Student Report (Deterministic Cursor Pagination)
export async function getAbsentStudentReport(
  schoolId: string,
  params: {
    classSectionId?: string;
    startDate: string;
    endDate?: string;
    includeGuardianPhone?: boolean;
    limit?: number | string;
    offset?: number;
    cursor?: string | null;
  }
) {
  const { classSectionId, startDate, endDate = startDate, includeGuardianPhone = false } = params;
  const limit = parseLimit(params.limit, 50, 200);
  const decoded = decodeCursor(params.cursor);

  let sessionConditions = [
    eq(attendanceSessions.schoolId, schoolId),
    gte(attendanceSessions.sessionDate, startDate),
    lte(attendanceSessions.sessionDate, endDate),
    eq(attendanceRecords.status, 'ABSENT'),
  ];

  if (classSectionId) {
    sessionConditions.push(eq(attendanceSessions.classSectionId, classSectionId));
  }

  if (decoded) {
    const cursorDate = decoded.timestamp || '';
    sessionConditions.push(
      sql`(${attendanceSessions.sessionDate} < ${cursorDate} OR (${attendanceSessions.sessionDate} = ${cursorDate} AND ${attendanceRecords.id} < ${decoded.id}))`
    );
  }

  const query = db
    .select({
      recordId: attendanceRecords.id,
      studentId: students.id,
      studentCode: students.studentCode,
      studentName: students.name,
      studentNameBn: students.nameBn,
      sessionDate: attendanceSessions.sessionDate,
      className: classSections.className,
      sectionName: classSections.sectionName,
      status: attendanceRecords.status,
    })
    .from(attendanceRecords)
    .innerJoin(attendanceSessions, eq(attendanceRecords.attendanceSessionId, attendanceSessions.id))
    .innerJoin(classSections, eq(attendanceSessions.classSectionId, classSections.id))
    .innerJoin(students, eq(attendanceRecords.studentId, students.id))
    .where(and(...sessionConditions))
    .orderBy(desc(attendanceSessions.sessionDate), desc(attendanceRecords.id))
    .limit(limit + 1);

  if (!decoded && params.offset && params.offset > 0) {
    query.offset(params.offset);
  }

  const rows = await query;
  const hasMore = rows.length > limit;
  const absentees = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor: string | null = null;
  if (hasMore && absentees.length > 0) {
    const last = absentees[absentees.length - 1];
    nextCursor = encodeCursor({
      id: last.recordId,
      timestamp: last.sessionDate,
    });
  }

  let guardianMap: Record<string, string> = {};
  if (includeGuardianPhone && absentees.length > 0) {
    const studentIds = Array.from(new Set(absentees.map((a: any) => a.studentId as string)));
    const gRows = await db
      .select({
        studentId: studentGuardians.studentId,
        phoneNumber: guardians.phoneNumber,
      })
      .from(studentGuardians)
      .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
      .where(and(eq(guardians.schoolId, schoolId), inArray(studentGuardians.studentId, studentIds as string[])));

    for (const g of gRows) {
      if (g.phoneNumber) {
        guardianMap[g.studentId] = g.phoneNumber;
      }
    }
  }

  const results = absentees.map((a: any) => ({
    ...a,
    guardianPhone: includeGuardianPhone ? guardianMap[a.studentId] || null : undefined,
  }));

  return {
    schoolId,
    startDate,
    endDate,
    totalAbsentCount: results.length,
    absentees: results,
    nextCursor,
    hasMore,
    limit,
  };
}

// 6. Attendance Correction Report (Deterministic Cursor Pagination)
export async function getCorrectionReport(
  schoolId: string,
  startDate?: string,
  endDate?: string,
  pagination?: { limit?: number | string; offset?: number; cursor?: string | null }
) {
  const limit = parseLimit(pagination?.limit, 50, 200);
  const decoded = decodeCursor(pagination?.cursor);

  let conditions = [
    eq(attendanceCorrections.schoolId, schoolId),
  ];

  if (startDate) {
    conditions.push(gte(attendanceSessions.sessionDate, startDate));
  }
  if (endDate) {
    conditions.push(lte(attendanceSessions.sessionDate, endDate));
  }

  if (decoded) {
    const cursorTime = decoded.timestamp ? new Date(decoded.timestamp) : new Date(0);
    conditions.push(
      sql`(${attendanceCorrections.correctedAt} < ${cursorTime} OR (${attendanceCorrections.correctedAt} = ${cursorTime} AND ${attendanceCorrections.id} < ${decoded.id}))`
    );
  }

  const query = db
    .select({
      correctionId: attendanceCorrections.id,
      recordId: attendanceRecords.id,
      studentId: students.id,
      studentCode: students.studentCode,
      studentName: students.name,
      sessionDate: attendanceSessions.sessionDate,
      className: classSections.className,
      sectionName: classSections.sectionName,
      previousStatus: attendanceCorrections.previousStatus,
      newStatus: attendanceCorrections.newStatus,
      correctionReason: attendanceCorrections.reason,
      correctedAt: attendanceCorrections.correctedAt,
      correctedByUserId: attendanceCorrections.correctedBy,
      correctedByName: users.fullName,
    })
    .from(attendanceCorrections)
    .innerJoin(attendanceRecords, eq(attendanceCorrections.attendanceRecordId, attendanceRecords.id))
    .innerJoin(attendanceSessions, eq(attendanceRecords.attendanceSessionId, attendanceSessions.id))
    .innerJoin(classSections, eq(attendanceSessions.classSectionId, classSections.id))
    .innerJoin(students, eq(attendanceRecords.studentId, students.id))
    .leftJoin(users, eq(attendanceCorrections.correctedBy, users.id))
    .where(and(...conditions))
    .orderBy(desc(attendanceCorrections.correctedAt), desc(attendanceCorrections.id))
    .limit(limit + 1);

  if (!decoded && pagination?.offset && pagination.offset > 0) {
    query.offset(pagination.offset);
  }

  const rows = await query;
  const hasMore = rows.length > limit;
  const corrections = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor: string | null = null;
  if (hasMore && corrections.length > 0) {
    const last = corrections[corrections.length - 1];
    nextCursor = encodeCursor({
      id: last.correctionId,
      timestamp: last.correctedAt ? new Date(last.correctedAt).toISOString() : undefined,
    });
  }

  return {
    schoolId,
    totalCorrections: corrections.length,
    corrections,
    nextCursor,
    hasMore,
    limit,
  };
}

// 7. Teacher / Session Audit Report (Deterministic Cursor Pagination)
export async function getTeacherSessionReport(
  schoolId: string,
  startDate?: string,
  endDate?: string,
  pagination?: { limit?: number | string; offset?: number; cursor?: string | null }
) {
  const limit = parseLimit(pagination?.limit, 50, 200);
  const decoded = decodeCursor(pagination?.cursor);

  let sessionConditions = [eq(attendanceSessions.schoolId, schoolId)];
  if (startDate) sessionConditions.push(gte(attendanceSessions.sessionDate, startDate));
  if (endDate) sessionConditions.push(lte(attendanceSessions.sessionDate, endDate));

  if (decoded) {
    const cursorDate = decoded.timestamp || '';
    sessionConditions.push(
      sql`(${attendanceSessions.sessionDate} < ${cursorDate} OR (${attendanceSessions.sessionDate} = ${cursorDate} AND ${attendanceSessions.id} < ${decoded.id}))`
    );
  }

  const query = db
    .select({
      sessionId: attendanceSessions.id,
      sessionDate: attendanceSessions.sessionDate,
      sessionType: attendanceSessions.sessionType,
      status: attendanceSessions.status,
      className: classSections.className,
      sectionName: classSections.sectionName,
      teacherId: attendanceSessions.teacherId,
      teacherName: users.fullName,
      createdAt: attendanceSessions.createdAt,
      finalizedAt: attendanceSessions.finalizedAt,
      reopenedAt: attendanceSessions.updatedAt,
    })
    .from(attendanceSessions)
    .innerJoin(classSections, eq(attendanceSessions.classSectionId, classSections.id))
    .innerJoin(users, eq(attendanceSessions.teacherId, users.id))
    .where(and(...sessionConditions))
    .orderBy(desc(attendanceSessions.sessionDate), desc(attendanceSessions.id))
    .limit(limit + 1);

  if (!decoded && pagination?.offset && pagination.offset > 0) {
    query.offset(pagination.offset);
  }

  const rows = await query;
  const hasMore = rows.length > limit;
  const sessions = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor: string | null = null;
  if (hasMore && sessions.length > 0) {
    const last = sessions[sessions.length - 1];
    nextCursor = encodeCursor({
      id: last.sessionId,
      timestamp: last.sessionDate,
    });
  }

  const sessionIds = sessions.map((s: any) => s.sessionId);

  let scanCountsMap: Record<string, number> = {};
  if (sessionIds.length > 0) {
    const scans = await db
      .select({
        sessionId: attendanceEvents.attendanceSessionId,
        count: sql<number>`count(*)::int`,
      })
      .from(attendanceEvents)
      .where(and(eq(attendanceEvents.schoolId, schoolId), inArray(attendanceEvents.attendanceSessionId, sessionIds)))
      .groupBy(attendanceEvents.attendanceSessionId);

    for (const sc of scans) {
      if (sc.sessionId) {
        scanCountsMap[sc.sessionId] = sc.count;
      }
    }
  }

  const reports = sessions.map((s: any) => ({
    ...s,
    scansLogged: scanCountsMap[s.sessionId] || 0,
  }));

  return {
    schoolId,
    totalSessions: reports.length,
    sessions: reports,
    nextCursor,
    hasMore,
    limit,
  };
}

// 8. Full Tenant Data Portability Export (Complete & Zero Secrets)
export async function getFullTenantExport(schoolId: string) {
  const [school] = await db
    .select()
    .from(schools)
    .where(eq(schools.id, schoolId));

  if (!school) {
    throw new Error('SCHOOL_NOT_FOUND');
  }

  const allAcademicYears = await db
    .select()
    .from(academicYears)
    .where(eq(academicYears.schoolId, schoolId));

  const sections = await db
    .select()
    .from(classSections)
    .where(eq(classSections.schoolId, schoolId));

  const allStudents = await db
    .select()
    .from(students)
    .where(eq(students.schoolId, schoolId));

  const allEnrollments = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.schoolId, schoolId));

  const allGuardians = await db
    .select()
    .from(guardians)
    .where(eq(guardians.schoolId, schoolId));

  const allStudentGuardians = await db
    .select({
      studentId: studentGuardians.studentId,
      guardianId: studentGuardians.guardianId,
      isPrimary: studentGuardians.isPrimary,
    })
    .from(studentGuardians)
    .innerJoin(students, eq(studentGuardians.studentId, students.id))
    .where(eq(students.schoolId, schoolId));

  // Teachers (Profiles & assignments only, NO passwordHash or auth sessions)
  const teacherProfileRows = await db
    .select({
      id: teacherProfiles.id,
      schoolId: teacherProfiles.schoolId,
      userId: teacherProfiles.userId,
      employeeId: teacherProfiles.employeeId,
      designation: teacherProfiles.designation,
      fullName: users.fullName,
      phoneNumber: users.phoneNumber,
    })
    .from(teacherProfiles)
    .innerJoin(users, eq(teacherProfiles.userId, users.id))
    .where(eq(teacherProfiles.schoolId, schoolId));

  const teacherAssignmentRows = await db
    .select()
    .from(teacherAssignments)
    .where(eq(teacherAssignments.schoolId, schoolId));

  const allSessions = await db
    .select()
    .from(attendanceSessions)
    .where(eq(attendanceSessions.schoolId, schoolId))
    .orderBy(desc(attendanceSessions.sessionDate));

  const allRosters = await db
    .select()
    .from(attendanceSessionRoster)
    .where(eq(attendanceSessionRoster.schoolId, schoolId));

  const allRecords = await db
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.schoolId, schoolId));

  const allCorrections = await db
    .select()
    .from(attendanceCorrections)
    .where(eq(attendanceCorrections.schoolId, schoolId));

  const allEvents = await db
    .select()
    .from(attendanceEvents)
    .where(eq(attendanceEvents.schoolId, schoolId));

  // Redacted Notification Jobs
  const notificationRows = await db
    .select({
      id: notificationJobs.id,
      attendanceSessionId: notificationJobs.attendanceSessionId,
      studentId: notificationJobs.studentId,
      status: notificationJobs.status,
      notificationType: notificationJobs.notificationType,
      language: notificationJobs.language,
      attemptCount: notificationJobs.attemptCount,
      failureReason: notificationJobs.failureReason,
      queuedAt: notificationJobs.queuedAt,
      deliveredAt: notificationJobs.deliveredAt,
    })
    .from(notificationJobs)
    .where(eq(notificationJobs.schoolId, schoolId));

  // Devices & Non-secret RFID metadata
  const deviceRows = await db
    .select({
      id: devices.id,
      deviceIdentifier: devices.deviceIdentifier,
      deviceModel: devices.deviceModel,
      status: devices.status,
      createdAt: devices.createdAt,
    })
    .from(devices)
    .where(eq(devices.schoolId, schoolId));

  const rfidKeyRows = await db
    .select({
      id: rfidKeyVersions.id,
      keyVersion: rfidKeyVersions.keyVersion,
      securityMode: rfidKeyVersions.securityMode,
      algorithm: rfidKeyVersions.algorithm,
      isCurrent: rfidKeyVersions.isCurrent,
    })
    .from(rfidKeyVersions)
    .where(eq(rfidKeyVersions.schoolId, schoolId));

  const rfidReaderRows = await db
    .select({
      id: rfidReaders.id,
      deviceId: rfidReaders.deviceId,
      name: rfidReaders.name,
      location: rfidReaders.location,
      directionMode: rfidReaders.directionMode,
      readerModel: rfidReaders.readerModel,
      status: rfidReaders.status,
    })
    .from(rfidReaders)
    .where(eq(rfidReaders.schoolId, schoolId));

  const rfidCardRows = await db
    .select({
      id: rfidCredentials.id,
      studentId: rfidCredentials.studentId,
      credentialDigest: rfidCredentials.credentialDigest,
      securityMode: rfidCredentials.securityMode,
      keyVersion: rfidCredentials.keyVersion,
      status: rfidCredentials.status,
      issuedAt: rfidCredentials.issuedAt,
    })
    .from(rfidCredentials)
    .where(eq(rfidCredentials.schoolId, schoolId));

  const importJobRows = await db
    .select({
      id: importJobs.id,
      fileName: importJobs.fileName,
      status: importJobs.status,
      totalRows: importJobs.totalRows,
      successfulRows: importJobs.successfulRows,
      failedRows: importJobs.failedRows,
      createdAt: importJobs.createdAt,
    })
    .from(importJobs)
    .where(eq(importJobs.schoolId, schoolId));

  const recentAuditLogs = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(eq(auditLogs.schoolId, schoolId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1000);

  return {
    exportVersion: '2.0.0',
    exportTimestamp: new Date().toISOString(),
    school: {
      id: school.id,
      name: school.name,
      slug: school.slug,
      udiseCode: school.udiseCode,
      district: school.district,
      block: school.block,
      preferredLanguage: school.preferredLanguage,
      timezone: school.timezone,
      status: school.status,
    },
    academicYears: allAcademicYears,
    classSections: sections,
    students: allStudents,
    guardians: allGuardians,
    studentGuardians: allStudentGuardians,
    enrollments: allEnrollments,
    teachers: teacherProfileRows,
    teacherAssignments: teacherAssignmentRows,
    sessions: allSessions,
    rosters: allRosters,
    records: allRecords,
    corrections: allCorrections,
    events: allEvents,
    notificationHistory: notificationRows,
    devices: deviceRows,
    rfidKeys: rfidKeyRows,
    rfidReaders: rfidReaderRows,
    rfidCredentials: rfidCardRows,
    importJobs: importJobRows,
    auditLogs: recentAuditLogs,
  };
}

// 8. Generate XLSX Buffer from JSON data
export async function generateXLSXExport(
  sheetName: string,
  headers: string[],
  rows: (string | number | boolean | null)[][]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.addRow(headers.map((h) => sanitizeSpreadsheetValue(h)));
  rows.forEach((row) => {
    worksheet.addRow(row.map((cell) => sanitizeSpreadsheetValue(cell)));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// 9. Generate CSV Buffer from JSON data
export function generateCSVExport(headers: string[], rows: (string | number | boolean | null)[][]): Buffer {
  const sanitizedRows = rows.map((row) =>
    row.map((cell) => {
      const val = sanitizeSpreadsheetValue(cell);
      if (val === null || val === undefined) return '""';
      const strVal = String(val).replace(/"/g, '""');
      return `"${strVal}"`;
    })
  );

  const headerLine = headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(',');
  const rowLines = sanitizedRows.map((r) => r.join(','));
  const csvStr = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');

  return Buffer.from(csvStr, 'utf-8');
}
