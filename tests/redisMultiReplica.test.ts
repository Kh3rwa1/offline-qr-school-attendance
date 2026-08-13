import Redis from 'ioredis';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { checkRateLimit, initRedis, closeRedisConnection, hashRateLimitKey } from '../src/services/redisService';

describe('Phase 6 — Redis Multi-Replica & Resilience Integration Tests', () => {
  let redis1: Redis;
  let redis2: Redis;
  let isRedisConnected = false;
  const testKeysCreated: string[] = [];

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    process.env.REDIS_KEY_HMAC_SECRET = process.env.REDIS_KEY_HMAC_SECRET || 'ci-redis-hmac-secret-012345678901234567890123456789';

    try {
      await initRedis();
      redis1 = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 2, enableOfflineQueue: false });
      redis2 = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 2, enableOfflineQueue: false });

      await Promise.all([
        new Promise<void>((resolve, reject) => {
          redis1.on('ready', resolve);
          redis1.on('error', reject);
        }),
        new Promise<void>((resolve, reject) => {
          redis2.on('ready', resolve);
          redis2.on('error', reject);
        }),
      ]);
      isRedisConnected = true;
    } catch (err: any) {
      if (process.env.REDIS_REQUIRED === '1') {
        throw new Error(`REDIS_REQUIRED_IN_CI: Redis service on 127.0.0.1:6379 is required for multi-replica integration tests: ${err.message}`);
      }
      console.warn('[RedisMultiReplicaTest] Local Redis service not available. Multi-replica tests will be skipped locally:', err.message);
      isRedisConnected = false;
    }
  });

  afterAll(async () => {
    if (redis1 && redis1.status === 'ready') {
      for (const k of testKeysCreated) {
        await redis1.del(k).catch(() => undefined);
      }
      await redis1.quit().catch(() => undefined);
    }
    if (redis2 && redis2.status === 'ready') {
      await redis2.quit().catch(() => undefined);
    }
    await closeRedisConnection();
  });

  it('proves two independent web replica clients share atomic rate limit counters in Redis', async () => {
    if (!isRedisConnected) {
      console.log('Skipping Redis multi-replica test locally (Redis 6379 unavailable)');
      return;
    }

    const prefix = 'shared-replica';
    const identifier = `replica-user-${Date.now()}`;
    const limit = 6;
    const windowMs = 60000;
    const keyName = hashRateLimitKey(prefix, identifier);
    testKeysCreated.push(keyName);

    // Replica 1 consumes first 3 requests
    for (let i = 1; i <= 3; i++) {
      const res = await checkRateLimit(prefix, identifier, limit, windowMs, redis1);
      expect(res.allowed).toBe(true);
      expect(res.currentCount).toBe(i);
      expect(res.isRedisError).toBe(false);
    }

    // Replica 2 consumes next 3 requests against the exact same shared key in Redis
    for (let i = 4; i <= 6; i++) {
      const res = await checkRateLimit(prefix, identifier, limit, windowMs, redis2);
      expect(res.allowed).toBe(true);
      expect(res.currentCount).toBe(i);
      expect(res.isRedisError).toBe(false);
    }

    // 7th request from Replica 1 is denied (429) and currentCount remains 6
    const exceeded = await checkRateLimit(prefix, identifier, limit, windowMs, redis1);
    expect(exceeded.allowed).toBe(false);
    expect(exceeded.currentCount).toBe(6);
    expect(exceeded.isRedisError).toBe(false);
  });

  it('proves HMAC key derivation produces zero raw IP or phone number exposure', () => {
    const prefix = 'login';
    const rawIdentifier = '192.168.1.100:+919876543210';
    const hashedKey = hashRateLimitKey(prefix, rawIdentifier);

    expect(hashedKey).not.toContain('192.168.1.100');
    expect(hashedKey).not.toContain('+919876543210');
    expect(hashedKey).toContain('ratelimit:login:');
  });

  it('proves missing or short REDIS_KEY_HMAC_SECRET throws in production mode', () => {
    const oldSecret = process.env.REDIS_KEY_HMAC_SECRET;
    try {
      process.env.REDIS_KEY_HMAC_SECRET = 'short';
      expect(() => hashRateLimitKey('test', 'id')).toThrow(/REDIS_KEY_HMAC_SECRET/i);
    } finally {
      process.env.REDIS_KEY_HMAC_SECRET = oldSecret;
    }
  });

  it('simulates Redis connection outage and clean recovery', async () => {
    if (!isRedisConnected) return;

    const outageClient = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 0, enableOfflineQueue: false });
    await new Promise<void>((resolve) => outageClient.on('ready', resolve));

    // Verify healthy state returns allowed: true
    const healthyRes = await checkRateLimit('outage', 'id', 5, 60000, outageClient);
    expect(healthyRes.isRedisError).toBe(false);

    // Disconnect client to simulate outage
    outageClient.disconnect();

    // Verify outage returns isRedisError: true (producing HTTP 503)
    const outageRes = await checkRateLimit('outage', 'id', 5, 60000, outageClient);
    expect(outageRes.isRedisError).toBe(true);
    expect(outageRes.allowed).toBe(false);

    // Reconnect client to simulate recovery
    const recoveredClient = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 2, enableOfflineQueue: false });
    await new Promise<void>((resolve) => recoveredClient.on('ready', resolve));

    // Verify recovered client resumes normal rate limiting (allowed: true, isRedisError: false)
    const recoveredRes = await checkRateLimit('outage', 'id', 5, 60000, recoveredClient);
    expect(recoveredRes.isRedisError).toBe(false);
    expect(recoveredRes.allowed).toBe(true);

    await recoveredClient.quit();
  });
});
