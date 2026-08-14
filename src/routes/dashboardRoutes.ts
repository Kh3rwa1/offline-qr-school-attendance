import { Router, Response } from 'express';
import { eq, and, sql, gte, notInArray, ne, desc } from 'drizzle-orm';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { withSystemContext, withTenantContext } from '../db';
import {
  schools,
  students,
  schoolMemberships,
  attendanceSessions,
  rfidReaders,
  rfidCredentials,
  classSections,
  notificationJobs,
  attendanceRecords,
  teacherAssignments,
  rfidScanEvents,
} from '../db/schema';
import {
  SuperAdminSummarySchema,
  SchoolAdminSummarySchema,
  TeacherSummarySchema,
  ReportViewerSummarySchema,
  RfidOperatorSummarySchema,
  DashboardResponseEnvelopeSchema,
} from '../types/dashboardSchemas';
import { createAuditLog } from '../services/auditLogService';

export const dashboardRouter = Router();

// ==========================================
// 1. SUPER ADMIN DASHBOARD
// ==========================================
dashboardRouter.get(
  ['/platform/dashboard', '/dashboard/super-admin/summary'],
  requireAuth,
  requireRole(['SUPER_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    return withSystemContext(async (tx) => {
      const allSchools = await tx.select().from(schools).orderBy(desc(schools.createdAt));
      const totalStudentsRes = await tx.select({ count: sql<number>`count(*)::int` }).from(students);
      const totalTeachersRes = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schoolMemberships)
        .where(eq(schoolMemberships.role, 'TEACHER'));
      const totalSessionsRes = await tx.select({ count: sql<number>`count(*)::int` }).from(attendanceSessions);

      const summaryData = SuperAdminSummarySchema.parse({
        systemHealth: 'OPERATIONAL',
        totalSchools: allSchools.length,
        totalStudents: totalStudentsRes[0]?.count ?? 0,
        totalTeachers: totalTeachersRes[0]?.count ?? 0,
        totalAttendanceSessions: totalSessionsRes[0]?.count ?? 0,
        schools: allSchools.map((s: any) => ({
          id: s.id,
          name: s.name,
          code: s.udiseCode,
          udiseCode: s.udiseCode,
          district: s.district,
          status: s.status,
          createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : null,
        })),
      });

      // Explicitly audit cross-tenant platform telemetry access
      await createAuditLog({
        actorId: req.user!.id,
        action: 'SUPER_ADMIN_PLATFORM_SUMMARY_VIEWED',
        resourceType: 'PLATFORM_TELEMETRY',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      const response = DashboardResponseEnvelopeSchema(SuperAdminSummarySchema).parse({
        success: true,
        generatedAt: new Date().toISOString(),
        data: summaryData,
      });

      return res.json(response);
    });
  }
);

// ==========================================
// 2. SCHOOL ADMIN DASHBOARD
// ==========================================
dashboardRouter.get(
  ['/schools/:schoolId/dashboard', '/dashboard/school-admin/summary'],
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.params.schoolId || req.sessionContext?.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'MISSING_SCHOOL_ID' });
    }

    const activeMembership = req.sessionContext?.activeMembership;
    const isSuperAdmin = req.sessionContext?.memberships?.some((m) => m.role === 'SUPER_ADMIN');

    if (!isSuperAdmin && (!activeMembership || activeMembership.schoolId !== schoolId || !['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(activeMembership.role))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'School Admin access required for target school' });
    }

    return withTenantContext(schoolId, async (tx) => {
      const studentsCount = await tx.select({ count: sql<number>`count(*)::int` }).from(students).where(eq(students.schoolId, schoolId));
      const teachersCount = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schoolMemberships)
        .where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.role, 'TEACHER')));
      const classesCount = await tx.select({ count: sql<number>`count(*)::int` }).from(classSections).where(eq(classSections.schoolId, schoolId));
      const readersCount = await tx.select({ count: sql<number>`count(*)::int` }).from(rfidReaders).where(eq(rfidReaders.schoolId, schoolId));

      const todayStr = new Date().toISOString().slice(0, 10);
      const [todayStats] = await tx
        .select({
          total: sql<number>`count(*)::int`,
          present: sql<number>`count(case when ${attendanceRecords.status} in ('PRESENT', 'LATE') then 1 end)::int`,
        })
        .from(attendanceRecords)
        .innerJoin(attendanceSessions, eq(attendanceRecords.attendanceSessionId, attendanceSessions.id))
        .where(and(eq(attendanceRecords.schoolId, schoolId), eq(attendanceSessions.sessionDate, todayStr)));

      const todayPercentage = todayStats?.total && todayStats.total > 0
        ? Math.round((todayStats.present / todayStats.total) * 1000) / 10
        : 0;

      const [pendingSms] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(notificationJobs)
        .where(and(eq(notificationJobs.schoolId, schoolId), eq(notificationJobs.status, 'QUEUED')));

      const summaryData = SchoolAdminSummarySchema.parse({
        totalStudents: studentsCount[0]?.count ?? 0,
        totalTeachers: teachersCount[0]?.count ?? 0,
        totalClasses: classesCount[0]?.count ?? 0,
        totalReaders: readersCount[0]?.count ?? 0,
        todayAttendancePercentage: todayPercentage,
        pendingSmsNotifications: pendingSms?.count ?? 0,
      });

      const response = DashboardResponseEnvelopeSchema(SchoolAdminSummarySchema).parse({
        success: true,
        schoolId,
        generatedAt: new Date().toISOString(),
        data: summaryData,
      });

      return res.json(response);
    });
  }
);

