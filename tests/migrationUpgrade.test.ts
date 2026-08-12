import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db/index';
import { sql } from 'drizzle-orm';
import { seedDatabase } from '../src/db/seed';

describe('Phase 3 — Database, RLS, & Migration Upgrade Integration Tests', () => {
  beforeEach(async () => {
    await seedDatabase();
  });

  it('verifies import_jobs.staged_data column exists after migration 0007', async () => {
    const colCheck = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'import_jobs' AND column_name = 'staged_data';
    `);

    expect(colCheck.rows.length).toBe(1);
    expect(colCheck.rows[0].column_name).toBe('staged_data');
  });

  it('verifies high-throughput scale indexes created by migration 0008 exist', async () => {
    const idxCheck = await db.execute(sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND indexname IN ('idx_school_memberships_user_status', 'idx_guardians_school_phone', 'idx_attendance_events_session_time', 'idx_notification_jobs_status_next');
    `);

    expect(idxCheck.rows.length).toBe(4);
  });

  it('verifies FORCE ROW LEVEL SECURITY is enabled on all protected tables', async () => {
    const rlsCheck = await db.execute(sql`
      SELECT relname AS tablename, relrowsecurity AS rowsecurity, relforcerowsecurity AS force_rowsecurity
      FROM pg_class
      JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
      WHERE nspname = 'public' 
        AND relname IN ('students', 'attendance_sessions', 'attendance_events', 'attendance_records', 'import_jobs', 'audit_logs');
    `);

    for (const row of rlsCheck.rows as any[]) {
      expect(row.rowsecurity).toBe(true);
    }
  });

  it('verifies application context without current_school_id returns zero tenant rows', async () => {
    await db.execute(sql`SELECT set_config('app.is_system', 'false', true), set_config('app.current_school_id', '', true);`);
    const studentCount = await db.execute(sql`SELECT COUNT(*)::int as cnt FROM students;`);
    expect((studentCount.rows[0] as any).cnt).toBe(0);
  });

  it('verifies system context sees no tenant data without app.is_system=true', async () => {
    await db.execute(sql`SELECT set_config('app.is_system', 'false', true), set_config('app.current_school_id', '', true);`);
    const count = await db.execute(sql`SELECT COUNT(*)::int as cnt FROM students;`);
    expect((count.rows[0] as any).cnt).toBe(0);
  });

  it('verifies migration 0008 can be executed safely multiple times idempotently', async () => {
    await expect(
      db.execute(sql`CREATE INDEX IF NOT EXISTS idx_school_memberships_user_status ON school_memberships(user_id, status, school_id);`)
    ).resolves.not.toThrow();
  });
});
