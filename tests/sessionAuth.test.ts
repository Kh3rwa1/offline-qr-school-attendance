import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createSession, getSession, invalidateSession } from '../src/auth/session';
import { hashPassword, verifyPassword } from '../src/auth/password';
import { db } from '../src/db';
import { users, authSessions } from '../src/db/schema';
import { seedDatabase } from '../src/db/seed';

describe('Session Authentication & Argon2id Security', () => {
  let seededData: any;

  beforeEach(async () => {
    seededData = await seedDatabase();
  });

  it('verifies Argon2id password hashing correctly', async () => {
    const password = 'MySecurePassword123!';
    const hash = await hashPassword(password);

    expect(hash).toContain('$argon2id$');
    const isValid = await verifyPassword(hash, password);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword(hash, 'WrongPassword!');
    expect(isInvalid).toBe(false);
  });

  it('creates and retrieves a valid database-backed session', async () => {
    // Teacher A1 phone
    const [teacherUser] = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, '+919100000002'));

    expect(teacherUser).toBeDefined();

    const { token, expiresAt } = await createSession(teacherUser.id, seededData.schoolA.id);
    expect(token).toBeDefined();
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const session = await getSession(token);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe(teacherUser.id);
    expect(session?.user.fullName).toBe('Sujata Banerjee');
  });

  it('rejects invalid or non-existent session tokens', async () => {
    const invalidSession = await getSession('fake-token-12345');
    expect(invalidSession).toBeNull();
  });

  it('rejects expired sessions', async () => {
    const [teacherUser] = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, '+919100000002'));

    const { token } = await createSession(teacherUser.id, seededData.schoolA.id);

    // Manually expire session in database
    await db
      .update(authSessions)
      .set({ expiresAt: new Date(Date.now() - 1000) });

    const session = await getSession(token);
    expect(session).toBeNull();
  });

  it('invalidates sessions on logout', async () => {
    const [teacherUser] = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, '+919100000002'));

    const { token } = await createSession(teacherUser.id, seededData.schoolA.id);
    let session = await getSession(token);
    expect(session).not.toBeNull();

    await invalidateSession(token);

    session = await getSession(token);
    expect(session).toBeNull();
  });
});
