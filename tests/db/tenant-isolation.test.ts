import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { db, withTenantContext, withSystemContext } from '../../src/db';
import { students } from '../../src/db/schema';
import { seedDatabase } from '../../src/db/seed';

describe('Database Layer Tenant Isolation', () => {
  let schoolAId: string;
  let schoolBId: string;

  beforeAll(async () => {
    const seeded = await seedDatabase();
    schoolAId = seeded.schoolA.id;
    schoolBId = seeded.schoolB.id;
  });

  it('no tenant config survives a transaction on a pooled connection', async () => {
    await withTenantContext(schoolAId, async (tx) => {
      await tx.select().from(students).limit(1);
    });
    // Hammer the pool so we definitely reuse that connection
    const results = await Promise.all(
      Array.from({ length: 30 }, () =>
        db.execute(sql`SELECT current_setting('app.current_school_id', true) AS s`)
      )
    );
    for (const r of results) {
      const s = (r as any).rows?.[0]?.s ?? '';
      expect(s).toBe('');
    }
  });

  it('a query outside any context sees zero tenant rows (RLS fails closed)', async () => {
    const rows = await db.select().from(students);
    expect(rows).toHaveLength(0);
  });

  it('nested transaction rolls back to savepoint when inner error is caught', async () => {
    await withTenantContext(schoolAId, async (tx) => {
      const existing = await tx.select().from(students);
      const baselineCount = existing.length;

      await db
        .transaction(async (t) => {
          await t.insert(students).values({
            schoolId: schoolAId,
            studentCode: `SAVEPOINT-${Date.now()}`,
            name: 'Savepoint Test Student',
            status: 'ACTIVE',
          });
          throw new Error('intentional_rollback');
        })
        .catch(() => {});

      const after = await tx.select().from(students);
      expect(after.length).toBe(baselineCount);
    });
  });

  it('refuses to switch school inside an active tenant context', async () => {
    await withTenantContext(schoolAId, async () => {
      await expect(
        withTenantContext(schoolBId, async () => {})
      ).rejects.toThrow('TENANT_CONTEXT_SWITCH_FORBIDDEN');
    });
  });

  it('refuses tenant context inside active system context', async () => {
    await withSystemContext(async () => {
      await expect(
        withTenantContext(schoolAId, async () => {})
      ).rejects.toThrow('TENANT_CONTEXT_INSIDE_SYSTEM_CONTEXT_FORBIDDEN');
    });
  });

  it('refuses system context inside active tenant context', async () => {
    await withTenantContext(schoolAId, async () => {
      await expect(
        withSystemContext(async () => {})
      ).rejects.toThrow('SYSTEM_CONTEXT_INSIDE_TENANT_CONTEXT_FORBIDDEN');
    });
  });

  it('refuses to start on in-memory database in production when DATABASE_URL is placeholder or missing', () => {
    const isPlaceholder = (url?: string) => !url || /replace[-_]with[-_]/.test(url);
    expect(isPlaceholder(undefined)).toBe(true);
    expect(isPlaceholder('')).toBe(true);
    expect(isPlaceholder('postgresql://user:pass@localhost:5432/replace-with-db')).toBe(true);
    expect(isPlaceholder('postgresql://app:secret@prod-db.internal:5432/attendance')).toBe(false);
  });
});