// ==========================================
// 3. TEACHER DASHBOARD
// ==========================================
dashboardRouter.get(
  ['/schools/:schoolId/teacher-dashboard', '/dashboard/teacher/summary'],
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.params.schoolId || req.sessionContext?.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'MISSING_SCHOOL_ID' });
    }

    const activeMembership = req.sessionContext?.activeMembership;
    const isSuperAdmin = req.sessionContext?.memberships?.some((m) => m.role === 'SUPER_ADMIN');

    if (!isSuperAdmin && (!activeMembership || activeMembership.schoolId !== schoolId || !['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(activeMembership.role))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Teacher access required for target school' });
    }

    return withTenantContext(schoolId, async (tx) => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const [assignedCount] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(teacherAssignments)
        .where(and(eq(teacherAssignments.schoolId, schoolId), eq(teacherAssignments.teacherId, req.user!.id)));

      const [openSession] = await tx
        .select({ id: attendanceSessions.id })
        .from(attendanceSessions)
        .where(and(
          eq(attendanceSessions.schoolId, schoolId),
          eq(attendanceSessions.teacherId, req.user!.id),
          eq(attendanceSessions.sessionDate, todayStr),
          eq(attendanceSessions.status, 'OPEN')
        ))
        .limit(1);

      const summaryData = TeacherSummarySchema.parse({
        assignedClassesCount: assignedCount?.count ?? 0,
        activeSessionOpen: Boolean(openSession),
        offlineSynced: true,
      });

      const response = DashboardResponseEnvelopeSchema(TeacherSummarySchema).parse({
        success: true,
        schoolId,
        generatedAt: new Date().toISOString(),
        data: summaryData,
      });

      return res.json(response);
    });
  }
);

// ==========================================
// 4. REPORT VIEWER DASHBOARD
// ==========================================
dashboardRouter.get(
  ['/schools/:schoolId/report-dashboard', '/dashboard/report-viewer/summary'],
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.params.schoolId || req.sessionContext?.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'MISSING_SCHOOL_ID' });
    }

    const activeMembership = req.sessionContext?.activeMembership;
    const isSuperAdmin = req.sessionContext?.memberships?.some((m) => m.role === 'SUPER_ADMIN');

    if (!isSuperAdmin && (!activeMembership || activeMembership.schoolId !== schoolId || !['REPORT_VIEWER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(activeMembership.role))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Report Viewer access required for target school' });
    }

    return withTenantContext(schoolId, async (tx) => {
      const sessionsCount = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(attendanceSessions)
        .where(eq(attendanceSessions.schoolId, schoolId));

      const [overallStats] = await tx
        .select({
          total: sql<number>`count(*)::int`,
          present: sql<number>`count(case when ${attendanceRecords.status} in ('PRESENT', 'LATE') then 1 end)::int`,
          absent: sql<number>`count(case when ${attendanceRecords.status} = 'ABSENT' then 1 end)::int`,
        })
        .from(attendanceRecords)
        .where(eq(attendanceRecords.schoolId, schoolId));

      const rate = overallStats?.total && overallStats.total > 0
        ? Math.round((overallStats.present / overallStats.total) * 1000) / 10
        : 0;

      const summaryData = ReportViewerSummarySchema.parse({
        overallAttendanceRate: rate,
        totalSessionsRecorded: sessionsCount[0]?.count ?? 0,
        flaggedAbsenceCount: overallStats?.absent ?? 0,
        lastReportGeneratedAt: new Date().toISOString(),
      });

      const response = DashboardResponseEnvelopeSchema(ReportViewerSummarySchema).parse({
        success: true,
        schoolId,
        generatedAt: new Date().toISOString(),
        data: summaryData,
      });

      return res.json(response);
    });
  }
);

// ==========================================
// 5. RFID OPERATOR DASHBOARD
// ==========================================
dashboardRouter.get(
  ['/schools/:schoolId/rfid/dashboard', '/dashboard/rfid-operator/summary'],
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.params.schoolId || req.sessionContext?.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'MISSING_SCHOOL_ID' });
    }

    const activeMembership = req.sessionContext?.activeMembership;
    const isSuperAdmin = req.sessionContext?.memberships?.some((m) => m.role === 'SUPER_ADMIN');

    if (!isSuperAdmin && (!activeMembership || activeMembership.schoolId !== schoolId || !['RFID_OPERATOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(activeMembership.role))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'RFID Operator access required for target school' });
    }

    return withTenantContext(schoolId, async (tx) => {
      const readers = await tx.select().from(rfidReaders).where(and(eq(rfidReaders.schoolId, schoolId), eq(rfidReaders.status, 'ACTIVE')));
      const cards = await tx.select({ count: sql<number>`count(*)::int` }).from(rfidCredentials).where(and(eq(rfidCredentials.schoolId, schoolId), eq(rfidCredentials.status, 'ACTIVE')));

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 3600 * 1000);
      const [rejections] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(rfidScanEvents)
        .where(and(
          eq(rfidScanEvents.schoolId, schoolId),
          ne(rfidScanEvents.decision, 'ACCEPTED'),
          gte(rfidScanEvents.createdAt, twentyFourHoursAgo)
        ));

      const summaryData = RfidOperatorSummarySchema.parse({
        activeReadersCount: readers.length,
        totalCardsEnrolled: cards[0]?.count ?? 0,
        gatewayQueueDepth: 0,
        recentScanRejections: rejections?.count ?? 0,
      });

      const response = DashboardResponseEnvelopeSchema(RfidOperatorSummarySchema).parse({
        success: true,
        schoolId,
        generatedAt: new Date().toISOString(),
        data: summaryData,
      });

      return res.json(response);
    });
  }
);
