import crypto from 'crypto';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db';
import { authSessions, users, schoolMemberships, schools } from '../db/schema';

export interface SessionContext {
  sessionId: string;
  userId: string;
  schoolId: string | null;
  user: {
    id: string;
    fullName: string;
    phoneNumber: string;
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

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function createSession(
  userId: string,
  schoolId?: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await db.insert(authSessions).values({
    userId,
    schoolId: schoolId || null,
    sessionToken: token,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function getSession(token: string): Promise<SessionContext | null> {
  if (!token) return null;

  const now = new Date();

  // Find active non-expired session
  const [sessionRecord] = await db
    .select()
    .from(authSessions)
    .where(and(eq(authSessions.sessionToken, token), gt(authSessions.expiresAt, now)));

  if (!sessionRecord) return null;

  // Find user details
  const [userRecord] = await db
    .select()
    .from(users)
    .where(eq(users.id, sessionRecord.userId));

  if (!userRecord || userRecord.status !== 'ACTIVE') {
    return null; // Reject if user is missing or suspended
  }

  // Find user school memberships
  const memberships = await db
    .select({
      schoolId: schoolMemberships.schoolId,
      schoolName: schools.name,
      role: schoolMemberships.role,
      status: schoolMemberships.status,
    })
    .from(schoolMemberships)
    .innerJoin(schools, eq(schoolMemberships.schoolId, schools.id))
    .where(eq(schoolMemberships.userId, userRecord.id));

  let activeMembership;
  if (sessionRecord.schoolId) {
    activeMembership = memberships.find(
      (m: { schoolId: string; schoolName: string; role: string; status: string }) => m.schoolId === sessionRecord.schoolId
    );
  } else if (memberships.length > 0) {
    activeMembership = memberships[0];
  }

  return {
    sessionId: sessionRecord.id,
    userId: userRecord.id,
    schoolId: sessionRecord.schoolId || activeMembership?.schoolId || null,
    user: {
      id: userRecord.id,
      fullName: userRecord.fullName,
      phoneNumber: userRecord.phoneNumber,
      status: userRecord.status,
    },
    memberships,
    activeMembership,
  };
}

export async function invalidateSession(token: string): Promise<void> {
  if (!token) return;
  await db.delete(authSessions).where(eq(authSessions.sessionToken, token));
}
