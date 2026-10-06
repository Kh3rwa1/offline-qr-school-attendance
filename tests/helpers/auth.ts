import request from 'supertest';
import type { Express } from 'express';
import { runMigrations } from '../../src/db/migrate';
import { seedDatabase } from '../../src/db/seed';

let seeded = false;

export async function loginAs(
  app: Express,
  role: 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' = 'SCHOOL_ADMIN'
) {
  if (!seeded) {
    process.env.TEST_SERVER_STATIC = 'true';
    await runMigrations();
    const { getDb } = await import('../../src/db');
    const { users } = await import('../../src/db/schema');
    const existingUsers = await getDb().select().from(users).limit(1);
    if (!existingUsers.length) {
      await seedDatabase();
    }
    seeded = true;
  }

  const credentials = {
    SUPER_ADMIN: { phone: '+919000000000', pass: 'SuperSecretAdminPassword123!' },
    SCHOOL_ADMIN: { phone: '+919100000001', pass: 'SchoolAdminPassword123!' },
    TEACHER: { phone: '+919100000002', pass: 'TeacherPassword123!' },
  }[role];

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ phoneNumber: credentials.phone, password: credentials.pass });

  if (loginRes.status !== 200) {
    throw new Error(
      `loginAs failed for role ${role} (status ${loginRes.status}): ${JSON.stringify(loginRes.body)}`
    );
  }

  const rawLoginCookies = loginRes.headers['set-cookie'];
  const loginCookieList: string[] = Array.isArray(rawLoginCookies)
    ? rawLoginCookies
    : typeof rawLoginCookies === 'string'
      ? [rawLoginCookies]
      : [];
  const cookieHeader = loginCookieList.map((c) => c.split(';')[0]).join('; ');

  const csrf = loginRes.body?.csrfToken;
  const schoolId = loginRes.body?.activeSchoolId || '00000000-0000-0000-0000-000000000001';

  return {
    cookies: cookieHeader,
    csrf,
    schoolId,
    user: loginRes.body?.user,
  };
}
