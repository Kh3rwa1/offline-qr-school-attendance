import { describe, it, expect } from 'vitest';
import { isCsrfExempt } from '../../src/middleware/csrfExemptions';

const S = '3f2b8c1e-4a5d-4e6f-9a1b-2c3d4e5f6a7b';
const req = (method: string, originalUrl: string) =>
  ({ method, originalUrl, url: originalUrl } as any);

describe('CSRF exemptions', () => {
  it.each([
    ['POST', `/api/v1/schools/${S}/rfid/zebra/reads`],
    ['POST', `/api/v1/schools/${S}/rfid/zebra/reads/`],
    ['POST', `/api/v1/schools/${S}/rfid/scans`],
    ['POST', '/api/v1/auth/login'],
  ])('exempts %s %s', (m, u) => expect(isCsrfExempt(req(m, u))).toBe(true));

  it.each([
    ['POST', `/api/v1/schools/${S}/students?x=/rfid/scans`], // the original bug
    ['POST', `/api/v1/schools/${S}/students#/rfid/scans`],
    ['POST', `/api/v1/schools/${S}/students/rfid/scans`], // not a UUID segment
    ['POST', `/api/v1/schools/${S}/rfid/scans/../../students`],
    ['POST', `/api/v1/schools/${S}/rfid%2Fscans`], // encoded slash
    ['POST', `/api/v1/schools/${S}/rfid/scans/extra`],
    ['DELETE', `/api/v1/schools/${S}/rfid/scans`], // wrong method
    ['POST', '/api/v1/auth/login/../../schools'],
    ['POST', '/api/v1/auth/loginX'],
  ])('does NOT exempt %s %s', (m, u) => expect(isCsrfExempt(req(m, u))).toBe(false));
});
