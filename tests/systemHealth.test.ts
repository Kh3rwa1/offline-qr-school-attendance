import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../server';
import { seedDatabase } from '../src/db/seed';
import { generateCsrfToken, CSRF_COOKIE_NAME, CSRF_SIG_COOKIE_NAME } from '../src/middleware/csrfProtection';
import type { Server } from 'http';

describe('System Health & Security Overview API', () => {
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

  it('rejects unauthenticated request to /api/v1/system/health with 401', async () => {
    const res = await fetch(`${baseUrl}/api/v1/system/health`);
    expect(res.status).toBe(401);
  });

  it('rejects non-SUPER_ADMIN role (e.g. Teacher) with 403', async () => {
    const teacherAuth = await login('+919100000002', 'TeacherPassword123!');
    expect(teacherAuth.status).toBe(200);
    const res = await fetch(`${baseUrl}/api/v1/system/health`, {
      headers: { Cookie: teacherAuth.cookieString },
    });
    expect(res.status).toBe(403);
  });

  it('allows SUPER_ADMIN to query system health and returns honest telemetry', async () => {
    const superAdminAuth = await login('+919000000000', 'SuperSecretAdminPassword123!');
    expect(superAdminAuth.status).toBe(200);
    const res = await fetch(`${baseUrl}/api/v1/system/health`, {
      headers: { Cookie: superAdminAuth.cookieString },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.telemetry).toBeDefined();
    expect(data.telemetry.db).toBe('CONNECTED');
    expect(['CONNECTED', 'IN_MEMORY_FALLBACK', 'DISCONNECTED']).toContain(data.telemetry.redis);
    expect(typeof data.telemetry.kmsProviderMode).toBe('string');
    expect(typeof data.telemetry.rfidCardProofEnforced).toBe('boolean');
  });
});
