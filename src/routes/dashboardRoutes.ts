import { Router, Response } from 'express';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { withSystemContext, withTenantContext } from '../db';
import { schools, students, schoolMemberships, attendanceSessions, rfidReaders, rfidCredentials } from '../db/schema';

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
      const allSchools = await tx.select().from(schools);
      const totalStudentsRes = await tx.select({ count: sql<number>`count(*)::int` }).from(students);
      const totalTeachersRes = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schoolMemberships)
        .where(eq(schoolMemberships.role, 'TEACHER'));
      const totalSessionsRes = await tx.select({ count: sql<number>`count(*)::int` }).from(attendanceSessions);

      return res.json({
        success: true,
        generatedAt: new Date().toISOString(),
        data: {
          systemHealth: 'OPERATIONAL',
          totalSchools: allSchools.length,
          totalStudents: totalStudentsRes[0]?.count ?? 0,
          totalTeachers: totalTeachersRes[0]?.count ?? 0,
          totalAttendanceSessions: totalSessionsRes[0]?.count ?? 0,
          schools: allSchools,
        },
      });
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

    const membership = req.sessionContext?.memberships?.find((m: any) => m.schoolId === schoolId);
    const isSuperAdmin = req.sessionContext?.memberships?.some((m: any) => m.role === 'SUPER_ADMIN');

    if (!isSuperAdmin && (!membership || (membership.role !== 'SCHOOL_ADMIN' && membership.role !== 'SUPER_ADMIN'))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'School admin access required' });
    }

    return withTenantContext(schoolId, async (tx) => {
      const studentsCount = await tx.select({ count: sql<number>`count(*)::int` }).from(students).where(eq(students.schoolId, schoolId));
      const teachersCount = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(schoolMemberships)
        .where(eq(schoolMemberships.schoolId, schoolId));
      const readersCount = await tx.select({ count: sql<number>`count(*)::int` }).from(rfidReaders).where(eq(rfidReaders.schoolId, schoolId));

      return res.json({
        success: true,
        schoolId,
        generatedAt: new Date().toISOString(),
        data: {
          totalStudents: studentsCount[0]?.count ?? 0,
          totalTeachers: teachersCount[0]?.count ?? 0,
          totalClasses: 12,
          totalReaders: readersCount[0]?.count ?? 0,
          todayAttendancePercentage: 96.2,
          pendingSmsNotifications: 0,
        },
      });
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

    return withTenantContext(schoolId, async (tx) => {
      return res.json({
        success: true,
        schoolId,
        generatedAt: new Date().toISOString(),
        data: {
          assignedClassesCount: 3,
          activeSessionOpen: true,
          offlineSynced: true,
        },
      });
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

    return withTenantContext(schoolId, async (tx) => {
      const sessionsCount = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(attendanceSessions)
        .where(eq(attendanceSessions.schoolId, schoolId));

      return res.json({
        success: true,
        schoolId,
        generatedAt: new Date().toISOString(),
        data: {
          overallAttendanceRate: 95.8,
          totalSessionsRecorded: sessionsCount[0]?.count ?? 0,
          flaggedAbsenceCount: 4,
          lastReportGeneratedAt: new Date().toISOString(),
        },
      });
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

    return withTenantContext(schoolId, async (tx) => {
      const readers = await tx.select().from(rfidReaders).where(eq(rfidReaders.schoolId, schoolId));
      const cards = await tx.select({ count: sql<number>`count(*)::int` }).from(rfidCredentials).where(eq(rfidCredentials.schoolId, schoolId));

      return res.json({
        success: true,
        schoolId,
        generatedAt: new Date().toISOString(),
        data: {
          activeReadersCount: readers.length,
          totalCardsEnrolled: cards[0]?.count ?? 0,
          gatewayQueueDepth: 0,
          recentScanRejections: 0,
        },
      });
    });
  }
);
