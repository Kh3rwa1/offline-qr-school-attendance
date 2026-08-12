import { db, withSystemContext } from '../src/db/index';
import { schools, academicYears, classSections, students, enrollments, guardians, studentGuardians, qrCredentials, notificationJobs } from '../src/db/schema';
import crypto from 'node:crypto';

/**
 * Realistic Scale Data Generator for 100 Schools, 500,000 Students profile.
 * Generates 100 schools, 10 classes per school, 500 students/class (5,000 total students/school, 500,000 overall),
 * complete with guardians, enrollments, active SHA-256 QR credentials, and notification jobs.
 */
export async function generateScaleDataProfile(targetSchools = 100, studentsPerSchool = 5000, batchSize = 1000) {
  console.log(`Starting Realistic Scale Data Generation for ${targetSchools} schools, ${studentsPerSchool} students/school (Total: ${targetSchools * studentsPerSchool} students)...`);
  const startTime = Date.now();

  await withSystemContext(async () => {
    for (let s = 1; s <= targetSchools; s++) {
      const schoolId = crypto.randomUUID();
      await db.insert(schools).values({
        id: schoolId,
        name: `Scale School ${s}`,
        udiseCode: `19100${100 + s}`,
        district: 'Dhaka',
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

      // Create 10 class sections per school (Class 1-10)
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
      }

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
          name: `Student ${i}`,
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
          name: `Guardian ${i}`,
          phoneNumber: `+9198${String(s).padStart(3, '0')}${String(i).padStart(5, '0')}`,
        });

        studentGuardianBatch.push({
          schoolId,
          studentId,
          guardianId,
          relationship: 'PARENT',
          isPrimary: true,
        });

        const rawToken = crypto.randomBytes(32).toString('hex');
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
            studentId,
            guardianPhoneNumber: `+9198${String(s).padStart(3, '0')}${String(i).padStart(5, '0')}`,
            messageText: `Dear Guardian, Student ${i} was marked absent on 2026-08-12.`,
            status: 'QUEUED',
            priority: 'HIGH',
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

      if (s % 10 === 0) {
        console.log(`Generated ${s}/${targetSchools} schools (${s * studentsPerSchool} total students)...`);
      }
    }
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Realistic Scale Data Profile Generation complete in ${durationSec}s.`);
}

if (process.argv[1]?.includes('generateScaleData')) {
  const isBenchmark = process.env.FULL_500K_BENCHMARK === '1';
  const targetSchools = isBenchmark ? 100 : 5;
  const studentsPerSchool = isBenchmark ? 5000 : 100;
  generateScaleDataProfile(targetSchools, studentsPerSchool).catch(console.error);
}
