import Redis from 'ioredis';
import crypto from 'node:crypto';

let redisClient: Redis | null = null;
const secretKey = process.env.REDIS_KEY_HMAC_SECRET || 'sch-attendance-redis-secret-key-123';

/**
 * Get or initialize Redis client instance.
 * In production (NODE_ENV=production), fails closed if REDIS_URL is missing.
 */
export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_IN_MEMORY_RATE_LIMITER !== 'true') {
      throw new Error('REDIS_URL_REQUIRED_IN_PRODUCTION: Production mode requires REDIS_URL for distributed rate limiting.');
    }
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      lazyConnect: false,
    });

    redisClient.on('error', (err) => {
      console.error('[RedisService] Connection error:', err.message);
    });

    return redisClient;
  } catch (err: any) {
    console.error('[RedisService] Initialization failed:', err.message);
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`REDIS_INIT_FAILED: ${err.message}`);
    }
    return null;
  }
}

/**
 * Hashes a rate limit key (e.g. phone number or IP) using HMAC-SHA256 to prevent PII exposure in Redis keys.
 */
export function hashRateLimitKey(prefix: string, identifier: string): string {
  const hash = crypto.createHmac('sha256', secretKey).update(identifier).digest('hex').substring(0, 32);
  return `ratelimit:${prefix}:${hash}`;
}

/**
 * Sliding-window distributed rate limit check.
 */
export async function checkRateLimit(
  prefix: string,
  identifier: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; currentCount: number; resetMs: number }> {
  const client = getRedisClient();
  const key = hashRateLimitKey(prefix, identifier);
  const now = Date.now();
  const clearBefore = now - windowMs;

  if (!client) {
    // Fallback for local unit test environments without Redis
    return { allowed: true, currentCount: 1, resetMs: windowMs };
  }

  try {
    const pipeline = client.pipeline();
    pipeline.zremrangebyscore(key, 0, clearBefore);
    pipeline.zadd(key, now, `${now}:${Math.random().toString(36).substring(2, 7)}`);
    pipeline.zcard(key);
    pipeline.pexpire(key, windowMs);

    const results = await pipeline.exec();
    const count = (results?.[2]?.[1] as number) || 1;
    const allowed = count <= maxRequests;

    return {
      allowed,
      currentCount: count,
      resetMs: Math.ceil(windowMs / 1000),
    };
  } catch (err: any) {
    console.error(`[RateLimiter] Redis error on ${prefix}:`, err.message);
    if (process.env.NODE_ENV === 'production') {
      // Fail closed in production if Redis errors
      return { allowed: false, currentCount: maxRequests + 1, resetMs: 60 };
    }
    return { allowed: true, currentCount: 1, resetMs: windowMs };
  }
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    redisClient = null;
  }
}
