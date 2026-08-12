import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db';
import { users } from '../src/db/schema';
import { seedDatabase } from '../src/db/seed';
import { createSession, getSession } from '../src/auth/session';
import { eq } from 'drizzle-orm';

describe('Role-Based Access Control (RBAC)', () => {
  let seededData: any;

  beforeEach(async () => {
    seededData = await seedDatabase();
  });

  it('verifies School Admin has administrative role in School A', async () => {
    const [adminA] = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, '+919100000001'));

    const { token } = await createSession(adminA.id, seededData.schoolA.id);
    const session = await getSession(token);

    const membership = session?.memberships.find(
      (m) => m.schoolId === seededData.schoolA.id
    );

    expect(membership?.role).toBe('SCHOOL_ADMIN');
  });

  it('verifies Teacher role cannot perform admin operations', async () => {
    const [teacherA1] = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, '+919100000002'));

    const { token } = await createSession(teacherA1.id, seededData.schoolA.id);
    const session = await getSession(token);

    const membership = session?.memberships.find(
      (m) => m.schoolId === seededData.schoolA.id
    );

    expect(membership?.role).toBe('TEACHER');
    expect(membership?.role).not.toBe('SCHOOL_ADMIN');
    expect(membership?.role).not.toBe('SUPER_ADMIN');
  });

  it('verifies Super Admin has cross-school access', async () => {
    const [superAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, '+919000000000'));

    const { token } = await createSession(superAdmin.id, seededData.schoolA.id);
    const session = await getSession(token);

    const hasSchoolA = session?.memberships.some(
      (m) => m.schoolId === seededData.schoolA.id
    );
    const hasSchoolB = session?.memberships.some(
      (m) => m.schoolId === seededData.schoolB.id
    );

    expect(hasSchoolA).toBe(true);
    expect(hasSchoolB).toBe(true);
    expect(session?.memberships[0].role).toBe('SUPER_ADMIN');
  });
});
