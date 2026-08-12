import { db, withSystemContext } from '../src/db/index';
import { schools, academicYears, classSections, students, enrollments } from '../src/db/schema';
import crypto from 'node:crypto';

/**
 * Scale Data Generator for 100 Schools, 500,000 Students profile.
 * Generates 100 schools, 5,000 students per school (500,000 total students) using high-performance chunked batch operations.
 */
export async function generateScaleDataProfile(targetSchools = 100, studentsPerSchool = 5000, batchSize = 1000) {
  console.log(`Starting Scale Data Generation for ${targetSchools} schools, ${studentsPerSchool} students/school (Total: ${targetSchools * studentsPerSchool} students)...`);
  const startTime = Date.now();

  await withSystemContext(async () => {
    for (let s = 1; s <= targetSchools; s++) {
      const schoolId = crypto.randomUUID();
      await db.insert(schools).values({
        id: schoolId,
        name: `Scale School ${s}`,
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

      const classSectionId = crypto.randomUUID();
      await db.insert(classSections).values({
        id: classSectionId,
        schoolId,
        academicYearId,
        className: 'Class 10',
        sectionName: 'A',
      });

      // Insert students and enrollments in batches of 1,000
      let studentBatch: any[] = [];
      let enrollmentBatch: any[] = [];

      for (let i = 1; i <= studentsPerSchool; i++) {
        const studentId = crypto.randomUUID();
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
          classSectionId,
          academicYearId,
          rollNumber: i,
          startDate: '2026-01-01',
          status: 'ACTIVE',
        });

        if (studentBatch.length >= batchSize || i === studentsPerSchool) {
          await db.insert(students).values(studentBatch);
          await db.insert(enrollments).values(enrollmentBatch);
          studentBatch = [];
          enrollmentBatch = [];
        }
      }

      if (s % 10 === 0) {
        console.log(`Generated ${s}/${targetSchools} schools (${s * studentsPerSchool} total students)...`);
      }
    }
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Scale Data Profile Generation complete in ${durationSec}s.`);
}

if (process.argv[1]?.includes('generateScaleData')) {
  const isBenchmark = process.env.FULL_500K_BENCHMARK === '1';
  const targetSchools = isBenchmark ? 100 : 5;
  const studentsPerSchool = isBenchmark ? 5000 : 100;
  generateScaleDataProfile(targetSchools, studentsPerSchool).catch(console.error);
}
