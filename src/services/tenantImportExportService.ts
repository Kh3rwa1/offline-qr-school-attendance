import { eq, inArray, and } from 'drizzle-orm';
import { db, withTenantContext } from '../db';
import {
  schools,
  academicYears,
  classSections,
  students,
  guardians,
  studentGuardians,
  enrollments,
  attendanceSessions,
  attendanceSessionRoster,
  attendanceRecords,
  attendanceCorrections,
  attendanceEvents,
  users,
  teacherProfiles,
  schoolMemberships,
  devices,
  rfidReaders,
  rfidKeyVersions,
  rfidCredentials,
  auditLogs,
} from '../db/schema';
import { getFullTenantExport } from './reportService';
import crypto from 'node:crypto';

/**
 * Imports a full tenant package into a target school
 */
export async function importFullTenantPackage(targetSchoolId: string, tenantPackage: any) {
  if (!tenantPackage || !tenantPackage.school) {
    throw new Error('INVALID_TENANT_PACKAGE');
  }

  return withTenantContext(targetSchoolId, async (tx) => {
    // 1. Academic Years Map (oldId -> newId)
    const academicYearMap = new Map<string, string>();
    if (tenantPackage.academicYears && Array.isArray(tenantPackage.academicYears)) {
      for (const ay of tenantPackage.academicYears) {
        const [inserted] = await tx
          .insert(academicYears)
          .values({
            schoolId: targetSchoolId,
            name: ay.name,
            startDate: ay.startDate,
            endDate: ay.endDate,
            isCurrent: ay.isCurrent,
          })
          .returning();
        academicYearMap.set(ay.id, inserted.id);
      }
    }

    // 2. Class Sections Map (oldId -> newId)
    const sectionMap = new Map<string, string>();
    if (tenantPackage.classSections && Array.isArray(tenantPackage.classSections)) {
      for (const cs of tenantPackage.classSections) {
        const newAcademicYearId = cs.academicYearId ? academicYearMap.get(cs.academicYearId) : null;
        const [inserted] = await tx
          .insert(classSections)
          .values({
            schoolId: targetSchoolId,
            academicYearId: newAcademicYearId,
            className: cs.className,
            sectionName: cs.sectionName,
            medium: cs.medium || 'BENGALI',
          })
          .returning();
        sectionMap.set(cs.id, inserted.id);
      }
    }

    // 3. Students Map (oldId -> newId)
    const studentMap = new Map<string, string>();
    if (tenantPackage.students && Array.isArray(tenantPackage.students)) {
      for (const s of tenantPackage.students) {
        const [inserted] = await tx
          .insert(students)
          .values({
            schoolId: targetSchoolId,
            studentCode: s.studentCode,
            name: s.name,
            nameBn: s.nameBn,
            banglarShikshaId: s.banglarShikshaId,
            gender: s.gender,
            dateOfBirth: s.dateOfBirth,
            status: s.status || 'ACTIVE',
          })
          .returning();
        studentMap.set(s.id, inserted.id);
      }
    }

    // 4. Guardians Map (oldId -> newId)
    const guardianMap = new Map<string, string>();
    if (tenantPackage.guardians && Array.isArray(tenantPackage.guardians)) {
      for (const g of tenantPackage.guardians) {
        const [inserted] = await tx
          .insert(guardians)
          .values({
            schoolId: targetSchoolId,
            name: g.name,
            phoneNumber: g.phoneNumber,
            relationship: g.relationship || 'PARENT',
          })
          .returning();
        guardianMap.set(g.id, inserted.id);
      }
    }

    // 5. Student Guardians Relationships
    if (tenantPackage.studentGuardians && Array.isArray(tenantPackage.studentGuardians)) {
      for (const sg of tenantPackage.studentGuardians) {
        const newStudentId = studentMap.get(sg.studentId);
        const newGuardianId = guardianMap.get(sg.guardianId);
        if (newStudentId && newGuardianId) {
          await tx.insert(studentGuardians).values({
            studentId: newStudentId,
            guardianId: newGuardianId,
            isPrimary: sg.isPrimary !== undefined ? sg.isPrimary : true,
          });
        }
      }
    }

    // 6. Enrollments
    if (tenantPackage.enrollments && Array.isArray(tenantPackage.enrollments)) {
      for (const en of tenantPackage.enrollments) {
        const newStudentId = studentMap.get(en.studentId);
        const newSectionId = sectionMap.get(en.classSectionId);
        const newYearId = en.academicYearId ? academicYearMap.get(en.academicYearId) : null;
        if (newStudentId && newSectionId) {
          await tx.insert(enrollments).values({
            schoolId: targetSchoolId,
            studentId: newStudentId,
            classSectionId: newSectionId,
            academicYearId: newYearId,
            rollNumber: en.rollNumber,
            startDate: en.startDate || new Date().toISOString().slice(0, 10),
            status: en.status || 'ACTIVE',
          });
        }
      }
    }

    // 7. Teachers Map (oldUserId -> newUserId)
    const teacherUserMap = new Map<string, string>();
    if (tenantPackage.teachers && Array.isArray(tenantPackage.teachers)) {
      for (const t of tenantPackage.teachers) {
        let targetUserId = t.userId;
        if (t.phoneNumber) {
          const [existingUser] = await tx
            .select()
            .from(users)
            .where(eq(users.phoneNumber, t.phoneNumber));

          if (existingUser) {
            targetUserId = existingUser.id;
          } else {
            const [newUser] = await tx
              .insert(users)
              .values({
                fullName: t.fullName || 'Imported Teacher',
                phoneNumber: t.phoneNumber,
                passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$importedlockedpasswordplaceholder',
                status: 'ACTIVE',
              })
              .returning();
            targetUserId = newUser.id;
          }

          // Ensure membership in target school
          const [existingMember] = await tx
            .select()
            .from(schoolMemberships)
            .where(and(eq(schoolMemberships.schoolId, targetSchoolId), eq(schoolMemberships.userId, targetUserId)));

          if (!existingMember) {
            await tx.insert(schoolMemberships).values({
              schoolId: targetSchoolId,
              userId: targetUserId,
              role: 'TEACHER',
              status: 'ACTIVE',
            });
          }

          // Ensure teacher profile in target school
          const [existingProfile] = await tx
            .select()
            .from(teacherProfiles)
            .where(and(eq(teacherProfiles.schoolId, targetSchoolId), eq(teacherProfiles.userId, targetUserId)));

          if (!existingProfile) {
            await tx.insert(teacherProfiles).values({
              schoolId: targetSchoolId,
              userId: targetUserId,
              employeeId: t.employeeId || 'EMP-IMPORT',
              designation: t.designation || 'Teacher',
            });
          }
        }
        teacherUserMap.set(t.userId, targetUserId);
      }
    }

    // 8. Attendance Sessions Map (oldId -> newId)
    const sessionMap = new Map<string, string>();
    if (tenantPackage.sessions && Array.isArray(tenantPackage.sessions)) {
      for (const ses of tenantPackage.sessions) {
        const newSectionId = sectionMap.get(ses.classSectionId);
        const mappedTeacherId = teacherUserMap.get(ses.teacherId) || ses.teacherId;
        if (newSectionId) {
          const [inserted] = await tx
            .insert(attendanceSessions)
            .values({
              schoolId: targetSchoolId,
              classSectionId: newSectionId,
              teacherId: mappedTeacherId,
              sessionDate: ses.sessionDate,
              sessionType: ses.sessionType || 'DAILY',
              status: ses.status || 'FINALIZED',
            })
            .returning();
          sessionMap.set(ses.id, inserted.id);
        }
      }
    }

    // 8. Attendance Records
    if (tenantPackage.records && Array.isArray(tenantPackage.records)) {
      for (const rec of tenantPackage.records) {
        const newSessionId = sessionMap.get(rec.attendanceSessionId);
        const newStudentId = studentMap.get(rec.studentId);
        if (newSessionId && newStudentId) {
          await tx.insert(attendanceRecords).values({
            schoolId: targetSchoolId,
            attendanceSessionId: newSessionId,
            studentId: newStudentId,
            status: rec.status || 'PRESENT',
            firstScannedAt: rec.firstScannedAt,
          });
        }
      }
    }

    return {
      status: 'SUCCESS',
      targetSchoolId,
      importedCounts: {
        academicYears: academicYearMap.size,
        classSections: sectionMap.size,
        students: studentMap.size,
        guardians: guardianMap.size,
        sessions: sessionMap.size,
      },
    };
  });
}

/**
 * Computes deterministic canonical hash of tenant data for equality verification
 */
export function computeCanonicalTenantHash(tenantPackage: any): string {
  const normalized = {
    students: (tenantPackage.students || [])
      .map((s: any) => ({
        studentCode: s.studentCode,
        name: s.name,
        nameBn: s.nameBn,
        gender: s.gender,
      }))
      .sort((a: any, b: any) => a.studentCode.localeCompare(b.studentCode)),
    guardians: (tenantPackage.guardians || [])
      .map((g: any) => ({
        name: g.name,
        phoneNumber: g.phoneNumber,
      }))
      .sort((a: any, b: any) => a.phoneNumber.localeCompare(b.phoneNumber)),
    classSections: (tenantPackage.classSections || [])
      .map((cs: any) => ({
        className: cs.className,
        sectionName: cs.sectionName,
      }))
      .sort((a: any, b: any) => `${a.className}:${a.sectionName}`.localeCompare(`${b.className}:${b.sectionName}`)),
  };

  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}
