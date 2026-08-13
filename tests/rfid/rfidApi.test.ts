import { describe, it, expect } from 'vitest';
import { rfidRouter } from '../../src/routes/rfidRoutes';

describe('RFID Public & Internal API Integration Suite', () => {
  it('RFID router exports valid Express router instance with registered handlers', () => {
    expect(rfidRouter).toBeDefined();
    expect(typeof rfidRouter).toBe('function');
    expect(rfidRouter.stack).toBeDefined();
    expect(rfidRouter.stack.length).toBeGreaterThan(10);
  });

  it('Contains endpoints for scans, credentials, readers, offline sync, and reports', () => {
    const paths = rfidRouter.stack.map((layer: any) => layer.route?.path).filter(Boolean);
    expect(paths).toContain('/:schoolId/rfid/scans');
    expect(paths).toContain('/:schoolId/rfid/credentials/enroll');
    expect(paths).toContain('/:schoolId/rfid/readers/register');
    expect(paths).toContain('/:schoolId/rfid/offline/sync');
    expect(paths).toContain('/:schoolId/rfid/reports/scans');
  });
});
