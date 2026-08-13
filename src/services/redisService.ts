import Redis from 'ioredis';
import crypto from 'node:crypto';

let redisClient: Redis | null = null;
let redisInitPromise: Promise<Redis | null> | null = null;

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
 * Initializes and verifies Redis connection on application startup.
 * Ensures the Redis client reaches 'ready' state and passes a PING check.
 */
export async function initRedis(): Promise<Redis | null> {
  if (redisClient && redisClient.status === 'ready') return redisClient;
  if (redisInitPromise) return redisInitPromise;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_IN_MEMORY_RATE_LIMITER !== 'true') {
      throw new Error('REDIS_URL_REQUIRED_IN_PRODUCTION: Production mode requires REDIS_URL for distributed rate limiting.');
    }
    return null;
  }

  redisInitPromise = new Promise<Redis | null>((resolve, reject) => {
    try {
      const client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
        lazyConnect: false,
        connectTimeout: 5000,
      });

      let isResolved = false;

      const timeoutTimer = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          const err = new Error('REDIS_CONNECT_TIMEOUT: Timed out waiting for Redis ready state.');
          if (process.env.NODE_ENV === 'production') {
            reject(err);
          } else {
            resolve(null);
          }
        }
      }, 5000);

      client.on('ready', async () => {
        if (isResolved) return;
        try {
          await client.ping();
          isResolved = true;
          clearTimeout(timeoutTimer);
          redisClient = client;
          resolve(client);
        } catch (pingErr: any) {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutTimer);
            if (process.env.NODE_ENV === 'production') reject(pingErr);
            else resolve(null);
          }
        }
      });

      client.on('error', (err) => {
        console.error('[RedisService] Connection error:', err.message);
        if (!isResolved && process.env.NODE_ENV === 'production') {
          isResolved = true;
          clearTimeout(timeoutTimer);
          reject(err);
        }
      });
    } catch (err: any) {
      if (process.env.NODE_ENV === 'production') {
        reject(err);
      } else {
        resolve(null);
      }
    }
  });

  return redisInitPromise;
}

export function getRedisClient(): Redis | null {
  if (redisClient && redisClient.status === 'ready') return redisClient;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_IN_MEMORY_RATE_LIMITER !== 'true') {
      throw new Error('REDIS_URL_REQUIRED_IN_PRODUCTION: Production mode requires REDIS_URL for distributed rate limiting.');
    }
    return null;
  }
  if (!redisClient) {
    initRedis().catch((err) => console.error('[RedisService] Eager init failed:', err.message));
  }
  return redisClient;
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

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  resetMs: number;
  isRedisError?: boolean;
}

/**
 * Sliding-window distributed rate limit check using an atomic Lua script.
 * Returns isRedisError: true when Redis is offline or errors out.
 */
export async function checkRateLimit(
  prefix: string,
  identifier: string,
  maxRequests: number,
  windowMs: number,
  customClient?: Redis
): Promise<RateLimitResult> {
  const client = customClient || getRedisClient();
  const key = hashRateLimitKey(prefix, identifier);
  const now = Date.now();
  const clearBefore = now - windowMs;
  const member = `${now}:${crypto.randomBytes(4).toString('hex')}`;

  if (!client || client.status !== 'ready') {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_IN_MEMORY_RATE_LIMITER !== 'true') {
      return { allowed: false, isRedisError: true, currentCount: 0, resetMs: 10 };
    }
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
      isRedisError: false,
    };
  } catch (err: any) {
    console.error(`[RateLimiter] Redis error on ${prefix}:`, err.message);
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_IN_MEMORY_RATE_LIMITER !== 'true') {
      return { allowed: false, isRedisError: true, currentCount: 0, resetMs: 10 };
    }
    return { allowed: true, currentCount: 1, resetMs: Math.ceil(windowMs / 1000) };
  }
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit().catch(() => {});
    redisClient = null;
    redisInitPromise = null;
  }
}
