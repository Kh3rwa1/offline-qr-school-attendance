import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db';
import { seedDatabase } from '../src/db/seed';
import {
  createStudent,
  listStudents,
  getStudentById,
  updateStudentStatus,
} from '../src/services/studentService';

describe('Student Management & Enrollment History Tests', () => {
  let seeded: any;

  beforeEach(async () => {
    seeded = await seedDatabase();
  });

  it('rejects duplicate student code within the same school', async () => {
    const code = `STU-DUP-CODE-${Math.floor(Math.random() * 100000)}`;

    // School A student creation
    await createStudent({
      schoolId: seeded.schoolA.id,
      studentCode: code,
      name: 'Subhash Chandra',
      classSectionId: seeded.schoolAClass5A.id,
      academicYearId: seeded.academicYearA.id,
      rollNumber: Math.floor(Math.random() * 10000),
    });

    // Attempting to create another student in School A with same student code should fail
    await expect(
      createStudent({
        schoolId: seeded.schoolA.id,
        studentCode: code,
        name: 'Another Student',
        classSectionId: seeded.schoolAClass5A.id,
        academicYearId: seeded.academicYearA.id,
        rollNumber: Math.floor(Math.random() * 10000),
      })
    ).rejects.toThrow('DUPLICATE_STUDENT_CODE');
  });

  it('rejects duplicate roll number within the same class section and academic year', async () => {
    const roll = Math.floor(Math.random() * 10000) + 100;
    const code1 = `STU-ROLL-${Math.floor(Math.random() * 100000)}-1`;
    const code2 = `STU-ROLL-${Math.floor(Math.random() * 100000)}-2`;

    await createStudent({
      schoolId: seeded.schoolA.id,
      studentCode: code1,
      name: 'Subhash Chandra',
      classSectionId: seeded.schoolAClass5A.id,
      academicYearId: seeded.academicYearA.id,
      rollNumber: roll,
    });

    // Attempting to create student with roll number in same class 5A
    await expect(
      createStudent({
        schoolId: seeded.schoolA.id,
        studentCode: code2,
        name: 'Pranab Mukherjee',
        classSectionId: seeded.schoolAClass5A.id,
        academicYearId: seeded.academicYearA.id,
        rollNumber: roll,
      })
    ).rejects.toThrow('DUPLICATE_ROLL_NUMBER');
  });

  it('enforces cross-tenant student access boundaries (School A vs School B)', async () => {
    const code = `STU-CT-${Math.floor(Math.random() * 100000)}`;
    const roll = Math.floor(Math.random() * 10000) + 500;

    const createdA = await createStudent({
      schoolId: seeded.schoolA.id,
      studentCode: code,
      name: 'School A Student',
      classSectionId: seeded.schoolAClass5A.id,
      academicYearId: seeded.academicYearA.id,
      rollNumber: roll,
    });

    // Trying to query School A student using School B's context should return null
    const studentInSchoolB = await getStudentById(seeded.schoolB.id, createdA.student.id);
    expect(studentInSchoolB).toBeNull();

    // Listing School B students should not include School A student
    const schoolBStudents = await listStudents({ schoolId: seeded.schoolB.id, status: 'ALL' });
    const match = schoolBStudents.find((s) => s.id === createdA.student.id);
    expect(match).toBeUndefined();
  });

  it('preserves enrollment history and updates status without hard-deleting records', async () => {
    const code = `STU-HIST-${Math.floor(Math.random() * 100000)}`;
    const roll = Math.floor(Math.random() * 10000) + 800;

    const created = await createStudent({
      schoolId: seeded.schoolA.id,
      studentCode: code,
      name: 'Satyajit Ray',
      classSectionId: seeded.schoolAClass5A.id,
      academicYearId: seeded.academicYearA.id,
      rollNumber: roll,
    });

    // Verify initial active student and enrollment
    let fetched = await getStudentById(seeded.schoolA.id, created.student.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.student.status).toBe('ACTIVE');
    expect(fetched?.activeEnrollment?.rollNumber).toBe(roll);
    expect(fetched?.enrollmentHistory.length).toBe(1);

    // Deactivate student (normal UI operation)
    await updateStudentStatus(seeded.schoolA.id, created.student.id, 'INACTIVE');

    fetched = await getStudentById(seeded.schoolA.id, created.student.id);
    expect(fetched?.student.status).toBe('INACTIVE');
    // Active enrollment is now completed / ended, but remains in history
    expect(fetched?.activeEnrollment).toBeNull();
    expect(fetched?.enrollmentHistory.length).toBe(1);
    expect(fetched?.enrollmentHistory[0].status).toBe('COMPLETED');
  });
});
