import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server';
import { runMigrations } from '../../src/db/migrate';
import { seedDatabase } from '../../src/db/seed';

const S_REAL = '00000000-0000-0000-0000-000000000001';
const S_OTHER = '00000000-0000-0000-0000-000000000002';
const VALID_TOKEN_FOR_S_REAL = 'aerdr_testvalidtoken1234567890abcdefghijklm';

describe('Error Information Leakage Prevention', () => {
  let app: any;

  beforeAll(async () => {
    process.env.TEST_SERVER_STATIC = 'true';
    process.env.FEATURE_RFID = 'true';
    await runMigrations();
    await seedDatabase();
    app = await createApp();
  });

  it('returns identical responses for unknown reader, wrong school, and bad token', async () => {
    const cases = [
      { school: S_REAL, token: 'aerdr_wrong' },
      { school: S_OTHER, token: VALID_TOKEN_FOR_S_REAL },
      { school: '00000000-0000-4000-8000-000000000000', token: VALID_TOKEN_FOR_S_REAL },
    ];
    const bodies = await Promise.all(
      cases.map(async ({ school, token }) => {
        const r = await request(app)
          .post(`/api/v1/schools/${school}/rfid/zebra/reads`)
          .set('Authorization', `Bearer ${token}`)
          .send({ data: [] });
        expect(r.status).toBe(401);
        const { requestId, ...rest } = r.body;
        return JSON.stringify(rest);
      })
    );
    expect(new Set(bodies).size).toBe(1);
  });
});
