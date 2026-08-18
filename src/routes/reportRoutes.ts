import { Router, Response } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import { z } from 'zod';
import {
  getDailySchoolReport,
  getDailyClassReport,
  getMonthlyClassRegister,
  getStudentAttendanceHistory,
  getAbsentStudentReport,
  getAllAbsentStudentsForExport,
  getCorrectionReport,
  getAllCorrectionsForExport,
  getTeacherSessionReport,
  generateXLSXExport,
  generateCSVExport,
  sanitizeFilename,
  getFullTenantExport,
  generateGovernmentReadyReportData,
} from '../services/reportService';
import { validateReportScope } from '../services/reportValidationService';
import {
  createReportDraft,
  approveReportInternally,
  recordReportExport,
  getReportHistory,
} from '../services/reportApprovalService';
import {
  buildGovernmentReadyExcelWorkbook,
  buildSecureCSVExport,
  generateSafeExportFilename,
} from '../services/excelExportService';
import {
  teacherAssignments,
  attendanceSessions,
  attendanceRecords,
  enrollments,
  reportingProfiles,
  reportApprovals,
  schools,
} from '../db/schema';
import { eq, and, inArray, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import { createAuditLog } from '../services/auditLogService';

const reportRouter = Router({ mergeParams: true });

// Helper to check if a teacher has access to a specific classSectionId
async function teacherHasClassAccess(req: AuthenticatedRequest, schoolId: string, classSectionId?: string): Promise<boolean> {
  if (!classSectionId) return true;
  if (req.userRole === 'SUPER_ADMIN' || req.userRole === 'SCHOOL_ADMIN' || req.userRole === 'REPORT_VIEWER') {
    return true;
  }
  if (req.userRole === 'TEACHER') {
    const [assignment] = await db
      .select()
      .from(teacherAssignments)
      .where(
        and(
          eq(teacherAssignments.schoolId, schoolId),
          eq(teacherAssignments.teacherId, req.user!.id),
          eq(teacherAssignments.classSectionId, classSectionId)
        )
      );
    return !!assignment;
  }
  return false;
}

// Helper to check if a teacher has access to a specific student
async function teacherHasStudentAccess(req: AuthenticatedRequest, schoolId: string, studentId: string): Promise<boolean> {
  if (req.userRole === 'SUPER_ADMIN' || req.userRole === 'SCHOOL_ADMIN' || req.userRole === 'REPORT_VIEWER') {
    return true;
  }
  if (req.userRole === 'TEACHER') {
    const assignments = await db
      .select({ classSectionId: teacherAssignments.classSectionId })
      .from(teacherAssignments)
      .where(
        and(
          eq(teacherAssignments.schoolId, schoolId),
          eq(teacherAssignments.teacherId, req.user!.id)
        )
      );

    if (assignments.length === 0) return false;
    const assignedClassIds = assignments.map((a: any) => a.classSectionId);

    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.schoolId, schoolId),
          eq(enrollments.studentId, studentId),
          inArray(enrollments.classSectionId, assignedClassIds)
        )
      );
    return !!enrollment;
  }
  return false;
}

