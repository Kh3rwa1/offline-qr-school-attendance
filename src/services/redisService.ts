import Redis from 'ioredis';
import crypto from 'node:crypto';

let redisClient: Redis | null = null;

function getHmacSecret(): string {
  const secret = process.env.REDIS_KEY_HMAC_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: REDIS_KEY_HMAC_SECRET environment variable is required in production mode (minimum 32 characters).');
    }
    return 'dev-redis-hmac-secret-01234567890123456789';
  }
  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error('FATAL: REDIS_KEY_HMAC_SECRET must be at least 32 characters long in production mode.');
  }
  return secret;
}

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
  const hash = crypto.createHmac('sha256', getHmacSecret()).update(identifier).digest('hex').substring(0, 32);
  return `ratelimit:${prefix}:${hash}`;
}

const LUA_SLIDING_WINDOW = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local clearBefore = tonumber(ARGV[2])
local windowMs = tonumber(ARGV[3])
local maxRequests = tonumber(ARGV[4])
local member = ARGV[5]

redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)
local current = redis.call('ZCARD', key)

if current < maxRequests then
    redis.call('ZADD', key, now, member)
    redis.call('PEXPIRE', key, windowMs)
    return {1, current + 1}
else
    return {0, current}
end
`;

/**
 * Sliding-window distributed rate limit check using an atomic Lua script.
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
  const member = `${now}:${crypto.randomBytes(4).toString('hex')}`;

  if (!client) {
    // Fallback for local unit test environments without Redis
    return { allowed: true, currentCount: 1, resetMs: Math.ceil(windowMs / 1000) };
  }

  try {
    const res = (await client.eval(
      LUA_SLIDING_WINDOW,
      1,
      key,
      now.toString(),
      clearBefore.toString(),
      windowMs.toString(),
      maxRequests.toString(),
      member
    )) as [number, number];

    const allowed = res[0] === 1;
    const currentCount = res[1];

    return {
      allowed,
      currentCount,
      resetMs: Math.ceil(windowMs / 1000),
    };
  } catch (err: any) {
    console.error(`[RateLimiter] Redis error on ${prefix}:`, err.message);
    if (process.env.NODE_ENV === 'production') {
      // Fail closed in production if Redis errors
      return { allowed: false, currentCount: maxRequests + 1, resetMs: 60 };
    }
    return { allowed: true, currentCount: 1, resetMs: Math.ceil(windowMs / 1000) };
  }
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    redisClient = null;
  }
}
