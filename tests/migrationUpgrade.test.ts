import { beforeAll, describe, expect, test } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../src/db';
import { runMigrations } from '../src/db/migrate';

const EXPECTED_TABLES = [
  'academic_calendar_days',
  'academic_calendar_versions',
  'report_approvals',
  'report_artifacts',
  'reporting_profiles',
] as const;

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  const rows = (result as { rows?: Array<Record<string, unknown>> } | undefined)?.rows;
  return rows || [];
}

describe('government reporting migration upgrade', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  test('creates the complete reporting schema with immutable artifact bytes', async () => {
    const tables = rowsOf(await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (${sql.join(EXPECTED_TABLES.map((name) => sql`${name}`), sql`, `)})
      ORDER BY table_name
    `));

    expect(tables.map((row) => row.table_name)).toEqual([...EXPECTED_TABLES].sort());

    const artifactColumns = rowsOf(await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'report_artifacts'
      ORDER BY ordinal_position
    `));
    const columnsByName = new Map(artifactColumns.map((row) => [String(row.column_name), row]));

    expect(columnsByName.get('content_bytes')?.data_type).toBe('bytea');
    expect(columnsByName.get('content_bytes')?.is_nullable).toBe('YES');
    expect(columnsByName.get('sha256')?.is_nullable).toBe('NO');
    expect(columnsByName.get('byte_size')?.is_nullable).toBe('NO');
    expect(columnsByName.get('storage_backend')?.is_nullable).toBe('NO');
    expect(columnsByName.get('created_at')?.is_nullable).toBe('NO');
  });

  test('forces tenant RLS and exposes no artifact update/delete policy', async () => {
    const rlsRows = rowsOf(await db.execute(sql`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relname IN ('report_artifacts', 'academic_calendar_versions', 'reporting_profiles', 'report_approvals')
      ORDER BY relname
    `));

    for (const row of rlsRows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
    }

    const artifactPolicies = rowsOf(await db.execute(sql`
      SELECT policyname, cmd
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'report_artifacts'
      ORDER BY policyname
    `));
    expect(artifactPolicies.map((row) => [row.policyname, row.cmd])).toEqual([
      ['report_artifacts_insert', 'INSERT'],
      ['report_artifacts_select', 'SELECT'],
    ]);
  });

  test('installs the fallback profile and preserves tenant isolation', async () => {
    const builtInProfiles = rowsOf(await db.execute(sql`
      SELECT id, school_id, profile_name, is_builtin
      FROM reporting_profiles
      WHERE id = '00000000-0000-4000-8000-000000000070'
    `));
    expect(builtInProfiles).toHaveLength(1);
    expect(builtInProfiles[0]?.school_id).toBeNull();
    expect(builtInProfiles[0]?.profile_name).toBe('West Bengal Standard Export');
    expect(builtInProfiles[0]?.is_builtin).toBe(true);

    const policyRows = rowsOf(await db.execute(sql`
      SELECT tablename, policyname, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('report_artifacts', 'academic_calendar_versions', 'reporting_profiles', 'report_approvals')
      ORDER BY tablename, policyname
    `));

    const policyText = policyRows
      .map((row) => `${row.tablename} ${row.policyname} ${row.cmd} ${row.qual || ''} ${row.with_check || ''}`)
      .join('\n');
    expect(policyText).toContain('app.current_school_id');
    expect(policyText).toContain('report_artifacts_select');
    expect(policyText).toContain('report_artifacts_insert');
    expect(policyText).toContain('reporting_profiles_select');
    expect(policyText).toContain('school_id IS NULL');
  });

  test('keeps reporting migrations idempotent across repeated startup runs', async () => {
    await expect(runMigrations()).resolves.toBeUndefined();
    await expect(runMigrations()).resolves.toBeUndefined();

    const migrationRows = rowsOf(await db.execute(sql`
      SELECT COUNT(*)::int AS migration_count
      FROM drizzle.__drizzle_migrations
    `));
    expect(Number(migrationRows[0]?.migration_count || 0)).toBeGreaterThanOrEqual(18);
  });
});
