import type { AppError } from './AppError';

export function logError(
  req: { id?: string; method: string; originalUrl: string },
  e: AppError
) {
  const entry = {
    level: e.status >= 500 ? 'error' : 'warn',
    ts: new Date().toISOString(),
    requestId: req.id,
    method: req.method,
    path: req.originalUrl ? req.originalUrl.split('?')[0] : '', // never log query strings (tokens end up there)
    code: e.code,
    status: e.status,
    internal: e.internal,
    stack: e.status >= 500 ? (e.cause instanceof Error ? e.cause.stack : e.stack) : undefined,
  };
  (e.status >= 500 ? console.error : console.warn)(JSON.stringify(entry));
}
