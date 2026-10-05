import type { Request, Response, NextFunction } from 'express';
import { isUuid } from '../lib/ids';
import { AppError } from '../errors/AppError';

export function extractSchoolId(req: Request): string {
  const url = req.originalUrl || req.url || '';
  const pathMatch = url.match(/\/schools\/([^/?#]+)/i);
  const pathId = (req as Request & { schoolId?: string }).schoolId || req.params?.schoolId || pathMatch?.[1];

  if (!pathId || !isUuid(String(pathId))) {
    throw new AppError('INVALID_SCHOOL_ID', 400, 'Invalid or missing schoolId in URL path');
  }

  const candidates: Array<[string, unknown]> = [
    ['header', req.headers['x-school-id']],
    ['query', (req.query as Record<string, unknown> | undefined)?.schoolId],
    ['body', (req.body as Record<string, unknown> | undefined)?.schoolId],
  ];

  for (const [source, val] of candidates) {
    if (val !== undefined && val !== null && String(val) !== pathId) {
      throw new AppError('SCHOOL_ID_MISMATCH', 400, `schoolId in ${source} does not match schoolId in URL path`);
    }
  }

  return String(pathId);
}

export function resolveSchoolId(req: Request, res?: Response, next?: NextFunction): string | void {
  if (!res || !next) {
    return extractSchoolId(req);
  }

  const url = req.originalUrl || req.url || '';
  if (url.startsWith('/api/v1/public/') || url.startsWith('/readyz') || url.startsWith('/metrics')) {
    return next();
  }

  const pathMatch = url.match(/\/schools\/([^/?#]+)/i);
  const pathId = req.params?.schoolId || pathMatch?.[1];

  if (!pathId || pathId === 'by-slug') return next(); // not a school-scoped route

  if (!isUuid(String(pathId))) {
    res.status(400).json({ success: false, error: 'INVALID_SCHOOL_ID' });
    return;
  }

  const candidates: Array<[string, unknown]> = [
    ['header', req.headers['x-school-id']],
    ['query', req.query?.schoolId],
    ['body', (req.body as Record<string, unknown> | undefined)?.schoolId],
  ];

  for (const [source, val] of candidates) {
    if (val !== undefined && val !== null && String(val) !== pathId) {
      res.status(400).json({
        success: false,
        error: 'SCHOOL_ID_MISMATCH',
        message: `schoolId in ${source} does not match schoolId in URL path`,
      });
      return;
    }
  }

  (req as Request & { schoolId?: string }).schoolId = pathId;
  if (!req.params) req.params = {};
  req.params.schoolId = pathId;

  next();
}