// 1. Daily School Attendance Summary (Admin & Report Viewer)
reportRouter.get(
  '/daily-school',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'REPORT_VIEWER']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];

      const report = await getDailySchoolReport(schoolId, dateStr);
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// 2. Daily Class Attendance Detail (Admin, Teacher, Report Viewer)
reportRouter.get(
  '/daily-class',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'REPORT_VIEWER']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const classSectionId = req.query.classSectionId as string;
      const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];

      if (!classSectionId) {
        res.status(400).json({ error: 'MISSING_CLASS_SECTION_ID' });
        return;
      }

      if (!await teacherHasClassAccess(req, schoolId, classSectionId)) {
        res.status(403).json({ error: 'UNAUTHORIZED_TEACHER_NOT_ASSIGNED' });
        return;
      }

      const report = await getDailyClassReport(schoolId, classSectionId, dateStr);
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// 3. Monthly Class Register Grid (Admin, Teacher, Report Viewer)
reportRouter.get(
  '/monthly-register',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'REPORT_VIEWER']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const classSectionId = req.query.classSectionId as string;
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

      if (!classSectionId) {
        res.status(400).json({ error: 'MISSING_CLASS_SECTION_ID' });
        return;
      }

      if (!await teacherHasClassAccess(req, schoolId, classSectionId)) {
        res.status(403).json({ error: 'UNAUTHORIZED_TEACHER_NOT_ASSIGNED' });
        return;
      }

      const report = await getMonthlyClassRegister(schoolId, classSectionId, year, month);
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// 4. Individual Student History (Admin, Teacher, Report Viewer)
reportRouter.get(
  '/student-history',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'REPORT_VIEWER']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const studentId = req.query.studentId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const limit = req.query.limit as string | undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;
      const cursor = req.query.cursor as string | undefined;

      if (!studentId) {
        res.status(400).json({ error: 'MISSING_STUDENT_ID' });
        return;
      }

      if (!await teacherHasStudentAccess(req, schoolId, studentId)) {
        res.status(403).json({ error: 'UNAUTHORIZED_TEACHER_NOT_ASSIGNED' });
        return;
      }

      const report = await getStudentAttendanceHistory(schoolId, studentId, startDate, endDate, { limit, offset, cursor });
      res.json(report);
    } catch (error: any) {
      if (error.message === 'INVALID_PAGINATION_CURSOR') {
        res.status(400).json({ error: 'INVALID_PAGINATION_CURSOR', message: 'The provided pagination cursor is invalid or malformed' });
        return;
      }
      res.status(400).json({ error: error.message });
    }
  }
);

// 5. Absent-Student Report (Admin, Teacher, Report Viewer)
reportRouter.get(
  '/absentee',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'REPORT_VIEWER']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const classSectionId = req.query.classSectionId as string;
      const startDate = (req.query.startDate as string) || new Date().toISOString().split('T')[0];
      const endDate = req.query.endDate as string;
      const reqGuardianPhone = req.query.includeGuardianPhone === 'true';
      const limit = req.query.limit as string | undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;
      const cursor = req.query.cursor as string | undefined;

      if (req.userRole === 'TEACHER' && !await teacherHasClassAccess(req, schoolId, classSectionId)) {
        res.status(403).json({ error: 'UNAUTHORIZED_TEACHER_NOT_ASSIGNED' });
        return;
      }

      const userRole = req.userRole!;
      const includeGuardianPhone = reqGuardianPhone && (userRole === 'SCHOOL_ADMIN' || userRole === 'SUPER_ADMIN');

      const report = await getAbsentStudentReport(schoolId, {
        classSectionId,
        startDate,
        endDate,
        includeGuardianPhone,
        limit,
        offset,
        cursor,
      });
      res.json(report);
    } catch (error: any) {
      if (error.message === 'INVALID_PAGINATION_CURSOR') {
        res.status(400).json({ error: 'INVALID_PAGINATION_CURSOR', message: 'The provided pagination cursor is invalid or malformed' });
        return;
      }
      res.status(400).json({ error: error.message });
    }
  }
);

// 6. Attendance Correction Report (Admin & Report Viewer)
reportRouter.get(
  '/corrections',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'REPORT_VIEWER']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const limit = req.query.limit as string | undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;
      const cursor = req.query.cursor as string | undefined;

      const report = await getCorrectionReport(schoolId, startDate, endDate, { limit, offset, cursor });
      res.json(report);
    } catch (error: any) {
      if (error.message === 'INVALID_PAGINATION_CURSOR') {
        res.status(400).json({ error: 'INVALID_PAGINATION_CURSOR', message: 'The provided pagination cursor is invalid or malformed' });
        return;
      }
      res.status(400).json({ error: error.message });
    }
  }
);

// 7. Teacher / Session Audit Report (Admin & Report Viewer)
reportRouter.get(
  '/teacher-sessions',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'REPORT_VIEWER']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const limit = req.query.limit as string | undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;
      const cursor = req.query.cursor as string | undefined;

      const report = await getTeacherSessionReport(schoolId, startDate, endDate, { limit, offset, cursor });
      res.json(report);
    } catch (error: any) {
      if (error.message === 'INVALID_PAGINATION_CURSOR') {
        res.status(400).json({ error: 'INVALID_PAGINATION_CURSOR', message: 'The provided pagination cursor is invalid or malformed' });
        return;
      }
      res.status(400).json({ error: error.message });
    }
  }
);

