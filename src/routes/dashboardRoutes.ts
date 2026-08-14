import { Router, Response } from 'express';
import { db, withTenantContext, withSystemContext } from '../db/index';
import {
  schools,
  students,
  schoolMemberships,
  classSections,
  attendanceSessions,
  attendanceRecords,
  rfidReaders,
  rfidCredentials,
  rfidScanEvents,
  notificationJobs,
} from '../db/schema';
import { count, eq, and, desc, gte } from 'drizzle-orm';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware';

export const dashboardRouter = Router();

// 1. Super Admin Cross-School Summary
dashboardRouter.get('/super-admin/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const role = req.userRole || req.sessionContext?.activeMembership?.role;
  if (role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Super admin role required' });
  }

  try {
    const summary = await withSystemContext(async () => {
      const [schoolsCount] = await db.select({ val: count() }).from(schools);
      const [studentsCount] = await db.select({ val: count() }).from(students);
      const [teachersCount] = await db
        .select({ val: count() })
        .from(schoolMemberships)
        .where(eq(schoolMemberships.role, 'TEACHER'));
      const [sessionsCount] = await db.select({ val: count() }).from(attendanceSessions);

      const allSchools = await db
        .select({
          id: schools.id,
          name: schools.name,
          udiseCode: schools.udiseCode,
          status: schools.status,
          createdAt: schools.createdAt,
        })
        .from(schools)
        .limit(50);

      return {
        totalSchools: Number(schoolsCount?.val || 0),
        totalStudents: Number(studentsCount?.val || 0),
        totalTeachers: Number(teachersCount?.val || 0),
        totalAttendanceSessions: Number(sessionsCount?.val || 0),
        systemHealth: 'OPERATIONAL',
        schools: allSchools,
      };
    });

    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: err.message });
  }
});

// 2. School Admin (Headmaster) Summary
dashboardRouter.get('/school-admin/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const schoolId = req.activeSchoolId || req.sessionContext?.activeMembership?.schoolId;

  if (!schoolId) {
    return res.status(400).json({ error: 'MISSING_SCHOOL_CONTEXT' });
  }

  try {
    const summary = await withTenantContext(schoolId, async (tx) => {
      const [studCount] = await tx.select({ val: count() }).from(students).where(eq(students.schoolId, schoolId));
      const [classCount] = await tx.select({ val: count() }).from(classSections).where(eq(classSections.schoolId, schoolId));
      const [readerCount] = await tx.select({ val: count() }).from(rfidReaders).where(eq(rfidReaders.schoolId, schoolId));
      const [pendingSms] = await tx
        .select({ val: count() })
        .from(notificationJobs)
        .where(and(eq(notificationJobs.schoolId, schoolId), eq(notificationJobs.status, 'PENDING')));

      // Today's attendance
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [todayAtt] = await tx
        .select({ val: count() })
        .from(attendanceRecords)
        .where(and(eq(attendanceRecords.schoolId, schoolId), gte(attendanceRecords.firstScannedAt, todayStart)));

      const totalStudents = Number(studCount?.val || 0);
      const totalAttToday = Number(todayAtt?.val || 0);
      const attendancePercent = totalStudents > 0 ? Math.min(100, Math.round((totalAttToday / totalStudents) * 100)) : 0;

      return {
        schoolId,
        totalStudents,
        totalClasses: Number(classCount?.val || 0),
        totalReaders: Number(readerCount?.val || 0),
        pendingSmsNotifications: Number(pendingSms?.val || 0),
        todayAttendanceCount: totalAttToday,
        todayAttendancePercentage: attendancePercent,
      };
    });

    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: err.message });
  }
});

// 3. Teacher Summary
dashboardRouter.get('/teacher/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  const schoolId = req.activeSchoolId || req.sessionContext?.activeMembership?.schoolId;

  if (!schoolId) {
    return res.status(400).json({ error: 'MISSING_SCHOOL_CONTEXT' });
  }

  try {
    const summary = await withTenantContext(schoolId, async (tx) => {
      const classes = await tx
        .select({
          id: classSections.id,
          className: classSections.className,
          sectionName: classSections.sectionName,
        })
        .from(classSections)
        .where(eq(classSections.schoolId, schoolId))
        .limit(20);

      const [activeSession] = await tx
        .select()
        .from(attendanceSessions)
        .where(and(eq(attendanceSessions.schoolId, schoolId), eq(attendanceSessions.status, 'OPEN')))
        .limit(1);

      return {
        teacherName: user?.fullName || 'Teacher',
        assignedClasses: classes,
        activeSession: activeSession || null,
      };
    });

    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: err.message });
  }
});

// 4. RFID Operator Summary
dashboardRouter.get('/rfid-operator/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const schoolId = req.activeSchoolId || req.sessionContext?.activeMembership?.schoolId;

  if (!schoolId) {
    return res.status(400).json({ error: 'MISSING_SCHOOL_CONTEXT' });
  }

  try {
    const summary = await withTenantContext(schoolId, async (tx) => {
      const readers = await tx
        .select()
        .from(rfidReaders)
        .where(eq(rfidReaders.schoolId, schoolId));

      const [enrolledCards] = await tx
        .select({ val: count() })
        .from(rfidCredentials)
        .where(eq(rfidCredentials.schoolId, schoolId));

      const recentEvents = await tx
        .select({
          id: rfidScanEvents.id,
          decision: rfidScanEvents.decision,
          rejectionCode: rfidScanEvents.rejectionCode,
          scanTimestamp: rfidScanEvents.scanTimestamp,
          processingLatencyMs: rfidScanEvents.processingLatencyMs,
          securityMode: rfidScanEvents.securityMode,
        })
        .from(rfidScanEvents)
        .where(eq(rfidScanEvents.schoolId, schoolId))
        .orderBy(desc(rfidScanEvents.scanTimestamp))
        .limit(15);

      return {
        activeReaders: readers,
        totalEnrolledCards: Number(enrolledCards?.val || 0),
        recentScanEvents: recentEvents,
      };
    });

    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: err.message });
  }
});

// 5. Report Viewer Summary
dashboardRouter.get('/report-viewer/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const schoolId = req.activeSchoolId || req.sessionContext?.activeMembership?.schoolId;

  if (!schoolId) {
    return res.status(400).json({ error: 'MISSING_SCHOOL_CONTEXT' });
  }

  try {
    const summary = await withTenantContext(schoolId, async (tx) => {
      const [totalRecords] = await tx.select({ val: count() }).from(attendanceRecords).where(eq(attendanceRecords.schoolId, schoolId));
      const [totalStudents] = await tx.select({ val: count() }).from(students).where(eq(students.schoolId, schoolId));

      const recentSessions = await tx
        .select({
          id: attendanceSessions.id,
          sessionType: attendanceSessions.sessionType,
          status: attendanceSessions.status,
          sessionDate: attendanceSessions.sessionDate,
        })
        .from(attendanceSessions)
        .where(eq(attendanceSessions.schoolId, schoolId))
        .orderBy(desc(attendanceSessions.sessionDate))
        .limit(10);

      return {
        totalAttendanceRecords: Number(totalRecords?.val || 0),
        totalEnrolledStudents: Number(totalStudents?.val || 0),
        recentSessions,
        exportFormatsAvailable: ['CSV', 'JSON', 'EXCEL_COMPLIANT'],
      };
    });

    res.json({ success: true, data: summary });
  } catch (err: any) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: err.message });
  }
});
