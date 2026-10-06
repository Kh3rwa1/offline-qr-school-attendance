import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware';
import { tenantRoute } from '../http/tenantRoute';
import { AppError } from '../errors/AppError';
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
import { attendanceSessions, classSections } from '../db/schema';
import { eq, and, inArray, sql, desc } from 'drizzle-orm';
import { encodeCursor, decodeCursor } from '../services/paginationHelper';
import {
  CreateAttendanceSessionBody,
  UpdateAttendanceSessionStatusBody,
  ProcessAttendanceScanBody,
  AttendanceStatusEnum,
  Uuid,
} from './schemas/attendance';

const router = Router({ mergeParams: true });
router.use(requireAuth);

// 1. Get Assigned Classes for Teacher / Admin
router.get(
  '/classes',
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'REPORT_VIEWER'],
    writes: false,
    handler: async ({ schoolId, user, req }) => {
      const userRole = (req as AuthenticatedRequest).userRole!;
      const assignedClasses = await getTeacherAssignedClasses({
        schoolId,
        teacherId: user.id,
        userRole,
      });
      return { status: 200, data: assignedClasses };
    },
  })
);

// 1b. Get Today Gate Attendance (Teacher-safe Gate Ingest Overview & Poll)
router.get(
  '/today-gate',
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'REPORT_VIEWER'],
    query: z.object({ classSectionId: Uuid.optional() }).strict(),
    handler: async ({ schoolId, user, query, req }) => {
      const userRole = (req as AuthenticatedRequest).userRole!;
      const result = await getTodayGateAttendance({
        schoolId,
        classSectionId: query.classSectionId,
        actorId: user.id,
        userRole,
      });
      return { status: 200, body: { success: true, ...result } };
    },
  })
);

// 2. Create Attendance Session
router.post(
  '/sessions',
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'],
    body: CreateAttendanceSessionBody,
    handler: async ({ schoolId, user, body, req }) => {
      try {
        const userRole = (req as AuthenticatedRequest).userRole!;
        const sessionResult = await createAttendanceSession({
          schoolId,
          classSectionId: body.classSectionId,
          teacherId: body.teacherId || user.id,
          sessionDate: body.sessionDate,
          sessionType: body.sessionType || 'DAILY',
          actorId: user.id,
          userRole,
        });

        return {
          status: 201,
          body: {
            success: true,
            data: sessionResult.session || sessionResult,
            session: sessionResult.session,
            details: sessionResult,
          },
        };
      } catch (error: any) {
        if (error.message === 'UNAUTHORIZED_TEACHER_NOT_ASSIGNED') {
          throw new AppError('UNAUTHORIZED_TEACHER_NOT_ASSIGNED', 403, 'Teacher is not assigned to this class section');
        }
        throw error;
      }
    },
  })
);

