import { Router, Response } from 'express';
import { db } from '../db';
import { auditLogs, users, schools } from '../db/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { requireAuth, requireRole, requirePlatformRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';

export const auditRouter = Router({ mergeParams: true });
export const platformAuditRouter = Router();

// GET /api/v1/schools/:schoolId/audit-logs (Tenant-Scoped)
auditRouter.get('/', requireAuth, requireTenant, requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.activeSchoolId!;
    const actionFilter = req.query.action as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

    const conditions: any[] = [eq(auditLogs.schoolId, schoolId)];

    if (actionFilter && actionFilter !== 'ALL') {
      conditions.push(eq(auditLogs.action, actionFilter));
    }
    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(endDate)));
    }

    const [totalCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(and(...conditions));

    const logs = await db
      .select({
        id: auditLogs.id,
        schoolId: auditLogs.schoolId,
        actorUserId: auditLogs.actorId,
        actorName: users.fullName,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        details: auditLogs.metadata,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    res.json({
      success: true,
      schoolId,
      page,
      limit,
      total: Number(totalCount?.count || 0),
      logs,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/v1/audit/platform (Platform-Wide Audit for SUPER_ADMIN)
platformAuditRouter.get('/platform', requireAuth, requirePlatformRole(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const actionFilter = req.query.action as string;
    const schoolId = req.query.schoolId as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

    const conditions: any[] = [];
    if (schoolId) {
      conditions.push(eq(auditLogs.schoolId, schoolId));
    }
    if (actionFilter && actionFilter !== 'ALL') {
      conditions.push(eq(auditLogs.action, actionFilter));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(whereClause);

    const logs = await db
      .select({
        id: auditLogs.id,
        schoolId: auditLogs.schoolId,
        schoolName: schools.name,
        actorUserId: auditLogs.actorId,
        actorName: users.fullName,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        details: auditLogs.metadata,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .leftJoin(schools, eq(auditLogs.schoolId, schools.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    res.json({
      success: true,
      page,
      limit,
      total: Number(totalCount?.count || 0),
      logs,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default auditRouter;
