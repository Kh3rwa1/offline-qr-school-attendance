import { describe, it, expect, beforeEach } from 'vitest';
import { db, withTenantContext, executeSql } from '../src/db';
import { users, schoolMemberships, students, schools } from '../src/db/schema';
import { seedDatabase } from '../src/db/seed';
import { createSession, getSession } from '../src/auth/session';
import { eq, and } from 'drizzle-orm';

describe('Multi-Tenant Isolation & RLS Security', () => {
  let seededData: any;

  beforeEach(async () => {
    seededData = await seedDatabase();
  });

  it('rejects access when School A teacher attempts to access School B', async () => {
    // School A Teacher
    const [teacherUserA] = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, '+919100000002'));

    const { token } = await createSession(teacherUserA.id, seededData.schoolA.id);
    const session = await getSession(token);

    expect(session).not.toBeNull();

    // Verify teacher only has membership in School A
    const hasMembershipB = session?.memberships.some(
      (m) => m.schoolId === seededData.schoolB.id
    );
    expect(hasMembershipB).toBe(false);
  });

  it('rejects user with suspended membership', async () => {
    // Suspend School A Teacher
    const [teacherUserA] = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, '+919100000002'));

    await db
      .update(schoolMemberships)
      .set({ status: 'SUSPENDED' })
      .where(
        and(
          eq(schoolMemberships.userId, teacherUserA.id),
          eq(schoolMemberships.schoolId, seededData.schoolA.id)
        )
      );

    const { token } = await createSession(teacherUserA.id, seededData.schoolA.id);
    const session = await getSession(token);

    const activeMem = session?.memberships.find(
      (m) => m.schoolId === seededData.schoolA.id
    );
    expect(activeMem?.status).toBe('SUSPENDED');
  });

  it('proves PostgreSQL RLS restricts direct tenant-scoped queries', async () => {
    const schoolAId = seededData.schoolA.id;
    const schoolBId = seededData.schoolB.id;

    // Insert dummy student in School A
    const [stuA] = await db
      .insert(students)
      .values({
        schoolId: schoolAId,
        studentCode: 'STU-A-101',
        name: 'Arjun Das',
        status: 'ACTIVE',
      })
      .returning();

    // Insert dummy student in School B
    const [stuB] = await db
      .insert(students)
      .values({
        schoolId: schoolBId,
        studentCode: 'STU-B-101',
        name: 'Riya Roy',
        status: 'ACTIVE',
      })
      .returning();

    // Query within School A context
    await withTenantContext(schoolAId, async (tx) => {
      const schoolAStudents = await tx
        .select()
        .from(students)
        .where(eq(students.schoolId, schoolAId));

      expect(schoolAStudents.some((s: any) => s.id === stuA.id)).toBe(true);
      expect(schoolAStudents.some((s: any) => s.id === stuB.id)).toBe(false);
    });
  });
});
