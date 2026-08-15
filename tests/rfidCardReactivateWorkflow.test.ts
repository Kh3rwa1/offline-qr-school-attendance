import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../server';
import { seedDatabase } from '../src/db/seed';
import { db } from '../src/db';
import { schools, students, rfidCredentials, users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { generateCsrfToken, CSRF_COOKIE_NAME, CSRF_SIG_COOKIE_NAME, CSRF_HEADER_NAME } from '../src/middleware/csrfProtection';
import type { Server } from 'http';

describe('RFID Credential Reactivation Workflow', () => {
  let server: Server;
  let baseUrl: string;
  let schoolAdmin: any;
  let schoolId: string;
  let testCredentialId: string;

  beforeAll(async () => {
    process.env.TEST_SERVER_STATIC = 'true';
    process.env.FEATURE_RFID = 'true';
    await seedDatabase();

    const [school] = await db.select().from(schools).limit(1);
    schoolId = school.id;

    let [student] = await db.select().from(students).where(eq(students.schoolId, schoolId)).limit(1);
    if (!student) {
      [student] = await db.insert(students).values({
        schoolId,
        studentCode: 'ST-TEST-' + Date.now(),
        name: 'Test Student',
        gender: 'MALE',
        dateOfBirth: '2012-01-01',
      }).returning();
    }

    const [adminUser] = await db.select().from(users).where(eq(users.phoneNumber, '+919100000001')).limit(1);

    // Create a credential for reactivation testing
    const [cred] = await db
      .insert(rfidCredentials)
      .values({
        schoolId,
        studentId: student.id,
        credentialDigest: 'test-digest-' + Date.now(),
        securityMode: 'SECURE',
        keyVersion: 1,
        createdByUserId: adminUser.id,
        status: 'ACTIVE',
      })
      .returning();
    testCredentialId = cred.id;

    const app = await createApp();
    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${(address as any).port}`;
        resolve();
      });
      server.on('error', reject);
    });

    // Login as School Admin
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+919100000001', password: 'SchoolAdminPassword123!' }),
    });
    const rawCookies = (res.headers as any).getSetCookie ? (res.headers as any).getSetCookie().join('; ') : (res.headers.get('set-cookie') || '');
    const sessionMatch = rawCookies.match(/session=([^;]+)/);
    const sessionToken = sessionMatch ? sessionMatch[1] : '';
    const { token, signature } = generateCsrfToken(sessionToken);

    schoolAdmin = {
      csrfToken: token,
      cookieString: `session=${sessionToken}; ${CSRF_COOKIE_NAME}=${token}; ${CSRF_SIG_COOKIE_NAME}=${signature}`,
    };
  });

  afterAll(async () => {
    if (server) {
      if (typeof (server as any).closeAllConnections === 'function') {
        (server as any).closeAllConnections();
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('rejects reactivation of a non-existent card with 404', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000999';
    const res = await fetch(`${baseUrl}/api/v1/schools/${schoolId}/rfid/credentials/${fakeId}/reactivate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: schoolAdmin.cookieString,
        [CSRF_HEADER_NAME]: schoolAdmin.csrfToken,
      },
      body: JSON.stringify({ reason: 'Student returned card' }),
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('rejects reactivation of an ACTIVE card with 409', async () => {
    const res = await fetch(`${baseUrl}/api/v1/schools/${schoolId}/rfid/credentials/${testCredentialId}/reactivate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: schoolAdmin.cookieString,
        [CSRF_HEADER_NAME]: schoolAdmin.csrfToken,
      },
      body: JSON.stringify({ reason: 'Student returned card' }),
    });

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('successfully suspends and then reactivates card back to ACTIVE with reason', async () => {
    // 1. Suspend
    const suspendRes = await fetch(`${baseUrl}/api/v1/schools/${schoolId}/rfid/credentials/${testCredentialId}/suspend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: schoolAdmin.cookieString,
        [CSRF_HEADER_NAME]: schoolAdmin.csrfToken,
      },
      body: JSON.stringify({ reason: 'Temporarily misplaced' }),
    });

    expect(suspendRes.status).toBe(200);
    const suspendData = await suspendRes.json();
    expect(suspendData.credential.status).toBe('SUSPENDED');

    // 2. Reactivate
    const reactivateRes = await fetch(`${baseUrl}/api/v1/schools/${schoolId}/rfid/credentials/${testCredentialId}/reactivate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: schoolAdmin.cookieString,
        [CSRF_HEADER_NAME]: schoolAdmin.csrfToken,
      },
      body: JSON.stringify({ reason: 'Card returned by student' }),
    });

    expect(reactivateRes.status).toBe(200);
    const reactivateData = await reactivateRes.json();
    expect(reactivateData.success).toBe(true);
    expect(reactivateData.credential.status).toBe('ACTIVE');
  });
});
