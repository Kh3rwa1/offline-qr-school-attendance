import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../server';
import { db } from '../src/db';
import { schools, demoRequests, auditLogs } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import type { Server } from 'http';

describe('Public Tenant Resolution, Demo Lead Capture & Bound Workspace Login', () => {
  let server: Server;
  let baseUrl: string;
  let seededData: any;
  let suspendedSchoolId: string;

  beforeAll(async () => {
    process.env.TEST_SERVER_STATIC = 'true';
    const { runMigrations } = await import('../src/db/migrate');
    await runMigrations();
    const { seedDatabase } = await import('../src/db/seed');
    seededData = await seedDatabase();

    // Create a suspended test school
    const [suspended] = await db
      .insert(schools)
      .values({
        name: 'Suspended Test Academy',
        slug: 'suspended-test-academy-9999',
        udiseCode: '19100109999',
        district: 'Kolkata',
        status: 'SUSPENDED',
      })
      .returning();
    suspendedSchoolId = suspended.id;

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

  it('1. GET /api/v1/public/schools/by-slug/:slug returns 200 with sanitized tenant metadata for active school', async () => {
    const res = await fetch(`${baseUrl}/api/v1/public/schools/by-slug/rampur-high-school-0101`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.school).toBeDefined();
    expect(body.school.name).toBe('Rampur High School');
    expect(body.school.slug).toBe('rampur-high-school-0101');
    expect(body.school.district).toBe('Murshidabad');
    expect(body.school.status).toBe('ACTIVE');

    // Strict privacy assurance: no secrets, phone numbers, or emails leaked
    expect((body.school as any).adminPhone).toBeUndefined();
    expect((body.school as any).passwordHash).toBeUndefined();
    expect((body.school as any).encryptionKey).toBeUndefined();
  });

  it('2. GET /api/v1/public/schools/by-slug/:slug returns 404 for unknown school slug', async () => {
    const res = await fetch(`${baseUrl}/api/v1/public/schools/by-slug/unknown-school-workspace`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('SCHOOL_NOT_FOUND');
    expect(body.message).toBe('This school workspace was not found');
  });

  it('3. GET /api/v1/public/schools/by-slug/:slug returns 403 for suspended school', async () => {
    const res = await fetch(`${baseUrl}/api/v1/public/schools/by-slug/suspended-test-academy-9999`);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('SCHOOL_NOT_ACTIVE');
    expect(body.message).toBe('This school workspace is suspended');
  });

  it('4. POST /api/v1/public/demo-requests persists lead data and returns 201 without leaking internals', async () => {
    const payload = {
      name: 'Headmaster Arindam Roy',
      phone: '+919876543210',
      email: 'arindam@malda-model.edu.in',
      schoolName: 'Malda Model Higher Secondary School',
      district: 'Malda',
      studentCount: '1000-2000',
      source: 'landing',
    };

    const res = await fetch(`${baseUrl}/api/v1/public/demo-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ success: true });

    // Verify database record
    const [saved] = await db
      .select()
      .from(demoRequests)
      .where(eq(demoRequests.phone, '+919876543210'));

    expect(saved).toBeDefined();
    expect(saved.name).toBe(payload.name);
    expect(saved.schoolName).toBe(payload.schoolName);
    expect(saved.district).toBe(payload.district);
    expect(saved.status).toBe('NEW');

    // Verify audit log
    const [log] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, 'DEMO_REQUEST_CREATED'));
    expect(log).toBeDefined();
  });

  it('5. POST /api/v1/public/demo-requests rejects invalid phone or missing fields with 400', async () => {
    const invalidPayload = {
      name: 'A',
      phone: 'invalid-phone-string',
      schoolName: '',
      district: '',
      studentCount: '',
    };

    const res = await fetch(`${baseUrl}/api/v1/public/demo-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('INVALID_INPUT');
  });

  it('6. POST /api/v1/auth/login with mismatched schoolId returns 403 SCHOOL_ACCESS_DENIED', async () => {
    // Teacher A1 belongs to School A, but submits login targeting School B ID
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '+919100000002',
        password: 'TeacherPassword123!',
        schoolId: seededData.schoolB.id,
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('SCHOOL_ACCESS_DENIED');
  });

  it('7. POST /api/v1/auth/login with matching schoolId returns 200 with bound activeSchoolId', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '+919100000002',
        password: 'TeacherPassword123!',
        schoolId: seededData.schoolA.id,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activeSchoolId).toBe(seededData.schoolA.id);
    expect(body.user).toBeDefined();
    expect(res.headers.get('set-cookie')).toContain('session=');
  });
});
