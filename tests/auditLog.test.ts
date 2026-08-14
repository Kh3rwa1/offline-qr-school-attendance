import { describe, it, expect, beforeAll } from 'vitest';
import { createAuditLog, sanitizeMetadata } from '../src/services/auditLogService';
import { db } from '../src/db';
import { auditLogs, users } from '../src/db/schema';
import { seedDatabase } from '../src/db/seed';
import { eq } from 'drizzle-orm';

describe('Audit Logging & Data Privacy Filters', () => {
  let seededData: any;

  beforeAll(async () => {
    seededData = await seedDatabase();
  });

  it('redacts sensitive fields like passwords, secrets, and full phone numbers from metadata', () => {
    const rawMetadata = {
      password: 'MySecretPassword123!',
      sessionToken: 'abc123xyz456',
      phoneNumber: '+919876543210',
      actionReason: 'Updated user details',
    };

    const sanitized = sanitizeMetadata(rawMetadata);

    expect(sanitized?.password).toBe('[REDACTED]');
    expect(sanitized?.sessionToken).toBe('[REDACTED]');
    expect(sanitized?.phoneNumber).toBe('+91******3210');
    expect(sanitized?.actionReason).toBe('Updated user details');
  });

  it('creates persistent audit logs for security actions', async () => {
    const [superAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, '+919000000000'));

    const logEntry = await createAuditLog({
      schoolId: seededData.schoolA.id,
      actorId: superAdmin.id,
      action: 'SUSPEND_TEACHER',
      resourceType: 'USER',
      resourceId: 'usr-target-123',
      metadata: { reason: 'Policy violation', passwordHash: 'secret_hash' },
    });

    expect(logEntry).toBeDefined();
    expect(logEntry?.action).toBe('SUSPEND_TEACHER');

    const [retrieved] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.id, logEntry!.id));

    expect(retrieved).toBeDefined();
    expect(retrieved.actorId).toBe(superAdmin.id);
    expect((retrieved.metadata as any)?.passwordHash).toBe('[REDACTED]');
  });
});
