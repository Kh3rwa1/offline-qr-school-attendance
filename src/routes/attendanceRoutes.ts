import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import { validateRequest, commonSchemas } from '../middleware/validate';
import {
  getTeacherAssignedClasses,
  createAttendanceSession,
  updateSessionStatus,
  processQRCode,
  manualStatusUpdate,
  getAttendanceSessionDetails,
  getDailyClassReport,
  getTodayGateAttendance,
  SessionStatus,
  AttendanceStatus,
} from '../services/attendanceService';
import { db } from '../db';
import { attendanceSessions, classSections } from '../db/schema';
import { eq, and, inArray, sql, desc } from 'drizzle-orm';

const router = Router({ mergeParams: true });

const createSessionSchema = z.object({
  classSectionId: commonSchemas.uuid,
  sessionDate: commonSchemas.isoDate,
  sessionType: commonSchemas.sessionType.optional().default('DAILY'),
  teacherId: commonSchemas.uuid.optional(),
});

const updateStatusSchema = z.object({
  newStatus: commonSchemas.sessionStatus.optional(),
  status: commonSchemas.sessionStatus.optional(),
  reason: z.string().optional(),
  autoMarkAbsentForUnmarked: z.boolean().optional(),
});

const scanSchema = z.object({
  clientEventId: z.string().min(1, 'MISSING_CLIENT_EVENT_ID'),
  rawToken: z.string().optional(),
  studentId: commonSchemas.uuid.optional(),
  statusValue: commonSchemas.attendanceStatus.optional().default('PRESENT'),
  clientTimestamp: commonSchemas.isoTimestamp.optional(),
  deviceId: commonSchemas.uuid.optional(),
  source: commonSchemas.scanSource.optional().default('CAMERA'),
  metadata: z.record(z.string(), z.any()).optional(),
});

// 1. Get Assigned Classes for Teacher / Admin
router.get(
  '/classes',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schoolId = req.activeSchoolId!;
      const user = req.user!;
      const userRole = req.userRole!;

      const assignedClasses = await getTeacherAssignedClasses({
        schoolId,
        teacherId: user.id,
        userRole,
      });

      res.json({ success: true, data: assignedClasses });
    } catch (error: any) {
      console.error('Error fetching assigned classes:', error);
      res.status(500).json({ success: false, error: error.message || 'FAILED_TO_FETCH_CLASSES' });
    }
  }
);

// 1b. Get Today Gate Attendance (Teacher-safe Gate Ingest Overview & Poll)
router.get(
  '/today-gate',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schoolId = req.activeSchoolId!;
      const user = req.user!;
      const userRole = req.userRole!;
      const classSectionId = req.query.classSectionId as string | undefined;

      const result = await getTodayGateAttendance({
        schoolId,
        classSectionId,
        actorId: user.id,
        userRole,
      });

      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Error fetching today gate attendance:', error);
      res.status(500).json({ success: false, error: error.message || 'FAILED_TO_FETCH_TODAY_GATE' });
    }
  }
);

// 2. Create Attendance Session
router.post(
  '/sessions',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schoolId = req.activeSchoolId!;
      const user = req.user!;
      const userRole = req.userRole!;
      const { classSectionId, sessionDate, sessionType } = req.body;

      if (!classSectionId || !sessionDate) {
        res.status(400).json({ success: false, error: 'MISSING_REQUIRED_FIELDS' });
        return;
      }

      const sessionResult = await createAttendanceSession({
        schoolId,
        classSectionId,
        teacherId: user.id,
        sessionDate,
        sessionType: sessionType || 'DAILY',
        actorId: user.id,
        userRole,
      });

      res.status(201).json({
        success: true,
        data: sessionResult.session || sessionResult,
        session: sessionResult.session,
        details: sessionResult,
      });
    } catch (error: any) {
      console.error('Error creating attendance session:', error);
      if (error.message === 'UNAUTHORIZED_TEACHER_NOT_ASSIGNED') {
        res.status(403).json({ success: false, error: 'UNAUTHORIZED_TEACHER_NOT_ASSIGNED' });
        return;
      }
      res.status(500).json({ success: false, error: error.message || 'FAILED_TO_CREATE_SESSION' });
    }
  }
);

import { encodeCursor, decodeCursor, parseLimit } from '../services/paginationHelper';

