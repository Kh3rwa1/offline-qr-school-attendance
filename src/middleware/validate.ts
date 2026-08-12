import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';

export function validateRequest(schemas: {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.params) {
        req.params = (await schemas.params.parseAsync(req.params)) as any;
      }
      if (schemas.query) {
        req.query = (await schemas.query.parseAsync(req.query)) as any;
      }
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      next();
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Invalid request payload or parameters',
          details: error.issues.map((e: any) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      return res.status(400).json({
        success: false,
        error: 'INVALID_INPUT',
        message: error.message || 'Invalid request data',
      });
    }
  };
}

export const commonSchemas = {
  uuid: z.string().uuid({ message: 'Invalid UUID format' }),
  isoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Invalid ISO date format (YYYY-MM-DD)' }),
  isoTimestamp: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid ISO timestamp' }),
  attendanceStatus: z.enum(['PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'EXCUSED']),
  sessionStatus: z.enum(['OPEN', 'FINALIZED', 'REOPENED', 'ARCHIVED']),
  sessionType: z.enum(['DAILY', 'SUBJECT', 'EXAM']),
  scanSource: z.enum(['CAMERA', 'USB', 'MANUAL']),
};
