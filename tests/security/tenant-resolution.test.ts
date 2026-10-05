import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { resolveSchoolId } from '../../src/middleware/resolveSchoolId';
import { createApp } from '../../server';
import { runMigrations } from '../../src/db/migrate';
import { seedDatabase } from '../../src/db/seed';
import { loginAs } from '../helpers/auth';

const VALID_UUID = '3f2b8c1e-4a5d-4e6f-9a1b-2c3d4e5f6a7b';
const OTHER_UUID = '00000000-0000-0000-0000-000000000002';
const INVALID_UUID = 'not-a-valid-uuid';

describe('Tenant Resolution Middleware (Unit)', () => {
  it('path only works', () => {
    let nextCalled = false;
    const req: any = {
      params: { schoolId: VALID_UUID },
      headers: {},
      query: {},
      body: {},
    };
    const res: any = {
      status: () => res,
      json: () => res,
    };
    resolveSchoolId(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    expect(req.schoolId).toBe(VALID_UUID);
  });

  it('matching header, query, and body works', () => {
    let nextCalled = false;
    const req: any = {
      params: { schoolId: VALID_UUID },
      headers: { 'x-school-id': VALID_UUID },
      query: { schoolId: VALID_UUID },
      body: { schoolId: VALID_UUID },
    };
    const res: any = {
      status: () => res,
      json: () => res,
    };
    resolveSchoolId(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    expect(req.schoolId).toBe(VALID_UUID);
  });

  it('mismatching header returns 400 SCHOOL_ID_MISMATCH', () => {
    let statusCode = 0;
    let jsonBody: any = null;
    const req: any = {
      params: { schoolId: VALID_UUID },
      headers: { 'x-school-id': OTHER_UUID },
      query: {},
      body: {},
    };
    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        jsonBody = data;
        return res;
      },
    };
    resolveSchoolId(req, res, () => {});
    expect(statusCode).toBe(400);
    expect(jsonBody.error).toBe('SCHOOL_ID_MISMATCH');
    expect(jsonBody.message).toContain('header');
  });

  it('mismatching body returns 400 SCHOOL_ID_MISMATCH', () => {
    let statusCode = 0;
    let jsonBody: any = null;
    const req: any = {
      params: { schoolId: VALID_UUID },
      headers: {},
      query: {},
      body: { schoolId: OTHER_UUID },
    };
    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        jsonBody = data;
        return res;
      },
    };
    resolveSchoolId(req, res, () => {});
    expect(statusCode).toBe(400);
    expect(jsonBody.error).toBe('SCHOOL_ID_MISMATCH');
    expect(jsonBody.message).toContain('body');
  });

  it('mismatching query returns 400 SCHOOL_ID_MISMATCH', () => {
    let statusCode = 0;
    let jsonBody: any = null;
    const req: any = {
      params: { schoolId: VALID_UUID },
      headers: {},
      query: { schoolId: OTHER_UUID },
      body: {},
    };
    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        jsonBody = data;
        return res;
      },
    };
    resolveSchoolId(req, res, () => {});
    expect(statusCode).toBe(400);
    expect(jsonBody.error).toBe('SCHOOL_ID_MISMATCH');
    expect(jsonBody.message).toContain('query');
  });

  it('malformed UUID returns 400 INVALID_SCHOOL_ID', () => {
    let statusCode = 0;
    let jsonBody: any = null;
    const req: any = {
      params: { schoolId: INVALID_UUID },
      headers: {},
      query: {},
      body: {},
    };
    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        jsonBody = data;
        return res;
      },
    };
    resolveSchoolId(req, res, () => {});
    expect(statusCode).toBe(400);
    expect(jsonBody.error).toBe('INVALID_SCHOOL_ID');
  });
});

describe('Tenant Resolution Middleware (E2E Integration)', () => {
  let app: any;
  let adminAuth: { cookies: string; csrf: string; schoolId: string };

  beforeAll(async () => {
    process.env.TEST_SERVER_STATIC = 'true';
    await runMigrations();
    await seedDatabase();
    app = await createApp();
    adminAuth = await loginAs(app, 'SCHOOL_ADMIN');
  });

  it('allows request with path only', async () => {
    const res = await request(app)
      .get(`/api/v1/schools/${adminAuth.schoolId}/students`)
      .set('Cookie', adminAuth.cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('allows request when header and query match path', async () => {
    const res = await request(app)
      .get(`/api/v1/schools/${adminAuth.schoolId}/students?schoolId=${adminAuth.schoolId}`)
      .set('Cookie', adminAuth.cookies)
      .set('x-school-id', adminAuth.schoolId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects mismatching x-school-id header with 400 SCHOOL_ID_MISMATCH', async () => {
    const res = await request(app)
      .get(`/api/v1/schools/${adminAuth.schoolId}/students`)
      .set('Cookie', adminAuth.cookies)
      .set('x-school-id', OTHER_UUID);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('SCHOOL_ID_MISMATCH');
  });

  it('rejects mismatching body.schoolId with 400 SCHOOL_ID_MISMATCH', async () => {
    const res = await request(app)
      .post(`/api/v1/schools/${adminAuth.schoolId}/students`)
      .set('Cookie', adminAuth.cookies)
      .set('x-csrf-token', adminAuth.csrf)
      .send({
        fullName: 'Test Student',
        schoolId: OTHER_UUID,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('SCHOOL_ID_MISMATCH');
  });

  it('rejects mismatching query.schoolId with 400 SCHOOL_ID_MISMATCH', async () => {
    const res = await request(app)
      .get(`/api/v1/schools/${adminAuth.schoolId}/students?schoolId=${OTHER_UUID}`)
      .set('Cookie', adminAuth.cookies);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('SCHOOL_ID_MISMATCH');
  });

  it('rejects malformed UUID in path with 400 INVALID_SCHOOL_ID', async () => {
    const res = await request(app)
      .get(`/api/v1/schools/${INVALID_UUID}/students`)
      .set('Cookie', adminAuth.cookies);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_SCHOOL_ID');
  });
});
