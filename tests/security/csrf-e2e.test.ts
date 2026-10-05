import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server';
import { loginAs } from '../helpers/auth';

describe('CSRF E2E Security Tests', () => {
  it('blocks query-string exemption smuggling', async () => {
    const app = await createApp();
    const { cookies, schoolId } = await loginAs(app, 'SCHOOL_ADMIN');
    const res = await request(app)
      .post(`/api/v1/schools/${schoolId}/students?x=/rfid/scans`)
      .set('Cookie', cookies)
      .set('Origin', 'https://evil.example')
      .send({ fullName: 'Pwned' });
    expect(res.status).toBe(403);
  });

  it('rejects session cookie on machine routes (defense in depth)', async () => {
    const app = await createApp();
    const { cookies, schoolId } = await loginAs(app, 'SCHOOL_ADMIN');
    const res = await request(app)
      .post(`/api/v1/schools/${schoolId}/rfid/scans`)
      .set('Cookie', cookies)
      .send({ rawScanData: 'epc-123' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('CSRF_COOKIE_ON_MACHINE_ROUTE');
  });
});
