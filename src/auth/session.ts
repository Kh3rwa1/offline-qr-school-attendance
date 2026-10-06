import crypto from 'crypto';
import { eq, and, gt, sql } from 'drizzle-orm';
import { db, withSystemContext } from '../db';
import { authSessions, users, schoolMemberships, schools } from '../db/schema';
import { AppError } from '../errors/AppError';

export interface SessionContext {
  sessionId: string;
  userId: string;
  schoolId: string | null;
  platformRole?: string | null;
  user: {
    id: string;
    fullName: string;
    phoneNumber: string;
    platformRole?: string | null;
    status: string;
  };
  memberships: {
    schoolId: string;
    schoolName: string;
    role: string;
    status: string;
  }[];
  activeMembership?: {
    schoolId: string;
    role: string;
    status: string;
  };
}

/** Absolute maximum session lifetime regardless of activity. */
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
/** Session expires if idle for longer than this window. */
const SESSION_IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  userId: string,
  schoolId?: string | null
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  await withSystemContext(async (tx) => {
    await tx.insert(authSessions).values({
      userId,
      schoolId: schoolId || null,
      sessionToken: hashedToken,
      expiresAt,
      lastAccessedAt: now,
    });
  });

  return { token, expiresAt };
}

export async function getSession(token: string): Promise<SessionContext | null> {
  if (!token) return null;

  return withSystemContext(async (tx) => {
    const now = new Date();
    const hashedToken = hashToken(token);
    const idleDeadline = new Date(now.getTime() - SESSION_IDLE_TIMEOUT_MS);

    // Find active non-expired, non-idle session by SHA-256 token hash
    const [sessionRecord] = await tx
      .select()
      .from(authSessions)
      .where(and(
        eq(authSessions.sessionToken, hashedToken),
        gt(authSessions.expiresAt, now),
        gt(authSessions.lastAccessedAt, idleDeadline),
      ));

    if (!sessionRecord) return null;

    // Bump lastAccessedAt to slide the idle window (fire-and-forget; non-fatal if it races)
    tx.update(authSessions)
      .set({ lastAccessedAt: now })
      .where(eq(authSessions.sessionToken, hashedToken))
      .execute()
      .catch(() => {});

    // Find user details
    const [userRecord] = await tx
      .select()
      .from(users)
      .where(eq(users.id, sessionRecord.userId));

    if (!userRecord || userRecord.status !== 'ACTIVE') {
      return null; // Reject if user is missing or suspended
    }

    // Find user school memberships
    const memberships = await tx
      .select({
        schoolId: schoolMemberships.schoolId,
        schoolName: schools.name,
        role: schoolMemberships.role,
        status: schoolMemberships.status,
      })
      .from(schoolMemberships)
      .innerJoin(schools, eq(schoolMemberships.schoolId, schools.id))
      .where(and(
        eq(schoolMemberships.userId, userRecord.id),
        eq(schoolMemberships.status, 'ACTIVE'),
        eq(schools.status, 'ACTIVE'),
      ));

    const isPlatformSuperAdmin = userRecord.platformRole === 'SUPER_ADMIN' || memberships.some((m: { role: string }) => m.role === 'SUPER_ADMIN');

    let activeMembership: SessionContext['activeMembership'] | undefined;
    if (sessionRecord.schoolId) {
      activeMembership = memberships.find(
        (m: { schoolId: string; schoolName: string; role: string; status: string }) => m.schoolId === sessionRecord.schoolId
      );
      if (!activeMembership && isPlatformSuperAdmin) {
        const [targetSchool] = await tx
          .select({ id: schools.id })
          .from(schools)
          .where(and(eq(schools.id, sessionRecord.schoolId), eq(schools.status, 'ACTIVE')));
        if (targetSchool) {
          activeMembership = { schoolId: targetSchool.id, role: 'SUPER_ADMIN', status: 'ACTIVE' };
        }
      }
    } else if (memberships.length > 0) {
      activeMembership = memberships[0];
    }

    // If not a platform super admin and no active membership, reject
    if (!activeMembership && !isPlatformSuperAdmin) {
      return null;
    }

    return {
      sessionId: sessionRecord.id,
      userId: userRecord.id,
      schoolId: sessionRecord.schoolId || activeMembership?.schoolId || null,
      platformRole: userRecord.platformRole || (isPlatformSuperAdmin ? 'SUPER_ADMIN' : null),
      user: {
        id: userRecord.id,
        fullName: userRecord.fullName,
        phoneNumber: userRecord.phoneNumber,
        platformRole: userRecord.platformRole || (isPlatformSuperAdmin ? 'SUPER_ADMIN' : null),
        status: userRecord.status,
      },
      memberships,
      activeMembership,
    };
  });
}

export async function invalidateSession(token: string): Promise<void> {
  if (!token) return;
  const hashedToken = hashToken(token);
  await withSystemContext(async (tx) => {
    await tx.delete(authSessions).where(eq(authSessions.sessionToken, hashedToken));
  });
}

export function isPlatformSuperAdmin(session?: SessionContext | null): boolean {
  if (!session) return false;
  return (
    session.platformRole === 'SUPER_ADMIN' ||
    session.user?.platformRole === 'SUPER_ADMIN' ||
    session.memberships?.some((m) => m.role === 'SUPER_ADMIN') === true
  );
}

export type Role = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'REPORT_VIEWER';
export type SessionUser = SessionContext['user'];

export async function assertMembership(
  user: SessionUser,
  schoolId: string,
  allowedRoles?: readonly (Role | string)[],
  session?: SessionContext
): Promise<{ role: string; schoolId: string }> {
  if (user.platformRole === 'SUPER_ADMIN') {
    return { role: 'SUPER_ADMIN', schoolId };
  }

  const mem = session?.memberships?.find((m) => m.schoolId === schoolId);
  if (mem) {
    if (mem.status === 'SUSPENDED') {
      throw new AppError('MEMBERSHIP_SUSPENDED', 403, 'School membership is suspended');
    }
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(mem.role)) {
      throw new AppError('FORBIDDEN', 403, `Role ${mem.role} not authorized for this resource`);
    }
    return { role: mem.role, schoolId };
  }

  return await withSystemContext(async (tx) => {
    const [row] = await tx
      .select({ role: schoolMemberships.role, status: schoolMemberships.status })
      .from(schoolMemberships)
      .where(and(eq(schoolMemberships.userId, user.id), eq(schoolMemberships.schoolId, schoolId)));

    if (!row) {
      throw new AppError('CROSS_TENANT_DENIED', 403, 'User is not a member of this school');
    }
    if (row.status === 'SUSPENDED') {
      throw new AppError('MEMBERSHIP_SUSPENDED', 403, 'School membership is suspended');
    }
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(row.role)) {
      throw new AppError('FORBIDDEN', 403, `Role ${row.role} not authorized for this resource`);
    }
    return { role: row.role, schoolId };
  });
}
