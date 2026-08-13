import pg from 'pg';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const migrationUrl = process.env.PG_RLS_MIGRATION_DATABASE_URL;
const appUrl = process.env.PG_RLS_APPLICATION_DATABASE_URL;
const requested = process.env.PRODUCTION_PG_TEST === '1';

if (requested && (!migrationUrl || !appUrl)) {
  throw new Error('FATAL: PRODUCTION_PG_TEST=1 requested but PG_RLS_MIGRATION_DATABASE_URL or PG_RLS_APPLICATION_DATABASE_URL environment variable is missing.');
}

const enabled = Boolean(migrationUrl && appUrl);

describe.skipIf(!enabled)('Phase 7 — Programmatic PostgreSQL RLS & Schema Completeness Audit', () => {
  let migrationPool: pg.Pool;
  let appPool: pg.Pool;

  beforeAll(async () => {
    migrationPool = new pg.Pool({ connectionString: migrationUrl });
    appPool = new pg.Pool({ connectionString: appUrl });
  });

  afterAll(async () => {
    if (appPool) await appPool.end();
    if (migrationPool) await migrationPool.end();
  });

  it('proves rowsecurity and forcerowsecurity are ENABLED for all application tables', async () => {
    const res = await migrationPool.query(`
      SELECT
        t.tablename,
        c.relrowsecurity AS rowsecurity,
        c.relforcerowsecurity AS forcerowsecurity
      FROM pg_catalog.pg_tables AS t
      JOIN pg_catalog.pg_namespace AS n
        ON n.nspname = t.schemaname
      JOIN pg_catalog.pg_class AS c
        ON c.relnamespace = n.oid
       AND c.relname = t.tablename
      WHERE t.schemaname = 'public'
        AND c.relkind = 'r';
    `);

    expect(res.rows.length).toBeGreaterThan(0);
    for (const row of res.rows) {
      if (row.tablename.includes('drizzle')) continue;
      expect(row.rowsecurity, `Table ${row.tablename} must have RLS enabled`).toBe(true);
      expect(row.forcerowsecurity, `Table ${row.tablename} must have FORCE RLS enabled`).toBe(true);
    }
  });

  it('proves application database role attendance_app is NOSUPERUSER and NOBYPASSRLS', async () => {
    const res = await migrationPool.query(`
      SELECT rolname, rolsuper, rolbypassrls
      FROM pg_roles
      WHERE rolname IN ('attendance_app', 'attendance_auth', 'attendance_worker')
    `);

    expect(res.rows.length).toBeGreaterThanOrEqual(1);
    for (const row of res.rows) {
      expect(row.rolsuper, `Role ${row.rolname} must be NOSUPERUSER`).toBe(false);
      expect(row.rolbypassrls, `Role ${row.rolname} must be NOBYPASSRLS`).toBe(false);
    }
  });

  it('proves application role cannot elevate privileges by setting app.is_system = true', async () => {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.is_system', 'true', true), set_config('app.current_school_id', '', true)");
      const res = await client.query('SELECT COUNT(*) FROM students');
      expect(Number(res.rows[0].count)).toBe(0);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('proves empty tenant context fails closed and returns 0 rows', async () => {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.is_system', 'false', true), set_config('app.current_school_id', '', true)");
      const res = await client.query('SELECT COUNT(*) FROM students');
      expect(Number(res.rows[0].count)).toBe(0);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });
});
