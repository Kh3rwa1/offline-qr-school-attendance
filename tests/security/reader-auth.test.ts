import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server';
import { runMigrations } from '../../src/db/migrate';
import { seedDatabase } from '../../src/db/seed';
import { loginAs } from '../helpers/auth';
import { withTenantContext } from '../../src/db';
import { rfidReaders } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { encryptReaderSecret } from '../../src/services/rfid/readerService';

describe('Reader Auth & Token Separation', () => {
  let app: any;
  let adminAuth: { cookies: string; csrf: string; schoolId: string };
  const testReaderId = '11111111-2222-4333-8444-555555555555';
  const testDeviceId = 'FX9600-AUTH-TEST-01';
  const hmacSecret = 'super_secret_hmac_key_for_testing_1234567890';

  beforeAll(async () => {
    process.env.TEST_SERVER_STATIC = 'true';
    process.env.FEATURE_RFID = 'true';
    process.env.READER_TOKEN_PEPPER = 'test_pepper_0123456789abcdef0123456789abcdef';
    await runMigrations();
    await seedDatabase();
    app = await createApp();
    adminAuth = await loginAs(app, 'SCHOOL_ADMIN');

    // Seed test reader with an HMAC secret and ACTIVE status
    await withTenantContext(adminAuth.schoolId, async (tx) => {
      await tx
        .delete(rfidReaders)
        .where(eq(rfidReaders.id, testReaderId));

      await tx.insert(rfidReaders).values({
        id: testReaderId,
        schoolId: adminAuth.schoolId,
        deviceId: testDeviceId,
        name: 'Gate Auth Test Reader',
        adapterType: 'NETWORK',
        securityCapability: 'ZEBRA_FX9600',
        status: 'ACTIVE',
        sharedSecretEncrypted: encryptReaderSecret(hmacSecret),
        bearerTokenHash: null,
      });
    });
  });

  it('rotates token, returning dedicated bearer token once, revoking previous immediately', async () => {
    // 1. Rotate token via School Admin API
    const rotateRes = await request(app)
      .post(`/api/v1/schools/${adminAuth.schoolId}/rfid/readers/${testReaderId}/rotate-token`)
      .set('Cookie', adminAuth.cookies)
      .set('x-csrf-token', adminAuth.csrf)
      .send();

    expect(rotateRes.status).toBe(200);
    expect(rotateRes.body.success).toBe(true);
    expect(rotateRes.body.readerId).toBe(testReaderId);
    expect(rotateRes.body.token).toMatch(/^aerdr_[A-Za-z0-9_-]{43}$/);
    expect(rotateRes.body.tokenHint).toBeDefined();

    const firstToken = rotateRes.body.token;

    // 2. Dedicated bearer token works for reader ingest
    const ingestRes1 = await request(app)
      .post(`/api/v1/schools/${adminAuth.schoolId}/rfid/zebra/reads`)
      .set('Authorization', `Bearer ${firstToken}`)
      .send({ data: [] });

    expect(ingestRes1.status).toBe(200);
    expect(ingestRes1.body.success).toBe(true);

    // 3. Rotate token a second time
    const rotateRes2 = await request(app)
      .post(`/api/v1/schools/${adminAuth.schoolId}/rfid/readers/${testReaderId}/rotate-token`)
      .set('Cookie', adminAuth.cookies)
      .set('x-csrf-token', adminAuth.csrf)
      .send();

    expect(rotateRes2.status).toBe(200);
    const secondToken = rotateRes2.body.token;
    expect(secondToken).not.toBe(firstToken);

    // 4. Old token revoked immediately (returns 401)
    const oldTokenRes = await request(app)
      .post(`/api/v1/schools/${adminAuth.schoolId}/rfid/zebra/reads`)
      .set('Authorization', `Bearer ${firstToken}`)
      .send({ data: [] });

    expect(oldTokenRes.status).toBe(401);
    expect(oldTokenRes.body.error).toBe('UNAUTHORIZED_READER');

    // 5. New token works immediately
    const newTokenRes = await request(app)
      .post(`/api/v1/schools/${adminAuth.schoolId}/rfid/zebra/reads`)
      .set('Authorization', `Bearer ${secondToken}`)
      .send({ data: [] });

    expect(newTokenRes.status).toBe(200);
    expect(newTokenRes.body.success).toBe(true);
  });

  it('enforces bearer != HMAC secret (HMAC secret cannot be used as Bearer token)', async () => {
    // Attempting to authenticate via Bearer using the reader HMAC secret
    const res = await request(app)
      .post(`/api/v1/schools/${adminAuth.schoolId}/rfid/zebra/reads`)
      .set('Authorization', `Bearer ${hmacSecret}`)
      .send({ data: [] });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED_READER');
  });

  it('returns uniform 401s on bad token and missing reader without leaking details', async () => {
    const resBadToken = await request(app)
      .post(`/api/v1/schools/${adminAuth.schoolId}/rfid/zebra/reads`)
      .set('Authorization', 'Bearer aerdr_nonexistentbadtoken1234567890')
      .send({ data: [] });

    const resUnknownSchool = await request(app)
      .post('/api/v1/schools/99999999-9999-4999-8999-999999999999/rfid/zebra/reads')
      .set('Authorization', 'Bearer aerdr_nonexistentbadtoken1234567890')
      .send({ data: [] });

    expect(resBadToken.status).toBe(401);
    expect(resUnknownSchool.status).toBe(401);

    expect(resBadToken.body.error).toBe('UNAUTHORIZED_READER');
    expect(resUnknownSchool.body.error).toBe('UNAUTHORIZED_READER');
    expect(resBadToken.body.message).toBe('Reader authentication failed');
    expect(resUnknownSchool.body.message).toBe('Reader authentication failed');
  });

  it('rejects deactivated reader with 403 FORBIDDEN_READER after valid authentication', async () => {
    // Generate valid token for reader
    const rotateRes = await request(app)
      .post(`/api/v1/schools/${adminAuth.schoolId}/rfid/readers/${testReaderId}/rotate-token`)
      .set('Cookie', adminAuth.cookies)
      .set('x-csrf-token', adminAuth.csrf)
      .send();

    expect(rotateRes.status).toBe(200);
    const validToken = rotateRes.body.token;

    // Deactivate reader
    await withTenantContext(adminAuth.schoolId, async (tx) => {
      await tx
        .update(rfidReaders)
        .set({ status: 'SUSPENDED' })
        .where(eq(rfidReaders.id, testReaderId));
    });

    // Valid auth on inactive reader -> 403 FORBIDDEN_READER
    const res = await request(app)
      .post(`/api/v1/schools/${adminAuth.schoolId}/rfid/zebra/reads`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ data: [] });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN_READER');
  });
});