// 8. Full Tenant Data Portability Package Export (SUPER_ADMIN, SCHOOL_ADMIN)
reportRouter.get(
  '/export/full-tenant',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const exportData = await getFullTenantExport(schoolId);

      await createAuditLog({
        schoolId,
        actorId: req.user!.id,
        action: 'EXPORT_FULL_TENANT_DATA',
        resourceType: 'SCHOOL',
        metadata: {
          schoolSlug: exportData.school.slug,
          studentCount: exportData.students.length,
          enrollmentCount: exportData.enrollments.length,
        },
      });

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="attendease_tenant_export_${exportData.school.slug}_${Date.now()}.json"`);
      res.json(exportData);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// 9. Universal Export Endpoint (XLSX / CSV)
reportRouter.get(
  '/export',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'REPORT_VIEWER']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const userRole = req.userRole!;
      const type = req.query.type as string; // 'monthly-register' | 'absentee' | 'daily-school' | 'daily-class' | 'corrections'
      const format = ((req.query.format as string) || 'xlsx').toLowerCase(); // 'xlsx' | 'csv'

      let headers: string[] = [];
      let rows: (string | number | boolean | null)[][] = [];
      let defaultFilename = `report_${type}_${Date.now()}`;

      if (type === 'daily-school') {
        if (userRole === 'TEACHER') {
          res.status(403).json({ error: 'FORBIDDEN' });
          return;
        }
        const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
        const data = await getDailySchoolReport(schoolId, dateStr);
        headers = ['Class', 'Section', 'Present', 'Late', 'Absent', 'Leave', 'Excused', 'Total', 'Attendance %'];
        rows = data.sections.map((s: any) => [
          s.className,
          s.sectionName,
          s.present,
          s.late,
          s.absent,
          s.leave,
          s.excused,
          s.total,
          `${s.attendancePercentage}%`,
        ]);
        defaultFilename = `daily_school_report_${dateStr}`;
      } else if (type === 'daily-class') {
        const classSectionId = req.query.classSectionId as string;
        const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
        if (!classSectionId || !await teacherHasClassAccess(req, schoolId, classSectionId)) {
          res.status(403).json({ error: 'UNAUTHORIZED_TEACHER_NOT_ASSIGNED' });
          return;
        }
        const data = await getDailyClassReport(schoolId, classSectionId, dateStr);
        headers = ['Roll', 'Student Code', 'Name', 'Name (Bengali)', 'Status', 'First Scanned At', 'Conflict', 'Correction Reason'];
        rows = data.roster.map((r: any) => [
          r.rollNumber,
          r.studentCode,
          r.studentName,
          r.studentNameBn || '',
          r.status,
          r.firstScannedAt || '',
          r.hasConflict ? 'Yes' : 'No',
          r.correctionReason || '',
        ]);
        defaultFilename = `daily_class_${data.className}_${data.sectionName}_${dateStr}`;
      } else if (type === 'monthly-register') {
        const classSectionId = req.query.classSectionId as string;
        const year = parseInt(req.query.year as string) || new Date().getFullYear();
        const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
        if (!classSectionId || !await teacherHasClassAccess(req, schoolId, classSectionId)) {
          res.status(403).json({ error: 'UNAUTHORIZED_TEACHER_NOT_ASSIGNED' });
          return;
        }
        const data = await getMonthlyClassRegister(schoolId, classSectionId, year, month);

        headers = ['Roll', 'Student Code', 'Name', 'Name (Bengali)'];
        for (let d = 1; d <= data.daysInMonth; d++) {
          headers.push(`Day ${d}`);
        }
        headers.push('Present', 'Late', 'Absent', 'Leave', 'Excused', 'Attendance %');

        rows = data.students.map((st: any) => {
          const r: (string | number | boolean | null)[] = [
            st.rollNumber,
            st.studentCode,
            st.name,
            st.nameBn || '',
          ];
          for (let d = 1; d <= data.daysInMonth; d++) {
            r.push(st.attendanceGrid[d] || '-');
          }
          r.push(
            st.summary.presentCount,
            st.summary.lateCount,
            st.summary.absentCount,
            st.summary.leaveCount,
            st.summary.excusedCount,
            `${st.summary.attendancePercentage}%`
          );
          return r;
        });
        defaultFilename = `monthly_register_${data.className}_${data.sectionName}_${year}_${month}`;
      } else if (type === 'absentee') {
        const classSectionId = req.query.classSectionId as string;
        const startDate = (req.query.startDate as string) || new Date().toISOString().split('T')[0];
        const endDate = req.query.endDate as string;
        const reqGuardianPhone = req.query.includeGuardianPhone === 'true';
        if (!await teacherHasClassAccess(req, schoolId, classSectionId)) {
          res.status(403).json({ error: 'UNAUTHORIZED_TEACHER_NOT_ASSIGNED' });
          return;
        }
        const includeGuardianPhone = reqGuardianPhone && (userRole === 'SCHOOL_ADMIN' || userRole === 'SUPER_ADMIN');

        const absentees = await getAllAbsentStudentsForExport(schoolId, {
          classSectionId,
          startDate,
          endDate,
          includeGuardianPhone,
        });

        headers = ['Date', 'Class', 'Section', 'Student Code', 'Name', 'Name (Bengali)'];
        if (includeGuardianPhone) headers.push('Guardian Phone');

        rows = absentees.map((a: any) => {
          const r: (string | number | boolean | null)[] = [
            a.sessionDate,
            a.className,
            a.sectionName,
            a.studentCode,
            a.studentName,
            a.studentNameBn || '',
          ];
          if (includeGuardianPhone) r.push(a.guardianPhone || '');
          return r;
        });
        defaultFilename = `absentee_report_${startDate}`;
      } else if (type === 'corrections') {
        if (userRole === 'TEACHER') {
          res.status(403).json({ error: 'FORBIDDEN' });
          return;
        }
        const startDate = req.query.startDate as string;
        const endDate = req.query.endDate as string;
        const corrections = await getAllCorrectionsForExport(schoolId, startDate, endDate);

        headers = ['Correction ID', 'Date', 'Class', 'Section', 'Student Code', 'Student Name', 'Previous Status', 'New Status', 'Reason', 'Corrected By', 'Corrected At'];
        rows = corrections.map((c: any) => [
          c.correctionId,
          c.sessionDate,
          c.className,
          c.sectionName,
          c.studentCode,
          c.studentName,
          c.previousStatus,
          c.newStatus,
          c.correctionReason || '—',
          c.correctedByName || '—',
          c.correctedAt ? new Date(c.correctedAt).toISOString() : '—',
        ]);
        defaultFilename = `corrections_report_${startDate || 'all'}`;
      } else {
        res.status(400).json({ error: 'INVALID_EXPORT_TYPE' });
        return;
      }

      const safeName = sanitizeFilename(defaultFilename);

      await createAuditLog({
        schoolId,
        actorId: req.user!.id,
        action: 'EXPORT_REPORT',
        resourceType: 'REPORT',
        metadata: {
          type,
          format,
          filename: safeName,
          rowCount: rows.length,
        },
      });

      if (format === 'csv') {
        const csvBuf = generateCSVExport(headers, rows);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}.csv"`);
        res.send(csvBuf);
      } else {
        const xlsxBuf = await generateXLSXExport(type, headers, rows);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}.xlsx"`);
        res.send(xlsxBuf);
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// 10. Multi-Day Attendance Trends Rollup (Single Optimized Grouped SQL Query)
reportRouter.get(
  '/trends',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'REPORT_VIEWER']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const MAX_TREND_RANGE_DAYS = 90;

      let minDateStr: string;
      let maxDateStr: string;
      let dateCount: number;

      if (req.query.startDate && req.query.endDate) {
        const start = new Date(req.query.startDate as string);
        const end = new Date(req.query.endDate as string);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          res.status(400).json({ error: 'INVALID_DATE_FORMAT', message: 'startDate and endDate must be valid ISO date strings' });
          return;
        }
        if (end < start) {
          res.status(400).json({ error: 'INVALID_DATE_RANGE', message: 'endDate must be greater than or equal to startDate' });
          return;
        }
        const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        if (diffDays > MAX_TREND_RANGE_DAYS) {
          res.status(400).json({ error: 'DATE_RANGE_EXCEEDED', message: `Date range cannot exceed ${MAX_TREND_RANGE_DAYS} days` });
          return;
        }
        minDateStr = start.toISOString().slice(0, 10);
        maxDateStr = end.toISOString().slice(0, 10);
        dateCount = diffDays;
      } else {
        const days = Math.min(Math.max(Number(req.query.days) || 7, 1), MAX_TREND_RANGE_DAYS);
        const today = new Date();
        const minDate = new Date(today);
        minDate.setDate(minDate.getDate() - (days - 1));
        minDateStr = minDate.toISOString().slice(0, 10);
        maxDateStr = today.toISOString().slice(0, 10);
        dateCount = days;
      }

      // Execute ONE single grouped SQL query for the entire date range
      const rows = await db
        .select({
          sessionDate: attendanceSessions.sessionDate,
          total: sql<number>`count(*)::int`,
          present: sql<number>`count(case when ${attendanceRecords.status} in ('PRESENT', 'LATE') then 1 end)::int`,
          absent: sql<number>`count(case when ${attendanceRecords.status} = 'ABSENT' then 1 end)::int`,
        })
        .from(attendanceRecords)
        .innerJoin(attendanceSessions, eq(attendanceRecords.attendanceSessionId, attendanceSessions.id))
        .where(
          and(
            eq(attendanceRecords.schoolId, schoolId),
            gte(attendanceSessions.sessionDate, minDateStr),
            lte(attendanceSessions.sessionDate, maxDateStr)
          )
        )
        .groupBy(attendanceSessions.sessionDate);

      const statsByDate = new Map<string, { total: number; present: number; absent: number }>();
      for (const r of rows) {
        statsByDate.set(r.sessionDate, { total: r.total, present: r.present, absent: r.absent });
      }

      const trends = [];
      const curr = new Date(minDateStr);
      const end = new Date(maxDateStr);

      while (curr <= end) {
        const dateStr = curr.toISOString().slice(0, 10);
        const stats = statsByDate.get(dateStr) || { total: 0, present: 0, absent: 0 };
        const pct = stats.total > 0 ? Math.round((stats.present / stats.total) * 1000) / 10 : 0;
        trends.push({
          date: dateStr,
          day: curr.toLocaleDateString('en-US', { weekday: 'short' }),
          totalStudents: stats.total,
          presentStudents: stats.present,
          absentStudents: stats.absent,
          percentage: pct,
        });
        curr.setDate(curr.getDate() + 1);
      }

      res.json({ success: true, days: dateCount, startDate: minDateStr, endDate: maxDateStr, trends });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// ──────────────────────────────────────────────────────────────────────────
