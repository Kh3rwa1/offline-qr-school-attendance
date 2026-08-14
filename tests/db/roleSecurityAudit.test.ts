import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';

const migrationUrl = process.env.PG_RLS_MIGRATION_DATABASE_URL;
const requested = process.env.PRODUCTION_PG_TEST === '1';
const enabled = Boolean(migrationUrl && requested);

describe.skipIf(!enabled)('PostgreSQL Fail-Closed Database Role & Function Privilege Audit', () => {
  let pool: pg.Pool;

  beforeAll(() => {
    pool = new pg.Pool({ connectionString: migrationUrl });
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  it('1. Verifies all required dedicated database roles exist with strict NOSUPERUSER & NOBYPASSRLS attributes', async () => {
    const res = await pool.query(`
      SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolcanlogin
      FROM pg_roles
      WHERE rolname IN ('attendance_app', 'attendance_auth', 'attendance_system', 'attendance_worker', 'attendance_migration')
      ORDER BY rolname;
    `);

    const roleMap = new Map<string, any>();
    for (const r of res.rows) {
      roleMap.set(r.rolname, r);
    }

    const expectedRoles = ['attendance_app', 'attendance_auth', 'attendance_system', 'attendance_worker', 'attendance_migration'];
    for (const expected of expectedRoles) {
      expect(roleMap.has(expected), `Expected role ${expected} to exist`).toBe(true);
      const r = roleMap.get(expected);
      expect(r.rolsuper, `Role ${expected} must be NOSUPERUSER`).toBe(false);
      expect(r.rolbypassrls, `Role ${expected} must be NOBYPASSRLS`).toBe(false);
      expect(r.rolcreatedb, `Role ${expected} must be NOCREATEDB`).toBe(false);
      expect(r.rolcreaterole, `Role ${expected} must be NOCREATEROLE`).toBe(false);
    }
  });

  it('2. Asserts attendance_auth has zero direct table privileges in public schema', async () => {
    const res = await pool.query(`
      SELECT table_schema, table_name, privilege_type
      FROM information_schema.role_table_grants
      WHERE grantee = 'attendance_auth' AND table_schema = 'public';
    `);

    expect(res.rows).toHaveLength(0);
  });

  it('3. Asserts PUBLIC cannot execute SECURITY DEFINER authentication functions', async () => {
    const res = await pool.query(`
      SELECT 
        has_function_privilege('public', 'public.lookup_auth_user_by_phone(text)', 'EXECUTE') AS can_exec_phone,
        has_function_privilege('public', 'public.get_user_school_memberships(uuid)', 'EXECUTE') AS can_exec_memberships;
    `);

    const row = res.rows[0];
    expect(row.can_exec_phone).toBe(false);
    expect(row.can_exec_memberships).toBe(false);
  });

  it('4. Asserts only attendance_auth has EXECUTE privilege on authentication functions', async () => {
    const res = await pool.query(`
      SELECT 
        has_function_privilege('attendance_auth', 'public.lookup_auth_user_by_phone(text)', 'EXECUTE') AS auth_exec_phone,
        has_function_privilege('attendance_auth', 'public.get_user_school_memberships(uuid)', 'EXECUTE') AS auth_exec_memberships,
        has_function_privilege('attendance_app', 'public.lookup_auth_user_by_phone(text)', 'EXECUTE') AS app_exec_phone,
        has_function_privilege('attendance_worker', 'public.lookup_auth_user_by_phone(text)', 'EXECUTE') AS worker_exec_phone;
    `);

    const row = res.rows[0];
    expect(row.auth_exec_phone).toBe(true);
    expect(row.auth_exec_memberships).toBe(true);
    expect(row.app_exec_phone).toBe(false);
    expect(row.worker_exec_phone).toBe(false);
  });

  it('5. Asserts authentication functions are SECURITY DEFINER with strict search_path = pg_catalog, public', async () => {
    const res = await pool.query(`
      SELECT proname, prosecdef, proconfig
      FROM pg_proc
      JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid
      WHERE pg_namespace.nspname = 'public'
        AND proname IN ('lookup_auth_user_by_phone', 'get_user_school_memberships');
    `);

    expect(res.rows.length).toBeGreaterThanOrEqual(2);
    for (const r of res.rows) {
      expect(r.prosecdef, `Function ${r.proname} must be SECURITY DEFINER`).toBe(true);
      const proconfig = Array.isArray(r.proconfig) ? r.proconfig.join(',') : String(r.proconfig || '');
      expect(proconfig, `Function ${r.proname} search_path must be pg_catalog, public`).toContain('search_path=pg_catalog, public');
    }
  });
});
