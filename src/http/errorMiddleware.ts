import type { Request, Response, NextFunction } from 'express';
import { toAppError } from '../errors/AppError';
import { logger } from '../lib/logger';

export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const e = toAppError(err);
  const log = (req as Request & { log?: typeof logger }).log ?? logger;
  const level = e.status >= 500 ? 'error' : 'warn';
  log[level]({ err: e.cause ?? e, code: e.code, internal: e.internal }, e.code);

  if (res.headersSent) return; // streaming responses (CSV export): can't change status now
  res.status(e.status).json({
    success: false,
    error: e.code,
    message: e.publicMessage,
    requestId: (req as Request & { id?: string }).id ?? (req.headers['x-request-id'] as string | undefined),
    ...(e.details ? { details: e.details } : {}),
  });
}
