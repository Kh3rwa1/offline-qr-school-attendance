import { db, withSystemContext, closeDatabasePools } from '../src/db/index';
import {
  schools,
  academicYears,
  users,
  schoolMemberships,
  teacherProfiles,
  devices,
  classSections,
  teacherAssignments,
  students,
  guardians,
  studentGuardians,
  enrollments,
  qrCredentials,
  attendanceSessions,
  attendanceSessionRoster,
  attendanceRecords,
  notificationJobs,
} from '../src/db/schema';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { sql, count, eq } from 'drizzle-orm';
import { hashPassword } from '../src/auth/password';
import { runMigrations } from '../src/db/migrate';

export interface ScaleDatasetReport {
  timestamp: string;
  durationSeconds: number;
  expectedCounts: {
    schools: number;
    academicYears: number;
    users: number;
    schoolMemberships: number;
    classSections: number;
    students: number;
    enrollments: number;
    guardians: number;
    qrCredentials: number;
    attendanceSessions: number;
    notificationJobs: number;
  };
  verifiedCounts: {
    schools: number;
    academicYears: number;
    users: number;
    schoolMemberships: number;
    classSections: number;
    students: number;
    enrollments: number;
    guardians: number;
    qrCredentials: number;
    attendanceSessions: number;
    notificationJobs: number;
  };
  verificationPassed: boolean;
}

