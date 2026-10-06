import { env } from '../env';
import type { Server } from 'node:http';
import type { Request, Response, NextFunction } from 'express';
import { closeDatabasePools } from '../db';
import { closeRedis } from '../services/redisService';
import { closeRateLimiterRedis } from '../middleware/distributedRateLimiter';
import { logger } from '../lib/logger';

const DRAIN_MS = Number(env.SHUTDOWN_DRAIN_MS ?? 20_000);
const READINESS_GRACE_MS = Number(env.SHUTDOWN_READINESS_GRACE_MS ?? 3_000);

let draining = false;
let inflight = 0;
export const isDraining = () => draining;

/** Mount FIRST. Counts requests; tells keep-alive clients to reconnect elsewhere during drain. */
export function inflightTracker(_req: Request, res: Response, next: NextFunction) {
  inflight++;
  if (draining) res.setHeader('Connection', 'close');
  res.on('close', () => {
    inflight--;
  });
  next();
}

export function installGracefulShutdown(server: Server, extra: Array<() => Promise<void>> = []) {
  let started = false;

  const shutdown = async (signal: string) => {
    if (started) return;
    started = true;
    draining = true;
    logger.info({ signal, inflight }, 'shutdown: draining');

    // 1. Fail readiness so the proxy stops sending new traffic
    await sleep(READINESS_GRACE_MS);

    // 2. Stop accepting connections; drop idle keep-alives
    server.close();
    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }

    // 3. Wait for in-flight requests (e.g. a Zebra batch mid-transaction)
    const deadline = Date.now() + DRAIN_MS;
    while (inflight > 0 && Date.now() < deadline) await sleep(100);
    if (inflight > 0) {
      logger.warn({ inflight }, 'shutdown: drain timeout, closing remaining connections');
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
    }

    // 4. Close resources in reverse dependency order
    const results = await Promise.allSettled([...extra.map((f) => f()), closeRedis(), closeRateLimiterRedis(), closeDatabasePools()]);
    results
      .filter((r) => r.status === 'rejected')
      .forEach((r) => logger.error({ err: (r as PromiseRejectedResult).reason }, 'shutdown: close failed'));

    logger.info('shutdown: complete');
    (logger as unknown as { flush?: () => void }).flush?.();
    process.exit(0);
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
