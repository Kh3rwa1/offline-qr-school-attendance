import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

process.env.TEST_SERVER_STATIC = 'true';

const [{ createApp }, { seedDatabase }, { runMigrations }] = await Promise.all([
  import('../server'),
  import('../src/db/seed'),
  import('../src/db/migrate'),
]);

describe('cookie-backed authentication', () => {
  let baseUrl = '';
  let server: any;
  let seeded: any;

  beforeAll(async () => {
    await runMigrations();
    const app = await createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  beforeEach(async () => {
    seeded = await seedDatabase();
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('sets an HTTP-only cookie, restores /auth/me, and rejects an unassigned school', async () => {
    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+919100000002', password: 'TeacherPassword123!', schoolId: seeded.schoolA.id }),
    });
    expect(login.status).toBe(200);
    const setCookie = login.headers.get('set-cookie') || '';
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    const loginBody = await login.json();
    expect(loginBody.token).toBeUndefined();
    const cookie = setCookie.split(';')[0];

    const me = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { cookie } });
    expect(me.status).toBe(200);
    expect((await me.json()).sessionContext.schoolId).toBe(seeded.schoolA.id);

    const crossTenantLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+919100000002', password: 'TeacherPassword123!', schoolId: seeded.schoolB.id }),
    });
    expect(crossTenantLogin.status).toBe(403);
    expect((await crossTenantLogin.json()).error).toBe('SCHOOL_ACCESS_DENIED');
  });

  it('invalidates the cookie-backed session on logout', async () => {
    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+919100000002', password: 'TeacherPassword123!' }),
    });
    const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
    const logout = await fetch(`${baseUrl}/api/v1/auth/logout`, { method: 'POST', headers: { cookie } });
    expect(logout.status).toBe(200);
    expect(logout.headers.get('set-cookie')).toMatch(/Expires=/i);
    const me = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { cookie } });
    expect(me.status).toBe(401);
  });
});
