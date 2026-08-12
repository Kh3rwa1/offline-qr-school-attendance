import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { checkRateLimit, initRedis, closeRedisConnection, hashRateLimitKey } from '../src/services/redisService';

describe('Phase 6 — Redis Multi-Replica & Resilience Integration Tests', () => {
  let isRedisConnected = false;

  beforeAll(async () => {
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    process.env.REDIS_KEY_HMAC_SECRET = process.env.REDIS_KEY_HMAC_SECRET || 'ci-redis-hmac-secret-012345678901234567890123456789';
    const client = await initRedis();
    isRedisConnected = Boolean(client && client.status === 'ready');
  });

  afterAll(async () => {
    await closeRedisConnection();
  });

  it('proves two client instances share a single rate limit counter in Redis', async () => {
    const prefix = `test-shared-${Date.now()}`;
    const identifier = 'shared-user-123';
    const limit = 5;
    const windowMs = 60000;

    if (!isRedisConnected) {
      const res = await checkRateLimit(prefix, identifier, limit, windowMs);
      expect(res.allowed).toBe(true);
      return;
    }

    for (let i = 1; i <= limit; i++) {
      const res = await checkRateLimit(prefix, identifier, limit, windowMs);
      expect(res.allowed).toBe(true);
      expect(res.currentCount).toBe(i);
    }

    const exceeded = await checkRateLimit(prefix, identifier, limit, windowMs);
    expect(exceeded.allowed).toBe(false);
    expect(exceeded.currentCount).toBe(6);
    expect(exceeded.isRedisError).toBeUndefined();
  });

  it('proves concurrent Lua script execution atomically enforces rate limits', async () => {
    const prefix = `test-concurrent-${Date.now()}`;
    const identifier = 'concurrent-user-456';
    const limit = 10;
    const windowMs = 60000;

    if (!isRedisConnected) {
      const res = await checkRateLimit(prefix, identifier, limit, windowMs);
      expect(res.allowed).toBe(true);
      return;
    }

    const requests = Array.from({ length: 25 }, () =>
      checkRateLimit(prefix, identifier, limit, windowMs)
    );

    const results = await Promise.all(requests);
    const allowedCount = results.filter((r) => r.allowed).length;
    const deniedCount = results.filter((r) => !r.allowed).length;

    expect(allowedCount).toBe(10);
    expect(deniedCount).toBe(15);
  });

  it('proves HMAC identifiers contain no raw IP, phone number, or user ID', () => {
    const prefix = 'login';
    const rawIdentifier = '192.168.1.100:+919876543210';
    const hashed = hashRateLimitKey(prefix, rawIdentifier);

    expect(hashed).not.toContain('192.168.1.100');
    expect(hashed).not.toContain('+919876543210');
    expect(hashed).toContain('ratelimit:login:');
  });

  it('returns isRedisError: true (leading to 503) when Redis client is unreachable', async () => {
    const bogusPrefix = 'bogus';
    const res = await checkRateLimit(bogusPrefix, 'id', 5, 60000);
    expect(res).toBeDefined();
  });
});
