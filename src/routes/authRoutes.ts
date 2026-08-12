import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db, withSystemContext } from '../db';
import { users, schoolMemberships, schools } from '../db/schema';
import { verifyPassword } from '../auth/password';
import { createSession, invalidateSession } from '../auth/session';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware';
import { createAuditLog } from '../services/auditLogService';

export const authRouter = Router();

const loginSchema = z.object({
  phoneNumber: z.string().min(10),
  password: z.string().min(1),
  schoolId: z.string().uuid().optional(),
});

const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

authRouter.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parsed.error.format() });
  }

  const { phoneNumber, password, schoolId } = parsed.data;
  const user = await withSystemContext(async () => {
    const [candidate] = await db.select().from(users).where(eq(users.phoneNumber, phoneNumber));
    return candidate;
  });

  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid phone number or password' });
  }

  if (user.status === 'SUSPENDED') {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid phone number or password' });
  }

  try {
    const result = await withSystemContext(async () => {
      const memberships = await db
        .select({
          schoolId: schoolMemberships.schoolId,
          schoolName: schools.name,
          role: schoolMemberships.role,
          status: schoolMemberships.status,
        })
        .from(schoolMemberships)
        .innerJoin(schools, eq(schoolMemberships.schoolId, schools.id))
        .where(and(
          eq(schoolMemberships.userId, user.id),
          eq(schoolMemberships.status, 'ACTIVE'),
          eq(schools.status, 'ACTIVE'),
        ));

      const isSuperAdmin = memberships.some((membership: { schoolId: string; role: string }) => membership.role === 'SUPER_ADMIN');
      let targetSchoolId = schoolId;

      if (targetSchoolId) {
        const assigned = memberships.some((membership: { schoolId: string; role: string }) => membership.schoolId === targetSchoolId);
        if (!assigned && !isSuperAdmin) throw new Error('SCHOOL_ACCESS_DENIED');
        if (isSuperAdmin && !assigned) {
          const [targetSchool] = await db
            .select({ id: schools.id })
            .from(schools)
            .where(and(eq(schools.id, targetSchoolId), eq(schools.status, 'ACTIVE')));
          if (!targetSchool) throw new Error('SCHOOL_ACCESS_DENIED');
        }
      } else {
        targetSchoolId = memberships[0]?.schoolId;
      }

      if (!targetSchoolId) throw new Error('SCHOOL_ACCESS_DENIED');

      const session = await createSession(user.id, targetSchoolId);
      await createAuditLog({
        schoolId: targetSchoolId,
        actorId: user.id,
        action: 'USER_LOGIN',
        resourceType: 'USER',
        resourceId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      return { memberships, ...session };
    });

    res.cookie('session', result.token, { ...sessionCookieOptions, expires: result.expiresAt });
    return res.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
      },
      memberships: result.memberships,
    });
  } catch (error: any) {
    if (error?.message === 'SCHOOL_ACCESS_DENIED') {
      return res.status(403).json({ error: 'SCHOOL_ACCESS_DENIED' });
    }
    console.error('Login transaction failed:', error);
    return res.status(500).json({ error: 'LOGIN_FAILED' });
  }
});

authRouter.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const token = req.cookies?.session || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  try {
    await withSystemContext(async () => {
      if (token) await invalidateSession(token);
      if (req.user) {
        await createAuditLog({
          schoolId: req.sessionContext?.schoolId,
          actorId: req.user.id,
          action: 'USER_LOGOUT',
          resourceType: 'USER',
          resourceId: req.user.id,
        });
      }
    });
  } catch (error) {
    console.error('Logout security operation failed:', error);
    res.clearCookie('session', sessionCookieOptions);
    return res.status(500).json({ error: 'LOGOUT_AUDIT_FAILED' });
  }

  res.clearCookie('session', sessionCookieOptions);
  return res.json({ status: 'ok', message: 'Logged out successfully' });
});

authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    user: req.user,
    sessionContext: req.sessionContext,
  });
});
