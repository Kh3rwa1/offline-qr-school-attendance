import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  rfidCredentials,
  students,
  enrollments,
  academicYears,
  attendanceSessions,
  teacherAssignments,
  academicCalendarDays,
} from '../../../db/schema';
import type { IngestContext, NormalizedRead } from './types';

type Tx = any;

export async function isSchoolOpen(tx: Tx, schoolId: string, schoolDate: string): Promise<boolean> {
  const [day] = await tx
    .select({ isWorkingDay: academicCalendarDays.isWorkingDay })
    .from(academicCalendarDays)
    .where(
      and(
        eq(academicCalendarDays.schoolId, schoolId),
        eq(academicCalendarDays.calendarDate, schoolDate)
      )
    )
    .limit(1);
  return day ? Boolean(day.isWorkingDay) : true;
}

export async function loadContext(
  tx: Tx,
  args: { schoolId: string; schoolDate: string; reads: NormalizedRead[]; debounced: Set<string> }
): Promise<IngestContext> {
  const { schoolId, schoolDate, reads, debounced } = args;
  const digests: string[] = Array.from(new Set<string>(reads.map((r) => r.epcDigest)));
  const empty = new Map();

  if (!digests.length) {
    return {
      schoolId,
      schoolDate,
      isSchoolDay: true,
      debounced,
      credsByDigest: empty,
      studentsById: empty,
      enrollmentByStudent: empty,
      sessionBySection: empty,
      teacherBySection: empty,
    };
  }

  // Q1: credentials
  const creds = await tx
    .select({
      id: rfidCredentials.id,
      studentId: rfidCredentials.studentId,
      epcDigest: rfidCredentials.credentialDigest,
      status: rfidCredentials.status,
    })
    .from(rfidCredentials)
    .where(and(eq(rfidCredentials.schoolId, schoolId), inArray(rfidCredentials.credentialDigest, digests)));

  const studentIds: string[] = Array.from(new Set<string>(creds.map((c: any) => String(c.studentId))));

  // Q2: students + current enrollment in one join
  const studentRows = studentIds.length
    ? await tx
        .select({
          id: students.id,
          name: students.name,
          status: students.status,
          photoUrl: students.photoUrl,
          classSectionId: enrollments.classSectionId,
          rollNumber: enrollments.rollNumber,
        })
        .from(students)
        .leftJoin(
          enrollments,
          and(
            eq(enrollments.studentId, students.id),
            eq(enrollments.schoolId, schoolId),
            sql`${enrollments.academicYearId} = (
                  SELECT ${academicYears.id} FROM ${academicYears}
                  WHERE ${academicYears.schoolId} = ${schoolId} AND ${academicYears.isCurrent} = true
                  LIMIT 1)`,
            eq(enrollments.status, 'ACTIVE')
          )
        )
        .where(and(eq(students.schoolId, schoolId), inArray(students.id, studentIds)))
    : [];

  const sectionIds: string[] = Array.from(new Set<string>(studentRows.map((s: any) => s.classSectionId).filter(Boolean) as string[]));

  // Q3 + Q4 sequential on single transaction connection
  const sessions = sectionIds.length
    ? await tx
        .select({
          id: attendanceSessions.id,
          classSectionId: attendanceSessions.classSectionId,
          status: attendanceSessions.status,
        })
        .from(attendanceSessions)
        .where(
          and(
            eq(attendanceSessions.schoolId, schoolId),
            inArray(attendanceSessions.classSectionId, sectionIds),
            eq(attendanceSessions.sessionDate, schoolDate),
            eq(attendanceSessions.sessionType, 'GATE_ARRIVAL')
          )
        )
    : [];

  const teachers = sectionIds.length
    ? await tx
        .select({
          classSectionId: teacherAssignments.classSectionId,
          teacherId: teacherAssignments.teacherId,
        })
        .from(teacherAssignments)
        .where(and(eq(teacherAssignments.schoolId, schoolId), inArray(teacherAssignments.classSectionId, sectionIds)))
        .orderBy(teacherAssignments.createdAt)
    : [];

  // Q5: calendar
  const isSchoolDay = await isSchoolOpen(tx, schoolId, schoolDate);

  const teacherBySection = new Map<string, string>();
  for (const t of teachers) {
    if (!teacherBySection.has(t.classSectionId)) {
      teacherBySection.set(t.classSectionId, t.teacherId);
    }
  }

  return {
    schoolId,
    schoolDate,
    isSchoolDay,
    debounced,
    credsByDigest: new Map(creds.map((c: any) => [c.epcDigest, c])),
    studentsById: new Map(
      studentRows.map((s: any) => [
        s.id,
        { id: s.id, name: s.name, status: s.status, photoUrl: s.photoUrl },
      ])
    ),
    enrollmentByStudent: new Map(
      studentRows
        .filter((s: any) => s.classSectionId)
        .map((s: any) => [
          s.id,
          { studentId: s.id, classSectionId: s.classSectionId!, rollNumber: s.rollNumber ?? null },
        ])
    ),
    sessionBySection: new Map(sessions.map((s: any) => [s.classSectionId, s])),
    teacherBySection,
  };
}