// 11. Government-Ready Reporting Endpoints
// ──────────────────────────────────────────────────────────────────────────

const ValidateReportSchema = z.object({
  reportType: z.string().min(1),
  scopeType: z.enum(['WHOLE_SCHOOL', 'ALL_CLASSES', 'SELECTED_CLASSES', 'SELECTED_SECTION', 'SELECTED_STUDENTS', 'ONE_STUDENT']),
  classSectionIds: z.array(z.string().uuid()).optional(),
  studentIds: z.array(z.string().uuid()).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
});

const GenerateReportSchema = z.object({
  reportType: z.string().min(1),
  scopeType: z.enum(['WHOLE_SCHOOL', 'ALL_CLASSES', 'SELECTED_CLASSES', 'SELECTED_SECTION', 'SELECTED_STUDENTS', 'ONE_STUDENT']),
  classSectionIds: z.array(z.string().uuid()).optional(),
  studentIds: z.array(z.string().uuid()).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
  periodType: z.string().default('MONTHLY'),
  format: z.enum(['xlsx', 'csv', 'html']).default('xlsx'),
  profileId: z.string().uuid().optional(),
  profileVersion: z.string().optional(),
});

// A. List Available Reporting Profiles
reportRouter.get(
  '/profiles',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const profiles = await db
        .select()
        .from(reportingProfiles)
        .where(sql`${reportingProfiles.schoolId} = ${schoolId} OR ${reportingProfiles.schoolId} IS NULL`)
        .orderBy(reportingProfiles.profileName);

      res.json({
        success: true,
        profiles: [
          {
            id: 'wb-gov-ready-default',
            profileName: 'West Bengal Management Attendance Register',
            version: '1.0.0',
            isDefault: true,
            description: 'Standardized management attendance register format for West Bengal school education with UDISE and Banglar Shiksha identifier support.',
          },
          ...profiles,
        ],
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// B. Pre-flight Validate Report Scope & Metadata
reportRouter.post(
  '/validate',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'REPORT_VIEWER', 'TEACHER']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const validated = ValidateReportSchema.parse(req.body);

      // Teacher scope restriction
      if (req.userRole === 'TEACHER' && validated.classSectionIds) {
        for (const cid of validated.classSectionIds) {
          if (!(await teacherHasClassAccess(req, schoolId, cid))) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Teacher is not assigned to one or more requested classes.' });
            return;
          }
        }
      }

      const result = await validateReportScope({
        schoolId,
        reportType: validated.reportType,
        scopeType: validated.scopeType,
        classSectionIds: validated.classSectionIds,
        studentIds: validated.studentIds,
        startDate: validated.startDate,
        endDate: validated.endDate,
      });

      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// C. Generate Report Version & Compute Checksum
reportRouter.post(
  '/generate',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'REPORT_VIEWER', 'TEACHER']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const validated = GenerateReportSchema.parse(req.body);

      // Teacher scope verification
      if (req.userRole === 'TEACHER') {
        if (validated.scopeType === 'WHOLE_SCHOOL' || validated.scopeType === 'ALL_CLASSES') {
          res.status(403).json({ error: 'FORBIDDEN', message: 'Teachers may only export assigned class sections.' });
          return;
        }
        if (validated.classSectionIds) {
          for (const cid of validated.classSectionIds) {
            if (!(await teacherHasClassAccess(req, schoolId, cid))) {
              res.status(403).json({ error: 'FORBIDDEN', message: 'Teacher is not assigned to one or more requested classes.' });
              return;
            }
          }
        }
      }

      // 1. Create Report Draft
      const { report, validationResult } = await createReportDraft({
        schoolId,
        reportType: validated.reportType,
        scopeType: validated.scopeType,
        scopeParameters: {
          classSectionIds: validated.classSectionIds,
          studentIds: validated.studentIds,
          format: validated.format,
        },
        periodType: validated.periodType,
        periodStartDate: validated.startDate,
        periodEndDate: validated.endDate,
        profileId: validated.profileId,
        profileVersion: validated.profileVersion,
        actorId: req.user!.id,
      });

      if (!validationResult.isValid) {
        res.status(400).json({
          error: 'REPORT_VALIDATION_FAILED',
          message: 'Report cannot be generated due to blocking errors.',
          blockingErrors: validationResult.blockingErrors,
          reportId: report.id,
        });
        return;
      }

      // 2. Fetch Data & Build Output
      const reportPayload = await generateGovernmentReadyReportData({
        schoolId,
        reportType: validated.reportType,
        scopeType: validated.scopeType,
        classSectionIds: validated.classSectionIds,
        studentIds: validated.studentIds,
        startDate: validated.startDate,
        endDate: validated.endDate,
        reportVersion: report.reportVersion,
        profileVersion: validated.profileVersion,
        internalApprovalStatus: report.status,
      });

      let fileBuffer: Buffer;
      if (validated.format === 'csv') {
        // Summary CSV
        const headers = ['Class', 'Section', 'Roll', 'Banglar Shiksha ID', 'Student Name', 'Present', 'Late', 'Absent', 'Leave', 'Working Days', 'Attendance %'];
        const rows: any[] = [];
        for (const cr of reportPayload.classRegisters) {
          for (const stu of cr.students) {
            rows.push([
              cr.className,
              cr.sectionName,
              stu.rollNumber,
              stu.banglarShikshaId || '—',
              stu.name,
              stu.presentCount,
              stu.lateCount,
              stu.absentCount,
              stu.leaveCount,
              stu.workingDays,
              `${stu.attendancePercentage}%`,
            ]);
          }
        }
        fileBuffer = buildSecureCSVExport(headers, rows);
      } else {
        fileBuffer = await buildGovernmentReadyExcelWorkbook(reportPayload);
      }

      // 3. Record Hash & Export Status
      const { hash } = await recordReportExport({
        schoolId,
        reportId: report.id,
        fileBuffer,
        actorId: req.user!.id,
      });

      const safeFilename = generateSafeExportFilename({
        udiseCode: reportPayload.school.udiseCode,
        scope: validated.scopeType.toLowerCase(),
        period: `${validated.startDate}_${validated.endDate}`,
        reportVersion: report.reportVersion,
        format: validated.format,
      });

      res.json({
        success: true,
        reportId: report.id,
        reportVersion: report.reportVersion,
        status: report.status,
        fileHashSha256: hash,
        filename: safeFilename,
        downloadUrl: `/api/v1/schools/${schoolId}/reports/${report.id}/download?format=${validated.format}`,
        summary: validationResult.summary,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// D. Download Generated Report File
reportRouter.get(
  '/:reportId/download',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const reportId = req.params.reportId;
      const format = (req.query.format as 'xlsx' | 'csv') || 'xlsx';

      const [report] = await db
        .select()
        .from(reportApprovals)
        .where(
          and(
            eq(reportApprovals.id, reportId),
            eq(reportApprovals.schoolId, schoolId)
          )
        );

      if (!report) {
        res.status(404).json({ error: 'REPORT_NOT_FOUND', message: 'The requested report was not found.' });
        return;
      }

      const scopeParams = (report.scopeParameters as any) || {};

      const reportPayload = await generateGovernmentReadyReportData({
        schoolId,
        reportType: report.reportType,
        scopeType: report.scopeType as any,
        classSectionIds: scopeParams.classSectionIds,
        studentIds: scopeParams.studentIds,
        startDate: report.periodStartDate,
        endDate: report.periodEndDate,
        reportVersion: report.reportVersion,
        profileVersion: report.profileVersion || undefined,
        internalApprovalStatus: report.status,
      });

      let fileBuffer: Buffer;
      let contentType: string;

      if (format === 'csv') {
        const headers = ['Class', 'Section', 'Roll', 'Banglar Shiksha ID', 'Student Name', 'Present', 'Late', 'Absent', 'Leave', 'Working Days', 'Attendance %'];
        const rows: any[] = [];
        for (const cr of reportPayload.classRegisters) {
          for (const stu of cr.students) {
            rows.push([
              cr.className,
              cr.sectionName,
              stu.rollNumber,
              stu.banglarShikshaId || '—',
              stu.name,
              stu.presentCount,
              stu.lateCount,
              stu.absentCount,
              stu.leaveCount,
              stu.workingDays,
              `${stu.attendancePercentage}%`,
            ]);
          }
        }
        fileBuffer = buildSecureCSVExport(headers, rows);
        contentType = 'text/csv; charset=utf-8';
      } else {
        fileBuffer = await buildGovernmentReadyExcelWorkbook(reportPayload);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      }

      const safeFilename = generateSafeExportFilename({
        udiseCode: reportPayload.school.udiseCode,
        scope: report.scopeType.toLowerCase(),
        period: `${report.periodStartDate}_${report.periodEndDate}`,
        reportVersion: report.reportVersion,
        format,
      });

      await recordReportExport({
        schoolId,
        reportId: report.id,
        fileBuffer,
        actorId: req.user?.id,
      });

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.send(fileBuffer);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// E. Internal Management Approval
reportRouter.post(
  '/:reportId/approve',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const reportId = req.params.reportId;

      const approved = await approveReportInternally({
        schoolId,
        reportId,
        actorId: req.user!.id,
        userRole: req.userRole!,
      });

      res.json({ success: true, report: approved });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// F. Report History & Audit Trail
reportRouter.get(
  '/history',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'REPORT_VIEWER']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const history = await getReportHistory(schoolId, limit, offset);
      res.json({ success: true, history });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

export default reportRouter;

