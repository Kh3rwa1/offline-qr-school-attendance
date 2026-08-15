import { describe, it, expect, beforeAll } from 'vitest';
import { db, withTenantContext } from '../src/db';
import {
  schools,
  academicYears,
  classSections,
  students,
  guardians,
  studentGuardians,
  enrollments,
  attendanceSessions,
  attendanceRecords,
  users,
  teacherProfiles,
  schoolMemberships,
} from '../src/db/schema';
import { getFullTenantExport } from '../src/services/reportService';
import {
  importFullTenantPackage,
  computeCanonicalTenantHash,
} from '../src/services/tenantImportExportService';
import { runMigrations } from '../src/db/migrate';
import crypto from 'node:crypto';

describe('Tenant Data Migration Round-Trip & Portability Suite', () => {
  let sourceSchoolId: string;
  let targetSchoolId: string;

  beforeAll(async () => {
    await runMigrations();

    // 1. Create source school
    const [sourceSchool] = await db
      .insert(schools)
      .values({
        name: 'Migration Source High School',
        slug: `migration-src-${Date.now()}`,
        district: 'Bankura',
        status: 'ACTIVE',
      })
      .returning();
    sourceSchoolId = sourceSchool.id;

    // 2. Create target school (empty)
    const [targetSchool] = await db
      .insert(schools)
      .values({
        name: 'Migration Target High School',
        slug: `migration-tgt-${Date.now()}`,
        district: 'Purulia',
        status: 'ACTIVE',
      })
      .returning();
    targetSchoolId = targetSchool.id;

    // 3. Seed source school with teacher, multilingual classes, students, guardians, attendance
    const [teacherUser] = await db
      .insert(users)
      .values({
        fullName: 'Buddhadeb Guha',
        phoneNumber: `+9197${String(Date.now()).slice(-8)}`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashforroundtriptest',
        status: 'ACTIVE',
      })
      .returning();

    await db.insert(schoolMemberships).values({
      schoolId: sourceSchoolId,
      userId: teacherUser.id,
      role: 'TEACHER',
      status: 'ACTIVE',
    });

    await db.insert(teacherProfiles).values({
      schoolId: sourceSchoolId,
      userId: teacherUser.id,
      employeeId: 'EMP-001',
      designation: 'Assistant Teacher',
    });

    await withTenantContext(sourceSchoolId, async (tx) => {
      const [ay] = await tx
        .insert(academicYears)
        .values({
          schoolId: sourceSchoolId,
          name: 'Academic Year 2026-2027',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          isCurrent: true,
        })
        .returning();

      const [cs] = await tx
        .insert(classSections)
        .values({
          schoolId: sourceSchoolId,
          academicYearId: ay.id,
          className: 'Class 9',
          sectionName: 'A',
          medium: 'BENGALI',
        })
        .returning();

      const [s1] = await tx
        .insert(students)
        .values({
          schoolId: sourceSchoolId,
          studentCode: `MIG-STU-001-${Date.now()}`,
          name: 'Subhashish Roy',
          nameBn: 'শুভাশীষ রায়',
          banglarShikshaId: 'WB20260001',
          gender: 'MALE',
          status: 'ACTIVE',
        })
        .returning();

      const [s2] = await tx
        .insert(students)
        .values({
          schoolId: sourceSchoolId,
          studentCode: `MIG-STU-002-${Date.now()}`,
          name: 'Debopriya Mukherjee',
          nameBn: 'দেবপ্রিয়া মুখার্জী',
          banglarShikshaId: 'WB20260002',
          gender: 'FEMALE',
          status: 'ACTIVE',
        })
        .returning();

      const [g1] = await tx
        .insert(guardians)
        .values({
          schoolId: sourceSchoolId,
          name: 'Bimal Roy',
          phoneNumber: `+9198${String(Date.now()).slice(-8)}`,
          relationship: 'FATHER',
        })
        .returning();

      await tx.insert(studentGuardians).values({
        studentId: s1.id,
        guardianId: g1.id,
        isPrimary: true,
      });

      await tx.insert(enrollments).values([
        {
          schoolId: sourceSchoolId,
          studentId: s1.id,
          classSectionId: cs.id,
          academicYearId: ay.id,
          rollNumber: 1,
          startDate: '2026-01-01',
          status: 'ACTIVE',
        },
        {
          schoolId: sourceSchoolId,
          studentId: s2.id,
          classSectionId: cs.id,
          academicYearId: ay.id,
          rollNumber: 2,
          startDate: '2026-01-01',
          status: 'ACTIVE',
        },
      ]);

      const [ses] = await tx
        .insert(attendanceSessions)
        .values({
          schoolId: sourceSchoolId,
          classSectionId: cs.id,
          teacherId: teacherUser.id,
          sessionDate: '2026-08-15',
          sessionType: 'DAILY',
          status: 'FINALIZED',
        })
        .returning();

      await tx.insert(attendanceRecords).values([
        {
          schoolId: sourceSchoolId,
          attendanceSessionId: ses.id,
          studentId: s1.id,
          status: 'PRESENT',
        },
        {
          schoolId: sourceSchoolId,
          attendanceSessionId: ses.id,
          studentId: s2.id,
          status: 'ABSENT',
        },
      ]);
    });
  });

  it('exports complete tenant package with zero secrets leaked', async () => {
    const pkg = await getFullTenantExport(sourceSchoolId);
    expect(pkg.exportVersion).toBe('2.0.0');
    expect(pkg.school.name).toBe('Migration Source High School');
    expect(pkg.students.length).toBe(2);
    expect(pkg.guardians.length).toBe(1);
    expect(pkg.academicYears.length).toBe(1);
    expect(pkg.classSections.length).toBe(1);
    expect(pkg.sessions.length).toBe(1);
    expect(pkg.records.length).toBe(2);

    // Verify Bengali UTF-8 preservation
    expect(pkg.students.some((s: any) => s.nameBn === 'শুভাশীষ রায়')).toBe(true);

    // Strict secrets exclusion check
    const rawJson = JSON.stringify(pkg);
    expect(rawJson).not.toContain('passwordHash');
    expect(rawJson).not.toContain('rawToken');
    expect(rawJson).not.toContain('kmsKey');
    expect(rawJson).not.toContain('sessionSecret');
  });

  it('imports tenant package into target school and verifies full round-trip parity', async () => {
    const srcPkg = await getFullTenantExport(sourceSchoolId);
    const srcHash = computeCanonicalTenantHash(srcPkg);

    const importResult = await importFullTenantPackage(targetSchoolId, srcPkg);
    expect(importResult.status).toBe('SUCCESS');
    expect(importResult.importedCounts.students).toBe(2);
    expect(importResult.importedCounts.guardians).toBe(1);

    const tgtPkg = await getFullTenantExport(targetSchoolId);
    const tgtHash = computeCanonicalTenantHash(tgtPkg);

    // Canonical data hash must match exactly
    expect(tgtHash).toBe(srcHash);

    // Verify Bengali UTF-8 in target school
    expect(tgtPkg.students.some((s: any) => s.nameBn === 'শুভাশীষ রায়')).toBe(true);
    expect(tgtPkg.records.length).toBe(2);
  });
});
