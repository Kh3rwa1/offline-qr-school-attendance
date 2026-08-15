import { Router, Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { schools, schoolMemberships, users, teacherProfiles } from '../db/schema';
import { requireAuth, requireRole, requirePlatformRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import { createAuditLog } from '../services/auditLogService';
import { SchoolService } from '../services/schoolService';
import { hashPassword } from '../auth/password';

export const schoolRouter = Router();

// Zod Validation Schemas
const provisionSchoolSchema = z.object({
  name: z.string().min(2).max(255),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug must consist of lowercase letters, digits, and hyphens').min(2).max(80).optional(),
  udiseCode: z.string().regex(/^\d{11}$/, 'UDISE code must be exactly 11 digits'),
  district: z.string().min(2).max(100),
  block: z.string().max(100).optional(),
  preferredLanguage: z.enum(['bn', 'en', 'hi']).default('bn'),
  timezone: z.string().default('Asia/Kolkata'),
  admin: z.object({
    fullName: z.string().min(2).max(255),
    phoneNumber: z.string().min(10).max(20),
    email: z.string().email().optional(),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    linkExistingUser: z.boolean().optional(),
  }),
  academicYear: z.object({
    name: z.string().min(2).max(50),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).optional(),
});

const updateSchoolSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug must consist of lowercase letters, digits, and hyphens').min(2).max(80).optional(),
  udiseCode: z.string().regex(/^\d{11}$/).optional(),
  district: z.string().min(2).max(100).optional(),
  block: z.string().max(100).optional().nullable(),
  preferredLanguage: z.enum(['bn', 'en', 'hi']).optional(),
  timezone: z.string().optional(),
});

const updateSchoolStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ARCHIVED']),
  reason: z.string().min(5, 'Reason must be at least 5 characters long'),
});

const inviteMemberSchema = z.object({
  fullName: z.string().min(2).max(255),
  phoneNumber: z.string().min(10).max(20),
  role: z.enum(['SCHOOL_ADMIN', 'TEACHER', 'REPORT_VIEWER', 'RFID_OPERATOR']),
  designation: z.string().max(100).optional(),
  employeeId: z.string().max(50).optional(),
  temporaryPassword: z.string().min(8, 'Password must be at least 8 characters long'),
  reactivateExisting: z.boolean().optional(),
});

const changeMemberRoleSchema = z.object({
  newRole: z.enum(['SCHOOL_ADMIN', 'TEACHER', 'REPORT_VIEWER', 'RFID_OPERATOR']),
  reason: z.string().optional(),
});

// GET /api/v1/schools
schoolRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { sessionContext } = req;
  if (!sessionContext) return res.status(401).json({ error: 'UNAUTHORIZED' });

  const isPlatformSuperAdmin = sessionContext.platformRole === 'SUPER_ADMIN' || sessionContext.memberships.some((m) => m.role === 'SUPER_ADMIN');

  if (isPlatformSuperAdmin) {
    const result = await SchoolService.listSchools({
      search: req.query.search as string,
      status: req.query.status as string,
      district: req.query.district as string,
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 50,
    });
    return res.json({
      success: true,
      schools: result.schools,
      pagination: result.pagination,
    });
  }

  const assignedSchools = sessionContext.memberships.map((m) => ({
    id: m.schoolId,
    name: m.schoolName,
    role: m.role,
    status: m.status,
  }));

  return res.json({ success: true, schools: assignedSchools });
});

// POST /api/v1/schools (SUPER_ADMIN Provisioning)
schoolRouter.post(
  '/',
  requireAuth,
  requirePlatformRole(['SUPER_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = provisionSchoolSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_INPUT',
        details: parsed.error.format(),
      });
    }

    try {
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
      const result = await SchoolService.provisionSchool(parsed.data, req.user!.id, idempotencyKey);

      return res.status(201).json({
        success: true,
        school: result.school,
        adminUser: result.adminUser,
        data: result,
      });
    } catch (err: any) {
      if (err.code === 'DUPLICATE_UDISE_CODE') {
        return res.status(409).json({ success: false, error: err.code, code: err.code, message: err.message });
      }
      if (err.code === 'ADMIN_PHONE_CONFLICT') {
        return res.status(409).json({ success: false, error: err.code, code: err.code, message: err.message });
      }
      if (err.code === 'IDEMPOTENCY_CONFLICT') {
        return res.status(409).json({ success: false, error: err.code, code: err.code, message: err.message });
      }
      if (err.code === 'INVALID_INPUT') {
        return res.status(400).json({ success: false, error: err.code, code: err.code, message: err.message });
      }
      console.error('School provisioning error:', err);
      return res.status(500).json({ success: false, error: 'SCHOOL_PROVISIONING_FAILED', message: 'Failed to provision school' });
    }
  }
);

