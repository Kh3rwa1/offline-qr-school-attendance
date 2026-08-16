import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createApp } from '../server';
import { db } from '../src/db';
import { users, schools, schoolMemberships, academicYears, students, enrollments, auditLogs } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import argon2 from 'argon2';
import { runMigrations } from '../src/db/migrate';

describe('First-Run Setup Wizard API Integration Suite', () => {
  let server: any;
  let baseUrl = '';

  beforeAll(async () => {
    await runMigrations();
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

  beforeEach(async () => {
    await db.delete(auditLogs);
    await db.delete(enrollments);
    await db.delete(students);
    await db.delete(schoolMemberships);
    await db.delete(academicYears);
    await db.delete(schools);
    await db.delete(users);
  });

  it('GET /api/v1/setup/status returns isBootstrapped: false when no super admin exists', async () => {
    const res = await fetch(`${baseUrl}/api/v1/setup/status`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isBootstrapped).toBe(false);
    expect(body.setupAllowed).toBe(true);
    expect(body.systemInfo).toBeDefined();
    expect(body.systemInfo.dbStatus).toBe('connected');
  });

  it('POST /api/v1/setup/initialize fails on invalid phone or short password', async () => {
    const res = await fetch(`${baseUrl}/api/v1/setup/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admin: {
          fullName: 'Test Admin',
          phoneNumber: 'invalid-phone',
          password: 'short',
        },
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/setup/initialize creates first Super Admin and permanently locks setup', async () => {
    const adminPhone = '+919876543210';
    const rawPassword = 'SuperSecureAdminPassword2026!';

    // 1. Initial setup call
    const res = await fetch(`${baseUrl}/api/v1/setup/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admin: {
          fullName: 'Master Headmaster',
          phoneNumber: adminPhone,
          password: rawPassword,
        },
        school: {
          name: 'Khatra Model High School',
          district: 'Bankura',
          udiseCode: '19130100101',
          preferredLanguage: 'bn',
        },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.userId).toBeDefined();
    expect(body.schoolId).toBeDefined();

    // 2. Verify database records
    const [createdUser] = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, adminPhone));

    expect(createdUser).toBeDefined();
    expect(createdUser.platformRole).toBe('SUPER_ADMIN');
    expect(createdUser.fullName).toBe('Master Headmaster');

    // Verify Argon2id password hash
    const passwordMatch = await argon2.verify(createdUser.passwordHash, rawPassword);
    expect(passwordMatch).toBe(true);

    // 3. Verify status endpoint now reflects isBootstrapped: true
    const statusRes = await fetch(`${baseUrl}/api/v1/setup/status`);
    expect(statusRes.status).toBe(200);
    const statusBody = await statusRes.json();
    expect(statusBody.isBootstrapped).toBe(true);
    expect(statusBody.setupAllowed).toBe(false);

    // 4. Subsequent initialization attempt must be rejected with 403 Forbidden
    const secondRes = await fetch(`${baseUrl}/api/v1/setup/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admin: {
          fullName: 'Adversary Hacker',
          phoneNumber: '+919999999999',
          password: 'AnotherPassword123!',
        },
      }),
    });

    expect(secondRes.status).toBe(403);
    const secondBody = await secondRes.json();
    expect(secondBody.error).toBe('SETUP_ALREADY_COMPLETED');
  });

  it('POST /api/v1/setup/import-roster requires authenticated administrator and imports student roster', async () => {
    // 1. Unauthenticated request rejected with 401
    const unauthRes = await fetch(`${baseUrl}/api/v1/setup/import-roster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolId: '00000000-0000-0000-0000-000000000001',
        records: [{ studentName: 'Test Student', rollNumber: 1, className: '10', sectionName: 'A' }],
      }),
    });
    expect(unauthRes.status).toBe(401);

    // 2. Initialize system to get admin and school
    const initRes = await fetch(`${baseUrl}/api/v1/setup/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admin: {
          fullName: 'Setup Admin',
          phoneNumber: '+919876543211',
          password: 'SuperSecureAdminPassword2026!',
        },
        school: {
          name: 'Roster Test School',
          district: 'Bankura',
        },
      }),
    });
    expect(initRes.status).toBe(201);
    const initBody = await initRes.json();
    const schoolId = initBody.schoolId;

    // 3. Log in as newly created Super Admin
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '+919876543211',
        password: 'SuperSecureAdminPassword2026!',
      }),
    });
    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json();
    const cookies = (loginRes.headers as any).getSetCookie ? (loginRes.headers as any).getSetCookie().join('; ') : (loginRes.headers.get('set-cookie') || '');

    // 4. Import roster records
    const importRes = await fetch(`${baseUrl}/api/v1/setup/import-roster`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookies,
        'x-csrf-token': loginBody.csrfToken || '',
      },
      body: JSON.stringify({
        schoolId,
        records: [
          { studentName: 'Sourav Ganguly', rollNumber: 1, className: 'Class 10', sectionName: 'A', gender: 'MALE' },
          { studentName: 'Jhulan Goswami', rollNumber: 2, className: 'Class 10', sectionName: 'A', gender: 'FEMALE' },
          { studentName: 'Poulomi Ghatak', rollNumber: 1, className: 'Class 9', sectionName: 'B', gender: 'FEMALE' },
        ],
      }),
    });

    expect(importRes.status).toBe(200);
    const importBody = await importRes.json();
    expect(importBody.success).toBe(true);
    expect(importBody.enrolledCount).toBe(3);
    expect(importBody.classesCreated).toBe(2);
  });

  it('strictly enforces rate limiting on /api/v1/setup/initialize returning 429 after 5 requests', async () => {
    // Send 5 rapid validation-error requests to consume the rate limit quota
    for (let i = 0; i < 5; i++) {
      await fetch(`${baseUrl}/api/v1/setup/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin: { fullName: 'Bad', phoneNumber: 'bad', password: 'bad' } }),
      });
    }

    // 6th request must be blocked by rate limiter with 429
    const rateLimitedRes = await fetch(`${baseUrl}/api/v1/setup/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin: { fullName: 'Blocked', phoneNumber: '+919999999999', password: 'Password12345!' } }),
    });

    expect(rateLimitedRes.status).toBe(429);
    const rateLimitedBody = await rateLimitedRes.json();
    expect(rateLimitedBody.error).toBe('TOO_MANY_REQUESTS');
    expect(rateLimitedBody.retryAfterSeconds).toBeDefined();
  });
});
