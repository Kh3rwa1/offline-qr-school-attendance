import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users, schoolMemberships, schools } from '../db/schema';
import { verifyPassword } from '../auth/password';
import { createSession, invalidateSession } from '../auth/session';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware';
import { createAuditLog } from '../services/auditLogService';

export const authRouter = Router();

const loginSchema = z.object({
  phoneNumber: z.string().min(10),
  password: z.string().min(1),
  schoolId: z.string().optional(),
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'INVALID_INPUT', details: parsed.error.format() });
  }

  const { phoneNumber, password, schoolId } = parsed.data;

  // Lookup user by phone number
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.phoneNumber, phoneNumber));

  if (!user) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid phone number or password' });
  }

  if (user.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'USER_SUSPENDED', message: 'User account is suspended' });
  }

  // Verify password
  const passwordValid = await verifyPassword(user.passwordHash, password);
  if (!passwordValid) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid phone number or password' });
  }

  // Fetch memberships
  const memberships = await db
    .select({
      schoolId: schoolMemberships.schoolId,
      schoolName: schools.name,
      role: schoolMemberships.role,
      status: schoolMemberships.status,
    })
    .from(schoolMemberships)
    .innerJoin(schools, eq(schoolMemberships.schoolId, schools.id))
    .where(eq(schoolMemberships.userId, user.id));

  // Create session
  const targetSchoolId = schoolId || memberships[0]?.schoolId;
  const { token, expiresAt } = await createSession(user.id, targetSchoolId);

  // Set HTTP-only session cookie
  res.cookie('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });

  await createAuditLog({
    schoolId: targetSchoolId,
    actorId: user.id,
    action: 'USER_LOGIN',
    resourceType: 'USER',
    resourceId: user.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return res.json({
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
    },
    memberships,
  });
});

authRouter.post('/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const token = req.cookies?.session || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (token) {
    await invalidateSession(token);
  }

  res.clearCookie('session', { path: '/' });

  if (req.user) {
    await createAuditLog({
      schoolId: req.sessionContext?.schoolId,
      actorId: req.user.id,
      action: 'USER_LOGOUT',
      resourceType: 'USER',
      resourceId: req.user.id,
    });
  }

  return res.json({ status: 'ok', message: 'Logged out successfully' });
});

authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    user: req.user,
    sessionContext: req.sessionContext,
  });
});
