import { describe, it, expect } from 'vitest';
import { checkRateLimit } from '../../src/services/redisService';

describe('RFID Redis Rate Limiting Integration', () => {
  it('checkRateLimit function handles evaluation gracefully', async () => {
    const res = await checkRateLimit('rfid-test', 'reader_1', 10, 60000);
    expect(res).toBeDefined();
    expect(typeof res.allowed).toBe('boolean');
  });
});