// PATCH /api/v1/schools/:schoolId (Update School Attributes)
schoolRouter.patch(
  '/:schoolId',
  requireAuth,
  requirePlatformRole(['SUPER_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req.params;
    const parsed = updateSchoolSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'INVALID_INPUT', details: parsed.error.format() });
    }
    try {
      const updated = await SchoolService.updateSchool(schoolId, parsed.data, req.user!.id);
      return res.json({ success: true, school: updated });
    } catch (err: any) {
      if (err.code === 'DUPLICATE_UDISE_CODE') {
        return res.status(409).json({ success: false, error: err.code, message: err.message });
      }
      if (err.code === 'SCHOOL_NOT_FOUND') {
        return res.status(404).json({ success: false, error: 'SCHOOL_NOT_FOUND' });
      }
      return res.status(500).json({ success: false, error: 'SCHOOL_UPDATE_FAILED', message: err.message });
    }
  }
);

// GET /api/v1/schools/:schoolId
schoolRouter.get('/:schoolId', requireAuth, requireTenant, async (req: AuthenticatedRequest, res: Response) => {
  const schoolId = req.activeSchoolId!;
  try {
    const details = await SchoolService.getSchoolDetails(schoolId);
    return res.json({ success: true, ...details });
  } catch (err: any) {
    if (err.code === 'SCHOOL_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'SCHOOL_NOT_FOUND' });
    }
    return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
});

// POST /api/v1/schools/:schoolId/status (Lifecycle State Transition)
schoolRouter.post(
  '/:schoolId/status',
  requireAuth,
  requirePlatformRole(['SUPER_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const { schoolId } = req.params;
    const parsed = updateSchoolStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'INVALID_INPUT', details: parsed.error.format() });
    }

    try {
      const updated = await SchoolService.updateSchoolStatus(
        schoolId,
        parsed.data.status,
        parsed.data.reason,
        req.user!.id
      );
      return res.json({ success: true, school: updated });
    } catch (err: any) {
      if (err.code === 'REASON_REQUIRED') {
        return res.status(400).json({ success: false, error: err.code, message: err.message });
      }
      if (err.code === 'SCHOOL_NOT_FOUND') {
        return res.status(404).json({ success: false, error: 'SCHOOL_NOT_FOUND' });
      }
      return res.status(500).json({ success: false, error: 'STATUS_UPDATE_FAILED' });
    }
  }
);

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
        createdAt: schoolMemberships.createdAt,
      })
      .from(schoolMemberships)
      .innerJoin(users, eq(schoolMemberships.userId, users.id))
      .where(eq(schoolMemberships.schoolId, schoolId));

    return res.json({ success: true, members });
  }
);

// POST /api/v1/schools/:schoolId/members (Create / Invite Staff)
schoolRouter.post(
  '/:schoolId/members',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const parsed = inviteMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'INVALID_INPUT', details: parsed.error.format() });
    }

    const { fullName, phoneNumber, role, designation, employeeId, temporaryPassword, reactivateExisting } = parsed.data;
    const normalizedPhone = phoneNumber.trim().replace(/[\s-]/g, '');

    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, normalizedPhone));

    let targetUser = existingUser;
    if (!targetUser) {
      const passwordHash = await hashPassword(temporaryPassword);
      const [newUser] = await db
        .insert(users)
        .values({
          fullName: fullName.trim(),
          phoneNumber: normalizedPhone,
          passwordHash,
          status: 'ACTIVE',
        })
        .returning();
      targetUser = newUser;
    }

    // Check if membership already exists in this school
    const [existingMembership] = await db
      .select()
      .from(schoolMemberships)
      .where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.userId, targetUser.id)));

    if (existingMembership) {
      if (existingMembership.status === 'SUSPENDED') {
        if (!reactivateExisting) {
          return res.status(409).json({
            success: false,
            error: 'MEMBER_SUSPENDED',
            message: 'User is currently suspended in this school. Please confirm explicit reactivation.',
          });
        }
        const [reactivated] = await db
          .update(schoolMemberships)
          .set({ status: 'ACTIVE', role, updatedAt: new Date() })
          .where(eq(schoolMemberships.id, existingMembership.id))
          .returning();

        await createAuditLog({
          schoolId,
          actorId: req.user!.id,
          action: 'REACTIVATE_MEMBERSHIP',
          resourceType: 'MEMBERSHIP',
          resourceId: reactivated.id,
          metadata: { targetUserId: targetUser.id, role, reason: 'Reactivated via invite form' },
        });

        return res.json({ success: true, member: reactivated, message: 'Member reactivated and updated' });
      }
      return res.status(409).json({ success: false, error: 'MEMBERSHIP_ALREADY_EXISTS', message: 'User is already an active member of this school' });
    }

    const [newMembership] = await db
      .insert(schoolMemberships)
      .values({
        schoolId,
        userId: targetUser.id,
        role,
        status: 'ACTIVE',
      })
      .returning();

    if (role === 'TEACHER') {
      await db
        .insert(teacherProfiles)
        .values({
          schoolId,
          userId: targetUser.id,
          employeeId: employeeId || null,
          designation: designation || 'Assistant Teacher',
        })
        .onConflictDoNothing();
    }

    await createAuditLog({
      schoolId,
      actorId: req.user!.id,
      action: 'MEMBER_INVITED',
      resourceType: 'MEMBERSHIP',
      resourceId: newMembership.id,
      metadata: {
        targetUserId: targetUser.id,
        role,
        fullName: targetUser.fullName,
      },
    });

    return res.status(201).json({
      success: true,
      member: {
        membershipId: newMembership.id,
        userId: targetUser.id,
        fullName: targetUser.fullName,
        phoneNumber: targetUser.phoneNumber,
        role: newMembership.role,
        status: newMembership.status,
      },
    });
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
    const reason = req.body.reason || 'Administrative suspension';

    // Prevent suspending self if last active admin
    const activeAdmins = await db
      .select()
      .from(schoolMemberships)
      .where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.role, 'SCHOOL_ADMIN'), eq(schoolMemberships.status, 'ACTIVE')));

    if (activeAdmins.length === 1 && activeAdmins[0].userId === userId) {
      return res.status(400).json({
        success: false,
        error: 'LAST_ADMIN_PROTECTED',
        message: 'Cannot suspend the last active administrator for this school',
      });
    }

    const [updated] = await db
      .update(schoolMemberships)
      .set({
        status: 'SUSPENDED',
        updatedAt: new Date(),
      })
      .where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.userId, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, error: 'MEMBERSHIP_NOT_FOUND' });
    }

    await createAuditLog({
      schoolId,
      actorId: req.user!.id,
      action: 'SUSPEND_MEMBERSHIP',
      resourceType: 'MEMBERSHIP',
      resourceId: updated.id,
      metadata: { targetUserId: userId, reason },
    });

    return res.json({ success: true, membership: updated });
  }
);

