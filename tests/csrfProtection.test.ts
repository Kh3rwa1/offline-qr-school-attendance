import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../server';
import { generateCsrfToken, CSRF_COOKIE_NAME, CSRF_SIG_COOKIE_NAME, CSRF_HEADER_NAME } from '../src/middleware/csrfProtection';
import crypto from 'crypto';
import type { Server } from 'http';

describe('Production CSRF Protection Test Suite', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.TEST_SERVER_STATIC = 'true';
    const { runMigrations } = await import('../src/db/migrate');
    await runMigrations();
    const { seedDatabase } = await import('../src/db/seed');
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

  it('1. Issues signed CSRF token pair on GET request', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/csrf`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.csrfToken).toBeDefined();

    const cookies = res.headers.get('set-cookie') || '';
    expect(cookies).toContain(CSRF_COOKIE_NAME);
    expect(cookies).toContain(CSRF_SIG_COOKIE_NAME);
  });

  it('2. Allows unauthenticated public mutating request (e.g. login)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+919999999999', password: 'NonExistentPassword' }),
    });

    // Should return 401 (handled by auth logic) rather than 403 CSRF block
    expect(res.status).toBe(401);
  });

  it('3. Rejects cookie-authenticated mutating request when CSRF token is missing', async () => {
    const res = await fetch(`${baseUrl}/api/v1/schools/00000000-0000-0000-0000-000000000000/attendance/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'session=fake-session-token-123',
      },
      body: JSON.stringify({ classSectionId: '00000000-0000-0000-0000-000000000001', sessionDate: '2026-08-14' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('CSRF_TOKEN_MISSING');
  });

  it('4. Rejects cookie-authenticated mutating request when CSRF token is invalid/forged', async () => {
    const sessionToken = 'session-token-abc';
    const { signature } = generateCsrfToken(sessionToken);

    const res = await fetch(`${baseUrl}/api/v1/schools/00000000-0000-0000-0000-000000000000/attendance/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionToken}; ${CSRF_SIG_COOKIE_NAME}=${signature}`,
        [CSRF_HEADER_NAME]: 'forged-attacker-csrf-token',
      },
      body: JSON.stringify({ classSectionId: '00000000-0000-0000-0000-000000000001', sessionDate: '2026-08-14' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('CSRF_TOKEN_INVALID');
  });

  it('5. Rejects cookie-authenticated mutating request on cross-origin mismatch', async () => {
    const sessionToken = 'session-token-abc';
    const { token, signature } = generateCsrfToken(sessionToken);

    const res = await fetch(`${baseUrl}/api/v1/schools/00000000-0000-0000-0000-000000000000/attendance/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: 'school.tumdah.internal',
        Origin: 'https://evil-attacker-site.com',
        Cookie: `session=${sessionToken}; ${CSRF_COOKIE_NAME}=${token}; ${CSRF_SIG_COOKIE_NAME}=${signature}`,
        [CSRF_HEADER_NAME]: token,
      },
      body: JSON.stringify({ classSectionId: '00000000-0000-0000-0000-000000000001', sessionDate: '2026-08-14' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('CSRF_ORIGIN_MISMATCH');
  });

  it('6. Accepts cookie-authenticated mutating request with matching origin and valid token', async () => {
    const sessionToken = 'session-token-abc';
    const { token, signature } = generateCsrfToken(sessionToken);

    const address = server.address() as any;
    const hostStr = `127.0.0.1:${address.port}`;

    const res = await fetch(`${baseUrl}/api/v1/schools/00000000-0000-0000-0000-000000000000/attendance/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: hostStr,
        Origin: `http://${hostStr}`,
        Cookie: `session=${sessionToken}; ${CSRF_COOKIE_NAME}=${token}; ${CSRF_SIG_COOKIE_NAME}=${signature}`,
        [CSRF_HEADER_NAME]: token,
      },
      body: JSON.stringify({ classSectionId: '00000000-0000-0000-0000-000000000001', sessionDate: '2026-08-14' }),
    });

    // CSRF check passed; reaches authentication middleware which returns 401 INVALID_SESSION because fake token
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('INVALID_SESSION');
  });

  it('7. Allows documented webhook exemption with independent cryptographic HMAC signature', async () => {
    const payload = JSON.stringify({ messageId: 'sms-123', status: 'DELIVERED' });
    const webhookSecret = process.env.SMS_WEBHOOK_SECRET || 'dlt-webhook-secret-key';
    const hmacSig = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');

    const res = await fetch(`${baseUrl}/api/v1/notifications/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Callback-Signature': hmacSig,
      },
      body: payload,
    });

    // Webhook route is exempt from cookie CSRF and proceeds directly to signature handler
    expect(res.status).not.toBe(403);
  });
});
