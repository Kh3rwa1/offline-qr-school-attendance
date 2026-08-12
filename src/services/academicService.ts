import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { academicYears, classSections, teacherAssignments, teacherProfiles, users } from '../db/schema';

export async function listAcademicYears(schoolId: string) {
  return db
    .select()
    .from(academicYears)
    .where(eq(academicYears.schoolId, schoolId));
}

export async function createAcademicYear(params: {
  schoolId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
}) {
  if (params.isCurrent) {
    await db
      .update(academicYears)
      .set({ isCurrent: false })
      .where(eq(academicYears.schoolId, params.schoolId));
  }

  const [created] = await db
    .insert(academicYears)
    .values({
      schoolId: params.schoolId,
      name: params.name,
      startDate: params.startDate,
      endDate: params.endDate,
      isCurrent: params.isCurrent ?? false,
    })
    .returning();

  return created;
}

export async function setCurrentAcademicYear(schoolId: string, academicYearId: string) {
  await db
    .update(academicYears)
    .set({ isCurrent: false })
    .where(eq(academicYears.schoolId, schoolId));

  const [updated] = await db
    .update(academicYears)
    .set({ isCurrent: true, updatedAt: new Date() })
    .where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.id, academicYearId)))
    .returning();

  return updated;
}

export async function listClassSections(schoolId: string, academicYearId?: string) {
  const query = db
    .select({
      id: classSections.id,
      schoolId: classSections.schoolId,
      academicYearId: classSections.academicYearId,
      academicYearName: academicYears.name,
      className: classSections.className,
      sectionName: classSections.sectionName,
      createdAt: classSections.createdAt,
    })
    .from(classSections)
    .innerJoin(academicYears, eq(classSections.academicYearId, academicYears.id))
    .where(eq(classSections.schoolId, schoolId));

  if (academicYearId) {
    return query.where(and(eq(classSections.schoolId, schoolId), eq(classSections.academicYearId, academicYearId)));
  }

  return query;
}

export async function createClassSection(params: {
  schoolId: string;
  academicYearId: string;
  className: string;
  sectionName: string;
}) {
  const [created] = await db
    .insert(classSections)
    .values({
      schoolId: params.schoolId,
      academicYearId: params.academicYearId,
      className: params.className.trim(),
      sectionName: params.sectionName.trim(),
    })
    .returning();

  return created;
}

export async function listTeachers(schoolId: string) {
  return db
    .select({
      teacherId: users.id,
      fullName: users.fullName,
      phoneNumber: users.phoneNumber,
      employeeId: teacherProfiles.employeeId,
      designation: teacherProfiles.designation,
    })
    .from(users)
    .innerJoin(teacherProfiles, eq(users.id, teacherProfiles.userId))
    .where(eq(teacherProfiles.schoolId, schoolId));
}

export async function assignTeacherToClass(params: {
  schoolId: string;
  teacherId: string;
  classSectionId: string;
}) {
  const [created] = await db
    .insert(teacherAssignments)
    .values({
      schoolId: params.schoolId,
      teacherId: params.teacherId,
      classSectionId: params.classSectionId,
    })
    .returning();

  return created;
}

export async function unassignTeacherFromClass(params: {
  schoolId: string;
  teacherId: string;
  classSectionId: string;
}) {
  const [deleted] = await db
    .delete(teacherAssignments)
    .where(
      and(
        eq(teacherAssignments.schoolId, params.schoolId),
        eq(teacherAssignments.teacherId, params.teacherId),
        eq(teacherAssignments.classSectionId, params.classSectionId)
      )
    )
    .returning();

  return deleted;
}
