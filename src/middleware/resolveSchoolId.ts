import type { Request, Response, NextFunction } from 'express';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveSchoolId(req: Request, res: Response, next: NextFunction) {
  const pathMatch = (req.originalUrl || req.url || '').match(/\/schools\/([^/?#]+)/i);
  const pathId = req.params?.schoolId || pathMatch?.[1];

  if (!pathId) return next(); // not a school-scoped route

  if (!UUID.test(pathId)) {
    return res.status(400).json({ success: false, error: 'INVALID_SCHOOL_ID' });
  }

  // If the client also sent a schoolId anywhere else, it MUST match the path.
  const candidates: Array<[string, unknown]> = [
    ['header', req.headers['x-school-id']],
    ['query', req.query?.schoolId],
    ['body', (req.body as any)?.schoolId],
  ];

  for (const [source, val] of candidates) {
    if (val !== undefined && val !== null && String(val) !== pathId) {
      return res.status(400).json({
        success: false,
        error: 'SCHOOL_ID_MISMATCH',
        message: `schoolId in ${source} does not match schoolId in URL path`,
      });
    }
  }

  // The rest of the app reads from here, nowhere else
  (req as any).schoolId = pathId;
  if (!req.params) req.params = {};
  req.params.schoolId = pathId;

  next();
}
