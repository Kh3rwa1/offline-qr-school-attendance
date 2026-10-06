import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server';
import { db } from '../../src/db';
import { schools, rfidReaders, rfidCredentials, students, attendanceRecords, rfidScanEvents, enrollments } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { canonicalizeEpc, computeEpcDigest } from '../../src/services/rfid/cryptoService';
import { loginAs } from '../helpers/auth';
import { seedDatabase } from '../../src/db/seed';
import { generateReaderToken } from '../../src/auth/readerTokens';

describe('Part D1 — Shadow Mode & Staged Rollout', () => {
  let app: any;
  let schoolId: string;
  let adminCookies: string;
  let adminCsrf: string;
  let teacherCookies: string;
  let teacherCsrf: string;
  let studentId: string;
  let epc: string;
  let readerDeviceId: string;
  let readerToken: string;

  beforeAll(async () => {
    process.env.TEST_SERVER_STATIC = 'true';
    process.env.FEATURE_RFID = 'true';
    process.env.RFID_INGEST_V2 = 'true';
    app = await createApp();
  });

  beforeEach(async () => {
    const seed = await seedDatabase();
    schoolId = seed.schoolA.id;

    const adminAuth = await loginAs(app, 'SCHOOL_ADMIN');
    adminCookies = adminAuth.cookies;
    adminCsrf = adminAuth.csrf || '';

    let adminUser = adminAuth.user;

    const teacherAuth = await loginAs(app, 'TEACHER');
    teacherCookies = teacherAuth.cookies;
    teacherCsrf = teacherAuth.csrf || '';

    // Create student
    const [st] = await db.insert(students).values({
      schoolId,
      studentCode: `SHADOW-${Date.now()}`,
      name: 'Shadow Test Student',
      status: 'ACTIVE',
    }).returning();
    studentId = st.id;

    // Enroll in Class 5A
    await db.insert(enrollments).values({
      schoolId,
      studentId,
      classSectionId: seed.schoolAClass5A.id,
      academicYearId: seed.academicYearA.id,
      rollNumber: 101,
      status: 'ACTIVE',
      startDate: '2026-01-01',
    });

    // Enroll EPC
    epc = 'E28011606000' + Math.floor(Math.random() * 1e12).toString(16).padStart(12, '0');
    const canonical = canonicalizeEpc(epc);
    const digest = computeEpcDigest(canonical, schoolId);
    await db.insert(rfidCredentials).values({
      schoolId,
      studentId,
      credentialDigest: digest,
      status: 'ACTIVE',
      securityMode: 'UHF_EPC',
      createdByUserId: adminUser.id,
    });

    // Create reader with bearer token
    const tokenData = generateReaderToken();
    readerToken = tokenData.token;
    readerDeviceId = `FX9600-SHADOW-${Date.now()}`;
    await db.insert(rfidReaders).values({
      schoolId,
      deviceId: readerDeviceId,
      name: 'Main Gate Reader',
      status: 'ACTIVE',
      directionMode: 'ENTRY',
      bearerTokenHash: tokenData.hash,
      bearerTokenHint: tokenData.hint,
    });
  });

  it('SHADOW mode: logs scans as ACCEPTED without altering attendance records', async () => {
    // Ensure school is in SHADOW mode
    await db.update(schools).set({ rfidMode: 'SHADOW' }).where(eq(schools.id, schoolId));

    const payload = JSON.stringify({
      data: [{
        idHex: epc,
        timestamp: new Date().toISOString(),
        antenna: 1,
        peakRssi: -50,
      }],
    });

    // Ingest via webhook
    const res = await request(app)
      .post(`/api/v1/schools/${schoolId}/rfid/zebra/reads`)
      .set('Content-Type', 'application/json')
      .set('Authorization', `Bearer ${readerToken}`)
      .set('x-reader-device-id', readerDeviceId)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.processedCount).toBe(1);
    expect(res.body.results[0].decision).toBe('ACCEPTED');

    // Verify scan event was written
    const scans = await db.select().from(rfidScanEvents).where(eq(rfidScanEvents.schoolId, schoolId));
    expect(scans.length).toBeGreaterThan(0);
    expect(scans.some((s) => s.decision === 'ACCEPTED')).toBe(true);

    // Verify NO attendance record was written in SHADOW mode
    const records = await db.select().from(attendanceRecords).where(eq(attendanceRecords.studentId, studentId));
    expect(records.length).toBe(0);
  });

  it('Admin PATCH /:schoolId/rfid/mode updates mode with audit trail', async () => {
    const patchRes = await request(app)
      .patch(`/api/v1/schools/${schoolId}/rfid/mode`)
      .set('Cookie', adminCookies)
      .set('x-csrf-token', adminCsrf)
      .send({ mode: 'ASSISTED' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.success).toBe(true);
    expect(patchRes.body.data.rfidMode).toBe('ASSISTED');
    expect(patchRes.body.data.previousMode).toBe('SHADOW');

    const [updated] = await db.select({ mode: schools.rfidMode }).from(schools).where(eq(schools.id, schoolId));
    expect(updated.mode).toBe('ASSISTED');
  });

  it('Rejects non-admin attempting to change rfid mode', async () => {
    const res = await request(app)
      .patch(`/api/v1/schools/${schoolId}/rfid/mode`)
      .set('Cookie', teacherCookies)
      .set('x-csrf-token', teacherCsrf)
      .send({ mode: 'LIVE' });

    expect(res.status).toBe(403);
  });
});
