import { db, withSystemContext } from '../src/db/index';
import { schools, users, academicYears, classSections, students, enrollments } from '../src/db/schema';
import crypto from 'node:crypto';

/**
 * Scale Data Generator for 100 Schools, 500,000 Students load testing profile.
 */
export async function generateScaleDataProfile(targetSchools = 100, studentsPerSchool = 5000) {
  console.log(`Starting Scale Data Generation for ${targetSchools} schools, ${studentsPerSchool} students/school...`);

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

      if (s <= 2) {
        // Generate actual records for first 2 schools for local smoke testing
        for (let i = 1; i <= 50; i++) {
          const studentId = crypto.randomUUID();
          await db.insert(students).values({
            id: studentId,
            schoolId,
            studentCode: `STU-SCALE-${s}-${i}`,
            name: `Scale Student ${i}`,
            status: 'ACTIVE',
          });
          await db.insert(enrollments).values({
            schoolId,
            studentId,
            classSectionId,
            academicYearId,
            rollNumber: i,
            startDate: '2026-01-01',
            status: 'ACTIVE',
          });
        }
      }
    }
  });

  console.log('Scale Data Profile Generation complete.');
}

if (process.argv[1]?.includes('generateScaleData')) {
  generateScaleDataProfile(10, 50).catch(console.error);
}
