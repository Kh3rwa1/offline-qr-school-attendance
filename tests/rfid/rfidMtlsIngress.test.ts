import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readerAuthMiddleware, ReaderAuthenticatedRequest } from '../../src/middleware/readerAuthMiddleware';
import { readerService } from '../../src/services/rfid/readerService';
import { credentialService } from '../../src/services/rfid/credentialService';
import { computeCanonicalSignature } from '../../src/services/rfid/cryptoService';
import { runMigrations } from '../../src/db/migrate';
import { seedDatabase } from '../../src/db/seed';
import { db } from '../../src/db';
import { students, attendanceSessions } from '../../src/db/schema';
import crypto from 'crypto';
import { Response } from 'express';

describe('mTLS Ingress Peer Certificate Enforcement Suite', () => {
  let schoolAId: string;
  let readerId: string;
  let credentialDigest: string;
  let sessionId: string;
  const certFingerprint = 'aa:bb:cc:dd:ee:ff:11:22:33:44:55:66:77:88:99:00:11:22:33:44';
  const secret = 'mtls-ingress-test-secret-32-chars-long';
  let origMtls: string | undefined;

  beforeAll(async () => {
    origMtls = process.env.RFID_ENFORCE_INGRESS_MTLS;
    process.env.RFID_ENFORCE_INGRESS_MTLS = 'true';
    process.env.RFID_HMAC_SECRET = secret;
    process.env.NODE_ENV = 'test';

    await runMigrations();
    const seeded = await seedDatabase();
    schoolAId = seeded.schoolA.id;

    // Register certificate-bound reader
    const reader = await readerService.registerReader({
      schoolId: schoolAId,
      deviceId: 'dev_mtls_reader_01',
      name: 'mTLS Gate Reader',
      adapterType: 'GATEWAY',
      certificateFingerprint: certFingerprint,
      sharedSecret: secret,
    });
    const approved = await readerService.approveReader(reader.id, schoolAId);
    readerId = approved.id;

    // Create student & credential
    const [student] = await db
      .insert(students)
      .values({
        schoolId: schoolAId,
        studentCode: 'MTLS-01',
        name: 'mTLS Test Student',
        status: 'ACTIVE',
      })
      .returning();

    const cred = await credentialService.enrollCredential({
      schoolId: schoolAId,
      studentId: student.id,
      credentialDigest: 'digest_mtls_test_card',
      securityMode: 'SECURE',
      keyVersion: 1,
      operatorUserId: seeded.adminUser.id,
    });
    await credentialService.activateCredential(cred.id, schoolAId, seeded.adminUser.id);
    credentialDigest = cred.credentialDigest;

    // Open session
    const [session] = await db
      .insert(attendanceSessions)
      .values({
        schoolId: schoolAId,
        classSectionId: seeded.schoolAClass5A.id,
        teacherId: seeded.teacherUser.id,
        sessionDate: new Date().toISOString().split('T')[0],
        sessionType: 'DAILY',
        status: 'OPEN',
      })
      .returning();
    sessionId = session.id;
  });

  afterAll(() => {
    process.env.RFID_ENFORCE_INGRESS_MTLS = origMtls;
  });

  function createMockReqRes(headers: Record<string, string>, body: Record<string, any>) {
    const req: Partial<ReaderAuthenticatedRequest> = {
      params: { schoolId: schoolAId },
      headers,
      body,
    };

    let resStatus = 200;
    let resJson: any = null;

    const res: Partial<Response> = {
      status: (code: number) => {
        resStatus = code;
        return res as Response;
      },
      json: (data: any) => {
        resJson = data;
        return res as Response;
      },
    };

    return {
      req: req as ReaderAuthenticatedRequest,
      res: res as Response,
      getStatus: () => resStatus,
      getJson: () => resJson,
    };
  }

  function buildEnvelope(nonceStr?: string, eventIdStr?: string) {
    const timestamp = new Date().toISOString();
    const nonce = nonceStr || `nonce_mtls_${Date.now()}_${Math.random()}`;
    const clientEventId = eventIdStr || `evt_mtls_${Date.now()}_${Math.random()}`;
    const proofPayload = `secure-proof-v1:${credentialDigest}:${nonce}:${timestamp}`;
    const secureProof = crypto.createHmac('sha256', secret).update(proofPayload).digest('hex');

    const envelope: Record<string, any> = {
      version: 1,
      schoolId: schoolAId,
      readerId,
      credentialDigest,
      secureProof,
      readerTimestamp: timestamp,
      sequenceNumber: 1,
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

  it('Allows scan request when valid matching client certificate fingerprint header is present', async () => {
    const envelope = buildEnvelope();
    const mock = createMockReqRes(
      {
        'x-reader-id': readerId,
        'x-reader-signature': envelope.signature,
        'x-reader-timestamp': envelope.readerTimestamp,
        'x-client-cert-fingerprint': certFingerprint,
      },
      envelope
    );

    let nextCalled = false;
    await readerAuthMiddleware(mock.req, mock.res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(mock.req.readerContext?.readerId).toBe(readerId);
  });

  it('Rejects scan request with 403 when client certificate fingerprint header is missing', async () => {
    const envelope = buildEnvelope();
    const mock = createMockReqRes(
      {
        'x-reader-id': readerId,
        'x-reader-signature': envelope.signature,
        'x-reader-timestamp': envelope.readerTimestamp,
      },
      envelope
    );

    let nextCalled = false;
    await readerAuthMiddleware(mock.req, mock.res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(mock.getStatus()).toBe(403);
    expect(mock.getJson().message).toContain('READER_MTLS_CERTIFICATE_MISMATCH');
  });

  it('Rejects scan request with 403 when spoofed or mismatched client certificate fingerprint is provided', async () => {
    const envelope = buildEnvelope();
    const mock = createMockReqRes(
      {
        'x-reader-id': readerId,
        'x-reader-signature': envelope.signature,
        'x-reader-timestamp': envelope.readerTimestamp,
        'x-client-cert-fingerprint': 'ff:ff:ff:ff:ff:ff:ff:ff:ff:ff:ff:ff:ff:ff:ff:ff:ff:ff:ff:ff',
      },
      envelope
    );

    let nextCalled = false;
    await readerAuthMiddleware(mock.req, mock.res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(mock.getStatus()).toBe(403);
    expect(mock.getJson().message).toContain('READER_MTLS_CERTIFICATE_MISMATCH');
  });
});
