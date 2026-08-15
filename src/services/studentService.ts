import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  students,
  guardians,
  studentGuardians,
  enrollments,
  classSections,
  academicYears,
} from '../db/schema';

export interface CreateStudentInput {
  schoolId: string;
  studentCode: string;
  name: string;
  nameBn?: string;
  banglarShikshaId?: string;
  dateOfBirth?: string;
  gender?: string;
  photoUrl?: string;
  classSectionId: string;
  academicYearId: string;
  rollNumber: number;
  guardian?: {
    name: string;
    phoneNumber: string;
    relationship?: string;
    isPrimary?: boolean;
  };
}

export async function createStudent(input: CreateStudentInput) {
  // Check studentCode duplicate in school
  const [existingCode] = await db
    .select()
    .from(students)
    .where(and(eq(students.schoolId, input.schoolId), eq(students.studentCode, input.studentCode.trim())));

  if (existingCode) {
    throw new Error('DUPLICATE_STUDENT_CODE');
  }

  // Check rollNumber duplicate in class/academic year
  const [existingRoll] = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.schoolId, input.schoolId),
        eq(enrollments.classSectionId, input.classSectionId),
        eq(enrollments.academicYearId, input.academicYearId),
        eq(enrollments.rollNumber, input.rollNumber),
        eq(enrollments.status, 'ACTIVE')
      )
    );

  if (existingRoll) {
    throw new Error('DUPLICATE_ROLL_NUMBER');
  }

  return db.transaction(async (tx: any) => {
    const [student] = await tx
      .insert(students)
      .values({
        schoolId: input.schoolId,
        studentCode: input.studentCode.trim(),
        name: input.name.trim(),
        nameBn: input.nameBn?.trim() || null,
        banglarShikshaId: input.banglarShikshaId?.trim() || null,
        dateOfBirth: input.dateOfBirth || null,
        gender: input.gender || 'OTHER',
        photoUrl: input.photoUrl || null,
        status: 'ACTIVE',
      })
      .returning();

    const [enrollment] = await tx
      .insert(enrollments)
      .values({
        schoolId: input.schoolId,
        studentId: student.id,
        classSectionId: input.classSectionId,
        academicYearId: input.academicYearId,
        rollNumber: input.rollNumber,
        startDate: new Date().toISOString().split('T')[0],
        status: 'ACTIVE',
      })
      .returning();

    let createdGuardian = null;
    if (input.guardian) {
      const [g] = await tx
        .insert(guardians)
        .values({
          schoolId: input.schoolId,
          name: input.guardian.name.trim(),
          phoneNumber: input.guardian.phoneNumber.trim(),
          relationship: input.guardian.relationship?.trim() || 'PARENT',
        })
        .returning();

      await tx.insert(studentGuardians).values({
        studentId: student.id,
        guardianId: g.id,
        isPrimary: input.guardian.isPrimary ?? true,
      });

      createdGuardian = g;
    }

    return {
      student,
      enrollment,
      guardian: createdGuardian,
    };
  });
}

import { encodeCursor, decodeCursor, parseLimit } from './paginationHelper';

