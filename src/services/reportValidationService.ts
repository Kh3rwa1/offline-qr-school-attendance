import { eq, and, inArray, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  schools,
  classSections,
  enrollments,
  students,
  attendanceSessions,
  attendanceRecords,
  attendanceCorrections,
  academicYears,
} from '../db/schema';
import { getWorkingDaysMap } from './calendarService';

export interface ValidationItem {
  code: string;
  message: string;
  severity: 'BLOCKING' | 'WARNING';
  entityId?: string;
  entityType?: string;
  details?: Record<string, any>;
  link?: string;
}

export interface ValidationReportResult {
  isValid: boolean; // True if zero blocking errors
  canExport: boolean;
  blockingErrors: ValidationItem[];
  warnings: ValidationItem[];
  summary: {
    totalStudents: number;
    totalClasses: number;
    workingDays: number;
    totalSessions: number;
    finalizedSessions: number;
    pendingSessions: number;
    missingBanglarShikshaCount: number;
    missingBengaliNameCount: number;
    duplicateRollCount: number;
    unmarkedCount: number;
    correctionsCount: number;
  };
}

export async function validateReportScope(params: {
  schoolId: string;
  reportType: string;
  scopeType: 'WHOLE_SCHOOL' | 'ALL_CLASSES' | 'SELECTED_CLASSES' | 'SELECTED_SECTION' | 'SELECTED_STUDENTS' | 'ONE_STUDENT';
  classSectionIds?: string[];
  studentIds?: string[];
  startDate: string;
  endDate: string;
}): Promise<ValidationReportResult> {
  const blockingErrors: ValidationItem[] = [];
  const warnings: ValidationItem[] = [];

  // 1. Verify Active School
  const [school] = await db
    .select()
    .from(schools)
    .where(eq(schools.id, params.schoolId));

  if (!school) {
    blockingErrors.push({
      code: 'SCHOOL_NOT_FOUND',
      message: 'School tenant context not found or invalid.',
      severity: 'BLOCKING',
    });
    return {
      isValid: false,
      canExport: false,
      blockingErrors,
      warnings,
      summary: {
        totalStudents: 0,
        totalClasses: 0,
        workingDays: 0,
        totalSessions: 0,
        finalizedSessions: 0,
        pendingSessions: 0,
        missingBanglarShikshaCount: 0,
        missingBengaliNameCount: 0,
        duplicateRollCount: 0,
        unmarkedCount: 0,
        correctionsCount: 0,
      },
    };
  }

  if (!school.udiseCode) {
    warnings.push({
      code: 'MISSING_UDISE_CODE',
      message: 'School UDISE code is missing in profile.',
      severity: 'WARNING',
      entityId: school.id,
      entityType: 'SCHOOL',
      link: '/app/school-admin/settings',
    });
  }

  // 2. Validate Date Range
  const start = new Date(params.startDate);
  const end = new Date(params.endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    blockingErrors.push({
      code: 'INVALID_DATE_FORMAT',
      message: 'Specified start date or end date format is invalid.',
      severity: 'BLOCKING',
    });
  } else if (start > end) {
    blockingErrors.push({
      code: 'INVALID_DATE_RANGE',
      message: 'Start date cannot be after end date.',
      severity: 'BLOCKING',
    });
  }

  // 3. Resolve Target Class Sections
  let targetClassSections: any[] = [];
  if (params.scopeType === 'WHOLE_SCHOOL' || params.scopeType === 'ALL_CLASSES') {
    targetClassSections = await db
      .select()
      .from(classSections)
      .where(eq(classSections.schoolId, params.schoolId));
  } else if (params.classSectionIds && params.classSectionIds.length > 0) {
    targetClassSections = await db
      .select()
      .from(classSections)
      .where(
        and(
          eq(classSections.schoolId, params.schoolId),
          inArray(classSections.id, params.classSectionIds)
        )
      );

    if (targetClassSections.length !== params.classSectionIds.length) {
      blockingErrors.push({
        code: 'CROSS_SCHOOL_CLASS_DETECTED',
        message: 'One or more requested classes do not belong to this school.',
        severity: 'BLOCKING',
      });
    }
  }

  const targetSectionIds = targetClassSections.map((s) => s.id);

  // 4. Resolve Target Students & Enrollments
  let activeEnrollments: any[] = [];
  if (targetSectionIds.length > 0) {
    activeEnrollments = await db
      .select({
        enrollmentId: enrollments.id,
        classSectionId: enrollments.classSectionId,
        studentId: enrollments.studentId,
        rollNumber: enrollments.rollNumber,
        studentCode: students.studentCode,
        banglarShikshaId: students.banglarShikshaId,
        studentName: students.name,
        studentNameBn: students.nameBn,
        status: students.status,
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .where(
        and(
          eq(enrollments.schoolId, params.schoolId),
          inArray(enrollments.classSectionId, targetSectionIds),
          eq(enrollments.status, 'ACTIVE')
        )
      );
  }

  if (params.studentIds && params.studentIds.length > 0) {
    activeEnrollments = activeEnrollments.filter((e) => params.studentIds!.includes(e.studentId));
  }

  // Check Duplicate Roll Numbers within each classSection
  const rollsBySection = new Map<string, Set<number>>();
  let duplicateRollCount = 0;
  for (const enr of activeEnrollments) {
    if (!rollsBySection.has(enr.classSectionId)) {
      rollsBySection.set(enr.classSectionId, new Set<number>());
    }
    const sectionRolls = rollsBySection.get(enr.classSectionId)!;
    if (sectionRolls.has(enr.rollNumber)) {
      duplicateRollCount++;
      blockingErrors.push({
        code: 'DUPLICATE_ROLL_NUMBER',
        message: `Duplicate roll number #${enr.rollNumber} detected in class section.`,
        severity: 'BLOCKING',
        entityId: enr.studentId,
        entityType: 'STUDENT',
        link: `/app/school-admin/students`,
      });
    } else {
      sectionRolls.add(enr.rollNumber);
    }
  }

  // Check Missing Banglar Shiksha ID & Bengali Name Warnings
  let missingBanglarShikshaCount = 0;
  let missingBengaliNameCount = 0;
  for (const enr of activeEnrollments) {
    if (!enr.banglarShikshaId || enr.banglarShikshaId.trim() === '') {
      missingBanglarShikshaCount++;
      warnings.push({
        code: 'MISSING_BANGLAR_SHIKSHA_ID',
        message: `Student ${enr.studentName} (Roll #${enr.rollNumber}) is missing Banglar Shiksha Student ID.`,
        severity: 'WARNING',
        entityId: enr.studentId,
        entityType: 'STUDENT',
        link: `/app/school-admin/students`,
      });
    }
    if (!enr.studentNameBn || enr.studentNameBn.trim() === '') {
      missingBengaliNameCount++;
    }
  }

  // 5. Working Days & Sessions Calculation
  const workingDaysMap = await getWorkingDaysMap(params.schoolId, params.startDate, params.endDate);
  let workingDaysCount = 0;
  for (const [_, dayInfo] of workingDaysMap) {
    if (dayInfo.isWorkingDay) {
      workingDaysCount++;
    }
  }

  // Attendance Sessions & Finalization Checks
  let totalSessions = 0;
  let finalizedSessions = 0;
  let pendingSessions = 0;
  let unmarkedCount = 0;

  if (targetSectionIds.length > 0) {
    const sessions = await db
      .select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.schoolId, params.schoolId),
          inArray(attendanceSessions.classSectionId, targetSectionIds),
          gte(attendanceSessions.sessionDate, params.startDate),
          lte(attendanceSessions.sessionDate, params.endDate)
        )
      );

    totalSessions = sessions.length;
    for (const sess of sessions) {
      if (sess.status === 'FINALIZED') {
        finalizedSessions++;
      } else {
        pendingSessions++;
        warnings.push({
          code: 'UNFINALIZED_ATTENDANCE_SESSION',
          message: `Attendance session on ${sess.sessionDate} is not yet finalized (Status: ${sess.status}).`,
          severity: 'WARNING',
          entityId: sess.id,
          entityType: 'ATTENDANCE_SESSION',
          link: `/app/school-admin/attendance`,
        });
      }
    }

    const sessionIds = sessions.map((s: any) => s.id);
    if (sessionIds.length > 0) {
      const unmarked = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.schoolId, params.schoolId),
            inArray(attendanceRecords.attendanceSessionId, sessionIds),
            eq(attendanceRecords.status, 'UNMARKED')
          )
        );
      unmarkedCount = unmarked[0]?.count || 0;
    }
  }

  // Corrections Check
  let correctionsCount = 0;
  if (targetSectionIds.length > 0) {
    const corrections = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(attendanceCorrections)
      .where(
        and(
          eq(attendanceCorrections.schoolId, params.schoolId),
          gte(attendanceCorrections.correctedAt, new Date(params.startDate)),
          lte(attendanceCorrections.correctedAt, new Date(params.endDate))
        )
      );
    correctionsCount = corrections[0]?.count || 0;
  }

  const isValid = blockingErrors.length === 0;

  return {
    isValid,
    canExport: isValid,
    blockingErrors,
    warnings,
    summary: {
      totalStudents: activeEnrollments.length,
      totalClasses: targetClassSections.length,
      workingDays: workingDaysCount,
      totalSessions,
      finalizedSessions,
      pendingSessions,
      missingBanglarShikshaCount,
      missingBengaliNameCount,
      duplicateRollCount,
      unmarkedCount,
      correctionsCount,
    },
  };
}
