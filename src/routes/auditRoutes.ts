import { Router, Request, Response } from 'express';
import { db } from '../db';
import { auditLogs, users, schoolMemberships } from '../db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

const auditRouter = Router({ mergeParams: true });

async function getUserAndRole(schoolId: string, actorId?: string) {
  if (!actorId) return null;
  const [userRec] = await db.select().from(users).where(eq(users.id, actorId));
  if (!userRec || userRec.status === 'SUSPENDED') return null;

  if (userRec.globalRole === 'SUPER_ADMIN') {
    return { user: userRec, role: 'SUPER_ADMIN' };
  }

  const [membership] = await db
    .select()
    .from(schoolMemberships)
    .where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.userId, actorId)));

  if (!membership || membership.status === 'SUSPENDED') return null;

  return { user: userRec, role: membership.role };
}

// GET /api/v1/schools/:schoolId/audit-logs
auditRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { schoolId } = req.params;
    const actorId = (req.headers['x-actor-id'] as string) || (req.query.actorId as string);
    const actionFilter = req.query.action as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const auth = await getUserAndRole(schoolId, actorId);
    if (!auth) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    if (auth.role === 'TEACHER') {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }

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