// 3. List Attendance Sessions (Deterministic Cursor Pagination)
router.get(
  '/sessions',
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'REPORT_VIEWER'],
    writes: false,
    query: z
      .object({
        classSectionId: Uuid.optional(),
        sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(200).default(50),
        page: z.coerce.number().int().min(1).max(10000).optional(),
      })
      .strict(),
    handler: async ({ schoolId, user, query, req, tx }) => {
      const userRole = (req as AuthenticatedRequest).userRole!;
      const { classSectionId, sessionDate, cursor, limit, page } = query;
      const decoded = decodeCursor(cursor);

      const conditions: any[] = [eq(attendanceSessions.schoolId, schoolId)];
      if (classSectionId) conditions.push(eq(attendanceSessions.classSectionId, classSectionId));
      if (sessionDate) conditions.push(eq(attendanceSessions.sessionDate, sessionDate));

      if (decoded) {
        const cursorDate = decoded.timestamp || '';
        conditions.push(
          sql`(${attendanceSessions.sessionDate} < ${cursorDate} OR (${attendanceSessions.sessionDate} = ${cursorDate} AND ${attendanceSessions.id} < ${decoded.id}))`
        );
      }

      if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(userRole)) {
        const assigned = await getTeacherAssignedClasses({ schoolId, teacherId: user.id, userRole });
        const assignedIds = assigned.map((c: { classSectionId: string }) => c.classSectionId);
        if (classSectionId && !assignedIds.includes(classSectionId)) {
          throw new AppError('UNAUTHORIZED_TEACHER_NOT_ASSIGNED', 403, 'Teacher is not assigned to this class section');
        }
        if (!classSectionId) {
          if (assignedIds.length === 0) {
            return { status: 200, body: { success: true, data: [], nextCursor: null, hasMore: false, limit } };
          }
          conditions.push(inArray(attendanceSessions.classSectionId, assignedIds));
        }
      }

      const q = tx
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

      if (!decoded && page && page > 1) {
        q.offset((page - 1) * limit);
      }

      const rows = await q;
      const hasMore = rows.length > limit;
      const sessions = hasMore ? rows.slice(0, limit) : rows;

      let nextCursor: string | null = null;
      if (hasMore && sessions.length > 0) {
        const last = sessions[sessions.length - 1];
        nextCursor = encodeCursor({ id: last.id, timestamp: last.sessionDate });
      }

      return {
        status: 200,
        body: {
          success: true,
          data: sessions,
          sessions,
          nextCursor,
          hasMore,
          limit,
        },
      };
    },
  })
);

// 4. Get Attendance Session Details (with Roster Snapshot & Records)
router.get(
  '/sessions/:sessionId',
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'REPORT_VIEWER'],
    writes: false,
    params: z.object({ sessionId: Uuid }),
    handler: async ({ schoolId, user, params, req }) => {
      const userRole = (req as AuthenticatedRequest).userRole!;
      try {
        const details = await getAttendanceSessionDetails(schoolId, params.sessionId, user.id, userRole);
        if (!details) {
          throw new AppError('SESSION_NOT_FOUND', 404, 'Session not found');
        }
        return { status: 200, data: details };
      } catch (error: any) {
        if (error.message === 'UNAUTHORIZED_TEACHER_NOT_ASSIGNED') {
          throw new AppError('UNAUTHORIZED_TEACHER_NOT_ASSIGNED', 403, 'Teacher is not assigned to this class section');
        }
        throw error;
      }
    },
  })
);

// 5. Update Attendance Session Status (State Machine)
router.patch(
  '/sessions/:sessionId/status',
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'],
    params: z.object({ sessionId: Uuid }),
    body: UpdateAttendanceSessionStatusBody,
    handler: async ({ schoolId, user, params, body, req }) => {
      const userRole = (req as AuthenticatedRequest).userRole!;
      const targetStatus = body.newStatus || body.status;
      if (!targetStatus) {
        throw new AppError('MISSING_STATUS_PARAMETER', 400, 'Status or newStatus is required');
      }
      try {
        const updated = await updateSessionStatus({
          schoolId,
          sessionId: params.sessionId,
          actorId: user.id,
          userRole,
          newStatus: targetStatus as SessionStatus,
          reason: body.reason,
          autoMarkAbsentForUnmarked: !!body.autoMarkAbsentForUnmarked,
        });
        return { status: 200, data: updated };
      } catch (error: any) {
        const statusMap: Record<string, { status: number; message: string }> = {
          FINALIZED_SESSION_LOCKED: { status: 400, message: 'Session is finalized and locked' },
          REOPEN_REQUIRES_ADMIN_ROLE: { status: 403, message: 'Only administrators can reopen a finalized session' },
          REOPEN_REASON_REQUIRED: { status: 400, message: 'Reason is required to reopen session' },
          SESSION_NOT_FOUND: { status: 404, message: 'Session not found' },
        };
        const mapped = statusMap[error.message];
        if (mapped) {
          throw new AppError(error.message, mapped.status, mapped.message);
        }
        throw error;
      }
    },
  })
);

