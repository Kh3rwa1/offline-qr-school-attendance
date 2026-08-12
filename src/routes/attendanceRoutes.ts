import { Router, Response } from 'express';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import {
  getTeacherAssignedClasses,
  createAttendanceSession,
  updateSessionStatus,
  processQRCode,
  manualStatusUpdate,
  getAttendanceSessionDetails,
  getDailyClassReport,
  SessionStatus,
  AttendanceStatus,
} from '../services/attendanceService';
import { db } from '../db';
import { attendanceSessions, classSections } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';

const router = Router({ mergeParams: true });

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

      res.status(201).json({ success: true, data: sessionResult });
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

// 3. List Attendance Sessions
router.get(
  '/sessions',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schoolId = req.activeSchoolId!;
      const user = req.user!;
      const userRole = req.userRole!;
      const { classSectionId, sessionDate } = req.query;

      const conditions: any[] = [eq(attendanceSessions.schoolId, schoolId)];
      if (classSectionId) {
        conditions.push(eq(attendanceSessions.classSectionId, classSectionId as string));
      }
      if (sessionDate) {
        conditions.push(eq(attendanceSessions.sessionDate, sessionDate as string));
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
            res.json({ success: true, data: [] });
            return;
          }
          conditions.push(inArray(attendanceSessions.classSectionId, assignedIds));
        }
      }

      const sessions = await db
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
        .where(and(...conditions));

      res.json({ success: true, data: sessions });
    } catch (error: any) {
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
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const schoolId = req.activeSchoolId!;
      const { sessionId } = req.params;
      const user = req.user!;
      const userRole = req.userRole!;
      const { status, reason, autoMarkAbsentForUnmarked } = req.body;

      if (!status) {
        res.status(400).json({ success: false, error: 'MISSING_STATUS_PARAMETER' });
        return;
      }

      const updated = await updateSessionStatus({
        schoolId,
        sessionId,
        actorId: user.id,
        userRole,
        newStatus: status as SessionStatus,
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

      if (!clientEventId) {
        res.status(400).json({ success: false, error: 'MISSING_CLIENT_EVENT_ID' });
        return;
      }

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
