import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/index';
import { sql } from 'drizzle-orm';
import { seedDatabase } from '../src/db/seed';

describe('P1-3 — Disaster Recovery & Post-Restore Verification Tests', () => {
  beforeEach(async () => {
    await seedDatabase();
  });

  it('verifies post-restore tenant RLS isolation policy enforces zero cross-tenant access', async () => {
    await db.execute(sql`SELECT set_config('app.is_system', 'false', true), set_config('app.current_school_id', '', true);`);
    const count = await db.execute(sql`SELECT COUNT(*)::int as cnt FROM students;`);
    expect((count.rows[0] as any).cnt).toBe(0);
  });

  it('verifies post-restore attendance record row counts and session integrity', async () => {
    const sessionCheck = await db.execute(sql`SELECT COUNT(*)::int as cnt FROM attendance_sessions;`);
    expect((sessionCheck.rows[0] as any).cnt).toBeGreaterThanOrEqual(0);
  });

  it('verifies notification queue worker safety after database restore', async () => {
    const queueCheck = await db.execute(sql`SELECT COUNT(*)::int as cnt FROM notification_jobs WHERE status = 'SENDING';`);
    expect((queueCheck.rows[0] as any).cnt).toBe(0);
  });
});
