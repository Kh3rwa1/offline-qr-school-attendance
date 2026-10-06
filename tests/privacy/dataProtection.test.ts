import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server';
import { db } from '../../src/db';
import {
  students,
  guardians,
  studentGuardians,
  rfidReaders,
  rfidCredentials,
  rfidScanEvents,
  guardianConsents,
  retentionPolicies,
} from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { hasConsent, recordConsent, withdrawConsent } from '../../src/services/privacy/consent';
import { runRetention } from '../../src/jobs/retention';
import { loginAs } from '../helpers/auth';
import { seedDatabase } from '../../src/db/seed';

describe('Part D4 — Data Protection Workflows & Rights', () => {
  let app: any;
  let schoolId: string;
  let adminCookies: string;
  let adminCsrf: string;
  let adminUserId: string;
  let studentId: string;
  let guardianId: string;

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
    adminCsrf = adminAuth.csrf || '';
    adminUserId = adminAuth.user.id;

    // Create student
    const [st] = await db.insert(students).values({
      schoolId,
      studentCode: `DPDP-${Date.now()}`,
      name: 'Aditi Sharma',
      banglarShikshaId: 'BS-1234567890',
      dateOfBirth: '2012-05-15',
      photoUrl: 'https://school.example.com/photos/aditi.jpg',
      status: 'ACTIVE',
    }).returning();
    studentId = st.id;

    // Create guardian
    const [g] = await db.insert(guardians).values({
      schoolId,
      name: 'Ramesh Sharma',
      phoneNumber: '9876543210',
      relationship: 'FATHER',
    }).returning();
    guardianId = g.id;

    await db.insert(studentGuardians).values({
      studentId,
      guardianId,
      isPrimary: true,
    });
  });

  it('records, queries, and withdraws guardian consent accurately', async () => {
    // 1. Initial state without consent record defaults to true for legacy backwards compatibility
    expect(await hasConsent(db, schoolId, studentId, 'RFID_ATTENDANCE')).toBe(true);

    // 2. Explicitly record consent: granted = false
    await recordConsent(db, {
      schoolId,
      studentId,
      guardianId,
      purpose: 'RFID_ATTENDANCE',
      granted: false,
    });
    expect(await hasConsent(db, schoolId, studentId, 'RFID_ATTENDANCE')).toBe(false);

    // 3. Update to granted = true
    await recordConsent(db, {
      schoolId,
      studentId,
      guardianId,
      purpose: 'RFID_ATTENDANCE',
      granted: true,
    });
    expect(await hasConsent(db, schoolId, studentId, 'RFID_ATTENDANCE')).toBe(true);

    // 4. Withdraw consent
    await withdrawConsent(db, { schoolId, studentId, purpose: 'RFID_ATTENDANCE' });
    const consents = await db.select().from(guardianConsents).where(eq(guardianConsents.studentId, studentId));
    expect(consents.every((c) => c.withdrawnAt !== null)).toBe(true);
  });

  it('blocks RFID credential enrollment when consent is denied (409 CONSENT_REQUIRED)', async () => {
    // Record explicit denial of RFID_ATTENDANCE consent
    await recordConsent(db, {
      schoolId,
      studentId,
      guardianId,
      purpose: 'RFID_ATTENDANCE',
      granted: false,
    });

    const res = await request(app)
      .post(`/api/v1/schools/${schoolId}/rfid/credentials/enroll-epc`)
      .set('Cookie', adminCookies)
      .set('x-csrf-token', adminCsrf)
      .send({
        studentId,
        epc: 'E280116060000219B2773344',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('CONSENT_REQUIRED');
  });

  it('GET /students/:studentId/data-export produces machine-readable parent data package', async () => {
    // Grant consent
    await recordConsent(db, {
      schoolId,
      studentId,
      guardianId,
      purpose: 'ABSENCE_SMS',
      granted: true,
    });

    const res = await request(app)
      .get(`/api/v1/schools/${schoolId}/students/${studentId}/data-export`)
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain(`student-${studentId}.json`);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data.student.id).toBe(studentId);
    expect(res.body.data.guardians.length).toBe(1);
    expect(res.body.data.consents.length).toBe(1);
  });

  it('POST /students/:studentId/anonymize implements right to erasure safely', async () => {
    // Provision a badge
    await db.insert(rfidCredentials).values({
      schoolId,
      studentId,
      credentialDigest: 'dummy-digest-for-anonymize-' + Date.now() + '-' + Math.random(),
      status: 'ACTIVE',
      createdByUserId: adminUserId,
    });

    // Request erasure / anonymization
    const res = await request(app)
      .post(`/api/v1/schools/${schoolId}/students/${studentId}/anonymize`)
      .set('Cookie', adminCookies)
      .set('x-csrf-token', adminCsrf);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify student was anonymized
    const [st] = await db.select().from(students).where(eq(students.id, studentId));
    expect(st.name).toBe('ANONYMIZED');
    expect(st.nameBn).toBeNull();
    expect(st.photoUrl).toBeNull();
    expect(st.banglarShikshaId).toBeNull();
    expect(st.dateOfBirth).toBeNull();
    expect(st.studentCode).toContain('ANON-');

    // Verify credentials were revoked
    const creds = await db.select().from(rfidCredentials).where(eq(rfidCredentials.studentId, studentId));
    expect(creds.every((c) => c.status === 'REVOKED')).toBe(true);

    // Verify guardian contact was redacted
    const [g] = await db.select().from(guardians).where(eq(guardians.id, guardianId));
    expect(g.name).toBe('REDACTED');
    expect(g.phoneNumber).toBe('0000000000');
  });

  it('runRetention: purges telemetry beyond retention thresholds in batches', async () => {
    // Configure retention policy
    await db.insert(retentionPolicies).values({
      schoolId,
      scanEventsDays: 180,
      notificationLogDays: 365,
    }).onConflictDoNothing();

    // Create a reader
    const [reader] = await db.insert(rfidReaders).values({
      schoolId,
      deviceId: `R-RET-${Date.now()}`,
      name: 'Retention Gate',
      status: 'ACTIVE',
    }).returning();

    // Insert an expired scan event (200 days old)
    const oldTimestamp = new Date(Date.now() - 200 * 86400 * 1000);
    const [oldScan] = await db.insert(rfidScanEvents).values({
      schoolId,
      readerId: reader.id,
      clientEventId: `old-scan-${Date.now()}`,
      scanTimestamp: oldTimestamp,
      decision: 'ACCEPTED',
    }).returning();

    // Insert a recent scan event (10 days old)
    const recentTimestamp = new Date(Date.now() - 10 * 86400 * 1000);
    const [recentScan] = await db.insert(rfidScanEvents).values({
      schoolId,
      readerId: reader.id,
      clientEventId: `recent-scan-${Date.now()}`,
      scanTimestamp: recentTimestamp,
      decision: 'ACCEPTED',
    }).returning();

    // Run retention purge
    const results = await runRetention();
    const schoolResult = results.find((r) => r.schoolId === schoolId);
    expect(schoolResult).toBeDefined();
    expect(schoolResult!.scanEventsDeleted).toBeGreaterThanOrEqual(1);

    // Verify old scan was deleted while recent scan remains
    const remainingOld = await db.select().from(rfidScanEvents).where(eq(rfidScanEvents.id, oldScan.id));
    expect(remainingOld.length).toBe(0);

    const remainingRecent = await db.select().from(rfidScanEvents).where(eq(rfidScanEvents.id, recentScan.id));
    expect(remainingRecent.length).toBe(1);
  });
});
