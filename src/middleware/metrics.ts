import { Request, Response, NextFunction } from 'express';
import { getDbPoolMetrics } from '../db';
import crypto from 'node:crypto';

interface MetricCounters {
  httpRequestsTotal: Map<string, number>;
  httpDurationSum: Map<string, number>;
  httpDurationCount: Map<string, number>;
}

const MAX_CARDINALITY_KEYS = 1000;
const metrics: MetricCounters = {
  httpRequestsTotal: new Map(),
  httpDurationSum: new Map(),
  httpDurationCount: new Map(),
};

let postgresUpGauge = 1;
let redisUpGauge = 1;

export function setDependencyHealthMetrics(postgres: boolean, redis: boolean) {
  postgresUpGauge = postgres ? 1 : 0;
  redisUpGauge = redis ? 1 : 0;
}

/**
 * Normalizes request paths to prevent high-cardinality metric map growth and memory exhaustion.
 */
function normalizePath(rawPath: any): string {
  const str = typeof rawPath === 'string' ? rawPath : (Array.isArray(rawPath) ? rawPath.join('_') : String(rawPath || ''));
  return str
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+/g, '/:id');
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const durationSec = (Date.now() - start) / 1000;
    const path = normalizePath(req.route?.path || req.path);
    const key = `${req.method}:${path}:${res.statusCode}`;

    if (metrics.httpRequestsTotal.size < MAX_CARDINALITY_KEYS || metrics.httpRequestsTotal.has(key)) {
      metrics.httpRequestsTotal.set(key, (metrics.httpRequestsTotal.get(key) || 0) + 1);
      metrics.httpDurationSum.set(key, (metrics.httpDurationSum.get(key) || 0) + durationSec);
      metrics.httpDurationCount.set(key, (metrics.httpDurationCount.get(key) || 0) + 1);
    }
  });

  next();
}

/**
 * Authenticated Prometheus metrics endpoint renderer.
 * Strictly requires Authorization: Bearer <METRICS_AUTH_TOKEN> header in production mode.
 */
export function renderPrometheusMetrics(req?: Request): { authorized: boolean; content: string } {
  const requiredToken = process.env.METRICS_AUTH_TOKEN;

  if (process.env.NODE_ENV === 'production') {
    if (!requiredToken) {
      return { authorized: false, content: 'METRICS_AUTH_TOKEN_REQUIRED_IN_PRODUCTION' };
    }
    const authHeader = req?.headers.authorization;
    const providedToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    if (!providedToken || providedToken.length !== requiredToken.length || !crypto.timingSafeEqual(Buffer.from(providedToken), Buffer.from(requiredToken))) {
      return { authorized: false, content: 'UNAUTHORIZED_METRICS_ACCESS' };
    }
  }

  const lines: string[] = [];
  const pool = getDbPoolMetrics();

  lines.push('# HELP app_postgres_up PostgreSQL database connectivity health state (1=up, 0=down)');
  lines.push('# TYPE app_postgres_up gauge');
  lines.push(`app_postgres_up ${postgresUpGauge}`);

  lines.push('# HELP app_redis_up Redis cluster connectivity health state (1=up, 0=down)');
  lines.push('# TYPE app_redis_up gauge');
  lines.push(`app_redis_up ${redisUpGauge}`);

  lines.push('# HELP db_pool_connections_total Total active database pool connections');
  lines.push('# TYPE db_pool_connections_total gauge');
  lines.push(`db_pool_connections_total ${pool.totalCount}`);

  lines.push('# HELP db_pool_connections_idle Idle database pool connections');
  lines.push('# TYPE db_pool_connections_idle gauge');
  lines.push(`db_pool_connections_idle ${pool.idleCount}`);

  lines.push('# HELP db_pool_connections_waiting Waiting connection requests');
  lines.push('# TYPE db_pool_connections_waiting gauge');
  lines.push(`db_pool_connections_waiting ${pool.waitingCount}`);

  lines.push('# HELP http_requests_total Total HTTP requests');
  lines.push('# TYPE http_requests_total counter');
  for (const [key, count] of metrics.httpRequestsTotal.entries()) {
    const [method, path, status] = key.split(':');
    lines.push(`http_requests_total{method="${method}",path="${path}",status="${status}"} ${count}`);
  }

  return { authorized: true, content: lines.join('\n') + '\n' };
}
