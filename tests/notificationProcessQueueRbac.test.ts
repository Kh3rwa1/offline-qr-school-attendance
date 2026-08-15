import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../server';
import { seedDatabase } from '../src/db/seed';
import { generateCsrfToken, CSRF_COOKIE_NAME, CSRF_SIG_COOKIE_NAME, CSRF_HEADER_NAME } from '../src/middleware/csrfProtection';
import type { Server } from 'http';

describe('Notification Queue Worker Execution RBAC', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.TEST_SERVER_STATIC = 'true';
    await seedDatabase();

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

  async function login(phoneNumber: string, passwordAttempt: string) {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, password: passwordAttempt }),
    });
    const body = await res.json();
    const rawCookies = (res.headers as any).getSetCookie ? (res.headers as any).getSetCookie().join('; ') : (res.headers.get('set-cookie') || '');
    const sessionMatch = rawCookies.match(/session=([^;]+)/);
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

  it('rejects unauthenticated request with 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/notifications/process-queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it('rejects TEACHER with 403', async () => {
    const teacher = await login('+919100000002', 'TeacherPassword123!');
    expect(teacher.status).toBe(200);
    const res = await fetch(`${baseUrl}/api/v1/notifications/process-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: teacher.cookieString,
        [CSRF_HEADER_NAME]: teacher.csrfToken,
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it('allows SCHOOL_ADMIN to trigger queue processing scoped to their school', async () => {
    const schoolAdmin = await login('+919100000001', 'SchoolAdminPassword123!');
    expect(schoolAdmin.status).toBe(200);
    const res = await fetch(`${baseUrl}/api/v1/notifications/process-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: schoolAdmin.cookieString,
        [CSRF_HEADER_NAME]: schoolAdmin.csrfToken,
      },
      body: JSON.stringify({ limit: 5 }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(typeof data.processed).toBe('number');
  });

  it('allows SUPER_ADMIN to trigger queue processing', async () => {
    const superAdmin = await login('+919000000000', 'SuperSecretAdminPassword123!');
    expect(superAdmin.status).toBe(200);
    const res = await fetch(`${baseUrl}/api/v1/notifications/process-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: superAdmin.cookieString,
        [CSRF_HEADER_NAME]: superAdmin.csrfToken,
      },
      body: JSON.stringify({ limit: 5 }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(typeof data.processed).toBe('number');
  });
});