// 3. List Attendance Sessions (Deterministic Cursor Pagination)
router.get(
  '/sessions',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schoolId = req.activeSchoolId!;
      const user = req.user!;
      const userRole = req.userRole!;
      const { classSectionId, sessionDate, cursor } = req.query;
      const limit = parseLimit(req.query.limit as string | undefined, 50, 200);
      const decoded = decodeCursor(cursor as string);

      const conditions: any[] = [eq(attendanceSessions.schoolId, schoolId)];
      if (classSectionId) {
        conditions.push(eq(attendanceSessions.classSectionId, classSectionId as string));
      }
      if (sessionDate) {
        conditions.push(eq(attendanceSessions.sessionDate, sessionDate as string));
      }

      if (decoded) {
        const cursorDate = decoded.timestamp || '';
        conditions.push(
          sql`(${attendanceSessions.sessionDate} < ${cursorDate} OR (${attendanceSessions.sessionDate} = ${cursorDate} AND ${attendanceSessions.id} < ${decoded.id}))`
        );
      }

      if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(userRole)) {
        const assigned = await getTeacherAssignedClasses({ schoolId, teacherId: user.id, userRole });
        const assignedIds = assigned.map((c: { classSectionId: string }) => c.classSectionId);
        if (classSectionId && !assignedIds.includes(classSectionId as string)) {
          res.status(403).json({ success: false, error: 'UNAUTHORIZED_TEACHER_NOT_ASSIGNED' });
          return;
        }
        if (!classSectionId) {
          if (assignedIds.length === 0) {
            res.json({ success: true, data: [], nextCursor: null, hasMore: false, limit });
            return;
          }
          conditions.push(inArray(attendanceSessions.classSectionId, assignedIds));
        }
      }

      const query = db
        .select({
          id: attendanceSessions.id,
          schoolId: attendanceSessions.schoolId,
          classSectionId: attendanceSessions.classSectionId,
          teacherId: attendanceSessions.teacherId,
          sessionDate: attendanceSessions.sessionDate,
          sessionType: attendanceSessions.sessionType,
          status: attendanceSessions.status,
          finalizedAt: attendanceSessions.finalizedAt,
          className: classSections.className,
          sectionName: classSections.sectionName,
        })
        .from(attendanceSessions)
        .innerJoin(classSections, eq(attendanceSessions.classSectionId, classSections.id))
        .where(and(...conditions))
        .orderBy(desc(attendanceSessions.sessionDate), desc(attendanceSessions.id))
        .limit(limit + 1);

      if (!decoded && req.query.page && Number(req.query.page) > 1) {
        query.offset((Number(req.query.page) - 1) * limit);
      }

      const rows = await query;
      const hasMore = rows.length > limit;
      const sessions = hasMore ? rows.slice(0, limit) : rows;

      let nextCursor: string | null = null;
      if (hasMore && sessions.length > 0) {
        const last = sessions[sessions.length - 1];
        nextCursor = encodeCursor({
          id: last.id,
          timestamp: last.sessionDate,
        });
      }

      res.json({
        success: true,
        data: sessions,
        sessions,
        nextCursor,
        hasMore,
        limit,
      });
    } catch (error: any) {
      if (error.message === 'INVALID_PAGINATION_CURSOR') {
        res.status(400).json({ success: false, error: 'INVALID_PAGINATION_CURSOR', message: 'The provided pagination cursor is invalid or malformed' });
        return;
      }
      console.error('Error listing attendance sessions:', error);
      res.status(500).json({ success: false, error: error.message || 'FAILED_TO_LIST_SESSIONS' });
    }
  }
);

// 4. Get Attendance Session Details (with Roster Snapshot & Records)
router.get(
  '/sessions/:sessionId',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schoolId = req.activeSchoolId!;
      const user = req.user!;
      const userRole = req.userRole!;
      const { sessionId } = req.params;

      const details = await getAttendanceSessionDetails(schoolId, sessionId, user.id, userRole);
      if (!details) {
        res.status(404).json({ success: false, error: 'SESSION_NOT_FOUND' });
        return;
      }

      res.json({ success: true, data: details });
    } catch (error: any) {
      console.error('Error fetching session details:', error);
      if (error.message === 'UNAUTHORIZED_TEACHER_NOT_ASSIGNED') {
        res.status(403).json({ success: false, error: 'UNAUTHORIZED_TEACHER_NOT_ASSIGNED' });
        return;
      }
      res.status(500).json({ success: false, error: error.message || 'FAILED_TO_FETCH_SESSION' });
    }
  }
);

