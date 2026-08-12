import { Router, Response } from 'express';
import {
  getDailySchoolReport,
  getDailyClassReport,
  getMonthlyClassRegister,
  getStudentAttendanceHistory,
  getAbsentStudentReport,
  getCorrectionReport,
  getTeacherSessionReport,
  generateXLSXExport,
  generateCSVExport,
  sanitizeFilename,
} from '../services/reportService';
import { createAuditLog } from '../services/auditLogService';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';

const reportRouter = Router({ mergeParams: true });

// 1. Daily School Summary (Admin only)
reportRouter.get(
  '/daily-school',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
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

// 2. Daily Class Detail
reportRouter.get(
  '/daily-class',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const classSectionId = req.query.classSectionId as string;
      const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];

      if (!classSectionId) {
        res.status(400).json({ error: 'MISSING_CLASS_SECTION_ID' });
        return;
      }

      const report = await getDailyClassReport(schoolId, classSectionId, dateStr);
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// 3. Monthly Class Register
reportRouter.get(
  '/monthly-register',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
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

      const report = await getMonthlyClassRegister(schoolId, classSectionId, year, month);
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// 4. Individual Student History
reportRouter.get(
  '/student-history',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const studentId = req.query.studentId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      if (!studentId) {
        res.status(400).json({ error: 'MISSING_STUDENT_ID' });
        return;
      }

      const report = await getStudentAttendanceHistory(schoolId, studentId, startDate, endDate);
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// 5. Absent-Student Report
reportRouter.get(
  '/absentee',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const classSectionId = req.query.classSectionId as string;
      const startDate = (req.query.startDate as string) || new Date().toISOString().split('T')[0];
      const endDate = req.query.endDate as string;
      const reqGuardianPhone = req.query.includeGuardianPhone === 'true';

      // Guardian phone number authorization check: only admins or super_admins
      const userRole = req.userRole!;
      const includeGuardianPhone = reqGuardianPhone && (userRole === 'SCHOOL_ADMIN' || userRole === 'SUPER_ADMIN');

      const report = await getAbsentStudentReport(schoolId, {
        classSectionId,
        startDate,
        endDate,
        includeGuardianPhone,
      });
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// 6. Attendance Correction Report (Admin only)
reportRouter.get(
  '/corrections',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const report = await getCorrectionReport(schoolId, startDate, endDate);
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// 7. Teacher / Session Audit Report (Admin only)
reportRouter.get(
  '/teacher-sessions',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const report = await getTeacherSessionReport(schoolId, startDate, endDate);
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

// 8. Universal Export Endpoint (XLSX / CSV)
reportRouter.get(
  '/export',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const schoolId = req.activeSchoolId!;
      const userRole = req.userRole!;
      const type = req.query.type as string; // 'monthly-register' | 'absentee' | 'daily-school' | 'daily-class'
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
      } else if (type === 'monthly-register') {
        const classSectionId = req.query.classSectionId as string;
        const year = parseInt(req.query.year as string) || new Date().getFullYear();
        const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
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
        const includeGuardianPhone = reqGuardianPhone && (userRole === 'SCHOOL_ADMIN' || userRole === 'SUPER_ADMIN');

        const data = await getAbsentStudentReport(schoolId, {
          classSectionId,
          startDate,
          endDate,
          includeGuardianPhone,
        });

        headers = ['Date', 'Class', 'Section', 'Student Code', 'Name', 'Name (Bengali)'];
        if (includeGuardianPhone) headers.push('Guardian Phone');

        rows = data.absentees.map((a: any) => {
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
        const xlsxBuf = generateXLSXExport(type, headers, rows);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}.xlsx"`);
        res.send(xlsxBuf);
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

export default reportRouter;
