import type { AppError } from './AppError';
import { logger } from '../lib/logger';

export function logError(
  req: { id?: string; method: string; originalUrl: string },
  e: AppError
) {
  const logFn = e.status >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
  logFn(
    {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl ? req.originalUrl.split('?')[0] : '', // never log query strings (tokens end up there)
      code: e.code,
      status: e.status,
      internal: e.internal,
      err: e.cause instanceof Error ? e.cause : e,
    },
    e.message
  );
}

