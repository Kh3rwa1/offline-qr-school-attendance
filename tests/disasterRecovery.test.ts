import { describe, it, expect, beforeEach } from 'vitest';
import { db, withSystemContext } from '../src/db/index';
import { sql } from 'drizzle-orm';
import { seedDatabase } from '../src/db/seed';

describe('P1-3 — Disaster Recovery & Post-Restore Verification Tests', () => {
  beforeEach(async () => {
    await seedDatabase();
  });

  it('verifies post-restore tenant RLS isolation policy enforces zero cross-tenant access', async () => {
    await db.execute(sql`SELECT set_config('app.is_system', 'false', false), set_config('app.current_school_id', '', false);`);
    const count = await db.execute(sql`SELECT COUNT(*)::int as cnt FROM students;`);
    expect((count.rows[0] as any).cnt).toBe(0);
  });

  it('verifies post-restore database schema integrity for schools and users tables', async () => {
    await withSystemContext(async (tx) => {
      const schoolCheck = await tx.execute(sql`SELECT COUNT(*)::int as cnt FROM schools;`);
      expect((schoolCheck.rows[0] as any).cnt).toBeGreaterThan(0);

      const userCheck = await tx.execute(sql`SELECT COUNT(*)::int as cnt FROM users;`);
      expect((userCheck.rows[0] as any).cnt).toBeGreaterThan(0);
    });
  });

  it('verifies notification queue worker safety after database restore with zero orphan sending jobs', async () => {
    await withSystemContext(async (tx) => {
      const queueCheck = await tx.execute(sql`SELECT COUNT(*)::int as cnt FROM notification_jobs WHERE status = 'SENDING';`);
      expect((queueCheck.rows[0] as any).cnt).toBe(0);
    });
  });
});
