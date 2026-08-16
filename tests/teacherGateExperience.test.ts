import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createApp } from '../server';
import { db, withTenantContext } from '../src/db/index';
import { runMigrations } from '../src/db/migrate';
import { createSession } from '../src/auth/session';
import {
  schools,
  academicYears,
  classSections,
  students,
  enrollments,
  users,
  schoolMemberships,
  teacherAssignments,
  attendanceSessions,
  attendanceSessionRoster,
  attendanceRecords,
  rfidReaders,
  rfidCredentials,
  rfidScanEvents,
} from '../src/db/schema';
import { canonicalizeEpc, computeEpcDigest, getEpcLastFour } from '../src/services/rfid/cryptoService';
import type { Server } from 'http';

describe('Teacher Gate Experience, Plain Language UI & Reports Integration', () => {
  let app: any;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.FEATURE_RFID = 'true';
    await runMigrations();
    app = await createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('today-gate endpoint returns PRESENT from a Zebra gate RFID accept', async () => {
    // 1. Setup School, Academic Year, Class Section, Teacher, Student
    const [school] = await db
      .insert(schools)
      .values({
        name: 'Bankura Model Primary School',
        slug: `bankura-gate-${Date.now()}`,
        district: 'Bankura',
        status: 'ACTIVE',
      })
      .returning();

    const [teacherUser] = await db
      .insert(users)
      .values({
        phoneNumber: `+9198300${Math.floor(10000 + Math.random() * 90000)}`,
        passwordHash: 'hash123',
        fullName: 'Sourav Ganguly',
        status: 'ACTIVE',
      })
      .returning();

    await db.insert(schoolMemberships).values({
      schoolId: school.id,
      userId: teacherUser.id,
      role: 'TEACHER',
      status: 'ACTIVE',
    });

    let classSectionId = '';
    let studentId = '';

    await withTenantContext(school.id, async (tx) => {
      const [ay] = await tx
        .insert(academicYears)
        .values({
          schoolId: school.id,
          name: 'AY 2026',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          isCurrent: true,
        })
        .returning();

      const [cs] = await tx
        .insert(classSections)
        .values({
          schoolId: school.id,
          academicYearId: ay.id,
          className: 'Class 5',
          sectionName: 'A',
          capacity: 40,
        })
        .returning();
      classSectionId = cs.id;

      await tx.insert(teacherAssignments).values({
        schoolId: school.id,
        teacherId: teacherUser.id,
        classSectionId: cs.id,
        academicYearId: ay.id,
        isClassTeacher: true,
      });

      const [st] = await tx
        .insert(students)
        .values({
          schoolId: school.id,
          studentCode: 'WB-BNK-001',
          name: 'Aniket Mukherjee',
          nameBn: 'অনিকেত মুখার্জী',
          gender: 'MALE',
          status: 'ACTIVE',
        })
        .returning();
      studentId = st.id;

      await tx.insert(enrollments).values({
        schoolId: school.id,
        studentId: st.id,
        classSectionId: cs.id,
        academicYearId: ay.id,
        rollNumber: 1,
        startDate: '2026-01-01',
        status: 'ACTIVE',
      });
    });

    // 2. Setup Zebra Gate Reader, Credential, and Scan Event
    const testEpc = 'E28011700000020B85794820';
    const canonical = canonicalizeEpc(testEpc);
    const digest = computeEpcDigest(canonical);
    const lastFour = getEpcLastFour(canonical);

    let readerId = '';
    let credentialId = '';
    await withTenantContext(school.id, async (tx) => {
      const [r] = await tx
        .insert(rfidReaders)
        .values({
          schoolId: school.id,
          deviceId: 'FX9600-GATE-01',
          name: 'Main Gate Box',
          location: 'North Entrance Gate',
          readerModel: 'ZEBRA_FX9600',
          adapterType: 'NETWORK',
          securityCapability: 'ZEBRA_FX9600',
          status: 'ACTIVE',
        })
        .returning();
      readerId = r.id;

      const [c] = await tx
        .insert(rfidCredentials)
        .values({
          schoolId: school.id,
          studentId,
          credentialDigest: digest,
          credentialType: 'UHF_EPC_GEN2',
          epcLastFour: lastFour,
          securityMode: 'UHF_EPC',
          status: 'ACTIVE',
          activatedAt: new Date(),
          createdByUserId: teacherUser.id,
        })
        .returning();
      credentialId = c.id;

      await tx.insert(rfidScanEvents).values({
        schoolId: school.id,
        readerId: r.id,
        credentialId: c.id,
        clientEventId: `evt-${Date.now()}`,
        epcDigest: digest,
        epcLastFour: lastFour,
        antennaPort: 1,
        peakRssi: -45,
        decision: 'ACCEPTED',
        scanTimestamp: new Date(),
      });
    });

    // 3. Create today's session and simulate Zebra RFID write to attendanceRecords
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    let sessionId = '';
    await withTenantContext(school.id, async (tx) => {
      const [sess] = await tx
        .insert(attendanceSessions)
        .values({
          schoolId: school.id,
          classSectionId,
          teacherId: teacherUser.id,
          sessionDate: todayStr,
          sessionType: 'DAILY',
          status: 'OPEN',
        })
        .returning();
      sessionId = sess.id;

      await tx.insert(attendanceRecords).values({
        schoolId: school.id,
        attendanceSessionId: sess.id,
        studentId,
        status: 'PRESENT',
        captureMethod: 'RFID_GATE',
      });
    });

    // 4. Generate Auth Session Token for Teacher
    const sessionAuth = await createSession(teacherUser.id, school.id);

    // 5. Query GET /today-gate
    const response = await fetch(`${baseUrl}/api/v1/schools/${school.id}/attendance/today-gate?classSectionId=${classSectionId}`, {
      headers: {
        Authorization: `Bearer ${sessionAuth.token}`,
        'X-Active-School-Id': school.id,
      },
    });

    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(body.success).toBe(true);
    expect(body.isAssigned).toBe(true);
    expect(body.stats.cameIn).toBe(1);
    expect(body.stats.missing).toBe(0);
    expect(body.arrivals).toHaveLength(1);
    expect(body.arrivals[0].name).toBe('Aniket Mukherjee');
    expect(body.arrivals[0].status).toBe('PRESENT');
  });

  it('GET /rfid/reports/scans returns populated recentScans and report with student & reader details', async () => {
    const [school] = await db
      .insert(schools)
      .values({
        name: 'Purulia Central Academy',
        slug: `purulia-scans-${Date.now()}`,
        district: 'Purulia',
        status: 'ACTIVE',
      })
      .returning();

    const [adminUser] = await db
      .insert(users)
      .values({
        phoneNumber: `+9198300${Math.floor(10000 + Math.random() * 90000)}`,
        passwordHash: 'hash123',
        fullName: 'Admin User',
        status: 'ACTIVE',
      })
      .returning();

    await db.insert(schoolMemberships).values({
      schoolId: school.id,
      userId: adminUser.id,
      role: 'SCHOOL_ADMIN',
      status: 'ACTIVE',
    });

    let studentId = '';
    let readerId = '';

    await withTenantContext(school.id, async (tx) => {
      const [st] = await tx
        .insert(students)
        .values({
          schoolId: school.id,
          studentCode: 'PUR-002',
          name: 'Debjit Roy',
          nameBn: 'দেবজিৎ রায়',
          status: 'ACTIVE',
        })
        .returning();
      studentId = st.id;

      const [r] = await tx
        .insert(rfidReaders)
        .values({
          schoolId: school.id,
          deviceId: 'FX9600-GATE-PUR-01',
          name: 'Main Gate Box',
          location: 'East Entrance',
          readerModel: 'ZEBRA_FX9600',
          adapterType: 'NETWORK',
          securityCapability: 'ZEBRA_FX9600',
          status: 'ACTIVE',
        })
        .returning();
      readerId = r.id;

      const [c] = await tx
        .insert(rfidCredentials)
        .values({
          schoolId: school.id,
          studentId: st.id,
          credentialDigest: 'digest-1234567890',
          credentialType: 'UHF_EPC_GEN2',
          epcLastFour: '4820',
          securityMode: 'UHF_EPC',
          status: 'ACTIVE',
          activatedAt: new Date(),
          createdByUserId: adminUser.id,
        })
        .returning();

      await tx.insert(rfidScanEvents).values({
        schoolId: school.id,
        readerId: r.id,
        credentialId: c.id,
        clientEventId: `evt-pur-${Date.now()}`,
        epcDigest: 'digest-1234567890',
        epcLastFour: '4820',
        antennaPort: 2,
        peakRssi: -50,
        decision: 'ACCEPTED',
        scanTimestamp: new Date(),
      });
    });

    const sessionAuth = await createSession(adminUser.id, school.id);

    const response = await fetch(`${baseUrl}/api/v1/schools/${school.id}/rfid/reports/scans`, {
      headers: {
        Authorization: `Bearer ${sessionAuth.token}`,
        'X-Active-School-Id': school.id,
      },
    });

    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(body.success).toBe(true);
    expect(body.recentScans).toBeDefined();
    expect(body.report).toBeDefined();
    expect(body.recentScans).toHaveLength(1);
    expect(body.recentScans[0].studentName).toBe('Debjit Roy');
    expect(body.recentScans[0].reader).toBe('Main Gate Box');
    expect(body.recentScans[0].decision).toBe('ACCEPTED');
  });

  it('bulk-enroll accepts studentCode and epc hex, calculating digest dynamically', async () => {
    const [school] = await db
      .insert(schools)
      .values({
        name: 'Hooghly High School',
        slug: `hooghly-bulk-${Date.now()}`,
        district: 'Hooghly',
        status: 'ACTIVE',
      })
      .returning();

    const [adminUser] = await db
      .insert(users)
      .values({
        phoneNumber: `+9198300${Math.floor(10000 + Math.random() * 90000)}`,
        passwordHash: 'hash123',
        fullName: 'School Operator',
        status: 'ACTIVE',
      })
      .returning();

    await db.insert(schoolMemberships).values({
      schoolId: school.id,
      userId: adminUser.id,
      role: 'RFID_OPERATOR',
      status: 'ACTIVE',
    });

    await withTenantContext(school.id, async (tx) => {
      await tx.insert(students).values({
        schoolId: school.id,
        studentCode: 'HGL-STD-101',
        name: 'Priyanka Das',
        status: 'ACTIVE',
      });
    });

    const sessionAuth = await createSession(adminUser.id, school.id);

    const response = await fetch(`${baseUrl}/api/v1/schools/${school.id}/rfid/credentials/bulk-enroll`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionAuth.token}`,
        'X-Active-School-Id': school.id,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entries: [
          {
            studentCode: 'HGL-STD-101',
            epc: 'E28011700000020B85794820',
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(body.success).toBe(true);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].success).toBe(true);
    expect(body.results[0].epcLastFour).toBe('4820');
  });

  it('Teacher manual override hits /manual with newStatus and server session UUID, saving correctly', async () => {
    const [school] = await db
      .insert(schools)
      .values({
        name: 'Midnapore Collegiate School',
        slug: `midnapore-manual-${Date.now()}`,
        district: 'Paschim Medinipur',
        status: 'ACTIVE',
      })
      .returning();

    const [teacherUser] = await db
      .insert(users)
      .values({
        phoneNumber: `+9198300${Math.floor(10000 + Math.random() * 90000)}`,
        passwordHash: 'hash123',
        fullName: 'Buddhadeb Guha',
        status: 'ACTIVE',
      })
      .returning();

    await db.insert(schoolMemberships).values({
      schoolId: school.id,
      userId: teacherUser.id,
      role: 'TEACHER',
      status: 'ACTIVE',
    });

    let classSectionId = '';
    let studentId = '';
    let sessionId = '';

    await withTenantContext(school.id, async (tx) => {
      const [ay] = await tx
        .insert(academicYears)
        .values({
          schoolId: school.id,
          name: 'AY 2026',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          isCurrent: true,
        })
        .returning();

      const [cs] = await tx
        .insert(classSections)
        .values({
          schoolId: school.id,
          academicYearId: ay.id,
          className: 'Class 6',
          sectionName: 'B',
          capacity: 40,
        })
        .returning();
      classSectionId = cs.id;

      await tx.insert(teacherAssignments).values({
        schoolId: school.id,
        teacherId: teacherUser.id,
        classSectionId: cs.id,
        academicYearId: ay.id,
        isClassTeacher: true,
      });

      const [st] = await tx
        .insert(students)
        .values({
          schoolId: school.id,
          studentCode: 'MID-001',
          name: 'Suman Chatterjee',
          gender: 'MALE',
          status: 'ACTIVE',
        })
        .returning();
      studentId = st.id;

      const [enr] = await tx.insert(enrollments).values({
        schoolId: school.id,
        studentId: st.id,
        classSectionId: cs.id,
        academicYearId: ay.id,
        rollNumber: 12,
        startDate: '2026-01-01',
        status: 'ACTIVE',
      }).returning();

      const [sess] = await tx
        .insert(attendanceSessions)
        .values({
          schoolId: school.id,
          classSectionId: cs.id,
          teacherId: teacherUser.id,
          sessionDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()),
          sessionType: 'DAILY',
          status: 'OPEN',
        })
        .returning();
      sessionId = sess.id;

      await tx.insert(attendanceSessionRoster).values({
        schoolId: school.id,
        attendanceSessionId: sess.id,
        studentId: st.id,
        enrollmentId: enr.id,
        studentNameSnapshot: st.name,
        rollNumberSnapshot: 12,
        isExpected: true,
      });
    });

    const sessionAuth = await createSession(teacherUser.id, school.id);

    // Call POST /api/v1/schools/:schoolId/attendance/sessions/:sessionId/manual
    const response = await fetch(`${baseUrl}/api/v1/schools/${school.id}/attendance/sessions/${sessionId}/manual`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionAuth.token}`,
        'X-Active-School-Id': school.id,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentId,
        newStatus: 'PRESENT',
        reason: 'Teacher manual override',
      }),
    });

    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('PRESENT');
    expect(body.data.captureMethod).toBe('MANUAL');

    // Confirm that GET /today-gate reflects the manual update
    const todayGateRes = await fetch(`${baseUrl}/api/v1/schools/${school.id}/attendance/today-gate?classSectionId=${classSectionId}`, {
      headers: {
        Authorization: `Bearer ${sessionAuth.token}`,
        'X-Active-School-Id': school.id,
      },
    });
    const gateBody: any = await todayGateRes.json();
    expect(gateBody.success).toBe(true);
    expect(gateBody.stats.cameIn).toBe(1);
    expect(gateBody.stats.missing).toBe(0);
  });

  it('Teacher finalize attendance locks the server session and auto-marks missing students as ABSENT', async () => {
    const [school] = await db
      .insert(schools)
      .values({
        name: 'Durgapur Modern Academy',
        slug: `durgapur-finalize-${Date.now()}`,
        district: 'Paschim Bardhaman',
        status: 'ACTIVE',
      })
      .returning();

    const [teacherUser] = await db
      .insert(users)
      .values({
        phoneNumber: `+9198300${Math.floor(10000 + Math.random() * 90000)}`,
        passwordHash: 'hash123',
        fullName: 'Barnali Roy',
        status: 'ACTIVE',
      })
      .returning();

    await db.insert(schoolMemberships).values({
      schoolId: school.id,
      userId: teacherUser.id,
      role: 'TEACHER',
      status: 'ACTIVE',
    });

    let classSectionId = '';
    let studentPresentId = '';
    let studentMissingId = '';
    let sessionId = '';

    await withTenantContext(school.id, async (tx) => {
      const [ay] = await tx
        .insert(academicYears)
        .values({
          schoolId: school.id,
          name: 'AY 2026',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          isCurrent: true,
        })
        .returning();

      const [cs] = await tx
        .insert(classSections)
        .values({
          schoolId: school.id,
          academicYearId: ay.id,
          className: 'Class 7',
          sectionName: 'A',
          capacity: 40,
        })
        .returning();
      classSectionId = cs.id;

      await tx.insert(teacherAssignments).values({
        schoolId: school.id,
        teacherId: teacherUser.id,
        classSectionId: cs.id,
        academicYearId: ay.id,
        isClassTeacher: true,
      });

      const [st1] = await tx
        .insert(students)
        .values({
          schoolId: school.id,
          studentCode: 'DUR-001',
          name: 'Tanmoy Sen',
          gender: 'MALE',
          status: 'ACTIVE',
        })
        .returning();
      studentPresentId = st1.id;

      const [st2] = await tx
        .insert(students)
        .values({
          schoolId: school.id,
          studentCode: 'DUR-002',
          name: 'Riya Sen',
          gender: 'FEMALE',
          status: 'ACTIVE',
        })
        .returning();
      studentMissingId = st2.id;

      const [enr1, enr2] = await tx.insert(enrollments).values([
        {
          schoolId: school.id,
          studentId: st1.id,
          classSectionId: cs.id,
          academicYearId: ay.id,
          rollNumber: 1,
          startDate: '2026-01-01',
          status: 'ACTIVE',
        },
        {
          schoolId: school.id,
          studentId: st2.id,
          classSectionId: cs.id,
          academicYearId: ay.id,
          rollNumber: 2,
          startDate: '2026-01-01',
          status: 'ACTIVE',
        },
      ]).returning();

      const [sess] = await tx
        .insert(attendanceSessions)
        .values({
          schoolId: school.id,
          classSectionId: cs.id,
          teacherId: teacherUser.id,
          sessionDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()),
          sessionType: 'DAILY',
          status: 'OPEN',
        })
        .returning();
      sessionId = sess.id;

      await tx.insert(attendanceSessionRoster).values([
        {
          schoolId: school.id,
          attendanceSessionId: sess.id,
          studentId: st1.id,
          enrollmentId: enr1.id,
          studentNameSnapshot: st1.name,
          rollNumberSnapshot: 1,
          isExpected: true,
        },
        {
          schoolId: school.id,
          attendanceSessionId: sess.id,
          studentId: st2.id,
          enrollmentId: enr2.id,
          studentNameSnapshot: st2.name,
          rollNumberSnapshot: 2,
          isExpected: true,
        },
      ]);

      await tx.insert(attendanceRecords).values([
        {
          schoolId: school.id,
          attendanceSessionId: sess.id,
          studentId: studentPresentId,
          status: 'PRESENT',
          captureMethod: 'MANUAL',
        },
        {
          schoolId: school.id,
          attendanceSessionId: sess.id,
          studentId: studentMissingId,
          status: 'UNMARKED',
          captureMethod: 'MANUAL',
        },
      ]);
    });

    const sessionAuth = await createSession(teacherUser.id, school.id);

    // Call PATCH /api/v1/schools/:schoolId/attendance/sessions/:sessionId/status with FINALIZED
    const response = await fetch(`${baseUrl}/api/v1/schools/${school.id}/attendance/sessions/${sessionId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${sessionAuth.token}`,
        'X-Active-School-Id': school.id,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'FINALIZED',
        autoMarkAbsentForUnmarked: true,
        reason: 'Class teacher finalized daily attendance',
      }),
    });

    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('FINALIZED');

    // Verify student 2 was auto-marked ABSENT
    await withTenantContext(school.id, async (tx) => {
      const records = await tx
        .select()
        .from(attendanceRecords)
        .where(eq(attendanceRecords.attendanceSessionId, sessionId));
      
      const st2Record = records.find((r: any) => r.studentId === studentMissingId);
      expect(st2Record).toBeDefined();
      expect(st2Record?.status).toBe('ABSENT');
    });
  });

  it('Verifies that old endpoint /records/manual returns 404', async () => {
    const [school] = await db
      .insert(schools)
      .values({
        name: 'Asansol Primary School',
        slug: `asansol-404-${Date.now()}`,
        district: 'Paschim Bardhaman',
        status: 'ACTIVE',
      })
      .returning();

    const [teacherUser] = await db
      .insert(users)
      .values({
        phoneNumber: `+9198300${Math.floor(10000 + Math.random() * 90000)}`,
        passwordHash: 'hash123',
        fullName: 'Subhashish Das',
        status: 'ACTIVE',
      })
      .returning();

    await db.insert(schoolMemberships).values({
      schoolId: school.id,
      userId: teacherUser.id,
      role: 'TEACHER',
      status: 'ACTIVE',
    });

    const sessionAuth = await createSession(teacherUser.id, school.id);

    const response = await fetch(`${baseUrl}/api/v1/schools/${school.id}/attendance/sessions/00000000-0000-0000-0000-000000000000/records/manual`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sessionAuth.token}`,
        'X-Active-School-Id': school.id,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentId: '00000000-0000-0000-0000-000000000000',
        status: 'PRESENT',
      }),
    });

    expect(response.status).toBe(404);
  });
});
