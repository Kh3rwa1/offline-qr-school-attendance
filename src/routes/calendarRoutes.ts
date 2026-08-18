import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import {
  getCalendarDays,
  upsertCalendarDay,
  bulkSetDateRange,
  populateDefaultWestBengalHolidays,
  getDefaultWestBengalHolidays,
} from '../services/calendarService';

export const calendarRouter = Router({ mergeParams: true });

const UpsertDaySchema = z.object({
  calendarDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  classification: z.enum([
    'WORKING_DAY',
    'SUNDAY_WEEKEND',
    'GOVERNMENT_HOLIDAY',
    'SCHOOL_HOLIDAY',
    'VACATION',
    'EXAMINATION_DAY',
    'EMERGENCY_CLOSURE',
    'OPTIONAL_WORKING_DAY',
  ]),
  reason: z.string().max(255).optional(),
  isWorkingDay: z.boolean().optional(),
});

const BulkRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format'),
  classification: z.enum([
    'WORKING_DAY',
    'SUNDAY_WEEKEND',
    'GOVERNMENT_HOLIDAY',
    'SCHOOL_HOLIDAY',
    'VACATION',
    'EXAMINATION_DAY',
    'EMERGENCY_CLOSURE',
    'OPTIONAL_WORKING_DAY',
  ]),
  reason: z.string().max(255).optional(),
  isWorkingDay: z.boolean().optional(),
});

const ImportHolidaysSchema = z.object({
  year: z.number().int().min(2000).max(2100),
});

// 1. GET /api/v1/schools/:schoolId/calendar
calendarRouter.get(
  '/',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const startDate = (req.query.startDate as string) || `${new Date().getFullYear()}-01-01`;
      const endDate = (req.query.endDate as string) || `${new Date().getFullYear()}-12-31`;

      const days = await getCalendarDays(schoolId, startDate, endDate);
      res.json({ success: true, schoolId, startDate, endDate, days });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// 2. POST /api/v1/schools/:schoolId/calendar/day
calendarRouter.post(
  '/day',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const validated = UpsertDaySchema.parse(req.body);

      const record = await upsertCalendarDay(schoolId, {
        calendarDate: validated.calendarDate,
        classification: validated.classification,
        reason: validated.reason,
        isWorkingDay: validated.isWorkingDay,
        createdBy: req.user!.id,
      });

      res.json({ success: true, record });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// 3. POST /api/v1/schools/:schoolId/calendar/range
calendarRouter.post(
  '/range',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const validated = BulkRangeSchema.parse(req.body);

      const result = await bulkSetDateRange(schoolId, {
        startDate: validated.startDate,
        endDate: validated.endDate,
        classification: validated.classification,
        reason: validated.reason,
        isWorkingDay: validated.isWorkingDay,
        createdBy: req.user!.id,
      });

      res.json({ success: true, count: result.count });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// 4. POST /api/v1/schools/:schoolId/calendar/import
calendarRouter.post(
  '/import',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const validated = ImportHolidaysSchema.parse(req.body);

      const result = await populateDefaultWestBengalHolidays(schoolId, validated.year, req.user!.id);
      res.json({ success: true, year: validated.year, importedCount: result.importedCount });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);
