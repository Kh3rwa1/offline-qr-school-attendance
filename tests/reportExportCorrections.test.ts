import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../server';
import { seedDatabase } from '../src/db/seed';
import { db } from '../src/db';
import { schools } from '../src/db/schema';
import { generateCsrfToken, CSRF_COOKIE_NAME, CSRF_SIG_COOKIE_NAME } from '../src/middleware/csrfProtection';
import type { Server } from 'http';

describe('Report Export Corrections Type', () => {
  let server: Server;
  let baseUrl: string;
  let adminCookie: string;
  let teacherCookie: string;
  let schoolId: string;

  beforeAll(async () => {
    process.env.TEST_SERVER_STATIC = 'true';
    await seedDatabase();

    const [school] = await db.select().from(schools).limit(1);
    schoolId = school.id;

    const app = await createApp();
    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${(address as any).port}`;
        resolve();
      });
      server.on('error', reject);
    });

    // Admin Auth
    const adminRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+919100000001', password: 'SchoolAdminPassword123!' }),
    });
    const adminRawCookies = (adminRes.headers as any).getSetCookie ? (adminRes.headers as any).getSetCookie().join('; ') : (adminRes.headers.get('set-cookie') || '');
    const adminMatch = adminRawCookies.match(/session=([^;]+)/);
    const adminToken = adminMatch ? adminMatch[1] : '';
    const adminCsrf = generateCsrfToken(adminToken);
    adminCookie = `session=${adminToken}; ${CSRF_COOKIE_NAME}=${adminCsrf.token}; ${CSRF_SIG_COOKIE_NAME}=${adminCsrf.signature}`;

    // Teacher Auth
    const teacherRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+919100000002', password: 'TeacherPassword123!' }),
    });
    const teacherRawCookies = (teacherRes.headers as any).getSetCookie ? (teacherRes.headers as any).getSetCookie().join('; ') : (teacherRes.headers.get('set-cookie') || '');
    const teacherMatch = teacherRawCookies.match(/session=([^;]+)/);
    const teacherToken = teacherMatch ? teacherMatch[1] : '';
    const teacherCsrf = generateCsrfToken(teacherToken);
    teacherCookie = `session=${teacherToken}; ${CSRF_COOKIE_NAME}=${teacherCsrf.token}; ${CSRF_SIG_COOKIE_NAME}=${teacherCsrf.signature}`;
  });

  afterAll(async () => {
    if (server) {
      if (typeof (server as any).closeAllConnections === 'function') {
        (server as any).closeAllConnections();
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('rejects TEACHER access to corrections report export with 403', async () => {
    const res = await fetch(`${baseUrl}/api/v1/schools/${schoolId}/reports/export?type=corrections&format=csv`, {
      headers: { Cookie: teacherCookie },
    });
    expect(res.status).toBe(403);
  });

  it('allows SCHOOL_ADMIN to download corrections report CSV', async () => {
    const res = await fetch(`${baseUrl}/api/v1/schools/${schoolId}/reports/export?type=corrections&format=csv`, {
      headers: { Cookie: adminCookie },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const text = await res.text();
    expect(text).toContain('Correction ID');
    expect(text).toContain('Previous Status');
    expect(text).toContain('New Status');
  });
});
