import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../server';
import { seedDatabase } from '../src/db/seed';
import { db } from '../src/db';
import { schools, students, enrollments, classSections, academicYears } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { generateCsrfToken, CSRF_COOKIE_NAME, CSRF_SIG_COOKIE_NAME } from '../src/middleware/csrfProtection';
import type { Server } from 'http';

describe('Student Search Joined Shape API', () => {
  let server: Server;
  let baseUrl: string;
  let adminCookie: string;
  let schoolId: string;

  beforeAll(async () => {
    process.env.TEST_SERVER_STATIC = 'true';
    await seedDatabase();

    const [school] = await db.select().from(schools).where(eq(schools.udiseCode, '19100100101')).limit(1);
    schoolId = school.id;

    const [classSection] = await db.select().from(classSections).where(eq(classSections.schoolId, schoolId)).limit(1);
    const [academicYear] = await db.select().from(academicYears).where(eq(academicYears.schoolId, schoolId)).limit(1);

    const [student] = await db
      .insert(students)
      .values({
        schoolId,
        studentCode: 'ST-SEARCH-01',
        name: 'Sourav Ganguly',
        gender: 'MALE',
        dateOfBirth: '2012-05-15',
        status: 'ACTIVE',
      })
      .returning();

    await db.insert(enrollments).values({
      schoolId,
      studentId: student.id,
      classSectionId: classSection.id,
      academicYearId: academicYear.id,
      rollNumber: 10,
      startDate: '2026-01-01',
      status: 'ACTIVE',
    });

    const app = await createApp();
    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${(address as any).port}`;
        resolve();
      });
      server.on('error', reject);
    });

    const adminRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+919100000001', password: 'SchoolAdminPassword123!' }),
    });
    const rawCookies = (adminRes.headers as any).getSetCookie ? (adminRes.headers as any).getSetCookie().join('; ') : (adminRes.headers.get('set-cookie') || '');
    const adminMatch = rawCookies.match(/session=([^;]+)/);
    const adminToken = adminMatch ? adminMatch[1] : '';
    const adminCsrf = generateCsrfToken(adminToken);
    adminCookie = `session=${adminToken}; ${CSRF_COOKIE_NAME}=${adminCsrf.token}; ${CSRF_SIG_COOKIE_NAME}=${adminCsrf.signature}`;
  });

  afterAll(async () => {
    if (server) {
      if (typeof (server as any).closeAllConnections === 'function') {
        (server as any).closeAllConnections();
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('returns student search results with fullName, className, sectionName, and rollNumber', async () => {
    const res = await fetch(`${baseUrl}/api/v1/schools/${schoolId}/students?search=Sourav&limit=10`, {
      headers: { Cookie: adminCookie },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.students)).toBe(true);
    expect(data.students.length).toBeGreaterThan(0);

    const first = data.students[0];
    expect(first.id).toBeDefined();
    expect(first.fullName || first.name).toBe('Sourav Ganguly');
    expect(first.className).toBeDefined();
    expect(first.sectionName).toBeDefined();
    expect(first.rollNumber).toBe(10);
  });
});
