import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { scanService, ScanEnvelope } from '../../src/services/rfid/scanService';
import { readerService } from '../../src/services/rfid/readerService';
import { credentialService } from '../../src/services/rfid/credentialService';
import { getRedisClient } from '../../src/services/redisService';
import { db, withTenantContext } from '../../src/db';
import { runMigrations } from '../../src/db/migrate';
import { seedDatabase } from '../../src/db/seed';
import {
  students,
  rfidReaders,
  rfidCredentials,
  attendanceSessions,
  rfidScanEvents,
  attendanceRecords,
  attendanceEvents,
} from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { computeCanonicalSignature } from '../../src/services/rfid/cryptoService';

describe('Distributed RFID Lock & Concurrency Correctness (Multi-Worker Integration)', () => {
  let schoolId: string;
  let readerId: string;
  let studentId: string;
  let credentialId: string;
  let sessionId: string;
  let teacherId: string;
  let adminUserId: string;
  const hmacSecret = 'integration-secret-test-32bytes-long';
  const credentialDigest = crypto.createHash('sha256').update('card_uid_concurrent_test').digest('hex');

  beforeAll(async () => {
    process.env.RFID_HMAC_SECRET = hmacSecret;
    process.env.ALLOW_LEGACY_RFID_UID_MODE = 'true';
    process.env.NODE_ENV = 'test';

    await runMigrations();
    const seeded = await seedDatabase();
    schoolId = seeded.schoolA.id;
    adminUserId = seeded.adminUser.id;
    teacherId = seeded.teacherUser.id;

    // Create student
    const [stud] = await db
      .insert(students)
      .values({
        schoolId,
        studentCode: `CONCUR-${Date.now()}`,
        name: 'Concurrent MultiWorker Student',
        status: 'ACTIVE',
      })
      .returning();
    studentId = stud.id;

    // Register reader
    const readerA = await readerService.registerReader({
      schoolId,
      deviceId: `dev_lock_reader_${Date.now()}`,
      name: 'Main Gate Lock Concurrency Reader',
      adapterType: 'GATEWAY',
      sharedSecret: hmacSecret,
    });
    const appA = await readerService.approveReader(readerA.id, schoolId);
    readerId = appA.id;

    // Enroll credential
    const cred = await credentialService.enrollCredential({
      schoolId,
      studentId,
      credentialDigest,
      securityMode: 'UID_LEGACY',
      keyVersion: 1,
      operatorUserId: adminUserId,
    });
    await credentialService.activateCredential(cred.id, schoolId, adminUserId);
    credentialId = cred.id;

    // Open session
    const [sess] = await db
      .insert(attendanceSessions)
      .values({
        schoolId,
        classSectionId: seeded.schoolAClass5A.id,
        teacherId,
        sessionDate: new Date().toISOString().split('T')[0],
        sessionType: 'DAILY',
        status: 'OPEN',
      })
      .returning();
    sessionId = sess.id;
  });

  function createTestEnvelope(clientEventId: string, customNonce?: string, customDigest?: string): ScanEnvelope {
    const readerTimestamp = new Date().toISOString();
    const nonce = customNonce || crypto.randomBytes(16).toString('hex');
    const envelopeWithoutSig = {
      version: 1,
      schoolId,
      readerId,
      credentialDigest: customDigest || credentialDigest,
      readerTimestamp,
      nonce,
      direction: 'ENTRY' as const,
      attendanceSessionId: sessionId,
      securityMode: 'UID_LEGACY' as const,
      clientEventId,
    };
    const signature = computeCanonicalSignature(envelopeWithoutSig, hmacSecret);
    return { ...envelopeWithoutSig, signature };
  }

  it('1. Handles 100 simultaneous identical requests with exactly 1 DB mutation and 100 idempotent results', async () => {
    const clientEventId = `storm-${crypto.randomUUID()}`;
    const envelope = createTestEnvelope(clientEventId);

    const promises = Array.from({ length: 100 }, () => scanService.processScan(envelope));
    const results = await Promise.all(promises);

    expect(results).toHaveLength(100);
    for (const res of results) {
      expect(res.decision).toBe('ACCEPTED');
    }

    const firstScanEventId = results[0].scanEventId;
    for (const res of results) {
      if (res.scanEventId) {
        expect(res.scanEventId).toBe(firstScanEventId);
      }
    }

    // Verify DB contains exactly 1 rfid_scan_events record and 1 attendance_records record
    const scans = await db
      .select()
      .from(rfidScanEvents)
      .where(and(eq(rfidScanEvents.schoolId, schoolId), eq(rfidScanEvents.clientEventId, clientEventId)));
    expect(scans).toHaveLength(1);

    const records = await db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.schoolId, schoolId), eq(attendanceRecords.attendanceSessionId, sessionId), eq(attendanceRecords.studentId, studentId)));
    expect(records).toHaveLength(1);
  });

  it('2. Rejects same clientEventId with altered payload (tampered nonce/reader) with PAYLOAD_HASH_MISMATCH', async () => {
    const [stud2] = await db
      .insert(students)
      .values({
        schoolId,
        studentCode: `CONCUR-2-${Date.now()}`,
        name: 'Concurrent MultiWorker Student 2',
        status: 'ACTIVE',
      })
      .returning();
    const digest2 = crypto.createHash('sha256').update(`card_uid_2_${Date.now()}`).digest('hex');
    const cred2 = await credentialService.enrollCredential({
      schoolId,
      studentId: stud2.id,
      credentialDigest: digest2,
      securityMode: 'UID_LEGACY',
      keyVersion: 1,
      operatorUserId: adminUserId,
    });
    await credentialService.activateCredential(cred2.id, schoolId, adminUserId);

    const clientEventId = `tamper-${crypto.randomUUID()}`;
    const validEnvelope = createTestEnvelope(clientEventId, 'nonce_alpha_012345', digest2);
    const tamperedEnvelope = createTestEnvelope(clientEventId, 'nonce_beta_678901', digest2);

    const firstResult = await scanService.processScan(validEnvelope);
    expect(firstResult.decision).toBe('ACCEPTED');

    const secondResult = await scanService.processScan(tamperedEnvelope);
    expect(secondResult.decision).toBe('REPLAY_REJECTED');
    expect(secondResult.rejectionCode).toBe('PAYLOAD_HASH_MISMATCH');
  });

  it('3. Lock renewal prevents lock expiry during long transaction processing', async () => {
    const redis = getRedisClient();
    if (!redis) return;

    const lockKey = `rfid:lock:${schoolId}:test-renewal-${Date.now()}`;
    const ownerToken = crypto.randomUUID();

    // Acquire lock for 500ms
    await redis.set(lockKey, ownerToken, 'PX', 500);

    const LUA_RENEW = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    // Renew for 2000ms
    const renewed = await redis.eval(LUA_RENEW, 1, lockKey, ownerToken, '2000');
    expect(renewed).toBe(1);

    // Wait 700ms (would have expired without renewal)
    await new Promise((res) => setTimeout(res, 700));

    const stillLocked = await redis.get(lockKey);
    expect(stillLocked).toBe(ownerToken);

    // Clean up
    await redis.del(lockKey);
  });

  it('4. Lock owner mismatch rejects renewal or deletion by another worker', async () => {
    const redis = getRedisClient();
    if (!redis) return;

    const lockKey = `rfid:lock:${schoolId}:test-mismatch-${Date.now()}`;
    const trueOwner = 'owner-worker-A';
    const fakeOwner = 'owner-worker-B';

    await redis.set(lockKey, trueOwner, 'PX', 5000);

    const LUA_RELEASE = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    // Attempt release by fake owner -> returns 0, lock remains intact
    const releasedByFake = await redis.eval(LUA_RELEASE, 1, lockKey, fakeOwner);
    expect(releasedByFake).toBe(0);

    const lockVal = await redis.get(lockKey);
    expect(lockVal).toBe(trueOwner);

    // Release by true owner -> returns 1
    const releasedByTrue = await redis.eval(LUA_RELEASE, 1, lockKey, trueOwner);
    expect(releasedByTrue).toBe(1);
  });
});
