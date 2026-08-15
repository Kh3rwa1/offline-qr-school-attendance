import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../server';
import { createSession } from '../src/auth/session';
import { withSystemContext } from '../src/db';
import { users, schools, schoolMemberships } from '../src/db/schema';
import { generateCsrfToken, CSRF_COOKIE_NAME, CSRF_SIG_COOKIE_NAME, CSRF_HEADER_NAME } from '../src/middleware/csrfProtection';
import type { Server } from 'http';

describe('Negative Authorization & Cross-Tenant Security Suite', () => {
  let server: Server;
  let baseUrl: string;
  let schoolAId: string;
  let schoolBId: string;
  let teacherUserAId: string;
  let reportViewerUserAId: string;
  let schoolAdminUserAId: string;
  let teacherSessionToken: string;
  let reportViewerSessionToken: string;
  let schoolAdminSessionToken: string;

  beforeAll(async () => {
    process.env.TEST_SERVER_STATIC = 'true';
    const { runMigrations } = await import('../src/db/migrate');
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

    await withSystemContext(async (tx) => {
      // Create School A
      const [sA] = await tx
        .insert(schools)
        .values({
          name: 'Primary School Alpha',
          slug: `school-alpha-${Date.now()}`,
          udiseCode: `190101${Math.floor(10000 + Math.random() * 90000)}`,
          district: 'Kolkata',
          block: 'Central',
        })
        .returning();
      schoolAId = sA.id;

      // Create School B
      const [sB] = await tx
        .insert(schools)
        .values({
          name: 'Secondary School Beta',
          slug: `school-beta-${Date.now()}`,
          udiseCode: `190102${Math.floor(10000 + Math.random() * 90000)}`,
          district: 'Howrah',
          block: 'North',
        })
        .returning();
      schoolBId = sB.id;

      // Create Teacher for School A
      const [tA] = await tx
        .insert(users)
        .values({
          fullName: 'Teacher Alpha',
          phoneNumber: `+919100000001`,
          passwordHash: 'dummy_hash',
          status: 'ACTIVE',
        })
        .returning();
      teacherUserAId = tA.id;
      await tx.insert(schoolMemberships).values({
        userId: tA.id,
        schoolId: schoolAId,
        role: 'TEACHER',
      });

      // Create Report Viewer for School A
      const [rvA] = await tx
        .insert(users)
        .values({
          fullName: 'Auditor Alpha',
          phoneNumber: `+919100000002`,
          passwordHash: 'dummy_hash',
          status: 'ACTIVE',
        })
        .returning();
      reportViewerUserAId = rvA.id;
      await tx.insert(schoolMemberships).values({
        userId: rvA.id,
        schoolId: schoolAId,
        role: 'REPORT_VIEWER',
      });

      // Create School Admin for School A
      const [saA] = await tx
        .insert(users)
        .values({
          fullName: 'Headmaster Alpha',
          phoneNumber: `+919100000003`,
          passwordHash: 'dummy_hash',
          status: 'ACTIVE',
        })
        .returning();
      schoolAdminUserAId = saA.id;
      await tx.insert(schoolMemberships).values({
        userId: saA.id,
        schoolId: schoolAId,
        role: 'SCHOOL_ADMIN',
      });
    });

    const tSession = await createSession(teacherUserAId, schoolAId);
    teacherSessionToken = tSession.token;

    const rvSession = await createSession(reportViewerUserAId, schoolAId);
    reportViewerSessionToken = rvSession.token;

    const saSession = await createSession(schoolAdminUserAId, schoolAId);
    schoolAdminSessionToken = saSession.token;
  });

  afterAll(async () => {
    if (server) {
      if (typeof (server as any).closeAllConnections === 'function') {
        (server as any).closeAllConnections();
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('1. Rejects TEACHER from accessing School B dashboard summary (Cross-Tenant Attack)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/schools/${schoolBId}/teacher-dashboard`, {
      headers: { Cookie: `session=${teacherSessionToken}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('FORBIDDEN');
  });

  it('2. Rejects SCHOOL_ADMIN from accessing School B dashboard summary (Cross-Tenant Attack)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/schools/${schoolBId}/dashboard`, {
      headers: { Cookie: `session=${schoolAdminSessionToken}` },
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('FORBIDDEN');
  });

  it('3. Rejects REPORT_VIEWER from performing state-changing mutations', async () => {
    const { token, signature } = generateCsrfToken(reportViewerSessionToken);

    const res = await fetch(`${baseUrl}/api/v1/schools/${schoolAId}/attendance/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${reportViewerSessionToken}; ${CSRF_COOKIE_NAME}=${token}; ${CSRF_SIG_COOKIE_NAME}=${signature}`,
        [CSRF_HEADER_NAME]: token,
      },
      body: JSON.stringify({ classSectionId: '00000000-0000-0000-0000-000000000001', sessionDate: '2026-08-14' }),
    });

    // REPORT_VIEWER is not allowed to create attendance sessions
    expect(res.status).toBe(403);
  });

  it('4. Rejects invalid school switching when user has no membership at target school', async () => {
    const { token, signature } = generateCsrfToken(teacherSessionToken);

    const res = await fetch(`${baseUrl}/api/v1/auth/switch-school`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${teacherSessionToken}; ${CSRF_COOKIE_NAME}=${token}; ${CSRF_SIG_COOKIE_NAME}=${signature}`,
        [CSRF_HEADER_NAME]: token,
      },
      body: JSON.stringify({ schoolId: schoolBId }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('MEMBERSHIP_NOT_FOUND');
  });

  it('5. Allows TEACHER to access their own school dashboard summary', async () => {
    const res = await fetch(`${baseUrl}/api/v1/schools/${schoolAId}/teacher-dashboard`, {
      headers: { Cookie: `session=${teacherSessionToken}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.assignedClassesCount).toBeDefined();
  });
});
