import { describe, it, expect } from 'vitest';
import { classifyReadTime } from '../../src/services/rfid/readFreshness';

describe('Read Freshness Classification', () => {
  const now = new Date('2026-10-05T10:00:00.000Z');

  it('classifies null or invalid timestamp as MISSING_TIMESTAMP', () => {
    expect(classifyReadTime(null, now)).toBe('MISSING_TIMESTAMP');
    expect(classifyReadTime(new Date('invalid-date'), now)).toBe('MISSING_TIMESTAMP');
  });

  it('classifies future skew (> 2 minutes ahead) as FUTURE_SKEW', () => {
    const future = new Date(now.getTime() + 3 * 60 * 1000);
    expect(classifyReadTime(future, now)).toBe('FUTURE_SKEW');
  });

  it('classifies read within tolerance as OK', () => {
    const fresh = new Date(now.getTime() - 30 * 1000);
    expect(classifyReadTime(fresh, now)).toBe('OK');
  });

  it('classifies buffered read within same school day (> 15m late) as LATE_BUFFERED', () => {
    const buffered = new Date(now.getTime() - 25 * 60 * 1000);
    expect(classifyReadTime(buffered, now)).toBe('LATE_BUFFERED');
  });

  it('classifies previous day read as WRONG_SCHOOL_DAY', () => {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(classifyReadTime(yesterday, now)).toBe('WRONG_SCHOOL_DAY');
  });
});