// 5. Update Attendance Session Status (State Machine)
router.patch(
  '/sessions/:sessionId/status',
  requireAuth,
  requireTenant,
  validateRequest({
    params: z.object({
      schoolId: commonSchemas.uuid,
      sessionId: commonSchemas.uuid,
    }),
    body: updateStatusSchema,
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schoolId = req.activeSchoolId!;
      const { sessionId } = req.params;
      const user = req.user!;
      const userRole = req.userRole!;
      const { newStatus, status, reason, autoMarkAbsentForUnmarked } = req.body;
      const targetStatus = newStatus || status;

      if (!targetStatus) {
        res.status(400).json({ success: false, error: 'MISSING_STATUS_PARAMETER' });
        return;
      }

      const updated = await updateSessionStatus({
        schoolId,
        sessionId,
        actorId: user.id,
        userRole,
        newStatus: targetStatus as SessionStatus,
        reason,
        autoMarkAbsentForUnmarked: !!autoMarkAbsentForUnmarked,
      });

      res.json({ success: true, data: updated });
    } catch (error: any) {
      console.error('Error updating session status:', error);
      const statusMap: Record<string, number> = {
        FINALIZED_SESSION_LOCKED: 400,
        REOPEN_REQUIRES_ADMIN_ROLE: 403,
        REOPEN_REASON_REQUIRED: 400,
        SESSION_NOT_FOUND: 404,
      };

      res.status(statusMap[error.message] || 500).json({
        success: false,
        error: error.message || 'FAILED_TO_UPDATE_SESSION_STATUS',
      });
    }
  }
);

// 6. Process Scan Event (Shared processQRCode endpoint for Camera QR and USB Keyboard-wedge Scanner)
router.post(
  '/sessions/:sessionId/scan',
  requireAuth,
  requireTenant,
  validateRequest({
    params: z.object({
      schoolId: commonSchemas.uuid,
      sessionId: commonSchemas.uuid,
    }),
    body: scanSchema,
  }) as any,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schoolId = req.activeSchoolId!;
      const { sessionId } = req.params;
      const user = req.user!;
      const {
        clientEventId,
        rawToken,
        studentId,
        statusValue,
        clientTimestamp,
        deviceId,
        source,
        metadata,
      } = req.body;

      const result = await processQRCode({
        schoolId,
        sessionId,
        actorId: user.id,
        userRole: req.userRole!,
        clientEventId,
        rawToken,
        studentId,
        statusValue: statusValue as AttendanceStatus,
        clientTimestamp: clientTimestamp || new Date().toISOString(),
        deviceId,
        source,
        metadata,
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('Error processing scan event:', error);
      const statusMap: Record<string, number> = {
        WRONG_SCHOOL_QR: 403,
        REVOKED_QR_TOKEN: 400,
        INVALID_QR_TOKEN: 400,
        STUDENT_NOT_IN_ROSTER: 404,
        FINALIZED_SESSION_LOCKED: 400,
        SESSION_NOT_FOUND: 404,
      };

      res.status(statusMap[error.message] || 500).json({
        success: false,
        error: error.message || 'FAILED_TO_PROCESS_SCAN',
      });
    }
  }
);

// 7. Manual Attendance Status Control & Correction
router.post(
  '/sessions/:sessionId/manual',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schoolId = req.activeSchoolId!;
      const { sessionId } = req.params;
      const user = req.user!;
      const userRole = req.userRole!;
      const { recordId, studentId, newStatus, reason, clientEventId } = req.body;

      if (!newStatus || (!recordId && !studentId)) {
        res.status(400).json({ success: false, error: 'MISSING_REQUIRED_PARAMETERS' });
        return;
      }

      const updatedRecord = await manualStatusUpdate({
        schoolId,
        sessionId,
        recordId,
        studentId,
        newStatus: newStatus as AttendanceStatus,
        reason,
        actorId: user.id,
        userRole,
        clientEventId,
      });

      res.json({ success: true, data: updatedRecord });
    } catch (error: any) {
      console.error('Error manually updating attendance:', error);
      const statusMap: Record<string, number> = {
        FINALIZED_SESSION_LOCKED: 400,
        CORRECTION_REASON_REQUIRED: 400,
        ATTENDANCE_RECORD_NOT_FOUND: 404,
        SESSION_NOT_FOUND: 404,
      };

      res.status(statusMap[error.message] || 500).json({
        success: false,
        error: error.message || 'FAILED_TO_UPDATE_ATTENDANCE',
      });
    }
  }
);

// 8. Daily Class Attendance Report
router.get(
  '/reports/daily',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schoolId = req.activeSchoolId!;
      const { classSectionId, sessionDate } = req.query;

      if (!classSectionId || !sessionDate) {
        res.status(400).json({ success: false, error: 'MISSING_QUERY_PARAMETERS' });
        return;
      }

      const report = await getDailyClassReport(
        schoolId,
        classSectionId as string,
        sessionDate as string
      );

      res.json({ success: true, data: report });
    } catch (error: any) {
      console.error('Error generating daily class report:', error);
      res.status(500).json({ success: false, error: error.message || 'FAILED_TO_GENERATE_REPORT' });
    }
  }
);

export default router;
