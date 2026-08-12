import { Router, Response } from 'express';
import { db } from '../db';
import { auditLogs, users } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';

const auditRouter = Router({ mergeParams: true });

// GET /api/v1/schools/:schoolId/audit-logs
auditRouter.get('/', requireAuth, requireTenant, requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.activeSchoolId!;
    const actionFilter = req.query.action as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    let conditions = [eq(auditLogs.schoolId, schoolId)];

    if (actionFilter) {
      conditions.push(eq(auditLogs.action, actionFilter));
    }

    const logs = await db
      .select({
        id: auditLogs.id,
        schoolId: auditLogs.schoolId,
        actorUserId: auditLogs.actorId,
        actorName: users.fullName,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        details: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    res.json({
      schoolId,
      page,
      limit,
      logs,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default auditRouter;
