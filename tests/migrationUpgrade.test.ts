import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index';
import { runMigrations } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';

describe('Database, RLS, and migration upgrade integration', () => {
  beforeEach(async () => {
    await seedDatabase();
  });

  it('keeps earlier hardened migration columns and indexes', async () => {
    const staged = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name='import_jobs' AND column_name='staged_data'`);
    expect(staged.rows).toHaveLength(1);
    const indexes = await db.execute(sql`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN ('idx_school_memberships_user_status','idx_guardians_school_phone','idx_attendance_events_session_time','idx_notification_jobs_status_next')`);
    expect(indexes.rows).toHaveLength(4);
  });

  it('installs the immutable report artifact schema with exact byte metadata', async () => {
    const columns = await db.execute(sql`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name='report_artifacts'
      ORDER BY column_name
    `);
    const names = new Map((columns.rows as any[]).map((row) => [row.column_name, row.data_type]));
    expect(names.get('content')).toBe('bytea');
    expect(names.get('sha256')).toBe('character varying');
    expect(names.has('content_type')).toBe(true);
    expect(names.has('filename')).toBe(true);
    expect(names.has('byte_size')).toBe(true);
    expect(names.has('storage_backend')).toBe(true);
    expect(names.has('storage_key')).toBe(true);
  });

  it('installs governed calendar versions and source/approximation fields', async () => {
    const versionColumns = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name='academic_calendar_versions'`);
    const versionNames = new Set((versionColumns.rows as any[]).map((row) => row.column_name));
    for (const name of ['school_id', 'academic_year', 'version', 'status', 'source_type', 'source_reference', 'approved_by', 'approved_at']) {
      expect(versionNames.has(name)).toBe(true);
    }
    const dayColumns = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name='academic_calendar_days'`);
    const dayNames = new Set((dayColumns.rows as any[]).map((row) => row.column_name));
    for (const name of ['calendar_version_id', 'source_type', 'source_reference', 'is_approximate']) expect(dayNames.has(name)).toBe(true);
  });

  it('forces RLS on all reporting tables', async () => {
    const result = await db.execute(sql`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class JOIN pg_namespace ON pg_namespace.oid=pg_class.relnamespace
      WHERE nspname='public' AND relname IN (
        'academic_calendar_days','academic_calendar_versions','reporting_profiles','report_approvals','report_artifacts'
      )
    `);
    expect(result.rows).toHaveLength(5);
    for (const row of result.rows as any[]) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
    }
  });

  it('exposes only SELECT and INSERT tenant policies for immutable artifacts', async () => {
    const policies = await db.execute(sql`
      SELECT policyname, cmd FROM pg_policies
      WHERE schemaname='public' AND tablename='report_artifacts'
      ORDER BY policyname
    `);
    const commands = (policies.rows as any[]).map((row) => row.cmd).sort();
    expect(commands).toEqual(['INSERT', 'SELECT']);
  });

  it('installs a UUID default profile with full localized configuration', async () => {
    const result = await db.execute(sql`
      SELECT id, version, configuration FROM reporting_profiles
      WHERE id='00000000-0000-4000-8000-000000000070'::uuid
    `);
    expect(result.rows).toHaveLength(1);
    const configuration = (result.rows[0] as any).configuration;
    expect(configuration.language).toBe('BILINGUAL');
    expect(configuration.disclaimer.en).toBeTruthy();
    expect(configuration.disclaimer.bn).toBeTruthy();
    expect(configuration.disclaimer.hi).toBeTruthy();
  });

  it('keeps tenant tables empty when no valid tenant context is set', async () => {
    await db.execute(sql`SELECT set_config('app.is_system','false',true), set_config('app.current_school_id','',true)`);
    const students = await db.execute(sql`SELECT COUNT(*)::int AS count FROM students`);
    const artifacts = await db.execute(sql`SELECT COUNT(*)::int AS count FROM report_artifacts`);
    expect(Number((students.rows[0] as any).count)).toBe(0);
    expect(Number((artifacts.rows[0] as any).count)).toBe(0);
  });

  it('can run the complete migration runner repeatedly without changing schema', async () => {
    await expect(runMigrations()).resolves.not.toThrow();
    await expect(runMigrations()).resolves.not.toThrow();
    const tables = await db.execute(sql`SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('report_artifacts','academic_calendar_versions')`);
    expect(Number((tables.rows[0] as any).count)).toBe(2);
  });
});
