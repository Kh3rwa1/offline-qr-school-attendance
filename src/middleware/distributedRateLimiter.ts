import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';

export interface RateLimitPolicyOptions {
  prefix: string;
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (req: Request) => string;
}

let redisClientInstance: Redis | null = null;

function getRateLimiterRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  if (!redisClientInstance) {
    redisClientInstance = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
      lazyConnect: false,
    });
  }
  return redisClientInstance;
}

export function createDistributedRateLimiter(options: RateLimitPolicyOptions) {
  const { prefix, maxRequests, windowMs, keyGenerator } = options;

  let store: any = undefined;

  // Use RedisStore when REDIS_URL is provided
  if (process.env.REDIS_URL) {
    store = new RedisStore({
      sendCommand: async (...args: string[]) => {
        const client = getRateLimiterRedisClient();
        if (client) {
          return client.call(args[0], ...args.slice(1)) as any;
        }
        if (process.env.NODE_ENV === 'production' && process.env.ALLOW_IN_MEMORY_RATE_LIMITER !== 'true') {
          throw new Error(`REDIS_RATE_LIMITER_UNAVAILABLE: Active Redis client is mandatory for production rate limit policy '${prefix}'.`);
        }
        return 1 as any;
      },
      prefix: `rl:${prefix}:`,
    });
  } else if (process.env.NODE_ENV === 'production' && process.env.ALLOW_IN_MEMORY_RATE_LIMITER !== 'true') {
    throw new Error(`REDIS_RATE_LIMITER_REQUIRED: REDIS_URL is mandatory for distributed policy '${prefix}' in production mode.`);
  }

  return rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: true,
    store,
    validate: { xForwardedForHeader: false, default: false },
    skip: (req: Request) => {
      if (process.env.DISABLE_RATE_LIMITING === 'true' || process.env.TEST_SERVER_STATIC === 'true') {
        return true;
      }
      // Strictly require non-production mode AND explicit ALLOW_TEST_BYPASS flag
      const isTestBypassAllowed = process.env.NODE_ENV !== 'production' && process.env.ALLOW_TEST_BYPASS === 'true';
      if (isTestBypassAllowed) {
        return (
          req.headers['x-benchmark-load-test'] === 'true' ||
          req.headers['x-playwright-e2e'] === 'true'
        );
      }
      return false;
    },
    keyGenerator: (req: Request) => {
      if (keyGenerator) return keyGenerator(req);
      return req.ip || req.socket.remoteAddress || 'unknown';
    },
    handler: (_req: Request, res: Response) => {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        success: false,
        error: 'TOO_MANY_REQUESTS',
        message: `Rate limit exceeded for policy '${prefix}'. Please try again in ${retryAfter} seconds.`,
        retryAfterSeconds: retryAfter,
      });
    },
  });
}

export const rateLimitPolicies = {
  login: createDistributedRateLimiter({
    prefix: 'login',
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    keyGenerator: (req) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const phone = (req.body?.phoneNumber || '').replace(/\D/g, '');
      return `${ip}:${phone}`;
    },
  }),

  generalApi: createDistributedRateLimiter({
    prefix: 'api',
    maxRequests: 500,
    windowMs: 15 * 60 * 1000,
  }),

  sync: createDistributedRateLimiter({
    prefix: 'sync',
    maxRequests: 300,
    windowMs: 15 * 60 * 1000,
  }),

  import: createDistributedRateLimiter({
    prefix: 'import',
    maxRequests: 20,
    windowMs: 15 * 60 * 1000,
  }),

  reports: createDistributedRateLimiter({
    prefix: 'reports',
    maxRequests: 50,
    windowMs: 15 * 60 * 1000,
  }),

  callback: createDistributedRateLimiter({
    prefix: 'callback',
    maxRequests: 200,
    windowMs: 60 * 1000,
  }),

  adminQueue: createDistributedRateLimiter({
    prefix: 'admin-queue',
    maxRequests: 30,
    windowMs: 15 * 60 * 1000,
  }),

  rfidScan: createDistributedRateLimiter({
    prefix: 'rfid-scan',
    maxRequests: 120,
    windowMs: 60 * 1000,
    keyGenerator: (req) => {
      // Do not trust unverified client header alone; use authenticated reader context if present or client IP
      const readerContext = (req as any).readerContext;
      const readerId = readerContext?.readerId || req.ip || req.socket.remoteAddress || 'unknown';
      return `reader:${readerId}`;
    },
  }),

  rfidEnrollment: createDistributedRateLimiter({
    prefix: 'rfid-enroll',
    maxRequests: 60,
    windowMs: 60 * 1000,
  }),

  rfidReaderPairing: createDistributedRateLimiter({
    prefix: 'rfid-pair',
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
  }),

  rfidUnknownCard: createDistributedRateLimiter({
    prefix: 'rfid-unknown',
    maxRequests: 20,
    windowMs: 60 * 1000,
  }),

  spaFallback: createDistributedRateLimiter({
    prefix: 'spa',
    maxRequests: 300,
    windowMs: 60 * 1000,
  }),

  demoRequests: createDistributedRateLimiter({
    prefix: 'demo-requests',
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    keyGenerator: (req) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const phone = (req.body?.phone || '').replace(/\D/g, '');
      return `${ip}:${phone}`;
    },
  }),
};
