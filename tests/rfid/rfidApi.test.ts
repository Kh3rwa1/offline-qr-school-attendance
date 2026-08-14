import { describe, it, expect, beforeAll } from 'vitest';
import { rfidRouter } from '../../src/routes/rfidRoutes';
import { runMigrations } from '../../src/db/migrate';
import { seedDatabase } from '../../src/db/seed';
import { readerService } from '../../src/services/rfid/readerService';
import { credentialService } from '../../src/services/rfid/credentialService';
import { computeCanonicalSignature } from '../../src/services/rfid/cryptoService';
import { db } from '../../src/db';
import { students, attendanceSessions } from '../../src/db/schema';
import crypto from 'crypto';
import EventEmitter from 'events';

class MockResponse extends EventEmitter {
  statusCode: number = 200;
  headers: Record<string, string> = {};
  body: any = null;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(data: any) {
    this.body = data;
    this.emit('finish');
    return this;
  }

  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
    return this;
  }
}

describe('RFID Router & Middleware Integration Suite', () => {
  let schoolId: string;
  let readerId: string;
  let student1Id: string;
  let student2Id: string;
  let sessionId: string;
  let credentialDigest1: string;
  let credentialDigest2: string;
  let adminUserId: string;
  const hmacSecret = 'test-secret-32-chars-length-environment';

  beforeAll(async () => {
    process.env.RFID_HMAC_SECRET = hmacSecret;
    process.env.NODE_ENV = 'test';

    await runMigrations();
    const seeded = await seedDatabase();
    schoolId = seeded.schoolA.id;
    adminUserId = seeded.adminUser.id;

    // Register & approve RFID reader
    const reader = await readerService.registerReader({
      schoolId,
      deviceId: 'api_test_reader_01',
      name: 'Main Gate Reader',
      adapterType: 'GATEWAY',
      securityCapability: 'DESFIRE_EV2',
      sharedSecret: hmacSecret,
    });
    const approved = await readerService.approveReader(reader.id, schoolId);
    readerId = approved.id;

    // Create student 1 & 2 for School A
    const [student1] = await db
      .insert(students)
      .values({
        schoolId,
        studentCode: 'API-STD-A01',
        name: 'API Test Student 1',
        status: 'ACTIVE',
      })
      .returning();
    student1Id = student1.id;

    const [student2] = await db
      .insert(students)
      .values({
        schoolId,
        studentCode: 'API-STD-A02',
        name: 'API Test Student 2',
        status: 'ACTIVE',
      })
      .returning();
    student2Id = student2.id;

    // Create active attendance session for School A
    const [session] = await db
      .insert(attendanceSessions)
      .values({
        schoolId,
        classSectionId: seeded.schoolAClass5A.id,
        teacherId: seeded.teacherUser.id,
        sessionDate: '2026-08-13',
        sessionType: 'DAILY',
        status: 'OPEN',
      })
      .returning();
    sessionId = session.id;

    // Enroll card credentials
    const enrolled1 = await credentialService.enrollCredential({
      schoolId,
      studentId: student1Id,
      credentialDigest: 'digest_api_test_student_01',
      securityMode: 'SECURE',
      keyVersion: 1,
      operatorUserId: seeded.adminUser.id,
    });
    await credentialService.activateCredential(enrolled1.id, schoolId);
    credentialDigest1 = enrolled1.credentialDigest;

    const enrolled2 = await credentialService.enrollCredential({
      schoolId,
      studentId: student2Id,
      credentialDigest: 'digest_api_test_student_02',
      securityMode: 'SECURE',
      keyVersion: 1,
      operatorUserId: seeded.adminUser.id,
    });
    await credentialService.activateCredential(enrolled2.id, schoolId);
    credentialDigest2 = enrolled2.credentialDigest;
  });

  let seqCounter = 100;
  function buildSignedEnvelope(digest: string, overrides: Record<string, any> = {}) {
    const timestamp = new Date().toISOString();
    const nonce = overrides.nonce || `nonce_api_${Date.now()}_${Math.random()}`;
    const clientEventId = overrides.clientEventId || `evt_api_${Date.now()}_${Math.random()}`;
    seqCounter += 1;
    
    // Secure proof MAC
    const proofPayload = `secure-proof-v1:${digest}:${nonce}:${timestamp}`;
    const secureProof = overrides.secureProof !== undefined
      ? overrides.secureProof
      : crypto.createHmac('sha256', hmacSecret).update(proofPayload).digest('hex');

    const envelope: Record<string, any> = {
      version: 1,
      schoolId,
      readerId,
      credentialDigest: digest,
      secureProof,
      readerTimestamp: timestamp,
      sequenceNumber: overrides.sequenceNumber !== undefined ? overrides.sequenceNumber : seqCounter,
      nonce,
      direction: 'NONE',
      attendanceSessionId: sessionId,
      securityMode: 'SECURE',
      clientEventId,
      isOffline: false,
      ...overrides,
    };

    const signature = computeCanonicalSignature(envelope, hmacSecret);
    envelope.signature = signature;
    return envelope;
  }

  function invokeScanEndpoint(pathSchoolId: string, headers: Record<string, string>, body: any): Promise<MockResponse> {
    return new Promise((resolve) => {
      const req: any = {
        method: 'POST',
        url: `/${pathSchoolId}/rfid/scans`,
        originalUrl: `/${pathSchoolId}/rfid/scans`,
        params: { schoolId: pathSchoolId },
        headers: headers,
        body: body,
      };

      const res = new MockResponse();
      res.on('finish', () => resolve(res));

      rfidRouter(req, res as any, () => {
        resolve(res);
      });
    });
  }

  it('POST /:schoolId/rfid/scans accepts valid signed scan request', async () => {
    const envelope = buildSignedEnvelope(credentialDigest1);
    const res = await invokeScanEndpoint(schoolId, {
      'x-reader-id': readerId,
      'x-reader-signature': envelope.signature,
      'x-reader-timestamp': envelope.readerTimestamp,
    }, envelope);

    expect(res.statusCode).toBe(200);
    expect(res.body.decision).toBe('ACCEPTED');
    expect(res.body.studentId).toBe(student1Id);
    expect(res.body.scanEventId).toBeDefined();
  });

  it('POST /:schoolId/rfid/scans rejects altered request body with signature mismatch', async () => {
    const envelope = buildSignedEnvelope(credentialDigest2);
    envelope.credentialDigest = 'tampered_digest_value'; // Tampered body

    const res = await invokeScanEndpoint(schoolId, {
      'x-reader-id': readerId,
      'x-reader-signature': envelope.signature,
      'x-reader-timestamp': envelope.readerTimestamp,
    }, envelope);

    expect(res.statusCode).toBe(400);
    expect(res.body.decision).toBe('REPLAY_REJECTED');
    expect(res.body.rejectionCode).toBe('INVALID_SIGNATURE');
  });

  it('POST /:schoolId/rfid/scans rejects invalid secure proof in SECURE mode', async () => {
    const envelope = buildSignedEnvelope(credentialDigest2, { secureProof: 'invalid_proof' });
    const res = await invokeScanEndpoint(schoolId, {
      'x-reader-id': readerId,
      'x-reader-signature': envelope.signature,
      'x-reader-timestamp': envelope.readerTimestamp,
    }, envelope);

    expect(res.statusCode).toBe(400);
    expect(res.body.decision).toBe('REPLAY_REJECTED');
    expect(res.body.rejectionCode).toBe('INVALID_SECURE_PROOF');
  });

  it('POST /:schoolId/rfid/scans rejects duplicate nonce replay', async () => {
    const [freshStudent] = await db
      .insert(students)
      .values({
        schoolId,
        studentCode: 'API-STD-NONCE',
        name: 'API Nonce Test Student',
        status: 'ACTIVE',
      })
      .returning();

    const freshCred = await credentialService.enrollCredential({
      schoolId,
      studentId: freshStudent.id,
      credentialDigest: 'digest_api_test_student_nonce',
      securityMode: 'SECURE',
      keyVersion: 1,
      operatorUserId: adminUserId,
    });
    await credentialService.activateCredential(freshCred.id, schoolId);

    const sharedNonce = `shared_nonce_replay_${Date.now()}`;
    const envelope1 = buildSignedEnvelope(freshCred.credentialDigest, { nonce: sharedNonce, clientEventId: `evt_replay_1_${Date.now()}` });
    
    // First request (accepted)
    const res1 = await invokeScanEndpoint(schoolId, {
      'x-reader-id': readerId,
      'x-reader-signature': envelope1.signature,
      'x-reader-timestamp': envelope1.readerTimestamp,
    }, envelope1);
    if (res1.statusCode !== 200) {
      console.error('res1 failed unexpectedly:', res1.body);
    }
    expect(res1.statusCode).toBe(200);

    // Replayed request with same nonce
    const envelope2 = buildSignedEnvelope(freshCred.credentialDigest, { nonce: sharedNonce, clientEventId: `evt_replay_2_${Date.now()}` });
    const res2 = await invokeScanEndpoint(schoolId, {
      'x-reader-id': readerId,
      'x-reader-signature': envelope2.signature,
      'x-reader-timestamp': envelope2.readerTimestamp,
    }, envelope2);

    expect(res2.statusCode).toBe(400);
    expect(res2.body.decision).toBe('REPLAY_REJECTED');
    expect(res2.body.rejectionCode).toBe('NONCE_REUSED');
  });

  it('POST /:schoolId/rfid/scans accepts scan with valid card-originated DESFire proof via HTTP route', async () => {
    const cardUid = '04A1B2C3D4E5F6';
    const readerChallenge = crypto.randomBytes(16).toString('hex');
    const transactionCounter = 42;
    const { computeDiversifiedKey, aesCmac } = await import('../../src/services/rfid/cryptoService');
    const divKey = computeDiversifiedKey(hmacSecret, cardUid, 'school_attendance');
    const txBuf = Buffer.alloc(4);
    txBuf.writeUInt32BE(transactionCounter, 0);
    const proofData = Buffer.concat([Buffer.from('desfire-ev2-proof-v1', 'utf8'), txBuf, Buffer.from(readerChallenge, 'hex')]);
    const cardProof = aesCmac(divKey, proofData).toString('hex');

    const [cardStudent] = await db
      .insert(students)
      .values({
        schoolId,
        studentCode: 'API-STD-CARDPROOF',
        name: 'API Card Proof Student',
        status: 'ACTIVE',
      })
      .returning();

    const cred = await credentialService.enrollCredential({
      schoolId,
      studentId: cardStudent.id,
      credentialDigest: 'digest_api_card_proof_std',
      securityMode: 'SECURE',
      keyVersion: 1,
      operatorUserId: adminUserId,
    });
    await credentialService.activateCredential(cred.id, schoolId);

    const envelope = buildSignedEnvelope(cred.credentialDigest, {
      cardProof,
      cardUid,
      readerChallenge,
      transactionCounter,
      sequenceNumber: 200,
    });

    const res = await invokeScanEndpoint(schoolId, {
      'x-reader-id': readerId,
      'x-reader-signature': envelope.signature,
      'x-reader-timestamp': envelope.readerTimestamp,
    }, envelope);

    expect(res.statusCode).toBe(200);
    expect(res.body.decision).toBe('ACCEPTED');
    expect(res.body.studentId).toBe(cardStudent.id);
  });

  it('POST /:schoolId/rfid/scans rejects scan with invalid card proof', async () => {
    const envelope = buildSignedEnvelope(credentialDigest1, {
      cardProof: '00112233445566778899aabbccddeeff',
      cardUid: '04A1B2C3D4E5F6',
      readerChallenge: 'abcdef0123456789abcdef0123456789',
      transactionCounter: 99,
      sequenceNumber: 205,
    });

    const res = await invokeScanEndpoint(schoolId, {
      'x-reader-id': readerId,
      'x-reader-signature': envelope.signature,
      'x-reader-timestamp': envelope.readerTimestamp,
    }, envelope);

    expect(res.statusCode).toBe(400);
    expect(res.body.decision).toBe('REPLAY_REJECTED');
    expect(res.body.rejectionCode).toBe('INVALID_CARD_PROOF');
  });

  it('POST /:schoolId/rfid/scans rejects out-of-order sequence number', async () => {
    const envelope = buildSignedEnvelope(credentialDigest1, {
      sequenceNumber: 50, // Lower than previous sequence (200)
    });

    const res = await invokeScanEndpoint(schoolId, {
      'x-reader-id': readerId,
      'x-reader-signature': envelope.signature,
      'x-reader-timestamp': envelope.readerTimestamp,
    }, envelope);

    expect(res.statusCode).toBe(400);
    expect(res.body.decision).toBe('REPLAY_REJECTED');
    expect(res.body.rejectionCode).toBe('OUT_OF_ORDER_SEQUENCE');
  });

  function invokeOfflineSyncEndpoint(pathSchoolId: string, headers: Record<string, string>, body: any): Promise<MockResponse> {
    return new Promise((resolve) => {
      const req: any = {
        method: 'POST',
        url: `/${pathSchoolId}/rfid/offline/sync`,
        originalUrl: `/${pathSchoolId}/rfid/offline/sync`,
        params: { schoolId: pathSchoolId },
        headers: headers,
        body: body,
      };

      const res = new MockResponse();
      res.on('finish', () => resolve(res));

      rfidRouter(req, res as any, () => {
        resolve(res);
      });
    });
  }

  it('POST /:schoolId/rfid/scans rejects request for wrong school', async () => {
    const envelope = buildSignedEnvelope(credentialDigest1);
    const wrongSchoolId = '00000000-0000-4000-8000-000000000999';

    const res = await invokeScanEndpoint(wrongSchoolId, {
      'x-reader-id': readerId,
      'x-reader-signature': envelope.signature,
      'x-reader-timestamp': envelope.readerTimestamp,
    }, envelope);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED_READER');
  });

  it('POST /:schoolId/rfid/offline/sync processes valid batch and returns accepted results with real scan IDs', async () => {
    const offlineEvent1 = buildSignedEnvelope(credentialDigest1, {
      isOffline: true,
      sequenceNumber: 300,
      clientEventId: `offline_evt_1_${Date.now()}`,
    });
    const offlineEvent2 = buildSignedEnvelope(credentialDigest2, {
      isOffline: true,
      sequenceNumber: 301,
      clientEventId: `offline_evt_2_${Date.now()}`,
    });

    const timestamp = new Date().toISOString();
    const batchPayload = JSON.stringify({ events: [offlineEvent1, offlineEvent2] });
    const batchSig = crypto.createHmac('sha256', hmacSecret).update(batchPayload).digest('hex');

    const res = await invokeOfflineSyncEndpoint(schoolId, {
      'x-reader-id': readerId,
      'x-reader-signature': batchSig,
      'x-reader-timestamp': timestamp,
    }, { events: [offlineEvent1, offlineEvent2] });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results.length).toBe(2);
    expect(res.body.results[0].decision).toBe('ACCEPTED');
    expect(res.body.results[0].scanEventId).toBeDefined();
    expect(res.body.results[1].decision).toBe('ACCEPTED');
    expect(res.body.results[1].scanEventId).toBeDefined();
  });

  it('POST /:schoolId/rfid/offline/sync rejects nonces already recorded in database history', async () => {
    const [freshStudent] = await db
      .insert(students)
      .values({
        schoolId,
        studentCode: `API-STD-NONCE-${Date.now()}`,
        name: 'Nonce Test Student',
        status: 'ACTIVE',
      })
      .returning();

    const cred = await credentialService.enrollCredential({
      schoolId,
      studentId: freshStudent.id,
      credentialDigest: `digest_nonce_test_${Date.now()}`,
      securityMode: 'SECURE',
      keyVersion: 1,
      operatorUserId: adminUserId,
    });
    await credentialService.activateCredential(cred.id, schoolId);

    const historicalNonce = `hist_nonce_${Date.now()}`;
    const cardUid = '04A1B2C3D4E5F6';
    const readerChallenge = crypto.randomBytes(16).toString('hex');
    const transactionCounter = 50;
    const { computeDiversifiedKey, aesCmac } = await import('../../src/services/rfid/cryptoService');
    const divKey = computeDiversifiedKey(hmacSecret, cardUid, 'school_attendance');
    const txBuf = Buffer.alloc(4);
    txBuf.writeUInt32BE(transactionCounter, 0);
    const proofData = Buffer.concat([Buffer.from('desfire-ev2-proof-v1', 'utf8'), txBuf, Buffer.from(readerChallenge, 'hex')]);
    const cardProof = aesCmac(divKey, proofData).toString('hex');

    const liveEnvelope = buildSignedEnvelope(cred.credentialDigest, {
      nonce: historicalNonce,
      sequenceNumber: 305,
      clientEventId: `live_evt_${Date.now()}`,
      cardProof,
      cardUid,
      readerChallenge,
      transactionCounter,
    });

    const liveRes = await invokeScanEndpoint(schoolId, {
      'x-reader-id': readerId,
      'x-reader-signature': liveEnvelope.signature,
      'x-reader-timestamp': liveEnvelope.readerTimestamp,
    }, liveEnvelope);
    expect(liveRes.statusCode).toBe(200);

    // Attempt offline sync with the same nonce under a different clientEventId
    const txBuf2 = Buffer.alloc(4);
    txBuf2.writeUInt32BE(51, 0);
    const proofData2 = Buffer.concat([Buffer.from('desfire-ev2-proof-v1', 'utf8'), txBuf2, Buffer.from(readerChallenge, 'hex')]);
    const cardProof2 = aesCmac(divKey, proofData2).toString('hex');

    const offlineReplay = buildSignedEnvelope(credentialDigest2, {
      isOffline: true,
      nonce: historicalNonce,
      sequenceNumber: 306,
      clientEventId: `offline_replay_${Date.now()}`,
      cardProof: cardProof2,
      cardUid,
      readerChallenge,
      transactionCounter: 51,
    });

    const timestamp = new Date().toISOString();
    const batchPayload = JSON.stringify({ events: [offlineReplay] });
    const batchSig = crypto.createHmac('sha256', hmacSecret).update(batchPayload).digest('hex');

    const res = await invokeOfflineSyncEndpoint(schoolId, {
      'x-reader-id': readerId,
      'x-reader-signature': batchSig,
      'x-reader-timestamp': timestamp,
    }, { events: [offlineReplay] });

    expect(res.statusCode).toBe(200);
    expect(res.body.results[0].decision).toBe('REPLAY_REJECTED');
    expect(res.body.results[0].rejectionCode).toBe('NONCE_REUSED');
  });
});
