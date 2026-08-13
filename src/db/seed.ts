import { hashPassword } from '../auth/password';
import { getDb, executeSql } from './index';
import { runMigrations } from './migrate';
import {
  schools,
  academicYears,
  users,
  schoolMemberships,
  teacherProfiles,
  classSections,
  teacherAssignments,
  students,
} from './schema';
import { eq, and } from 'drizzle-orm';

export async function seedDatabase() {
  const db = getDb();

  // Tests and explicit development seeding run the versioned migrations first.
  await runMigrations();
  if (process.env.NODE_ENV === 'test') {
    // Each test that asks for the fixture expects a clean tenant graph. This
    // reset is test-only; production never calls seedDatabase automatically.
    for (const table of [
      'rfid_scan_events', 'rfid_credentials', 'rfid_readers', 'rfid_key_versions',
      'audit_logs', 'notification_attempts', 'notification_jobs', 'attendance_corrections',
      'attendance_events', 'attendance_records', 'attendance_session_roster', 'attendance_sessions',
      'qr_credentials', 'student_guardians', 'guardians', 'enrollments', 'students',
      'teacher_assignments', 'teacher_profiles', 'devices', 'class_sections',
      'school_memberships', 'auth_sessions', 'academic_years', 'school_sms_settings', 'schools', 'users',
    ]) {
      await executeSql(`DELETE FROM ${table};`);
    }
  }

  console.log('Seeding initial database state for Milestone 1...');

  // 1. Create Super Admin User
  const superAdminHash = await hashPassword('SuperSecretAdminPassword123!');
  const existingSuperAdmin = await db
    .select()
    .from(users)
    .where(eq(users.phoneNumber, '+919000000000'));

  let superAdminUser;
  if (existingSuperAdmin.length === 0) {
    [superAdminUser] = await db
      .insert(users)
      .values({
        fullName: 'System Super Admin',
        phoneNumber: '+919000000000',
        passwordHash: superAdminHash,
        status: 'ACTIVE',
      })
      .returning();
  } else {
    superAdminUser = existingSuperAdmin[0];
  }

  // 2. Create School A
  const existingSchoolA = await db
    .select()
    .from(schools)
    .where(eq(schools.udiseCode, '19100100101'));

  let schoolA;
  if (existingSchoolA.length === 0) {
    [schoolA] = await db
      .insert(schools)
      .values({
        name: 'Rampur High School',
        udiseCode: '19100100101',
        district: 'Murshidabad',
        block: 'Raninagar-I',
        preferredLanguage: 'bn',
        timezone: 'Asia/Kolkata',
        status: 'ACTIVE',
      })
      .returning();
  } else {
    schoolA = existingSchoolA[0];
  }

  // 3. Create School B
  const existingSchoolB = await db
    .select()
    .from(schools)
    .where(eq(schools.udiseCode, '19100100102'));

  let schoolB;
  if (existingSchoolB.length === 0) {
    [schoolB] = await db
      .insert(schools)
      .values({
        name: 'Haripur High School',
        udiseCode: '19100100102',
        district: 'Murshidabad',
        block: 'Raninagar-II',
        preferredLanguage: 'bn',
        timezone: 'Asia/Kolkata',
        status: 'ACTIVE',
      })
      .returning();
  } else {
    schoolB = existingSchoolB[0];
  }

  // Assign Super Admin membership to School A & B
  await db
    .insert(schoolMemberships)
    .values([
      { schoolId: schoolA.id, userId: superAdminUser.id, role: 'SUPER_ADMIN', status: 'ACTIVE' },
      { schoolId: schoolB.id, userId: superAdminUser.id, role: 'SUPER_ADMIN', status: 'ACTIVE' },
    ])
    .onConflictDoNothing();

  // 4. Create Academic Years
  let [academicYearA] = await db
    .insert(academicYears)
    .values({
      schoolId: schoolA.id,
      name: '2026',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      isCurrent: true,
    })
    .onConflictDoNothing()
    .returning();
  if (!academicYearA) {
    [academicYearA] = await db.select().from(academicYears).where(and(eq(academicYears.schoolId, schoolA.id), eq(academicYears.name, '2026')));
  }

  let [academicYearB] = await db
    .insert(academicYears)
    .values({
      schoolId: schoolB.id,
      name: '2026',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      isCurrent: true,
    })
    .onConflictDoNothing()
    .returning();
  if (!academicYearB) {
    [academicYearB] = await db.select().from(academicYears).where(and(eq(academicYears.schoolId, schoolB.id), eq(academicYears.name, '2026')));
  }

  // Standard passwords for seed
  const adminPassHash = await hashPassword('SchoolAdminPassword123!');
  const teacherPassHash = await hashPassword('TeacherPassword123!');

  // --- SCHOOL A STAFF ---
  // School A Admin
  let [adminA] = await db
    .insert(users)
    .values({
      fullName: 'Dr. Anupam Mukherjee',
      phoneNumber: '+919100000001',
      passwordHash: adminPassHash,
      status: 'ACTIVE',
    })
    .onConflictDoNothing()
    .returning();

  if (!adminA) {
    [adminA] = await db.select().from(users).where(eq(users.phoneNumber, '+919100000001'));
  }

  if (adminA) {
    await db
      .update(users)
      .set({ status: 'ACTIVE' })
      .where(eq(users.id, adminA.id));

    await db.insert(schoolMemberships).values({
      schoolId: schoolA.id,
      userId: adminA.id,
      role: 'SCHOOL_ADMIN',
      status: 'ACTIVE',
    }).onConflictDoNothing();

    await db
      .update(schoolMemberships)
      .set({ status: 'ACTIVE' })
      .where(and(eq(schoolMemberships.schoolId, schoolA.id), eq(schoolMemberships.userId, adminA.id)));
  }

  // School A Teacher 1
  let [teacherA1] = await db
    .insert(users)
    .values({
      fullName: 'Sujata Banerjee',
      phoneNumber: '+919100000002',
      passwordHash: teacherPassHash,
      status: 'ACTIVE',
    })
    .onConflictDoNothing()
    .returning();

  if (!teacherA1) {
    [teacherA1] = await db.select().from(users).where(eq(users.phoneNumber, '+919100000002'));
  }

  if (teacherA1) {
    await db
      .update(users)
      .set({ status: 'ACTIVE' })
      .where(eq(users.id, teacherA1.id));

    await db.insert(schoolMemberships).values({
      schoolId: schoolA.id,
      userId: teacherA1.id,
      role: 'TEACHER',
      status: 'ACTIVE',
    }).onConflictDoNothing();

    await db
      .update(schoolMemberships)
      .set({ status: 'ACTIVE' })
      .where(and(eq(schoolMemberships.schoolId, schoolA.id), eq(schoolMemberships.userId, teacherA1.id)));

    await db.insert(teacherProfiles).values({
      schoolId: schoolA.id,
      userId: teacherA1.id,
      employeeId: 'EMP-A-01',
      designation: 'Assistant Teacher (Math)',
    }).onConflictDoNothing();
  }

  // School A Teacher 2
  const [teacherA2] = await db
    .insert(users)
    .values({
      fullName: 'Prabir Roy',
      phoneNumber: '+919100000003',
      passwordHash: teacherPassHash,
      status: 'ACTIVE',
    })
    .onConflictDoNothing()
    .returning();

  if (teacherA2) {
    await db.insert(schoolMemberships).values({
      schoolId: schoolA.id,
      userId: teacherA2.id,
      role: 'TEACHER',
      status: 'ACTIVE',
    }).onConflictDoNothing();

    await db.insert(teacherProfiles).values({
      schoolId: schoolA.id,
      userId: teacherA2.id,
      employeeId: 'EMP-A-02',
      designation: 'Assistant Teacher (English)',
    }).onConflictDoNothing();
  }

  // --- SCHOOL B STAFF ---
  // School B Admin
  const [adminB] = await db
    .insert(users)
    .values({
      fullName: 'Bikash Chandra Sen',
      phoneNumber: '+919200000001',
      passwordHash: adminPassHash,
      status: 'ACTIVE',
    })
    .onConflictDoNothing()
    .returning();

  if (adminB) {
    await db.insert(schoolMemberships).values({
      schoolId: schoolB.id,
      userId: adminB.id,
      role: 'SCHOOL_ADMIN',
      status: 'ACTIVE',
    }).onConflictDoNothing();
  }

  // School B Teacher 1
  const [teacherB1] = await db
    .insert(users)
    .values({
      fullName: 'Tapas Das',
      phoneNumber: '+919200000002',
      passwordHash: teacherPassHash,
      status: 'ACTIVE',
    })
    .onConflictDoNothing()
    .returning();

  if (teacherB1) {
    await db.insert(schoolMemberships).values({
      schoolId: schoolB.id,
      userId: teacherB1.id,
      role: 'TEACHER',
      status: 'ACTIVE',
    }).onConflictDoNothing();

    await db.insert(teacherProfiles).values({
      schoolId: schoolB.id,
      userId: teacherB1.id,
      employeeId: 'EMP-B-01',
      designation: 'Assistant Teacher (Science)',
    }).onConflictDoNothing();
  }

  // School B Teacher 2
  const [teacherB2] = await db
    .insert(users)
    .values({
      fullName: 'Manasi Ghosh',
      phoneNumber: '+919200000003',
      passwordHash: teacherPassHash,
      status: 'ACTIVE',
    })
    .onConflictDoNothing()
    .returning();

  if (teacherB2) {
    await db.insert(schoolMemberships).values({
      schoolId: schoolB.id,
      userId: teacherB2.id,
      role: 'TEACHER',
      status: 'ACTIVE',
    }).onConflictDoNothing();

    await db.insert(teacherProfiles).values({
      schoolId: schoolB.id,
      userId: teacherB2.id,
      employeeId: 'EMP-B-02',
      designation: 'Assistant Teacher (History)',
    }).onConflictDoNothing();
  }

  // 5. Create Default Class Sections
  let schoolAClass5A: any;
  if (academicYearA) {
    const existing = await db
      .select()
      .from(classSections)
      .where(and(eq(classSections.schoolId, schoolA.id), eq(classSections.academicYearId, academicYearA.id)));
    if (existing.length > 0) {
      schoolAClass5A = existing[0];
    } else {
      [schoolAClass5A] = await db
        .insert(classSections)
        .values({
          schoolId: schoolA.id,
          academicYearId: academicYearA.id,
          className: 'Class 5',
          sectionName: 'A',
        })
        .returning();
    }
  }

  let schoolAClass6A: any;
  if (academicYearA) {
    const existing = await db
      .select()
      .from(classSections)
      .where(and(eq(classSections.schoolId, schoolA.id), eq(classSections.className, 'Class 6')));
    if (existing.length > 0) {
      schoolAClass6A = existing[0];
    } else {
      [schoolAClass6A] = await db
        .insert(classSections)
        .values({
          schoolId: schoolA.id,
          academicYearId: academicYearA.id,
          className: 'Class 6',
          sectionName: 'A',
        })
        .returning();
    }
  }

  let schoolBClass6A: any;
  if (academicYearB) {
    const existing = await db
      .select()
      .from(classSections)
      .where(and(eq(classSections.schoolId, schoolB.id), eq(classSections.academicYearId, academicYearB.id)));
    if (existing.length > 0) {
      schoolBClass6A = existing[0];
    } else {
      [schoolBClass6A] = await db
        .insert(classSections)
        .values({
          schoolId: schoolB.id,
          academicYearId: academicYearB.id,
          className: 'Class 6',
          sectionName: 'A',
        })
        .returning();
    }
  }

  // Teacher Assignments
  if (teacherA1 && schoolAClass5A) {
    await db
      .insert(teacherAssignments)
      .values({
        schoolId: schoolA.id,
        teacherId: teacherA1.id,
        classSectionId: schoolAClass5A.id,
      })
      .onConflictDoNothing();
  }

  if (teacherB1 && schoolBClass6A) {
    await db
      .insert(teacherAssignments)
      .values({
        schoolId: schoolB.id,
        teacherId: teacherB1.id,
        classSectionId: schoolBClass6A.id,
      })
      .onConflictDoNothing();
  }

  console.log('Seed completed successfully!');
  return {
    schoolA,
    schoolB,
    academicYearA,
    academicYearB,
    schoolAClass5A,
    schoolAClass6A,
    schoolBClass6A,
    teacherUser: teacherA1,
    adminUser: adminA,
    schoolAdminUser: adminA,
    superAdminUser,
  };
}

// Allow direct execution via CLI
if (process.argv[1]?.includes('seed')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}
