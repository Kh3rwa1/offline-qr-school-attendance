import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db, withSystemContext } from '../db';
import { users, schoolMemberships, schools } from '../db/schema';
import { verifyPassword } from '../auth/password';
import { timingSafeVerifyPassword, lookupAuthUserByPhone, getUserSchoolMemberships } from '../db/authFunctions';
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
  const user = await lookupAuthUserByPhone(phoneNumber);
  const isValidPassword = await timingSafeVerifyPassword(user?.passwordHash, password);

  if (!user || !isValidPassword || user.status === 'SUSPENDED') {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid phone number or password' });
  }

  try {
    const memberships = await getUserSchoolMemberships(user.id);
    const isSuperAdmin = memberships.some((m) => m.role === 'SUPER_ADMIN');
    let targetSchoolId = schoolId;

    if (targetSchoolId) {
      const assigned = memberships.some((m) => m.schoolId === targetSchoolId);
      if (!assigned && !isSuperAdmin) throw new Error('SCHOOL_ACCESS_DENIED');
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

    res.cookie('session', session.token, { ...sessionCookieOptions, expires: session.expiresAt });
    return res.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
      },
      memberships,
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

const switchSchoolSchema = z.object({
  schoolId: z.string().uuid(),
});

authRouter.post('/switch-school', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = switchSchoolSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parsed.error.format() });
  }

  const { schoolId } = parsed.data;
  const memberships = await getUserSchoolMemberships(req.user!.id);
  const targetMembership = memberships.find((m) => m.schoolId === schoolId);
  const isSuperAdmin = memberships.some((m) => m.role === 'SUPER_ADMIN');

  if (!targetMembership && !isSuperAdmin) {
    return res.status(403).json({ error: 'MEMBERSHIP_NOT_FOUND', message: 'User does not belong to target school' });
  }

  const session = await createSession(req.user!.id, schoolId);
  res.cookie('session', session.token, { ...sessionCookieOptions, expires: session.expiresAt });

  return res.json({
    success: true,
    activeSchoolId: schoolId,
    activeRole: targetMembership?.role || 'SUPER_ADMIN',
  });
});
