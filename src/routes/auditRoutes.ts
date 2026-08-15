import { Router, Response } from 'express';
import { db } from '../db';
import { auditLogs, users, schools } from '../db/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { requireAuth, requireRole, requirePlatformRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import { encodeCursor, decodeCursor, parseLimit } from '../services/paginationHelper';

export const auditRouter = Router({ mergeParams: true });
export const platformAuditRouter = Router();

// GET /api/v1/schools/:schoolId/audit-logs (Tenant-Scoped with Deterministic Cursor Pagination)
auditRouter.get('/', requireAuth, requireTenant, requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.activeSchoolId!;
    const actionFilter = req.query.action as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const cursor = req.query.cursor as string | undefined;
    const limit = parseLimit(req.query.limit as string | undefined, 50, 200);
    const decoded = decodeCursor(cursor);

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

    if (decoded) {
      const cursorTime = decoded.timestamp ? new Date(decoded.timestamp) : new Date(0);
      conditions.push(
        sql`(${auditLogs.createdAt} < ${cursorTime} OR (${auditLogs.createdAt} = ${cursorTime} AND ${auditLogs.id} < ${decoded.id}))`
      );
    }

    const query = db
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
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(limit + 1);

    // Support legacy page offset if no cursor
    if (!decoded && req.query.page && Number(req.query.page) > 1) {
      query.offset((Number(req.query.page) - 1) * limit);
    }

    const rows = await query;
    const hasMore = rows.length > limit;
    const logs = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && logs.length > 0) {
      const last = logs[logs.length - 1];
      nextCursor = encodeCursor({
        id: last.id,
        timestamp: last.createdAt ? new Date(last.createdAt).toISOString() : undefined,
      });
    }

    res.json({
      success: true,
      schoolId,
      limit,
      logs,
      nextCursor,
      hasMore,
      total: logs.length,
    });
  } catch (error: any) {
    if (error.message === 'INVALID_PAGINATION_CURSOR') {
      res.status(400).json({ success: false, error: 'INVALID_PAGINATION_CURSOR', message: 'The provided pagination cursor is invalid or malformed' });
      return;
    }
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/v1/audit/platform (Platform-Wide Audit with Deterministic Cursor Pagination)
platformAuditRouter.get('/platform', requireAuth, requirePlatformRole(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const actionFilter = req.query.action as string;
    const schoolId = req.query.schoolId as string;
    const cursor = req.query.cursor as string | undefined;
    const limit = parseLimit(req.query.limit as string | undefined, 50, 200);
    const decoded = decodeCursor(cursor);

    const conditions: any[] = [];
    if (schoolId) {
      conditions.push(eq(auditLogs.schoolId, schoolId));
    }
    if (actionFilter && actionFilter !== 'ALL') {
      conditions.push(eq(auditLogs.action, actionFilter));
    }

    if (decoded) {
      const cursorTime = decoded.timestamp ? new Date(decoded.timestamp) : new Date(0);
      conditions.push(
        sql`(${auditLogs.createdAt} < ${cursorTime} OR (${auditLogs.createdAt} = ${cursorTime} AND ${auditLogs.id} < ${decoded.id}))`
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const query = db
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
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(limit + 1);

    if (!decoded && req.query.page && Number(req.query.page) > 1) {
      query.offset((Number(req.query.page) - 1) * limit);
    }

    const rows = await query;
    const hasMore = rows.length > limit;
    const logs = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && logs.length > 0) {
      const last = logs[logs.length - 1];
      nextCursor = encodeCursor({
        id: last.id,
        timestamp: last.createdAt ? new Date(last.createdAt).toISOString() : undefined,
      });
    }

    res.json({
      success: true,
      limit,
      logs,
      nextCursor,
      hasMore,
      total: logs.length,
    });
  } catch (error: any) {
    if (error.message === 'INVALID_PAGINATION_CURSOR') {
      res.status(400).json({ success: false, error: 'INVALID_PAGINATION_CURSOR', message: 'The provided pagination cursor is invalid or malformed' });
      return;
    }
    res.status(400).json({ success: false, error: error.message });
  }
});

export default auditRouter;