// 6. Process Scan Event (Shared processQRCode endpoint for Camera QR and USB Keyboard-wedge Scanner)
router.post(
  '/sessions/:sessionId/scan',
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'],
    params: z.object({ sessionId: Uuid }),
    body: ProcessAttendanceScanBody,
    handler: async ({ schoolId, user, params, body, req }) => {
      const userRole = (req as AuthenticatedRequest).userRole!;
      try {
        const result = await processQRCode({
          schoolId,
          sessionId: params.sessionId,
          actorId: user.id,
          userRole,
          clientEventId: body.clientEventId,
          rawToken: body.rawToken,
          studentId: body.studentId,
          statusValue: body.statusValue as AttendanceStatus,
          clientTimestamp: body.clientTimestamp || new Date().toISOString(),
          deviceId: body.deviceId,
          source: body.source,
          metadata: body.metadata,
        });
        return { status: 200, data: result };
      } catch (error: any) {
        const statusMap: Record<string, { status: number; message: string }> = {
          WRONG_SCHOOL_QR: { status: 403, message: 'QR belongs to a different school' },
          REVOKED_QR_TOKEN: { status: 400, message: 'QR token is revoked' },
          INVALID_QR_TOKEN: { status: 400, message: 'Invalid QR token' },
          STUDENT_NOT_IN_ROSTER: { status: 404, message: 'Student is not in the session roster' },
          FINALIZED_SESSION_LOCKED: { status: 400, message: 'Session is finalized and locked' },
          SESSION_NOT_FOUND: { status: 404, message: 'Session not found' },
        };
        const mapped = statusMap[error.message];
        if (mapped) {
          throw new AppError(error.message, mapped.status, mapped.message);
        }
        throw error;
      }
    },
  })
);

// 7. Manual Attendance Status Control & Correction
router.post(
  '/sessions/:sessionId/manual',
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'],
    params: z.object({ sessionId: Uuid }),
    body: z
      .object({
        recordId: Uuid.optional(),
        studentId: Uuid.optional(),
        newStatus: AttendanceStatusEnum,
        reason: z.string().trim().max(500).optional(),
        clientEventId: z.string().trim().optional(),
      })
      .strict(),
    handler: async ({ schoolId, user, params, body, req }) => {
      const userRole = (req as AuthenticatedRequest).userRole!;
      if (!body.recordId && !body.studentId) {
        throw new AppError('MISSING_REQUIRED_PARAMETERS', 400, 'Either recordId or studentId is required');
      }
      try {
        const updatedRecord = await manualStatusUpdate({
          schoolId,
          sessionId: params.sessionId,
          recordId: body.recordId,
          studentId: body.studentId,
          newStatus: body.newStatus as AttendanceStatus,
          reason: body.reason,
          actorId: user.id,
          userRole,
          clientEventId: body.clientEventId,
        });
        return { status: 200, data: updatedRecord };
      } catch (error: any) {
        const statusMap: Record<string, { status: number; message: string }> = {
          FINALIZED_SESSION_LOCKED: { status: 400, message: 'Session is finalized and locked' },
          CORRECTION_REASON_REQUIRED: { status: 400, message: 'Correction reason is required' },
          ATTENDANCE_RECORD_NOT_FOUND: { status: 404, message: 'Attendance record not found' },
          SESSION_NOT_FOUND: { status: 404, message: 'Session not found' },
        };
        const mapped = statusMap[error.message];
        if (mapped) {
          throw new AppError(error.message, mapped.status, mapped.message);
        }
        throw error;
      }
    },
  })
);

// 8. Daily Class Attendance Report
router.get(
  '/reports/daily',
  tenantRoute({
    roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'REPORT_VIEWER'],
    writes: false,
    query: z
      .object({
        classSectionId: Uuid,
        sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .strict(),
    handler: async ({ schoolId, query }) => {
      const report = await getDailyClassReport(schoolId, query.classSectionId, query.sessionDate);
      return { status: 200, data: report };
    },
  })
);

export default router;
