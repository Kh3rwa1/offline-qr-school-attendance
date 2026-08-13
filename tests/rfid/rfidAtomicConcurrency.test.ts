import { describe, it, expect, beforeAll } from 'vitest';
import { scanService } from '../../src/services/rfid/scanService';
import { readerService } from '../../src/services/rfid/readerService';
import { credentialService } from '../../src/services/rfid/credentialService';
import { computeCanonicalSignature } from '../../src/services/rfid/cryptoService';
import { runMigrations } from '../../src/db/migrate';
import { seedDatabase } from '../../src/db/seed';
import { db } from '../../src/db';
import { students, attendanceSessions, rfidScanEvents, attendanceRecords, attendanceEvents } from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

describe('RFID Atomic Replay & Concurrency Suite', () => {
  let schoolAId: string;
  let readerAId: string;
  let adminUserId: string;
  let classSectionId: string;
  let teacherUserId: string;
  let sharedSessionId: string;
  const secret = 'concurrency-test-secret-32-chars-env';

  beforeAll(async () => {
    process.env.RFID_HMAC_SECRET = secret;
    process.env.NODE_ENV = 'test';

    await runMigrations();
    const seeded = await seedDatabase();
    schoolAId = seeded.schoolA.id;
    adminUserId = seeded.adminUser.id;
    classSectionId = seeded.schoolAClass5A.id;
    teacherUserId = seeded.teacherUser.id;

    // Register reader
    const readerA = await readerService.registerReader({
      schoolId: schoolAId,
      deviceId: 'dev_atomic_reader_01',
      name: 'Main Gate Atomic Reader',
      adapterType: 'GATEWAY',
      sharedSecret: secret,
    });
    const appA = await readerService.approveReader(readerA.id, schoolAId);
    readerAId = appA.id;

    // Open single attendance session
    const [session] = await db
      .insert(attendanceSessions)
      .values({
        schoolId: schoolAId,
        classSectionId,
        teacherId: teacherUserId,
        sessionDate: new Date().toISOString().split('T')[0],
        sessionType: 'DAILY',
        status: 'OPEN',
      })
      .returning();
    sharedSessionId = session.id;
  });

  async function createTestStudentAndCredential(code: string, digest: string) {
    const [student] = await db
      .insert(students)
      .values({
        schoolId: schoolAId,
        studentCode: code,
        name: `Student ${code}`,
        status: 'ACTIVE',
      })
      .returning();

    const cred = await credentialService.enrollCredential({
      schoolId: schoolAId,
      studentId: student.id,
      credentialDigest: digest,
      securityMode: 'SECURE',
      keyVersion: 1,
      operatorUserId: adminUserId,
    });
    await credentialService.activateCredential(cred.id, schoolAId, adminUserId);

    return { studentId: student.id, credentialDigest: digest, sessionId: sharedSessionId };
  }

  function buildEnvelope(schoolId: string, readerId: string, credentialDigest: string, sessionId: string, seq: number, nonceStr?: string, eventIdStr?: string) {
    const timestamp = new Date().toISOString();
    const nonce = nonceStr || `nonce_atomic_${Date.now()}_${Math.random()}`;
    const clientEventId = eventIdStr || `evt_atomic_${Date.now()}_${Math.random()}`;
    const proofPayload = `secure-proof-v1:${credentialDigest}:${nonce}:${timestamp}`;
    const secureProof = crypto.createHmac('sha256', secret).update(proofPayload).digest('hex');

    const envelope: Record<string, any> = {
      version: 1,
      schoolId,
      readerId,
      credentialDigest,
      secureProof,
      readerTimestamp: timestamp,
      sequenceNumber: seq,
      nonce,
      direction: 'NONE',
      attendanceSessionId: sessionId,
      securityMode: 'SECURE',
      clientEventId,
      isOffline: false,
    };
    envelope.signature = computeCanonicalSignature(envelope, secret);
    return envelope;
  }

  it('100 concurrent requests of the exact same event return idempotent ACCEPTED decision with exactly 1 database event created', async () => {
    const fixture = await createTestStudentAndCredential('ATOMIC-100', 'digest_atomic_100');
    const nonce = `nonce_concurrent_${Date.now()}`;
    const eventId = `evt_concurrent_${Date.now()}`;
    const envelope = buildEnvelope(schoolAId, readerAId, fixture.credentialDigest, fixture.sessionId, 100, nonce, eventId);

    const promises = Array.from({ length: 100 }, () => scanService.processScan({ ...envelope } as any));
    const results = await Promise.all(promises);

    expect(results).toHaveLength(100);
    expect(results.every((r) => r.decision === 'ACCEPTED')).toBe(true);

    const dbEvents = await db
      .select()
      .from(rfidScanEvents)
      .where(and(eq(rfidScanEvents.schoolId, schoolAId), eq(rfidScanEvents.clientEventId, eventId)));
    expect(dbEvents).toHaveLength(1);

    const dbAttEvents = await db
      .select()
      .from(attendanceEvents)
      .where(and(eq(attendanceEvents.schoolId, schoolAId), eq(attendanceEvents.studentId, fixture.studentId)));
    expect(dbAttEvents).toHaveLength(1);

    const dbRecords = await db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.schoolId, schoolAId), eq(attendanceRecords.studentId, fixture.studentId)));
    expect(dbRecords).toHaveLength(1);
  });

  it('Rejects duplicate nonce submission with different event payload', async () => {
    const fixture = await createTestStudentAndCredential('ATOMIC-REUSE', 'digest_atomic_reuse');
    const nonce = `nonce_reuse_test_${Date.now()}`;
    const env1 = buildEnvelope(schoolAId, readerAId, fixture.credentialDigest, fixture.sessionId, 200, nonce, `evt_reuse_1_${Date.now()}`);
    const env2 = buildEnvelope(schoolAId, readerAId, fixture.credentialDigest, fixture.sessionId, 201, nonce, `evt_reuse_2_${Date.now()}`);

    const res1 = await scanService.processScan(env1 as any);
    expect(res1.decision).toBe('ACCEPTED');

    const res2 = await scanService.processScan(env2 as any);
    expect(res2.decision).toBe('REPLAY_REJECTED');
    expect(res2.rejectionCode).toBe('NONCE_REUSED');
  });

  it('Rejects out-of-order sequence number submission', async () => {
    const fixture = await createTestStudentAndCredential('ATOMIC-SEQ', 'digest_atomic_seq');
    const envHigh = buildEnvelope(schoolAId, readerAId, fixture.credentialDigest, fixture.sessionId, 500);
    const envLow = buildEnvelope(schoolAId, readerAId, fixture.credentialDigest, fixture.sessionId, 499);

    const resHigh = await scanService.processScan(envHigh as any);
    expect(resHigh.decision).toBe('ACCEPTED');

    const resLow = await scanService.processScan(envLow as any);
    expect(resLow.decision).toBe('REPLAY_REJECTED');
    expect(resLow.rejectionCode).toBe('OUT_OF_ORDER_SEQUENCE');
  });
});
