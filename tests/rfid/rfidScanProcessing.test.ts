import { describe, it, expect, beforeEach, vi } from 'vitest';
import { scanService } from '../../src/services/rfid/scanService';

describe('RFID Scan Processing Unit Tests', () => {
  it('defines scanService.processScan and scanService.processOfflineScans', () => {
    expect(typeof scanService.processScan).toBe('function');
    expect(typeof scanService.processOfflineScans).toBe('function');
  });

  it('rejects envelope with missing version or required fields', async () => {
    await expect(
      scanService.processScan({
        version: 0 as any,
        schoolId: '',
        readerId: '',
        readerTimestamp: new Date().toISOString(),
        nonce: '',
        securityMode: 'SECURE',
        signature: '',
        clientEventId: '',
      })
    ).rejects.toThrow('Invalid envelope');
  });
});
