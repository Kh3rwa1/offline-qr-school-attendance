import { hashPassword } from '../auth/password';
import { getDb } from './index';
import {
  schools,
  academicYears,
  users,
  schoolMemberships,
  teacherProfiles,
  classSections,
  teacherAssignments,
  students,
  guardians,
  studentGuardians,
  enrollments,
  qrCredentials,
  attendanceSessions,
  attendanceSessionRoster,
  attendanceEvents,
  attendanceRecords,
  notificationJobs,
  notificationAttempts,
  importJobs,
  attendanceCorrections,
} from './schema';
import { eq, and, inArray, or, like } from 'drizzle-orm';

// Procedural name generators for high performance
const FIRST_NAMES = [
  'Sujata', 'Prabir', 'Tapas', 'Manasi', 'Anupam', 'Bikash', 'Debashis', 'Mousumi', 'Fatema', 'Dulal',
  'Joy', 'Rahul', 'Amit', 'Sneha', 'Riya', 'Priya', 'Rohan', 'Vikram', 'Samir', 'Neha',
  'Arjun', 'Deepika', 'Sachin', 'Sourav', 'Souvik', 'Tuhin', 'Biplab', 'Goutam', 'Kabir', 'Sanjay'
];
const FIRST_NAMES_BN = [
  'সুজাতা', 'প্রবীর', 'তাপস', 'মানসী', 'অনুপম', 'বিকাশ', 'দেবাশীষ', 'মৌসুমী', 'ফাতেমা', 'দুলাল',
  'জয়', 'রাহুল', 'অমিত', 'স্নেহা', 'রিয়া', 'প্রিয়া', 'রোহন', 'বিক্রম', 'সমীর', 'নেহা',
  'অর্জুন', 'দীপিকা', 'শচীন', 'সৌরভ', 'সৌভিক', 'তুহিন', 'বিপ্লব', 'গৌতম', 'কবীর', 'সঞ্জয়'
];
const LAST_NAMES = [
  'Banerjee', 'Roy', 'Das', 'Ghosh', 'Sen', 'Mukherjee', 'Kisku', 'Sarker', 'Mondal', 'Chakraborty',
  'Dutta', 'Bose', 'Pal', 'Gupta', 'Mitra', 'Ray', 'Sikder', 'Halder', 'Sardar', 'Saha'
];
const LAST_NAMES_BN = [
  'ব্যানার্জী', 'রায়', 'দাস', 'ঘোষ', 'সেন', 'মুখার্জী', 'কিসকু', 'সরকার', 'মন্ডল', 'চক্রবর্তী',
  'দত্ত', 'বসু', 'পাল', 'গুপ্ত', 'মিত্র', 'রায়', 'সিকদার', 'হালদার', 'সরদার', 'সাহা'
];

function generateName(index: number) {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last = LAST_NAMES[(index + 3) % LAST_NAMES.length];
  const firstBn = FIRST_NAMES_BN[index % FIRST_NAMES_BN.length];
  const lastBn = LAST_NAMES_BN[(index + 3) % LAST_NAMES_BN.length];
  return {
    en: `${first} ${last}`,
    bn: `${firstBn} ${lastBn}`
  };
}