export async function listStudents(params: {
  schoolId: string;
  classSectionId?: string;
  status?: string;
  search?: string;
  limit?: number | string | null;
  cursor?: string | null;
  page?: number;
}) {
  const limit = parseLimit(params.limit, 50, 200);
  const decoded = decodeCursor(params.cursor);

  let conditions: any[] = [eq(students.schoolId, params.schoolId)];

  if (params.status && params.status !== 'ALL') {
    conditions.push(eq(students.status, params.status));
  } else if (!params.status) {
    conditions.push(eq(students.status, 'ACTIVE'));
  }

  if (params.classSectionId) {
    conditions.push(eq(enrollments.classSectionId, params.classSectionId));
  }

  if (params.search && params.search.trim()) {
    const pattern = `%${params.search.trim()}%`;
    conditions.push(
      sql`(${students.name} ILIKE ${pattern} OR ${students.studentCode} ILIKE ${pattern} OR ${students.banglarShikshaId} ILIKE ${pattern})`
    );
  }

  if (decoded) {
    const cursorValue = decoded.value !== undefined ? String(decoded.value) : '';
    conditions.push(
      sql`(${students.name} > ${cursorValue} OR (${students.name} = ${cursorValue} AND ${students.id} > ${decoded.id}))`
    );
  }

  const query = db
    .select({
      id: students.id,
      schoolId: students.schoolId,
      studentCode: students.studentCode,
      banglarShikshaId: students.banglarShikshaId,
      name: students.name,
      fullName: students.name,
      nameBn: students.nameBn,
      gender: students.gender,
      dateOfBirth: students.dateOfBirth,
      photoUrl: students.photoUrl,
      status: students.status,
      enrollmentId: enrollments.id,
      rollNumber: enrollments.rollNumber,
      classSectionId: enrollments.classSectionId,
      className: classSections.className,
      sectionName: classSections.sectionName,
      academicYearId: enrollments.academicYearId,
      academicYearName: academicYears.name,
    })
    .from(students)
    .leftJoin(
      enrollments,
      and(eq(students.id, enrollments.studentId), eq(enrollments.status, 'ACTIVE'))
    )
    .leftJoin(classSections, eq(enrollments.classSectionId, classSections.id))
    .leftJoin(academicYears, eq(enrollments.academicYearId, academicYears.id))
    .where(and(...conditions))
    .orderBy(students.name, students.id)
    .limit(limit + 1);

  // If legacy page > 1 requested without cursor
  if (!decoded && params.page && params.page > 1) {
    query.offset((params.page - 1) * limit);
  }

  const rows = await query;
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1];
    nextCursor = encodeCursor({
      id: lastItem.id,
      value: lastItem.name,
    });
  }

  return Object.assign(items, {
    items,
    nextCursor,
    hasMore,
    limit,
  });
}

export async function getStudentById(schoolId: string, studentId: string) {
  const [student] = await db
    .select()
    .from(students)
    .where(and(eq(students.schoolId, schoolId), eq(students.id, studentId)));

  if (!student) return null;

  const studentGuardiansList = await db
    .select({
      guardianId: guardians.id,
      name: guardians.name,
      phoneNumber: guardians.phoneNumber,
      relationship: guardians.relationship,
      isPrimary: studentGuardians.isPrimary,
    })
    .from(studentGuardians)
    .innerJoin(guardians, eq(studentGuardians.guardianId, guardians.id))
    .where(eq(studentGuardians.studentId, studentId));

  const enrollmentList = await db
    .select({
      id: enrollments.id,
      classSectionId: enrollments.classSectionId,
      className: classSections.className,
      sectionName: classSections.sectionName,
      academicYearId: enrollments.academicYearId,
      academicYearName: academicYears.name,
      rollNumber: enrollments.rollNumber,
      startDate: enrollments.startDate,
      endDate: enrollments.endDate,
      status: enrollments.status,
    })
    .from(enrollments)
    .innerJoin(classSections, eq(enrollments.classSectionId, classSections.id))
    .innerJoin(academicYears, eq(enrollments.academicYearId, academicYears.id))
    .where(and(eq(enrollments.schoolId, schoolId), eq(enrollments.studentId, studentId)))
    .orderBy(desc(enrollments.startDate));

  return {
    student,
    guardians: studentGuardiansList,
    enrollmentHistory: enrollmentList,
    activeEnrollment: enrollmentList.find((e: { status: string }) => e.status === 'ACTIVE') || null,
  };
}

export async function updateStudentStatus(schoolId: string, studentId: string, status: 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED') {
  const [updated] = await db
    .update(students)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(students.schoolId, schoolId), eq(students.id, studentId)))
    .returning();

  if (updated && status !== 'ACTIVE') {
    // Also update current active enrollment status
    await db
      .update(enrollments)
      .set({
        status: status === 'TRANSFERRED' ? 'WITHDRAWN' : 'COMPLETED',
        endDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(enrollments.schoolId, schoolId),
          eq(enrollments.studentId, studentId),
          eq(enrollments.status, 'ACTIVE')
        )
      );
  }

  return updated;
}

export async function updateStudentDetails(
  schoolId: string,
  studentId: string,
  data: Partial<{
    name: string;
    nameBn: string;
    banglarShikshaId: string;
    gender: string;
    dateOfBirth: string;
    photoUrl: string;
  }>
) {
  const [updated] = await db
    .update(students)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(students.schoolId, schoolId), eq(students.id, studentId)))
    .returning();

  return updated;
}
