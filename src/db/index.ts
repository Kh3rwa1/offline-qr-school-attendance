import { drizzle } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
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
    // In-memory or embedded PGlite for zero-config dev & vitest
    const pglite = new PGlite();
    client = pglite;
    dbInstance = drizzle(pglite, { schema });
  }

  return dbInstance;
}

export const db = getDb();

/**
 * Execute SQL DDL statements to set up schema tables and RLS policies.
 */
export async function setupRlsPolicies(pgInstance: any = client) {
  const tableDdls = [
    `CREATE TABLE IF NOT EXISTS schools (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      udise_code VARCHAR(50) UNIQUE,
      district VARCHAR(100) NOT NULL,
      block VARCHAR(100),
      preferred_language VARCHAR(10) NOT NULL DEFAULT 'bn',
      timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS academic_years (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      name VARCHAR(50) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      is_current BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(20) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS school_memberships (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(30) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS teacher_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      employee_id VARCHAR(50),
      designation VARCHAR(100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS devices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_identifier VARCHAR(255) NOT NULL,
      device_model VARCHAR(100),
      status VARCHAR(20) NOT NULL DEFAULT 'AUTHORIZED',
      last_synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS auth_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
      session_token VARCHAR(255) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS class_sections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      class_name VARCHAR(50) NOT NULL,
      section_name VARCHAR(50) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS teacher_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      class_section_id UUID NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS students (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      student_code VARCHAR(50) NOT NULL,
      banglar_shiksha_id VARCHAR(100),
      name VARCHAR(255) NOT NULL,
      name_bn VARCHAR(255),
      date_of_birth DATE,
      gender VARCHAR(20),
      photo_url TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS guardians (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(20) NOT NULL,
      relationship VARCHAR(50) NOT NULL DEFAULT 'PARENT',
      sms_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `ALTER TABLE guardians ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN NOT NULL DEFAULT FALSE;`,
    `CREATE TABLE IF NOT EXISTS student_guardians (
      student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
      is_primary BOOLEAN NOT NULL DEFAULT TRUE,
      PRIMARY KEY (student_id, guardian_id)
    );`,
    `CREATE TABLE IF NOT EXISTS enrollments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      class_section_id UUID NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
      academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
      roll_number INT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS qr_credentials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      token_digest VARCHAR(255) NOT NULL,
      version INT NOT NULL DEFAULT 1,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      revoked_at TIMESTAMPTZ
    );`,
    `CREATE TABLE IF NOT EXISTS attendance_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      class_section_id UUID NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
      teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_date DATE NOT NULL,
      session_type VARCHAR(20) NOT NULL DEFAULT 'DAILY',
      status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
      finalized_at TIMESTAMPTZ,
      finalized_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS attendance_session_roster (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      attendance_session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
      roll_number_snapshot INT NOT NULL,
      student_name_snapshot VARCHAR(255) NOT NULL,
      is_expected BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS attendance_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      client_event_id VARCHAR(255) NOT NULL UNIQUE,
      attendance_session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      event_type VARCHAR(30) NOT NULL,
      status_value VARCHAR(20) NOT NULL,
      client_timestamp TIMESTAMPTZ NOT NULL,
      server_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      device_id UUID REFERENCES devices(id),
      actor_id UUID NOT NULL REFERENCES users(id),
      metadata JSONB
    );`,
    `CREATE TABLE IF NOT EXISTS attendance_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      attendance_session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL,
      first_scanned_at TIMESTAMPTZ,
      last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      has_conflict BOOLEAN NOT NULL DEFAULT FALSE
    );`,
    `CREATE TABLE IF NOT EXISTS attendance_corrections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      attendance_record_id UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
      previous_status VARCHAR(20) NOT NULL,
      new_status VARCHAR(20) NOT NULL,
      reason TEXT NOT NULL,
      corrected_by UUID NOT NULL REFERENCES users(id),
      corrected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS notification_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
      template_code VARCHAR(50) NOT NULL,
      language VARCHAR(10) NOT NULL,
      content TEXT NOT NULL,
      dlt_template_id VARCHAR(100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS school_sms_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
      sms_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      dlt_principal_entity_id VARCHAR(100),
      dlt_header VARCHAR(20),
      allowlist_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      allowlist JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS notification_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      attendance_session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
      student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      recipient_phone VARCHAR(20) NOT NULL,
      language VARCHAR(10) NOT NULL DEFAULT 'bn',
      message_body TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
      notification_type VARCHAR(50) NOT NULL DEFAULT 'ABSENCE',
      finalized_attendance_version VARCHAR(100) NOT NULL DEFAULT 'v1',
      provider_message_id VARCHAR(255),
      attempt_count INT NOT NULL DEFAULT 0,
      failure_reason TEXT,
      queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sent_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ
    );`,
    `ALTER TABLE notification_jobs ADD COLUMN IF NOT EXISTS notification_type VARCHAR(50) NOT NULL DEFAULT 'ABSENCE';`,
    `ALTER TABLE notification_jobs ADD COLUMN IF NOT EXISTS finalized_attendance_version VARCHAR(100) NOT NULL DEFAULT 'v1';`,
    `CREATE UNIQUE INDEX IF NOT EXISTS notification_jobs_dedup_idx ON notification_jobs (school_id, student_id, attendance_session_id, notification_type, finalized_attendance_version);`,
    `CREATE TABLE IF NOT EXISTS notification_attempts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id UUID NOT NULL REFERENCES notification_jobs(id) ON DELETE CASCADE,
      attempt_number INT NOT NULL,
      status VARCHAR(20) NOT NULL,
      response_payload JSONB,
      error_message TEXT,
      attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS import_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
      file_name VARCHAR(255) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      total_rows INT NOT NULL DEFAULT 0,
      successful_rows INT NOT NULL DEFAULT 0,
      failed_rows INT NOT NULL DEFAULT 0,
      error_summary JSONB,
      created_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
      actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      resource_type VARCHAR(100) NOT NULL,
      resource_id VARCHAR(255),
      ip_address VARCHAR(45),
      user_agent TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );`
  ];

  for (const ddl of tableDdls) {
    try {
      await executeSql(ddl);
    } catch (err) {
      // DDL error handled
    }
  }

  const tablesWithRls = [
    'academic_years',
    'school_memberships',
    'teacher_profiles',
    'devices',
    'class_sections',
    'teacher_assignments',
    'students',
    'guardians',
    'enrollments',
    'qr_credentials',
    'attendance_sessions',
    'attendance_session_roster',
    'attendance_events',
    'attendance_records',
    'attendance_corrections',
    'school_sms_settings',
    'notification_jobs',
    'import_jobs',
    'audit_logs',
  ];

  for (const table of tablesWithRls) {
    try {
      await executeSql(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      await executeSql(`
        DROP POLICY IF EXISTS tenant_isolation_policy ON ${table};
        CREATE POLICY tenant_isolation_policy ON ${table}
          USING (school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid);
      `);
    } catch (err) {
      // Ignore policy setup if unsupported or existing
    }
  }
}

export async function executeSql(sqlQuery: string) {
  const rawDb = getDb();
  if ('query' in rawDb) {
    // drizzle-orm
    if ('client' in rawDb && typeof rawDb.client.query === 'function') {
      return rawDb.client.query(sqlQuery);
    }
  }
  if (client && 'query' in client) {
    return (client as any).query(sqlQuery);
  }
  if (client && 'exec' in client) {
    return (client as any).exec(sqlQuery);
  }
}

export async function setTenantContext(schoolId: string) {
  try {
    await executeSql(`SET app.current_school_id = '${schoolId}';`);
  } catch (e) {}
}

export async function resetTenantContext() {
  try {
    await executeSql(`RESET app.current_school_id;`);
  } catch (e) {}
}

/**
 * Helper to execute a callback within a tenant RLS transaction.
 */
export async function withTenantContext<T>(
  schoolId: string,
  fn: (tx: any) => Promise<T>
): Promise<T> {
  const currentDb = getDb();
  return await currentDb.transaction(async (tx: any) => {
    if (tx.client && typeof tx.client.query === 'function') {
      await tx.client.query(`SET LOCAL app.current_school_id = '${schoolId}';`);
    } else if (typeof tx.execute === 'function') {
      await tx.execute(`SET LOCAL app.current_school_id = '${schoolId}';`);
    }
    return await fn(tx);
  });
}
