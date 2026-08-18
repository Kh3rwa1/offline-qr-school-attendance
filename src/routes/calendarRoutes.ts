import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import {
  approveCalendarVersion,
  bulkSetDateRange,
  getCalendarDays,
  getDefaultWestBengalHolidays,
  listCalendarVersions,
  populateDefaultWestBengalHolidays,
  upsertCalendarDay,
} from '../services/calendarService';

export const calendarRouter = Router({ mergeParams: true });

const ClassificationSchema = z.enum([
  'WORKING_DAY',
  'SUNDAY_WEEKEND',
  'GOVERNMENT_HOLIDAY',
  'SCHOOL_HOLIDAY',
  'VACATION',
  'EXAMINATION_DAY',
  'EMERGENCY_CLOSURE',
  'OPTIONAL_WORKING_DAY',
]);

const SourceTypeSchema = z.enum([
  'SCHOOL_CONFIRMED',
  'DEPARTMENT_ORDER',
  'LEGACY_UNVERIFIED',
  'SYSTEM_TEMPLATE',
]);

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const CalendarQuerySchema = z.object({
  startDate: DateSchema,
  endDate: DateSchema,
  versionId: z.string().uuid().optional(),
}).refine((value) => value.startDate <= value.endDate, {
  message: 'CALENDAR_RANGE_INVALID',
  path: ['endDate'],
});

const UpsertDaySchema = z.object({
  calendarDate: DateSchema,
  classification: ClassificationSchema,
  reason: z.string().max(255).optional(),
  isWorkingDay: z.boolean().optional(),
  sourceType: SourceTypeSchema.default('SCHOOL_CONFIRMED'),
  sourceReference: z.string().max(1000).optional(),
  isApproximate: z.boolean().default(false),
});

const BulkRangeSchema = z.object({
  startDate: DateSchema,
  endDate: DateSchema,
  classification: ClassificationSchema,
  reason: z.string().max(255).optional(),
  isWorkingDay: z.boolean().optional(),
  sourceType: SourceTypeSchema.default('SCHOOL_CONFIRMED'),
  sourceReference: z.string().max(1000).optional(),
  isApproximate: z.boolean().default(false),
}).refine((value) => value.startDate <= value.endDate, {
  message: 'CALENDAR_RANGE_INVALID',
  path: ['endDate'],
});

const YearSchema = z.coerce.number().int().min(2000).max(2100);
const ImportHolidaysSchema = z.object({ year: YearSchema });
const ApproveVersionSchema = z.object({ sourceReference: z.string().trim().min(3).max(1000) });

function sendError(res: Response, error: unknown) {
  if (error instanceof z.ZodError) {
    res.status(400).json({ success: false, error: 'CALENDAR_REQUEST_INVALID', issues: error.issues });
    return;
  }
  const code = error instanceof Error ? error.message : 'CALENDAR_REQUEST_FAILED';
  const status = code.includes('NOT_FOUND') ? 404 : code.includes('APPROXIMATE') || code.includes('NOT_DRAFT') ? 409 : 400;
  res.status(status).json({ success: false, error: code, messageKey: `calendar.error.${code}` });
}

calendarRouter.get(
  '/',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const currentYear = new Date().getFullYear();
      const rawStartDate = req.query.startDate;
      const rawEndDate = req.query.endDate;
      const rawVersionId = req.query.versionId;
      if (rawStartDate !== undefined && typeof rawStartDate !== 'string') throw new Error('CALENDAR_DATE_INVALID');
      if (rawEndDate !== undefined && typeof rawEndDate !== 'string') throw new Error('CALENDAR_DATE_INVALID');
      if (rawVersionId !== undefined && typeof rawVersionId !== 'string') throw new Error('CALENDAR_VERSION_ID_INVALID');
      const query = CalendarQuerySchema.parse({
        startDate: rawStartDate ?? `${currentYear}-01-01`,
        endDate: rawEndDate ?? `${currentYear}-12-31`,
        versionId: rawVersionId,
      });
      const schoolId = req.activeSchoolId!;
      const result = await getCalendarDays(schoolId, query.startDate, query.endDate, query.versionId);
      res.json({ success: true, schoolId, startDate: query.startDate, endDate: query.endDate, ...result });
    } catch (error) {
      sendError(res, error);
    }
  }
);

calendarRouter.get(
  '/versions',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const year = YearSchema.parse(req.query.year || new Date().getFullYear());
      const versions = await listCalendarVersions(req.activeSchoolId!, year);
      res.json({ success: true, year, versions });
    } catch (error) {
      sendError(res, error);
    }
  }
);

calendarRouter.get(
  '/planning-template',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const year = YearSchema.parse(req.query.year || new Date().getFullYear());
      const holidays = getDefaultWestBengalHolidays(year);
      res.json({
        success: true,
        year,
        holidays,
        approximateCount: holidays.filter((holiday) => holiday.isApproximate).length,
        authoritative: false,
        messageKey: 'calendar.template.reviewRequired',
      });
    } catch (error) {
      sendError(res, error);
    }
  }
);

calendarRouter.post(
  '/day',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validated = UpsertDaySchema.parse(req.body);
      const record = await upsertCalendarDay(req.activeSchoolId!, {
        ...validated,
        createdBy: req.user!.id,
      });
      res.json({ success: true, record, activationRequired: true });
    } catch (error) {
      sendError(res, error);
    }
  }
);

calendarRouter.post(
  '/range',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validated = BulkRangeSchema.parse(req.body);
      const result = await bulkSetDateRange(req.activeSchoolId!, {
        ...validated,
        createdBy: req.user!.id,
      });
      res.json({ success: true, count: result.count, activationRequired: true });
    } catch (error) {
      sendError(res, error);
    }
  }
);

calendarRouter.post(
  '/import',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validated = ImportHolidaysSchema.parse(req.body);
      const result = await populateDefaultWestBengalHolidays(
        req.activeSchoolId!,
        validated.year,
        req.user!.id
      );
      res.status(201).json({
        success: true,
        year: validated.year,
        ...result,
        authoritative: false,
        messageKey: 'calendar.template.importedAsDraft',
      });
    } catch (error) {
      sendError(res, error);
    }
  }
);

calendarRouter.post(
  '/versions/:versionId/approve',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const versionId = z.string().uuid().parse(req.params.versionId);
      const validated = ApproveVersionSchema.parse(req.body);
      const version = await approveCalendarVersion(
        req.activeSchoolId!,
        versionId,
        req.user!.id,
        validated.sourceReference
      );
      res.json({ success: true, version });
    } catch (error) {
      sendError(res, error);
    }
  }
);
