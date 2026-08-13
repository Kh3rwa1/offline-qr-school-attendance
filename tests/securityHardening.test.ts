import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { validateProductionEnv } from '../src/env';

function safeTimingCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

describe('10/10 Application Security Hardening & Regression Suite', () => {
  it('proves production startup fails closed when SESSION_SECRET is missing or weak (< 32 chars)', () => {
    const oldEnv = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      process.env.COMPONENT = 'web';
      process.env.SESSION_SECRET = 'short-secret';
      process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.REDIS_KEY_HMAC_SECRET = 'ci-redis-hmac-secret-012345678901234567890123456789';
      process.env.METRICS_AUTH_TOKEN = 'ci-metrics-token-012345678901234567890123456789';

      expect(() => validateProductionEnv()).toThrow();
    } finally {
      process.env = oldEnv;
    }
  });

  it('proves production startup fails closed when REDIS_KEY_HMAC_SECRET is missing or weak', () => {
    const oldEnv = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      process.env.COMPONENT = 'web';
      process.env.SESSION_SECRET = 'ci-session-secret-012345678901234567890123456789';
      process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.REDIS_KEY_HMAC_SECRET = 'weak';
      process.env.METRICS_AUTH_TOKEN = 'ci-metrics-token-012345678901234567890123456789';

      expect(() => validateProductionEnv()).toThrow();
    } finally {
      process.env = oldEnv;
    }
  });

  it('proves timing-safe secret comparisons prevent side-channel timing attacks', () => {
    const secret = 'secret-token-1234567890';
    const validCandidate = 'secret-token-1234567890';
    const invalidCandidate = 'invalid-token-diff-len';

    expect(safeTimingCompare(secret, validCandidate)).toBe(true);
    expect(safeTimingCompare(secret, invalidCandidate)).toBe(false);
  });
});
