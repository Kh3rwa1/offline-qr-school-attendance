import { drizzle } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from './schema';
import { env } from '../env';

let client: PGlite | pg.Pool;
let dbInstance: any;

export function getDb() {
  if (dbInstance) return dbInstance;

  if (env.DATABASE_URL && env.NODE_ENV !== 'test') {
    const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
    client = pool;
    dbInstance = drizzlePg(pool, { schema });
  } else {
    const pglite = new PGlite();
    client = pglite;
    dbInstance = drizzle(pglite, { schema });
  }
  return dbInstance;
}

export const db = getDb();

/**
 * Configure policies after migrations have created the schema. Table DDL is
 * intentionally not performed here; deployment owns schema changes.
 */
export async function setupRlsPolicies() {
  const tables = [
    'academic_years', 'school_memberships', 'teacher_profiles', 'devices',
    'class_sections', 'teacher_assignments', 'students', 'guardians',
    'enrollments', 'qr_credentials', 'attendance_sessions',
    'attendance_session_roster', 'attendance_events', 'attendance_records',
    'attendance_corrections', 'school_sms_settings', 'notification_jobs',
    'import_jobs', 'audit_logs',
  ];
  for (const table of tables) {
    await executeSql(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    await executeSql(`DROP POLICY IF EXISTS tenant_isolation_policy ON ${table};`);
    await executeSql(`CREATE POLICY tenant_isolation_policy ON ${table}
      USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid)
      WITH CHECK (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid);`);
  }
}

export async function executeSql(sqlQuery: string) {
  if (client && 'query' in client) return (client as any).query(sqlQuery);
  if (client && 'exec' in client) return (client as any).exec(sqlQuery);
  throw new Error('DATABASE_CLIENT_UNAVAILABLE');
}

export async function setTenantContext(schoolId: string) {
  if (!isUuid(schoolId)) throw new Error('INVALID_SCHOOL_ID');
  await executeSql(`SELECT set_config('app.current_school_id', '${schoolId}', false);`);
}

export async function resetTenantContext() {
  await executeSql('RESET app.current_school_id;');
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Execute all tenant-sensitive work on one transaction/connection. */
export async function withTenantContext<T>(schoolId: string, fn: (tx: any) => Promise<T>): Promise<T> {
  if (!isUuid(schoolId)) throw new Error('INVALID_SCHOOL_ID');
  return getDb().transaction(async (tx: any) => {
    await tx.execute(sql`SELECT set_config('app.current_school_id', ${schoolId}, true)`);
    return fn(tx);
  });
}
