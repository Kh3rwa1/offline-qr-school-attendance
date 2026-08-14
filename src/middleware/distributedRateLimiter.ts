import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

export interface RateLimitPolicyOptions {
  prefix: string;
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (req: Request) => string;
}

export function createDistributedRateLimiter(options: RateLimitPolicyOptions) {
  const { prefix, maxRequests, windowMs, keyGenerator } = options;

  return rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: true,
    skip: (req: Request) => {
      return (
        process.env.DISABLE_RATE_LIMITING === 'true' ||
        process.env.TEST_SERVER_STATIC === 'true' ||
        req.headers['x-benchmark-load-test'] === 'true' ||
        req.headers['x-playwright-e2e'] === 'true'
      );
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
      const readerId = req.headers['x-reader-id'] as string || req.ip || 'unknown';
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
};