export async function seedProductionDatabase() {
  const db = getDb();
  console.log('--- STARTING PRODUCTION SCALE DATASET SEED ---');

  // Clean up any pre-existing records for these 2 schools to guarantee idempotency
  console.log('Cleaning up pre-existing seed data...');
  const targetUsers = await db.select({ id: users.id }).from(users).where(
    or(
      like(users.phoneNumber, '+919100000%'),
      like(users.phoneNumber, '+919200000%')
    )
  );
  const targetUserIds = targetUsers.map((u: { id: string }) => u.id);

  if (targetUserIds.length > 0) {
    await db.delete(importJobs).where(inArray(importJobs.createdBy, targetUserIds));
    await db.delete(attendanceCorrections).where(inArray(attendanceCorrections.correctedBy, targetUserIds));
    await db.delete(attendanceEvents).where(inArray(attendanceEvents.actorId, targetUserIds));
    await db.delete(attendanceSessions).where(inArray(attendanceSessions.teacherId, targetUserIds));
    await db.delete(users).where(inArray(users.id, targetUserIds));
  }

  await db.delete(schools).where(inArray(schools.udiseCode, ['19100100103', '19100100104']));

  // 1. Create 2 Schools (Tenants)
  console.log('Creating 2 schools...');
  const [primarySchool] = await db
    .insert(schools)
    .values({
      name: 'Murshidabad Model Primary School',
      slug: 'murshidabad-model-primary-0103',
      udiseCode: '19100100103',
      district: 'Murshidabad',
      block: 'Raninagar-I',
      preferredLanguage: 'bn',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
    })
    .returning();

  const [secondarySchool] = await db
    .insert(schools)
    .values({
      name: 'Murshidabad Girls High School',
      slug: 'murshidabad-girls-high-0104',
      udiseCode: '19100100104',
      district: 'Murshidabad',
      block: 'Raninagar-II',
      preferredLanguage: 'bn',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
    })
    .returning();

  // 2. Create Multiple Academic Years
  console.log('Creating multiple academic years (2025, 2026, 2027)...');
  const years = ['2025', '2026', '2027'];
  const academicYearsMap: Record<string, any[]> = {
    primary: [],
    secondary: [],
  };

  for (const year of years) {
    const [ayPrimary] = await db
      .insert(academicYears)
      .values({
        schoolId: primarySchool.id,
        name: year,
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
        isCurrent: year === '2026',
      })
      .returning();
    academicYearsMap.primary.push(ayPrimary);

    const [aySecondary] = await db
      .insert(academicYears)
      .values({
        schoolId: secondarySchool.id,
        name: year,
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
        isCurrent: year === '2026',
      })
      .returning();
    academicYearsMap.secondary.push(aySecondary);
  }

  const primaryCurrentYear = academicYearsMap.primary.find(y => y.isCurrent)!;
  const secondaryCurrentYear = academicYearsMap.secondary.find(y => y.isCurrent)!;

  // 3. Create Class Sections
  console.log('Creating multiple class sections...');
  const primarySections: any[] = [];
  const classes = ['Class I', 'Class II', 'Class III', 'Class IV', 'Class V'];
  const sects = ['A', 'B'];

  for (const cls of classes) {
    for (const sct of sects) {
      const [cs] = await db
        .insert(classSections)
        .values({
          schoolId: primarySchool.id,
          academicYearId: primaryCurrentYear.id,
          className: cls,
          sectionName: sct,
        })
        .returning();
      primarySections.push(cs);
    }
  }

  const secondarySections: any[] = [];
  const secClasses = ['Class VI', 'Class VII', 'Class VIII', 'Class IX', 'Class X'];
  for (const cls of secClasses) {
    for (const sct of sects) {
      const [cs] = await db
        .insert(classSections)
        .values({
          schoolId: secondarySchool.id,
          academicYearId: secondaryCurrentYear.id,
          className: cls,
          sectionName: sct,
        })
        .returning();
      secondarySections.push(cs);
    }
  }

  // 4. Create 60 Teachers
  console.log('Creating 60 teachers (hash password computed once)...');
  const teacherPassHash = await hashPassword('TeacherPassword123!');
  const allTeachers: any[] = [];

  // 35 Primary School Teachers
  for (let i = 1; i <= 35; i++) {
    const tName = generateName(i);
    const [tUser] = await db
      .insert(users)
      .values({
        fullName: tName.en,
        phoneNumber: `+919100000${100 + i}`,
        passwordHash: teacherPassHash,
        status: 'ACTIVE',
      })
      .returning();

    await db.insert(schoolMemberships).values({
      schoolId: primarySchool.id,
      userId: tUser.id,
      role: 'TEACHER',
      status: 'ACTIVE',
    });

    const [tProfile] = await db.insert(teacherProfiles).values({
      schoolId: primarySchool.id,
      userId: tUser.id,
      employeeId: `EMP-PRI-${100 + i}`,
      designation: i % 4 === 0 ? 'Senior Teacher' : 'Assistant Teacher',
    }).returning();

    allTeachers.push({ user: tUser, schoolId: primarySchool.id });
  }

  // 25 Secondary School Teachers
  for (let i = 1; i <= 25; i++) {
    const tName = generateName(i + 35);
    const [tUser] = await db
      .insert(users)
      .values({
        fullName: tName.en,
        phoneNumber: `+919200000${100 + i}`,
        passwordHash: teacherPassHash,
        status: 'ACTIVE',
      })
      .returning();

    await db.insert(schoolMemberships).values({
      schoolId: secondarySchool.id,
      userId: tUser.id,
      role: 'TEACHER',
      status: 'ACTIVE',
    });

    const [tProfile] = await db.insert(teacherProfiles).values({
      schoolId: secondarySchool.id,
      userId: tUser.id,
      employeeId: `EMP-SEC-${100 + i}`,
      designation: i % 4 === 0 ? 'Senior Teacher' : 'Assistant Teacher',
    }).returning();

    allTeachers.push({ user: tUser, schoolId: secondarySchool.id });
  }

  // Assign teachers to class sections
  console.log('Assigning teachers to class sections...');
  const primaryTeachers = allTeachers.filter(t => t.schoolId === primarySchool.id);
  for (let i = 0; i < primarySections.length; i++) {
    const section = primarySections[i];
    const teacher = primaryTeachers[i % primaryTeachers.length];
    await db.insert(teacherAssignments).values({
      schoolId: primarySchool.id,
      teacherId: teacher.user.id,
      classSectionId: section.id,
    });
  }

  const secondaryTeachers = allTeachers.filter(t => t.schoolId === secondarySchool.id);
  for (let i = 0; i < secondarySections.length; i++) {
    const section = secondarySections[i];
    const teacher = secondaryTeachers[i % secondaryTeachers.length];
    await db.insert(teacherAssignments).values({
      schoolId: secondarySchool.id,
      teacherId: teacher.user.id,
      classSectionId: section.id,
    });
  }

  // 5. Create 1,400+ Students in the Primary School
  console.log('Generating 1,410 students and primary guardians for Murshidabad Model Primary School...');
  const studentsBatch: any[] = [];
  const guardiansBatch: any[] = [];

  const TOTAL_STUDENTS_TO_GENERATE = 1410;

  for (let i = 1; i <= TOTAL_STUDENTS_TO_GENERATE; i++) {
    const sName = generateName(i + 100);
    const code = `STU-PRI-${10000 + i}`;
    studentsBatch.push({
      schoolId: primarySchool.id,
      studentCode: code,
      banglarShikshaId: `BS-2026-${20000 + i}`,
      name: sName.en,
      nameBn: sName.bn,
      gender: i % 2 === 0 ? 'MALE' : 'FEMALE',
      status: 'ACTIVE',
    });

    guardiansBatch.push({
      schoolId: primarySchool.id,
      name: `${sName.en.split(' ')[0]}'s Parent`,
      phoneNumber: `+917000${100000 + i}`,
      relationship: i % 5 === 0 ? 'MOTHER' : 'FATHER',
    });
  }

  // Bulk insert in chunks of 400 to comply with SQL parameter limits
  console.log('Inserting students and guardians in batches...');
  const chunkSize = 400;
  const insertedStudents: any[] = [];
  const insertedGuardians: any[] = [];

  for (let i = 0; i < studentsBatch.length; i += chunkSize) {
    const sChunk = studentsBatch.slice(i, i + chunkSize);
    const gChunk = guardiansBatch.slice(i, i + chunkSize);

    const sRes = await db.insert(students).values(sChunk).returning();
    const gRes = await db.insert(guardians).values(gChunk).returning();

    insertedStudents.push(...sRes);
    insertedGuardians.push(...gRes);
  }

  console.log(`Successfully inserted ${insertedStudents.length} students & ${insertedGuardians.length} guardians.`);

  // Link Student-Guardians, Enrollments, and QR credentials in batches
  console.log('Building linkages, class enrollments, and QR digests for the roster...');
  const junctionsBatch: any[] = [];
  const enrollmentsBatch: any[] = [];
  const qrsBatch: any[] = [];

  for (let i = 0; i < insertedStudents.length; i++) {
    const stu = insertedStudents[i];
    const guar = insertedGuardians[i];
    const section = primarySections[i % primarySections.length];
    const roll = Math.floor(i / primarySections.length) + 1;

    junctionsBatch.push({
      studentId: stu.id,
      guardianId: guar.id,
      isPrimary: true,
    });

    enrollmentsBatch.push({
      schoolId: primarySchool.id,
      studentId: stu.id,
      classSectionId: section.id,
      academicYearId: primaryCurrentYear.id,
      rollNumber: roll,
      startDate: '2026-01-01',
      status: 'ACTIVE',
    });

    // Hash/digest based on student details
    qrsBatch.push({
      schoolId: primarySchool.id,
      studentId: stu.id,
      tokenDigest: `sha256-prod-digest-${stu.studentCode}-${stu.id}`,
      version: 1,
      status: 'ACTIVE',
    });
  }

  const insertedEnrollments: any[] = [];
  for (let i = 0; i < junctionsBatch.length; i += chunkSize) {
    await db.insert(studentGuardians).values(junctionsBatch.slice(i, i + chunkSize));
    const enRes = await db.insert(enrollments).values(enrollmentsBatch.slice(i, i + chunkSize)).returning();
    insertedEnrollments.push(...enRes);
    await db.insert(qrCredentials).values(qrsBatch.slice(i, i + chunkSize));
  }

  console.log('Roster linkage setup finished.');

  // 6. Seed Attendance History, Offline Event Batches, and Notifications
  console.log('Simulating attendance history and offline batches...');
  // Create a session for primary Class I Section A
  const section1A = primarySections[0];
  const teacher1A = primaryTeachers[0];

  const [session] = await db
    .insert(attendanceSessions)
    .values({
      schoolId: primarySchool.id,
      classSectionId: section1A.id,
      teacherId: teacher1A.user.id,
      sessionDate: '2026-08-11',
      sessionType: 'DAILY',
      status: 'FINALIZED',
      finalizedAt: new Date(),
    })
    .returning();

  // Load expected roster for snapshot
  const rosterEnrollments = insertedEnrollments.filter(e => e.classSectionId === section1A.id);
  const rosterSnapshot: any[] = [];
  for (let i = 0; i < rosterEnrollments.length; i++) {
    const enrol = rosterEnrollments[i];
    const stu = insertedStudents.find(s => s.id === enrol.studentId)!;
    rosterSnapshot.push({
      schoolId: primarySchool.id,
      attendanceSessionId: session.id,
      studentId: stu.id,
      enrollmentId: enrol.id, // reference real inserted enrollment ID
      rollNumberSnapshot: enrol.rollNumber,
      studentNameSnapshot: stu.name,
      isExpected: true,
    });
  }

  for (let i = 0; i < rosterSnapshot.length; i += chunkSize) {
    await db.insert(attendanceSessionRoster).values(rosterSnapshot.slice(i, i + chunkSize));
  }

  // Create attendance records and attendance events
  console.log('Generating attendance history fixtures...');
  const recordsBatch: any[] = [];
  const eventsBatch: any[] = [];
  const notificationsBatch: any[] = [];

  for (let i = 0; i < rosterSnapshot.length; i++) {
    const ros = rosterSnapshot[i];
    const status = i % 10 === 0 ? 'ABSENT' : 'PRESENT';

    recordsBatch.push({
      schoolId: primarySchool.id,
      attendanceSessionId: session.id,
      studentId: ros.studentId,
      status: status,
      firstScannedAt: status === 'PRESENT' ? new Date() : null,
      hasConflict: false,
    });

    eventsBatch.push({
      schoolId: primarySchool.id,
      clientEventId: `client-event-prod-${ros.studentId}-${session.id}`,
      attendanceSessionId: session.id,
      studentId: ros.studentId,
      eventType: status === 'PRESENT' ? 'QR_SCANNED' : 'MARKED_ABSENT',
      statusValue: status,
      clientTimestamp: new Date(),
      actorId: teacher1A.user.id,
    });

    if (status === 'ABSENT') {
      const guar = insertedGuardians[i];
      notificationsBatch.push({
        schoolId: primarySchool.id,
        attendanceSessionId: session.id,
        studentId: ros.studentId,
        recipientPhone: guar?.phoneNumber || '+919999999999',
        messageBody: `শ্রদ্ধেয় অভিভাবক, আপনার সন্তান আজ অনুপস্থিত।`,
        status: 'SENT',
        sentAt: new Date(),
      });
    }
  }

  for (let i = 0; i < recordsBatch.length; i += chunkSize) {
    await db.insert(attendanceRecords).values(recordsBatch.slice(i, i + chunkSize));
    await db.insert(attendanceEvents).values(eventsBatch.slice(i, i + chunkSize));
  }

  for (let i = 0; i < notificationsBatch.length; i += chunkSize) {
    await db.insert(notificationJobs).values(notificationsBatch.slice(i, i + chunkSize));
  }

  console.log('--- SEEDING PRODUCTION SCALE DATASET SUCCESSFULLY COMPLETED ---');
}

// Allow direct execution via CLI
if (process.argv[1]?.includes('seed_production')) {
  seedProductionDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}
