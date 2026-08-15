import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../server';
import { seedDatabase } from '../src/db/seed';
import { db } from '../src/db';
import { schools, users, schoolMemberships, attendanceSessions, rfidReaders, rfidCredentials } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateCsrfToken, CSRF_COOKIE_NAME, CSRF_SIG_COOKIE_NAME, CSRF_HEADER_NAME } from '../src/middleware/csrfProtection';
import type { Server } from 'http';

describe('Comprehensive Product Verification Suite', () => {
  let server: Server;
  let baseUrl: string;
  let seeded: any;

  beforeAll(async () => {
    process.env.TEST_SERVER_STATIC = 'true';
    process.env.FEATURE_RFID = 'true';
    seeded = await seedDatabase();

    const app = await createApp();
    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${(address as any).port}`;
        resolve();
      });
      server.on('error', reject);
    });
  });

  afterAll(async () => {
    if (server) {
      if (typeof (server as any).closeAllConnections === 'function') {
        (server as any).closeAllConnections();
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  async function loginUser(phoneNumber: string, passwordAttempt: string) {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, password: passwordAttempt }),
    });
    const body = await res.json();
    const cookieHeader = res.headers.get('set-cookie') || '';
    const sessionMatch = cookieHeader.match(/session=([^;]+)/);
    const sessionToken = sessionMatch ? sessionMatch[1] : '';

    const { token, signature } = generateCsrfToken(sessionToken);

    return {
      status: res.status,
      body,
      sessionToken,
      csrfToken: token,
      cookieString: `session=${sessionToken}; ${CSRF_COOKIE_NAME}=${token}; ${CSRF_SIG_COOKIE_NAME}=${signature}`,
    };
  }

  it('1. Provision school API -> DB row + admin login + Super Admin can switch into it', async () => {
    const timestamp = Date.now();
    const udiseCode = `1901${Math.floor(1000000 + Math.random() * 9000000)}`;
    const adminPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
    const adminPassword = 'NewSchoolAdminPassword123!';

    // 1. Super Admin signs in
    const saAuth = await loginUser('+919000000000', 'SuperSecretAdminPassword123!');
    expect(saAuth.status).toBe(200);

    // 2. Super Admin provisions new school
    const provisionRes = await fetch(`${baseUrl}/api/v1/schools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: saAuth.cookieString,
        [CSRF_HEADER_NAME]: saAuth.csrfToken,
      },
      body: JSON.stringify({
        name: `Integration Test Academy ${timestamp}`,
        udiseCode,
        district: 'Kolkata',
        block: 'Central',
        preferredLanguage: 'en',
        timezone: 'Asia/Kolkata',
        admin: {
          fullName: 'Principal Test',
          phoneNumber: adminPhone,
          password: adminPassword,
        },
      }),
    });

    expect(provisionRes.status).toBe(201);
    const provisionBody = await provisionRes.json();
    expect(provisionBody.school).toBeDefined();
    const newSchoolId = provisionBody.school.id;

    // 3. Verify DB row
    const [schoolRow] = await db.select().from(schools).where(eq(schools.id, newSchoolId));
    expect(schoolRow).toBeDefined();
    expect(schoolRow.udiseCode).toBe(udiseCode);
    expect(schoolRow.status).toBe('ACTIVE');

    // 4. New School Admin logs in
    const adminAuth = await loginUser(adminPhone, adminPassword);
    expect(adminAuth.status).toBe(200);
    expect(adminAuth.body.user.phoneNumber).toBe(adminPhone);

    // 5. Super Admin switches into new school
    const switchRes = await fetch(`${baseUrl}/api/v1/auth/switch-school`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: saAuth.cookieString,
        [CSRF_HEADER_NAME]: saAuth.csrfToken,
      },
      body: JSON.stringify({ schoolId: newSchoolId }),
    });

    expect(switchRes.status).toBe(200);
    const switchBody = await switchRes.json();
    expect(switchBody.activeSchoolId).toBe(newSchoolId);
  });

  it('2. Duplicate UDISE 409, duplicate admin phone 409, and idempotent retry', async () => {
    const timestamp = Date.now();
    const udiseCode = `1902${Math.floor(1000000 + Math.random() * 9000000)}`;
    const adminPhone = `+9197${Math.floor(10000000 + Math.random() * 90000000)}`;
    const idempotencyKey = `idemp-${timestamp}`;

    const saAuth = await loginUser('+919000000000', 'SuperSecretAdminPassword123!');
    expect(saAuth.status).toBe(200);

    const payload = {
      name: `Idempotent Academy ${timestamp}`,
      udiseCode,
      district: 'Hooghly',
      admin: {
        fullName: 'Admin One',
        phoneNumber: adminPhone,
        password: 'AdminPassword123!',
      },
    };

    // First call with Idempotency-Key
    const firstRes = await fetch(`${baseUrl}/api/v1/schools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: saAuth.cookieString,
        [CSRF_HEADER_NAME]: saAuth.csrfToken,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    expect(firstRes.status).toBe(201);
    const firstBody = await firstRes.json();
    const createdSchoolId = firstBody.school.id;

    // Retry with SAME Idempotency-Key -> 200 with identical school
    const retryRes = await fetch(`${baseUrl}/api/v1/schools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: saAuth.cookieString,
        [CSRF_HEADER_NAME]: saAuth.csrfToken,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    expect([200, 201]).toContain(retryRes.status);
    const retryBody = await retryRes.json();
    expect(retryBody.school.id).toBe(createdSchoolId);

    // Call with duplicate UDISE -> 409 DUPLICATE_UDISE_CODE
    const dupUdiseRes = await fetch(`${baseUrl}/api/v1/schools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: saAuth.cookieString,
        [CSRF_HEADER_NAME]: saAuth.csrfToken,
      },
      body: JSON.stringify({
        name: 'Another School',
        udiseCode,
        district: 'Hooghly',
        admin: {
          fullName: 'Admin Two',
          phoneNumber: `+9196${Math.floor(10000000 + Math.random() * 90000000)}`,
          password: 'AdminPassword123!',
        },
      }),
    });

    expect(dupUdiseRes.status).toBe(409);
    const dupUdiseBody = await dupUdiseRes.json();
    expect(dupUdiseBody.code).toBe('DUPLICATE_UDISE_CODE');

    // Call with duplicate admin phone without linkExistingUser -> 409 ADMIN_PHONE_CONFLICT
    const dupPhoneRes = await fetch(`${baseUrl}/api/v1/schools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: saAuth.cookieString,
        [CSRF_HEADER_NAME]: saAuth.csrfToken,
      },
      body: JSON.stringify({
        name: 'Another School 2',
        udiseCode: `1903${Math.floor(1000000 + Math.random() * 9000000)}`,
        district: 'Hooghly',
        admin: {
          fullName: 'Admin One Duplicate',
          phoneNumber: adminPhone,
          password: 'AdminPassword123!',
          linkExistingUser: false,
        },
      }),
    });

    expect(dupPhoneRes.status).toBe(409);
    const dupPhoneBody = await dupPhoneRes.json();
    expect(dupPhoneBody.code).toBe('ADMIN_PHONE_CONFLICT');
  });

  it('3. Teacher online finalize uses server session ID and marks DB status FINALIZED', async () => {
    const teacherAuth = await loginUser('+919100000002', 'TeacherPassword123!');
    expect(teacherAuth.status).toBe(200);

    const schoolId = seeded.schoolA.id;
    const classSectionId = seeded.schoolAClass5A.id;
    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Create session
    const createSessionRes = await fetch(`${baseUrl}/api/v1/schools/${schoolId}/attendance/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: teacherAuth.cookieString,
        [CSRF_HEADER_NAME]: teacherAuth.csrfToken,
      },
      body: JSON.stringify({
        classSectionId,
        sessionDate: todayStr,
        sessionType: 'DAILY',
      }),
    });

    expect(createSessionRes.status).toBe(201);
    const sessionBody = await createSessionRes.json();
    const sessionId = sessionBody.data.id;
    expect(sessionId).toBeDefined();

    // 2. Finalize session
    const finalizeRes = await fetch(`${baseUrl}/api/v1/schools/${schoolId}/attendance/sessions/${sessionId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: teacherAuth.cookieString,
        [CSRF_HEADER_NAME]: teacherAuth.csrfToken,
      },
      body: JSON.stringify({
        status: 'FINALIZED',
        autoMarkAbsentForUnmarked: true,
        reason: 'Daily roll completion',
      }),
    });

    expect(finalizeRes.status).toBe(200);
    const finalizeBody = await finalizeRes.json();
    expect(finalizeBody.data.status).toBe('FINALIZED');

    // 3. Verify DB status
    const [sessionRow] = await db.select().from(attendanceSessions).where(eq(attendanceSessions.id, sessionId));
    expect(sessionRow.status).toBe('FINALIZED');
  });

  it('4. RFID reader register/approve/suspend route workflow', async () => {
    const adminAuth = await loginUser('+919100000001', 'SchoolAdminPassword123!');
    expect(adminAuth.status).toBe(200);
    const schoolId = seeded.schoolA.id;

    // 1. Register reader
    const regReaderRes = await fetch(`${baseUrl}/api/v1/schools/${schoolId}/rfid/readers/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminAuth.cookieString,
        [CSRF_HEADER_NAME]: adminAuth.csrfToken,
      },
      body: JSON.stringify({
        deviceId: `reader-test-${Date.now()}`,
        name: 'Main Gate Test Turnstile',
        location: 'Entrance',
        directionMode: 'IN',
        adapterType: 'GATEWAY',
        securityCapability: 'DESFIRE_EV2_EV3',
      }),
    });

    expect(regReaderRes.status).toBe(201);
    const regBody = await regReaderRes.json();
    const readerId = regBody.reader.id;

    // 2. Approve reader
    const approveRes = await fetch(`${baseUrl}/api/v1/schools/${schoolId}/rfid/readers/${readerId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminAuth.cookieString,
        [CSRF_HEADER_NAME]: adminAuth.csrfToken,
      },
      body: JSON.stringify({}),
    });

    expect(approveRes.status).toBe(200);
    const approveBody = await approveRes.json();
    expect(approveBody.reader.status).toBe('ACTIVE');

    // 3. Suspend reader
    const suspendRes = await fetch(`${baseUrl}/api/v1/schools/${schoolId}/rfid/readers/${readerId}/suspend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminAuth.cookieString,
        [CSRF_HEADER_NAME]: adminAuth.csrfToken,
      },
      body: JSON.stringify({ reason: 'Hardware maintenance' }),
    });

    expect(suspendRes.status).toBe(200);
    const suspendBody = await suspendRes.json();
    expect(suspendBody.reader.status).toBe('SUSPENDED');
  });

  it('5. Export daily-school succeeds; monthly-register without classSectionId returns 403', async () => {
    const adminAuth = await loginUser('+919100000001', 'SchoolAdminPassword123!');
    const schoolId = seeded.schoolA.id;

    // Daily school export CSV
    const exportDailyRes = await fetch(
      `${baseUrl}/api/v1/schools/${schoolId}/reports/export?type=daily-school&format=csv`,
      {
        headers: { Cookie: adminAuth.cookieString },
      }
    );

    expect(exportDailyRes.status).toBe(200);
    expect(exportDailyRes.headers.get('content-type')).toContain('text/csv');

    // Monthly register export without classSectionId
    const exportMonthlyRes = await fetch(
      `${baseUrl}/api/v1/schools/${schoolId}/reports/export?type=monthly-register&format=csv`,
      {
        headers: { Cookie: adminAuth.cookieString },
      }
    );

    expect(exportMonthlyRes.status).toBe(403);
  });

  it('6. REPORT_VIEWER can GET daily-class and cannot POST members (RBAC test)', async () => {
    const rvAuth = await loginUser('+919100000004', 'ReportViewerPassword123!');
    expect(rvAuth.status).toBe(200);
    const schoolId = seeded.schoolA.id;
    const classSectionId = seeded.schoolAClass5A.id;

    // Report Viewer can GET daily-class
    const getReportRes = await fetch(
      `${baseUrl}/api/v1/schools/${schoolId}/reports/daily-class?classSectionId=${classSectionId}&date=2026-08-14`,
      {
        headers: { Cookie: rvAuth.cookieString },
      }
    );

    expect(getReportRes.status).toBe(200);

    // Report Viewer CANNOT POST members -> 403 FORBIDDEN
    const postMemberRes = await fetch(`${baseUrl}/api/v1/schools/${schoolId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: rvAuth.cookieString,
        [CSRF_HEADER_NAME]: rvAuth.csrfToken,
      },
      body: JSON.stringify({
        fullName: 'Unauthorized Staff',
        phoneNumber: '+919876500000',
        role: 'TEACHER',
        initialPassword: 'TempPassword123!',
      }),
    });

    expect(postMemberRes.status).toBe(403);
  });

  it('7. Canonical seed and demo credentials sign-in verification', async () => {
    const credentials = [
      { phone: '+919000000000', pass: 'SuperSecretAdminPassword123!', role: 'SUPER_ADMIN' },
      { phone: '+919100000001', pass: 'SchoolAdminPassword123!', role: 'SCHOOL_ADMIN' },
      { phone: '+919100000002', pass: 'TeacherPassword123!', role: 'TEACHER' },
      { phone: '+919100000003', pass: 'RfidOpPassword123!', role: 'RFID_OPERATOR' },
      { phone: '+919100000004', pass: 'ReportViewerPassword123!', role: 'REPORT_VIEWER' },
    ];

    for (const cred of credentials) {
      const auth = await loginUser(cred.phone, cred.pass);
      expect(auth.status).toBe(200);
      expect(auth.body.user).toBeDefined();
      expect(auth.body.user.phoneNumber).toBe(cred.phone);
    }
  });
});
