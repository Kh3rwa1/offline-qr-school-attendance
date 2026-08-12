import { Router, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { schools, schoolMemberships, users } from '../db/schema';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import { createAuditLog } from '../services/auditLogService';

export const schoolRouter = Router();

// GET /api/v1/schools
schoolRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { sessionContext } = req;
  if (!sessionContext) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const isSuperAdmin = sessionContext.memberships.some((m) => m.role === 'SUPER_ADMIN');

  if (isSuperAdmin) {
    const allSchools = await db.select().from(schools);
    return res.json({ schools: allSchools });
  }

  const assignedSchools = sessionContext.memberships.map((m) => ({
    id: m.schoolId,
    name: m.schoolName,
    role: m.role,
    status: m.status,
  }));

  return res.json({ schools: assignedSchools });
});

// GET /api/v1/schools/:schoolId
schoolRouter.get('/:schoolId', requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const schoolId = req.activeSchoolId!;

  const [school] = await db
    .select()
    .from(schools)
    .where(eq(schools.id, schoolId));

  if (!school) {
    return res.status(404).json({ error: 'SCHOOL_NOT_FOUND' });
  }

  return res.json({ school });
});

// GET /api/v1/schools/:schoolId/members
schoolRouter.get(
  '/:schoolId/members',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;

    const members = await db
      .select({
        membershipId: schoolMemberships.id,
        userId: users.id,
        fullName: users.fullName,
        phoneNumber: users.phoneNumber,
        role: schoolMemberships.role,
        status: schoolMemberships.status,
      })
      .from(schoolMemberships)
      .innerJoin(users, eq(schoolMemberships.userId, users.id))
      .where(eq(schoolMemberships.schoolId, schoolId));

    return res.json({ members });
  }
);

// POST /api/v1/schools/:schoolId/members/:userId/suspend
schoolRouter.post(
  '/:schoolId/members/:userId/suspend',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { userId } = req.params;

    const [updated] = await db
      .update(schoolMemberships)
      .set({
        status: 'SUSPENDED',
        updatedAt: new Date(),
      })
      .where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.userId, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'MEMBERSHIP_NOT_FOUND' });
    }

    await createAuditLog({
      schoolId,
      actorId: req.user!.id,
      action: 'SUSPEND_MEMBERSHIP',
      resourceType: 'MEMBERSHIP',
      resourceId: updated.id,
      metadata: { targetUserId: userId },
    });

    return res.json({ status: 'ok', membership: updated });
  }
);
