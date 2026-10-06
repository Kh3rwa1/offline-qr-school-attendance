import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server';
import { db, withTenantContext } from '../../src/db';
import {
  students,
  rfidReaders,
  rfidCredentials,
  attendanceSessions,
  attendanceRecords,
  rfidScanEvents,
} from '../../src/db/schema';
import { findAnomalies } from '../../src/services/rfid/anomalies';
import { canonicalizeEpc, computeEpcDigest } from '../../src/services/rfid/cryptoService';
import { loginAs } from '../helpers/auth';
import { seedDatabase } from '../../src/db/seed';

describe('Part D3 — Anomaly Review: Badge vs Child', () => {
  let app: any;
  let schoolId: string;
  let adminCookies: string;
  let studentId: string;
  let reader1Id: string;
  let reader2Id: string;
  let credentialId: string;
  let sessionId: string;
  const testDate = '2026-11-03';
  const tz = 'Asia/Kolkata';

  beforeAll(async () => {
    process.env.TEST_SERVER_STATIC = 'true';
    process.env.FEATURE_RFID = 'true';
    app = await createApp();
  });

  beforeEach(async () => {
    const seed = await seedDatabase();
    schoolId = seed.schoolA.id;

    const adminAuth = await loginAs(app, 'SCHOOL_ADMIN');
    adminCookies = adminAuth.cookies;

    // Create session
    const [sess] = await db.insert(attendanceSessions).values({
      schoolId,
      classSectionId: seed.schoolAClass5A.id,
      teacherId: seed.teacherUser.id,
      sessionDate: testDate,
      status: 'OPEN',
    }).returning();
    sessionId = sess.id;

    // Create student
    const [st] = await db.insert(students).values({
      schoolId,
      studentCode: `ANOM-${Date.now()}`,
      name: 'Anomaly Test Kid',
      status: 'ACTIVE',
    }).returning();
    studentId = st.id;

    // Create readers
    const [r1] = await db.insert(rfidReaders).values({
      schoolId,
      deviceId: `R1-${Date.now()}`,
      name: 'North Gate',
      status: 'ACTIVE',
    }).returning();
    reader1Id = r1.id;

    const [r2] = await db.insert(rfidReaders).values({
      schoolId,
      deviceId: `R2-${Date.now()}`,
      name: 'South Gate',
      status: 'ACTIVE',
    }).returning();
    reader2Id = r2.id;

    // Create credential
    const epc = 'E28011606000' + Math.floor(Math.random() * 1e12).toString(16).padStart(12, '0');
    const canonical = canonicalizeEpc(epc);
    const digest = computeEpcDigest(canonical);
    const [cred] = await db.insert(rfidCredentials).values({
      schoolId,
      studentId,
      credentialDigest: digest,
      status: 'ACTIVE',
      createdByUserId: adminAuth.user.id,
    }).returning();
    credentialId = cred.id;
  });

  it('detects GATE_PRESENT_CLASS_ABSENT when badge was scanned at gate but teacher marked ABSENT', async () => {
    // 1. RFID scan event logged at gate with ACCEPTED
    await db.insert(rfidScanEvents).values({
      schoolId,
      readerId: reader1Id,
      credentialId,
      studentId,
      clientEventId: `scan-${Date.now()}-1`,
      scanTimestamp: new Date(`${testDate}T08:30:00+05:30`),
      decision: 'ACCEPTED',
    });

    // 2. Teacher marked child ABSENT manually
    await db.insert(attendanceRecords).values({
      schoolId,
      attendanceSessionId: sessionId,
      studentId,
      status: 'ABSENT',
      source: 'MANUAL',
    });

    const anomalies = await withTenantContext(schoolId, async (tx) => {
      return findAnomalies(tx, schoolId, testDate, tz);
    });

    const match = anomalies.find((a) => a.kind === 'GATE_PRESENT_CLASS_ABSENT' && a.studentId === studentId);
    expect(match).toBeDefined();
  });

  it('detects MULTI_READER_BURST when same badge is seen at multiple readers within 60s', async () => {
    const scanTime = new Date(`${testDate}T09:00:00+05:30`);
    const burstTime = new Date(`${testDate}T09:00:20+05:30`); // 20s later at different reader

    await db.insert(rfidScanEvents).values([
      {
        schoolId,
        readerId: reader1Id,
        credentialId,
        studentId,
        clientEventId: `burst-${Date.now()}-1`,
        scanTimestamp: scanTime,
        decision: 'ACCEPTED',
      },
      {
        schoolId,
        readerId: reader2Id,
        credentialId,
        studentId,
        clientEventId: `burst-${Date.now()}-2`,
        scanTimestamp: burstTime,
        decision: 'ACCEPTED',
      },
    ]);

    const anomalies = await withTenantContext(schoolId, async (tx) => {
      return findAnomalies(tx, schoolId, testDate, tz);
    });

    const match = anomalies.find((a) => a.kind === 'MULTI_READER_BURST' && a.studentId === studentId);
    expect(match).toBeDefined();
  });

  it('detects OFF_HOURS_READ when badge is scanned outside 06:00 - 18:00', async () => {
    const lateNight = new Date(`${testDate}T21:30:00+05:30`); // 21:30 PM

    await db.insert(rfidScanEvents).values({
      schoolId,
      readerId: reader1Id,
      credentialId,
      studentId,
      clientEventId: `offhours-${Date.now()}`,
      scanTimestamp: lateNight,
      decision: 'ACCEPTED',
    });

    const anomalies = await withTenantContext(schoolId, async (tx) => {
      return findAnomalies(tx, schoolId, testDate, tz);
    });

    const match = anomalies.find((a) => a.kind === 'OFF_HOURS_READ' && a.studentId === studentId);
    expect(match).toBeDefined();
  });

  it('Admin API GET /:schoolId/rfid/anomalies returns anomaly list', async () => {
    const res = await request(app)
      .get(`/api/v1/schools/${schoolId}/rfid/anomalies?date=${testDate}`)
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.anomalies)).toBe(true);
  });
});