// POST /api/v1/schools/:schoolId/members/:userId/reactivate
schoolRouter.post(
  '/:schoolId/members/:userId/reactivate',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { userId } = req.params;
    const reason = req.body.reason || 'Administrative reactivation';

    const [updated] = await db
      .update(schoolMemberships)
      .set({
        status: 'ACTIVE',
        updatedAt: new Date(),
      })
      .where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.userId, userId)))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, error: 'MEMBERSHIP_NOT_FOUND' });
    }

    await createAuditLog({
      schoolId,
      actorId: req.user!.id,
      action: 'REACTIVATE_MEMBERSHIP',
      resourceType: 'MEMBERSHIP',
      resourceId: updated.id,
      metadata: { targetUserId: userId, reason },
    });

    return res.json({ success: true, membership: updated });
  }
);

// PATCH /api/v1/schools/:schoolId/members/:userId/role (Change Faculty Role)
schoolRouter.patch(
  '/:schoolId/members/:userId/role',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { userId } = req.params;
    const parsed = changeMemberRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'INVALID_INPUT', details: parsed.error.format() });
    }

    const { newRole, reason } = parsed.data;

    const [existingMem] = await db
      .select()
      .from(schoolMemberships)
      .where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.userId, userId)));

    if (!existingMem) {
      return res.status(404).json({ success: false, error: 'MEMBERSHIP_NOT_FOUND' });
    }

    // Last admin protection
    if (existingMem.role === 'SCHOOL_ADMIN' && newRole !== 'SCHOOL_ADMIN' && existingMem.status === 'ACTIVE') {
      const activeAdmins = await db
        .select()
        .from(schoolMemberships)
        .where(and(eq(schoolMemberships.schoolId, schoolId), eq(schoolMemberships.role, 'SCHOOL_ADMIN'), eq(schoolMemberships.status, 'ACTIVE')));
      if (activeAdmins.length <= 1) {
        return res.status(400).json({
          success: false,
          error: 'LAST_ADMIN_PROTECTED',
          message: 'Cannot demote the last active administrator for this school',
        });
      }
    }

    const [updated] = await db
      .update(schoolMemberships)
      .set({
        role: newRole,
        updatedAt: new Date(),
      })
      .where(eq(schoolMemberships.id, existingMem.id))
      .returning();

    if (newRole === 'TEACHER') {
      await db
        .insert(teacherProfiles)
        .values({
          schoolId,
          userId,
          designation: 'Assistant Teacher',
        })
        .onConflictDoNothing();
    }

    await createAuditLog({
      schoolId,
      actorId: req.user!.id,
      action: 'MEMBER_ROLE_CHANGED',
      resourceType: 'MEMBERSHIP',
      resourceId: updated.id,
      metadata: {
        targetUserId: userId,
        oldRole: existingMem.role,
        newRole,
        reason: reason || 'Role updated by administrator',
      },
    });

    return res.json({ success: true, membership: updated });
  }
);
