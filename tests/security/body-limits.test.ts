import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server';

const S = '3f2b8c1e-4a5d-4e6f-9a1b-2c3d4e5f6a7b';

describe('Body payload limits and parser error handling', () => {
  let app: any;

  beforeAll(async () => {
    process.env.TEST_SERVER_STATIC = 'true';
    app = await createApp();
  });

  it('returns 413 (not 500) for oversized Zebra payloads', async () => {
    const big = { data: Array.from({ length: 20_000 }, () => ({ epc: 'E2'.padEnd(24, '0') })) };
    const res = await request(app).post(`/api/v1/schools/${S}/rfid/zebra/reads`).send(big);
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('PAYLOAD_TOO_LARGE');
    expect(JSON.stringify(res.body)).not.toMatch(/entity|limit|bytes/i);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post(`/api/v1/schools/${S}/rfid/zebra/reads`)
      .set('Content-Type', 'application/json')
      .send('{"data": [');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MALFORMED_JSON');
  });

  it('applies the 100kb default limit elsewhere', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ x: 'a'.repeat(150_000) });
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('PAYLOAD_TOO_LARGE');
  });
});
