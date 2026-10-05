import { describe, it, expect } from 'vitest';
import { LEGACY_SUNSET } from '../../src/services/rfid/zebraAuth';

describe('Legacy Reader Auth Sunset', () => {
  it('defines sunset date as 2026-12-31', () => {
    expect(LEGACY_SUNSET).toBe('2026-12-31');
  });

  it('verifies sunset date is ISO format and valid UTC date', () => {
    const sunset = new Date(`${LEGACY_SUNSET}T23:59:59.999Z`);
    expect(Number.isNaN(sunset.getTime())).toBe(false);
    expect(sunset.getUTCFullYear()).toBe(2026);
    expect(sunset.getUTCMonth()).toBe(11); // December is 11 (0-indexed)
    expect(sunset.getUTCDate()).toBe(31);
  });
});
