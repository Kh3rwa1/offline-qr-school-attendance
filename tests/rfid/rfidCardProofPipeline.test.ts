import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { scanService } from '../../src/services/rfid/scanService';
import { readerService } from '../../src/services/rfid/readerService';
import { credentialService } from '../../src/services/rfid/credentialService';
import { computeCanonicalSignature, computeDiversifiedKey, aesCmac } from '../../src/services/rfid/cryptoService';
import { runMigrations } from '../../src/db/migrate';
import { seedDatabase } from '../../src/db/seed';
import { db } from '../../src/db';
import { students, attendanceSessions } from '../../src/db/schema';
import crypto from 'crypto';

describe('DESFire Card Proof End-to-End Scan Pipeline Suite', () => {
  let schoolAId: string;
  let readerAId: string;
  let adminUserId: string;
  let teacherUserId: string;
  let sharedSessionId: string;
  const masterKey = '00112233445566778899aabbccddeeff';
  const readerSecret = 'reader-secret-for-card-proof-test-32ch';

  beforeAll(async () => {
    process.env.RFID_HMAC_SECRET = masterKey;
    process.env.RFID_CARD_MASTER_KEY = masterKey;
    process.env.NODE_ENV = 'test';

    await runMigrations();
    const seeded = await seedDatabase();
    schoolAId = seeded.schoolA.id;
    adminUserId = seeded.adminUser.id;
    teacherUserId = seeded.teacherUser.id;

    const reader = await readerService.registerReader({
      schoolId: schoolAId,
      deviceId: 'dev_card_proof_reader_01',
      name: 'Card Proof Gate Reader',
      adapterType: 'GATEWAY',
      sharedSecret: readerSecret,
    });
    const approved = await readerService.approveReader(reader.id, schoolAId);
    readerAId = approved.id;

    const [session] = await db
      .insert(attendanceSessions)
      .values({
        schoolId: schoolAId,
        classSectionId: seeded.schoolAClass5A.id,
        teacherId: teacherUserId,
        sessionDate: new Date().toISOString().split('T')[0],
        sessionType: 'DAILY',
        status: 'OPEN',
      })
      .returning();
    sharedSessionId = session.id;
  });

  function generateValidCardProof(cardUid: string, readerChallenge: string, txCounter: number, masterKeyHex: string) {
    const divKey = computeDiversifiedKey(masterKeyHex, cardUid, 'school_attendance');
    const txBuf = Buffer.alloc(4);
    txBuf.writeUInt32BE(txCounter, 0);
    const challengeBuf = Buffer.from(readerChallenge, 'hex');
    const proofData = Buffer.concat([Buffer.from('desfire-ev2-proof-v1', 'utf8'), txBuf, challengeBuf]);
    return aesCmac(divKey, proofData).toString('hex');
  }

  it('Accepts scan envelope with valid DESFire EV2/EV3 card AES-CMAC proof', async () => {
    const [student] = await db
      .insert(students)
      .values({
        schoolId: schoolAId,
        studentCode: 'CARD-PROOF-001',
        name: 'Student Card Proof',
        status: 'ACTIVE',
      })
      .returning();

    const credDigest = 'digest_card_proof_001';
    const cred = await credentialService.enrollCredential({
      schoolId: schoolAId,
      studentId: student.id,
      credentialDigest: credDigest,
      securityMode: 'SECURE',
      keyVersion: 1,
      operatorUserId: adminUserId,
    });
    await credentialService.activateCredential(cred.id, schoolAId, adminUserId);

    const cardUid = '04a1b2c3d4e5f6';
    const readerChallenge = 'aabbccddeeff00112233445566778899';
    const txCounter = 42;
    const cardProof = generateValidCardProof(cardUid, readerChallenge, txCounter, masterKey);

    const timestamp = new Date().toISOString();
    const nonce = `nonce_cp_${Date.now()}`;
    const proofPayload = `secure-proof-v1:${credDigest}:${nonce}:${timestamp}`;
    const secureProof = crypto.createHmac('sha256', readerSecret).update(proofPayload).digest('hex');

    const envelope: Record<string, any> = {
      version: 1,
      schoolId: schoolAId,
      readerId: readerAId,
      credentialDigest: credDigest,
      secureProof,
      readerTimestamp: timestamp,
      sequenceNumber: 1000,
      nonce,
      direction: 'NONE',
      attendanceSessionId: sharedSessionId,
      securityMode: 'SECURE',
      clientEventId: `evt_cp_${Date.now()}`,
      isOffline: false,
      cardProof,
      cardUid,
      readerChallenge,
      transactionCounter: txCounter,
    };
    envelope.signature = computeCanonicalSignature(envelope, readerSecret);

    const res = await scanService.processScan(envelope as any);
    expect(res.decision).toBe('ACCEPTED');
  });

  it('Rejects scan envelope with tampered cardProof (invalid AES-CMAC)', async () => {
    const [student] = await db
      .insert(students)
      .values({
        schoolId: schoolAId,
        studentCode: 'CARD-PROOF-002',
        name: 'Student Card Proof 2',
        status: 'ACTIVE',
      })
      .returning();

    const credDigest = 'digest_card_proof_002';
    const cred = await credentialService.enrollCredential({
      schoolId: schoolAId,
      studentId: student.id,
      credentialDigest: credDigest,
      securityMode: 'SECURE',
      keyVersion: 1,
      operatorUserId: adminUserId,
    });
    await credentialService.activateCredential(cred.id, schoolAId, adminUserId);

    const cardUid = '04a1b2c3d4e5f6';
    const readerChallenge = 'aabbccddeeff00112233445566778899';
    const txCounter = 43;
    const tamperedCardProof = 'deadbeefcafebabedeadbeefcafebabe';

    const timestamp = new Date().toISOString();
    const nonce = `nonce_cp_bad_${Date.now()}`;
    const proofPayload = `secure-proof-v1:${credDigest}:${nonce}:${timestamp}`;
    const secureProof = crypto.createHmac('sha256', readerSecret).update(proofPayload).digest('hex');

    const envelope: Record<string, any> = {
      version: 1,
      schoolId: schoolAId,
      readerId: readerAId,
      credentialDigest: credDigest,
      secureProof,
      readerTimestamp: timestamp,
      sequenceNumber: 1001,
      nonce,
      direction: 'NONE',
      attendanceSessionId: sharedSessionId,
      securityMode: 'SECURE',
      clientEventId: `evt_cp_bad_${Date.now()}`,
      isOffline: false,
      cardProof: tamperedCardProof,
      cardUid,
      readerChallenge,
      transactionCounter: txCounter,
    };
    envelope.signature = computeCanonicalSignature(envelope, readerSecret);

    const res = await scanService.processScan(envelope as any);
    expect(res.decision).toBe('REPLAY_REJECTED');
    expect(res.rejectionCode).toBe('INVALID_CARD_PROOF');
  });
});