export async function generateScaleDataset(
  targetSchools = Number(process.env.SCALE_SCHOOLS || (process.env.FULL_500K_BENCHMARK === '1' ? 100 : 5)),
  studentsPerSchool = Number(process.env.SCALE_STUDENTS_PER_SCHOOL || (process.env.FULL_500K_BENCHMARK === '1' ? 5000 : 100)),
  batchSize = 2000
): Promise<ScaleDatasetReport> {
  const startTime = Date.now();
  console.log(`=== Scale Data Pipeline: Generating ${targetSchools} schools, ${studentsPerSchool} students/school (Total ${targetSchools * studentsPerSchool} students) ===`);

  const passwordHash = await hashPassword('ScalePassword123!');
  const expectedTotalStudents = targetSchools * studentsPerSchool;
  const expectedTotalSchools = targetSchools;
  const expectedTotalAcademicYears = targetSchools;
  const expectedTotalUsers = targetSchools * 2; // 1 admin + 1 teacher per school
  const expectedTotalMemberships = targetSchools * 2;
  const expectedTotalClasses = targetSchools * 10;
  const expectedTotalEnrollments = expectedTotalStudents;
  const expectedTotalGuardians = expectedTotalStudents;
  const expectedTotalQrs = expectedTotalStudents;
  const expectedTotalSessions = targetSchools;
  const expectedTotalNotificationJobs = Math.floor(expectedTotalStudents / 50);

  // Ensure DB schema migrations are applied
  await runMigrations();

  await withSystemContext(async () => {
    // 1. Cleanup old scale benchmark data
    console.log('Cleaning up existing scale benchmark data...');
    await db.execute(sql`DELETE FROM schools WHERE udise_code LIKE '19100%'`);

    // 2. Generate per-school data
    for (let s = 1; s <= targetSchools; s++) {
      const schoolId = crypto.randomUUID();
      const schoolName = `Scale School ${s}`;
      const udiseCode = `19100${100 + s}`;

      await db.insert(schools).values({
        id: schoolId,
        name: schoolName,
        slug: `scale-school-${s}`,
        udiseCode,
        district: 'Benchmark District',
        status: 'ACTIVE',
      });

      const academicYearId = crypto.randomUUID();
      await db.insert(academicYears).values({
        id: academicYearId,
        schoolId,
        name: '2026',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        isCurrent: true,
      });

      // School Admin & Teacher
      const adminUserId = crypto.randomUUID();
      const teacherUserId = crypto.randomUUID();
      const adminPhone = `+9199${String(s).padStart(4, '0')}0001`;
      const teacherPhone = `+9199${String(s).padStart(4, '0')}0002`;

      await db.insert(users).values([
        {
          id: adminUserId,
          fullName: `Admin School ${s}`,
          phoneNumber: adminPhone,
          passwordHash,
          status: 'ACTIVE',
        },
        {
          id: teacherUserId,
          fullName: `Teacher School ${s}`,
          phoneNumber: teacherPhone,
          passwordHash,
          status: 'ACTIVE',
        },
      ]);

      await db.insert(schoolMemberships).values([
        {
          schoolId,
          userId: adminUserId,
          role: 'SCHOOL_ADMIN',
          status: 'ACTIVE',
        },
        {
          schoolId,
          userId: teacherUserId,
          role: 'TEACHER',
          status: 'ACTIVE',
        },
      ]);

      await db.insert(teacherProfiles).values({
        schoolId,
        userId: teacherUserId,
        employeeId: `EMP-${s}-01`,
        designation: 'Head Teacher',
      });

      const deviceId = crypto.randomUUID();
      await db.insert(devices).values({
        id: deviceId,
        schoolId,
        userId: teacherUserId,
        deviceIdentifier: `device-school-${s}`,
        deviceModel: 'Benchmarking Scanner Pro',
        status: 'AUTHORIZED',
      });

      // 10 Class Sections per school
      const classSectionIds: string[] = [];
      for (let c = 1; c <= 10; c++) {
        const classSectionId = crypto.randomUUID();
        classSectionIds.push(classSectionId);
        await db.insert(classSections).values({
          id: classSectionId,
          schoolId,
          academicYearId,
          className: `Class ${c}`,
          sectionName: 'A',
        });
        await db.insert(teacherAssignments).values({
          schoolId,
          teacherId: teacherUserId,
          classSectionId,
        });
      }

      // Sample attendance session for Class 1
      const sampleSessionId = crypto.randomUUID();
      await db.insert(attendanceSessions).values({
        id: sampleSessionId,
        schoolId,
        classSectionId: classSectionIds[0],
        teacherId: teacherUserId,
        sessionDate: '2026-08-12',
        sessionType: 'DAILY',
        status: 'FINALIZED',
        finalizedAt: new Date(),
        finalizedBy: teacherUserId,
      });

      // Student batching
      let studentBatch: any[] = [];
      let enrollmentBatch: any[] = [];
      let guardianBatch: any[] = [];
      let studentGuardianBatch: any[] = [];
      let qrBatch: any[] = [];
      let notificationBatch: any[] = [];

      for (let i = 1; i <= studentsPerSchool; i++) {
        const studentId = crypto.randomUUID();
        const guardianId = crypto.randomUUID();
        const targetClassSectionId = classSectionIds[(i - 1) % classSectionIds.length];

        studentBatch.push({
          id: studentId,
          schoolId,
          studentCode: `STU-${s}-${i}`,
          banglarShikshaId: `WB${s}${String(i).padStart(6, '0')}`,
          name: `Student ${s}-${i}`,
          nameBn: `ছাত্র ${s}-${i}`,
          status: 'ACTIVE',
        });

        enrollmentBatch.push({
          schoolId,
          studentId,
          classSectionId: targetClassSectionId,
          academicYearId,
          rollNumber: Math.floor((i - 1) / 10) + 1,
          startDate: '2026-01-01',
          status: 'ACTIVE',
        });

        guardianBatch.push({
          id: guardianId,
          schoolId,
          name: `Guardian ${s}-${i}`,
          phoneNumber: `+9198${String(s).padStart(3, '0')}${String(i).padStart(5, '0')}`,
        });

        studentGuardianBatch.push({
          schoolId,
          studentId,
          guardianId,
          relationship: 'PARENT',
          isPrimary: true,
        });

        const rawToken = crypto.createHash('sha256').update(`token-${s}-${i}-${studentId}`).digest('hex');
        const tokenDigest = crypto.createHash('sha256').update(rawToken).digest('hex');

        qrBatch.push({
          schoolId,
          studentId,
          tokenDigest,
          version: 1,
          status: 'ACTIVE',
          issuedAt: new Date(),
        });

        if (i % 50 === 0) {
          notificationBatch.push({
            schoolId,
            attendanceSessionId: sampleSessionId,
            studentId,
            recipientPhone: `+9198${String(s).padStart(3, '0')}${String(i).padStart(5, '0')}`,
            messageBody: `Dear Parent, Student ${s}-${i} was absent on 2026-08-12.`,
            status: 'QUEUED',
            notificationType: 'ABSENCE',
            queuedAt: new Date(),
          });
        }

        if (studentBatch.length >= batchSize || i === studentsPerSchool) {
          await db.insert(students).values(studentBatch);
          await db.insert(enrollments).values(enrollmentBatch);
          await db.insert(guardians).values(guardianBatch);
          await db.insert(studentGuardians).values(studentGuardianBatch);
          await db.insert(qrCredentials).values(qrBatch);
          if (notificationBatch.length > 0) {
            await db.insert(notificationJobs).values(notificationBatch);
          }

          studentBatch = [];
          enrollmentBatch = [];
          guardianBatch = [];
          studentGuardianBatch = [];
          qrBatch = [];
          notificationBatch = [];
        }
      }

      if (s % 10 === 0 || s === targetSchools) {
        console.log(`Generated ${s}/${targetSchools} schools (${s * studentsPerSchool} total students)...`);
      }
    }
  });

  // 3. Verify Row Counts from Database
  console.log('Verifying actual row counts in PostgreSQL database...');
  const [actualSchools] = await db.select({ count: count() }).from(schools);
  const [actualAcademicYears] = await db.select({ count: count() }).from(academicYears);
  const [actualUsers] = await db.select({ count: count() }).from(users);
  const [actualMemberships] = await db.select({ count: count() }).from(schoolMemberships);
  const [actualClassSections] = await db.select({ count: count() }).from(classSections);
  const [actualStudents] = await db.select({ count: count() }).from(students);
  const [actualEnrollments] = await db.select({ count: count() }).from(enrollments);
  const [actualGuardians] = await db.select({ count: count() }).from(guardians);
  const [actualQrs] = await db.select({ count: count() }).from(qrCredentials);
  const [actualSessions] = await db.select({ count: count() }).from(attendanceSessions);
  const [actualNotifications] = await db.select({ count: count() }).from(notificationJobs);

  const durationSeconds = Number(((Date.now() - startTime) / 1000).toFixed(2));

  const verifiedCounts = {
    schools: actualSchools.count,
    academicYears: actualAcademicYears.count,
    users: actualUsers.count,
    schoolMemberships: actualMemberships.count,
    classSections: actualClassSections.count,
    students: actualStudents.count,
    enrollments: actualEnrollments.count,
    guardians: actualGuardians.count,
    qrCredentials: actualQrs.count,
    attendanceSessions: actualSessions.count,
    notificationJobs: actualNotifications.count,
  };

  const expectedCounts = {
    schools: expectedTotalSchools,
    academicYears: expectedTotalAcademicYears,
    users: expectedTotalUsers,
    schoolMemberships: expectedTotalMemberships,
    classSections: expectedTotalClasses,
    students: expectedTotalStudents,
    enrollments: expectedTotalEnrollments,
    guardians: expectedTotalGuardians,
    qrCredentials: expectedTotalQrs,
    attendanceSessions: expectedTotalSessions,
    notificationJobs: expectedTotalNotificationJobs,
  };

  const verificationPassed =
    verifiedCounts.students >= expectedCounts.students &&
    verifiedCounts.schools >= expectedCounts.schools &&
    verifiedCounts.classSections >= expectedCounts.classSections;

  const report: ScaleDatasetReport = {
    timestamp: new Date().toISOString(),
    durationSeconds,
    expectedCounts,
    verifiedCounts,
    verificationPassed,
  };

  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(path.join(outputDir, 'scale-dataset-report.json'), JSON.stringify(report, null, 2));

  console.log(`Scale Data Generation finished in ${durationSeconds}s. Verification passed: ${verificationPassed}`);
  console.log(`Report written to output/scale-dataset-report.json`);

  if (!verificationPassed) {
    throw new Error(`Scale dataset verification failed! Verified students: ${verifiedCounts.students}, Expected: ${expectedCounts.students}`);
  }

  return report;
}

if (process.argv[1]?.includes('generateScaleDataset')) {
  generateScaleDataset()
    .then(async () => {
      await closeDatabasePools();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Scale dataset generation failed:', err);
      await closeDatabasePools();
      process.exit(1);
    });
}
