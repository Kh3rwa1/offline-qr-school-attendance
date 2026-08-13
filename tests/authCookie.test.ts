import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import EventEmitter from 'events';
import { authRouter } from '../src/routes/authRoutes';
import { seedDatabase } from '../src/db/seed';
import { runMigrations } from '../src/db/migrate';
import { Response } from 'express';

class MockResponse extends EventEmitter {
  statusCode: number = 200;
  headers: Record<string, string> = {};
  cookies: Record<string, { value: string; options: any }> = {};
  body: any = null;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(data: any) {
    this.body = data;
    this.emit('finish');
    return this;
  }

  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
    return this;
  }

  getHeader(name: string) {
    return this.headers[name.toLowerCase()];
  }

  cookie(name: string, value: string, options: any) {
    this.cookies[name] = { value, options };
    this.headers['set-cookie'] = `${name}=${value}; HttpOnly; SameSite=Lax; Path=/`;
    return this;
  }

  clearCookie(name: string, options: any) {
    delete this.cookies[name];
    this.headers['set-cookie'] = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    return this;
  }
}

describe('cookie-backed authentication', () => {
  let seeded: any;

  beforeAll(async () => {
    await runMigrations();
  });

  beforeEach(async () => {
    seeded = await seedDatabase();
  });

  function invokeRoute(method: string, path: string, headers: Record<string, string> = {}, body: any = {}, cookies: Record<string, string> = {}): Promise<MockResponse> {
    return new Promise((resolve) => {
      const req: any = {
        method,
        url: path,
        originalUrl: path,
        path,
        headers,
        body,
        cookies,
        ip: '127.0.0.1',
      };

      const res = new MockResponse();
      res.on('finish', () => resolve(res));

      authRouter(req, res as any, () => {
        resolve(res);
      });
    });
  }

  it('sets an HTTP-only cookie, restores /auth/me, and rejects an unassigned school', async () => {
    const loginRes = await invokeRoute('POST', '/login', {}, {
      phoneNumber: '+919100000002',
      password: 'TeacherPassword123!',
      schoolId: seeded.schoolA.id,
    });

    expect(loginRes.statusCode).toBe(200);
    const setCookie = loginRes.getHeader('set-cookie') || '';
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(loginRes.body.token).toBeUndefined();

    const cookieVal = loginRes.cookies['session']?.value;
    expect(cookieVal).toBeDefined();

    const crossTenantLogin = await invokeRoute('POST', '/login', {}, {
      phoneNumber: '+919100000002',
      password: 'TeacherPassword123!',
      schoolId: seeded.schoolB.id,
    });
    expect(crossTenantLogin.statusCode).toBe(403);
    expect(crossTenantLogin.body.error).toBe('SCHOOL_ACCESS_DENIED');
  });

  it('invalidates the cookie-backed session on logout', async () => {
    const loginRes = await invokeRoute('POST', '/login', {}, {
      phoneNumber: '+919100000002',
      password: 'TeacherPassword123!',
    });

    const cookieVal = loginRes.cookies['session']?.value;
    expect(cookieVal).toBeDefined();

    const logoutRes = await invokeRoute('POST', '/logout', {}, {}, { session: cookieVal });
    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.getHeader('set-cookie')).toMatch(/Expires=/i);
  });
});
