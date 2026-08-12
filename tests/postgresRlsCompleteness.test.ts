import pg from 'pg';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const migrationUrl = process.env.PG_RLS_MIGRATION_DATABASE_URL;
const appUrl = process.env.PG_RLS_APPLICATION_DATABASE_URL;
const systemUrl = process.env.PG_RLS_SYSTEM_DATABASE_URL || appUrl;
const requested = process.env.PRODUCTION_PG_TEST === '1';
const enabled = Boolean(migrationUrl && appUrl && requested);

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
      SELECT tablename, rowsecurity, forcerowsecurity
      FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      WHERE schemaname = 'public'
        AND tablename NOT IN ('drizzle.__drizzle_migrations')
    `);

    expect(res.rows.length).toBeGreaterThan(0);
    for (const row of res.rows) {
      expect(row.rowsecurity, `Table ${row.tablename} must have RLS enabled`).toBe(true);
      expect(row.forcerowsecurity, `Table ${row.tablename} must have FORCE RLS enabled`).toBe(true);
    }
  });

  it('proves application database role attendance_app is NOSUPERUSER and NOBYPASSRLS', async () => {
    const res = await migrationPool.query(`
      SELECT rolname, rolsuper, rolbypassrls
      FROM pg_roles
      WHERE rolname = 'attendance_app'
    `);

    expect(res.rows).toHaveLength(1);
    expect(res.rows[0].rolsuper).toBe(false);
    expect(res.rows[0].rolbypassrls).toBe(false);
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
