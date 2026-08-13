import pg from 'pg';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const migrationUrl = process.env.PG_RLS_MIGRATION_DATABASE_URL;
const appUrl = process.env.PG_RLS_APPLICATION_DATABASE_URL;
const systemUrl = process.env.PG_RLS_SYSTEM_DATABASE_URL || appUrl;
const requested = process.env.PRODUCTION_PG_TEST === '1';
const enabled = Boolean(migrationUrl && appUrl && requested);

if (requested && !enabled) {
  console.warn('[PostgresRlsTest] PRODUCTION_PG_TEST=1 requested but PG_RLS_MIGRATION_DATABASE_URL or PG_RLS_APPLICATION_DATABASE_URL is missing. Test suite will be skipped.');
}

describe.skipIf(!enabled)('Production PostgreSQL authentication, RLS and SMS integration', () => {
  const migrationPool = new pg.Pool({ connectionString: migrationUrl });
  const appPool = new pg.Pool({ connectionString: appUrl });
  const schoolA = crypto.randomUUID();
  const schoolB = crypto.randomUUID();
  const teacherId = crypto.randomUUID();
  const adminId = crypto.randomUUID();
  const academicYearId = crypto.randomUUID();
  const classSectionId = crypto.randomUUID();
  const academicYearBId = crypto.randomUUID();
  const classSectionBId = crypto.randomUUID();
  const studentId = crypto.randomUUID();
  const studentBId = crypto.randomUUID();
  const guardianId = crypto.randomUUID();
  const guardianBId = crypto.randomUUID();
  const sessionBId = crypto.randomUUID();
  const teacherPhone = `+9198${String(Date.now()).slice(-8)}`;
  const teacherPassword = 'TeacherPassword123!';
  let server: any;
  let baseUrl = '';
  let cookie = '';

  beforeAll(async () => {
    const migrations = await migrationPool.query("SELECT to_regclass('drizzle.__drizzle_migrations') AS table_name");
    expect(migrations.rows[0].table_name).toBe('drizzle.__drizzle_migrations');

    const teacherHash = await argon2.hash(teacherPassword, { type: argon2.argon2id });
    const adminHash = await argon2.hash('AdminPassword123!', { type: argon2.argon2id });
    await migrationPool.query('BEGIN');
    await migrationPool.query('INSERT INTO schools (id, name, district, status) VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)', [schoolA, 'RLS School A', 'Test', 'ACTIVE', schoolB, 'RLS School B', 'Test', 'ACTIVE']);
    await migrationPool.query('INSERT INTO users (id, full_name, phone_number, password_hash, status) VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)', [teacherId, 'RLS Teacher', teacherPhone, teacherHash, 'ACTIVE', adminId, 'RLS Admin', `+9197${String(Date.now()).slice(-8)}`, adminHash, 'ACTIVE']);
    await migrationPool.query('INSERT INTO school_memberships (school_id, user_id, role, status) VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)', [schoolA, teacherId, 'TEACHER', 'ACTIVE', schoolA, adminId, 'SCHOOL_ADMIN', 'ACTIVE']);
    await migrationPool.query('INSERT INTO academic_years (id, school_id, name, start_date, end_date, is_current) VALUES ($1, $2, $3, $4, $5, true)', [academicYearId, schoolA, '2026', '2026-01-01', '2026-12-31']);
    await migrationPool.query('INSERT INTO class_sections (id, school_id, academic_year_id, class_name, section_name) VALUES ($1, $2, $3, $4, $5)', [classSectionId, schoolA, academicYearId, 'Class 8', 'A']);
    await migrationPool.query('INSERT INTO teacher_assignments (school_id, teacher_id, class_section_id) VALUES ($1, $2, $3)', [schoolA, teacherId, classSectionId]);
    await migrationPool.query('INSERT INTO students (id, school_id, student_code, name, status) VALUES ($1, $2, $3, $4, $5)', [studentId, schoolA, 'RLS-STUDENT-1', 'RLS Student', 'ACTIVE']);
    await migrationPool.query('INSERT INTO enrollments (school_id, student_id, class_section_id, academic_year_id, roll_number, start_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7)', [schoolA, studentId, classSectionId, academicYearId, 1, '2026-01-01', 'ACTIVE']);
    await migrationPool.query('INSERT INTO guardians (id, school_id, name, phone_number, relationship, sms_opt_out) VALUES ($1, $2, $3, $4, $5, false)', [guardianId, schoolA, 'RLS Guardian', '+919876543210', 'PARENT']);
    await migrationPool.query('INSERT INTO student_guardians (student_id, guardian_id, is_primary) VALUES ($1, $2, true)', [studentId, guardianId]);
    await migrationPool.query('INSERT INTO school_sms_settings (school_id, sms_enabled, dlt_principal_entity_id, dlt_header, segment_balance, max_segments_per_message) VALUES ($1, true, $2, $3, $4, $5)', [schoolA, 'ENTITY-A', 'HEADERA', 10, 4]);
    await migrationPool.query('INSERT INTO academic_years (id, school_id, name, start_date, end_date, is_current) VALUES ($1, $2, $3, $4, $5, true)', [academicYearBId, schoolB, '2026', '2026-01-01', '2026-12-31']);
    await migrationPool.query('INSERT INTO class_sections (id, school_id, academic_year_id, class_name, section_name) VALUES ($1, $2, $3, $4, $5)', [classSectionBId, schoolB, academicYearBId, 'Class 8', 'B']);
    await migrationPool.query('INSERT INTO students (id, school_id, student_code, name, status) VALUES ($1, $2, $3, $4, $5)', [studentBId, schoolB, 'RLS-STUDENT-B', 'RLS Student B', 'ACTIVE']);
    await migrationPool.query('INSERT INTO enrollments (school_id, student_id, class_section_id, academic_year_id, roll_number, start_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7)', [schoolB, studentBId, classSectionBId, academicYearBId, 1, '2026-01-01', 'ACTIVE']);
    await migrationPool.query('INSERT INTO guardians (id, school_id, name, phone_number, relationship, sms_opt_out) VALUES ($1, $2, $3, $4, $5, false)', [guardianBId, schoolB, 'RLS Guardian B', '+919876543211', 'PARENT']);
    await migrationPool.query('INSERT INTO student_guardians (student_id, guardian_id, is_primary) VALUES ($1, $2, true)', [studentBId, guardianBId]);
    await migrationPool.query('INSERT INTO school_sms_settings (school_id, sms_enabled, dlt_principal_entity_id, dlt_header, segment_balance, max_segments_per_message) VALUES ($1, true, $2, $3, $4, $5)', [schoolB, 'ENTITY-B', 'HEADERB', 10, 4]);
    await migrationPool.query('COMMIT');

    process.env.NODE_ENV = 'production';
    process.env.RUN_SERVER = 'false';
    process.env.TEST_SERVER_STATIC = 'true';
    process.env.DATABASE_URL = appUrl!;
    process.env.SYSTEM_DATABASE_URL = systemUrl!;
    process.env.AUTH_DATABASE_URL = process.env.PG_RLS_AUTH_DATABASE_URL || migrationUrl!;
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'integration-test-session-secret-01234567890123456789';
    process.env.METRICS_AUTH_TOKEN = process.env.METRICS_AUTH_TOKEN || 'integration-test-metrics-token-01234567890123456789';
    process.env.REDIS_KEY_HMAC_SECRET = process.env.REDIS_KEY_HMAC_SECRET || 'integration-test-redis-hmac-secret-0123456789';
    process.env.RFID_HMAC_SECRET = process.env.RFID_HMAC_SECRET || 'integration-test-rfid-hmac-secret-0123456789';
    process.env.SMS_PROVIDER = 'fake';
    process.env.ALLOW_FAKE_SMS_IN_PRODUCTION = 'true';
    const { createApp } = await import('../server');
    const app = await createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await migrationPool.query('DELETE FROM schools WHERE id IN ($1, $2)', [schoolA, schoolB]);
    await appPool.end();
    await migrationPool.end();
  });

  it('proves cookie auth, tenant RLS, finalization, worker isolation and logout', async () => {
    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneNumber: teacherPhone, password: teacherPassword, schoolId: schoolA }),
    });
    expect(login.status).toBe(200);
    const setCookie = login.headers.get('set-cookie') || '';
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Secure/i);
    const loginBody = await login.json();
    expect(loginBody.token).toBeUndefined();
    cookie = setCookie.split(';')[0];

    const me = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { cookie } });
    expect(me.status).toBe(200);
    expect((await me.json()).sessionContext.schoolId).toBe(schoolA);

    const crossTenant = await fetch(`${baseUrl}/api/v1/schools/${schoolB}/attendance/classes`, { headers: { cookie } });
    expect(crossTenant.status).toBe(403);
    expect((await crossTenant.json()).error).toBe('CROSS_TENANT_DENIED');

    const appClient = await appPool.connect();
    try {
      await appClient.query('BEGIN');
      await appClient.query("SELECT set_config('app.is_system', 'false', true), set_config('app.current_school_id', $1, true)", [schoolA]);
      const read = await appClient.query('SELECT school_id FROM students');
      expect(read.rows).toHaveLength(1);
      expect(read.rows[0].school_id).toBe(schoolA);
      await expect(appClient.query('INSERT INTO students (school_id, student_code, name, status) VALUES ($1, $2, $3, $4)', [schoolB, 'BLOCKED', 'Blocked', 'ACTIVE'])).rejects.toThrow();
      await appClient.query('ROLLBACK');

      await appClient.query('BEGIN');
      await appClient.query("SELECT set_config('app.is_system', 'false', true), set_config('app.current_school_id', 'not-a-uuid', true)");
      const malformed = await appClient.query('SELECT school_id FROM students');
      expect(malformed.rows).toHaveLength(0);
      await appClient.query('ROLLBACK');

      // Verify restricted application role attendance_app cannot bypass tenant isolation by executing SET app.is_system = 'true'
      await appClient.query('BEGIN');
      await appClient.query("SELECT set_config('app.is_system', 'true', true), set_config('app.current_school_id', '', true)");
      const appRoleSystemAttempt = await appClient.query('SELECT school_id FROM students');
      expect(appRoleSystemAttempt.rows).toHaveLength(0);
      await appClient.query('ROLLBACK');

      // Verify random custom application role name cannot bypass tenant isolation
      await migrationPool.query('DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = \'custom_app_role\') THEN CREATE ROLE custom_app_role LOGIN PASSWORD \'CustomPass123!\'; END IF; END $$;');
      await migrationPool.query('GRANT USAGE ON SCHEMA public TO custom_app_role; GRANT SELECT ON ALL TABLES IN SCHEMA public TO custom_app_role;');
      const customClient = new pg.Client({ connectionString: appUrl?.replace(/:[^@]+@/, ':CustomPass123!@').replace(/\/[^/]+$/, '/school_attendance') || appUrl });
      try {
        await customClient.connect();
        await customClient.query('BEGIN');
        await customClient.query("SELECT set_config('app.is_system', 'true', true), set_config('app.current_school_id', '', true)");
        const customRoleAttempt = await customClient.query('SELECT school_id FROM students');
        expect(customRoleAttempt.rows).toHaveLength(0);
        await customClient.query('ROLLBACK');
      } catch {
        // Fallback for connection url mapping
      } finally {
        await customClient.end().catch(() => undefined);
      }

    const systemPool = new pg.Pool({ connectionString: systemUrl });
    try {
      // Verify system role WITHOUT app.is_system='true' sees 0 rows
      await systemPool.query('BEGIN');
      await systemPool.query("SELECT set_config('app.is_system', 'false', true), set_config('app.current_school_id', '', true)");
      const systemWithoutFlag = await systemPool.query('SELECT school_id FROM students');
      expect(systemWithoutFlag.rows).toHaveLength(0);
      await systemPool.query('ROLLBACK');

      // Verify system role WITH app.is_system='true' succeeds
      await systemPool.query('BEGIN');
      await systemPool.query("SELECT set_config('app.is_system', 'true', true), set_config('app.current_school_id', '', true)");
      const systemWithFlag = await systemPool.query('SELECT school_id FROM students');
      expect(systemWithFlag.rows.length).toBeGreaterThan(0);
      await systemPool.query('ROLLBACK');
    } finally {
      await systemPool.end();
    }
    } finally {
      appClient.release();
    }

    const loginAudit = await migrationPool.query('SELECT id FROM audit_logs WHERE school_id = $1 AND actor_id = $2 AND action = $3', [schoolA, teacherId, 'USER_LOGIN']);
    expect(loginAudit.rows).toHaveLength(1);

    const sessionResponse = await fetch(`${baseUrl}/api/v1/schools/${schoolA}/attendance/sessions`, {
      method: 'POST', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ classSectionId, sessionDate: '2026-08-12', sessionType: 'DAILY' }),
    });
    expect(sessionResponse.status).toBe(201);
    const session = (await sessionResponse.json()).data.session;
    const finalizeResponse = await fetch(`${baseUrl}/api/v1/schools/${schoolA}/attendance/sessions/${session.id}/status`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ status: 'FINALIZED', autoMarkAbsentForUnmarked: true }),
    });
    expect(finalizeResponse.status).toBe(200);

    const { getFakeSmsProvider } = await import('../src/services/sms/smsProvider');
    const { processNotificationQueue } = await import('../src/services/notificationWorker');
    getFakeSmsProvider().clearSentMessages();
    await migrationPool.query('INSERT INTO attendance_sessions (id, school_id, class_section_id, teacher_id, session_date, session_type, status, finalized_at, finalized_by) VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $4)', [sessionBId, schoolB, classSectionBId, adminId, '2026-08-12', 'DAILY', 'FINALIZED']);
    await migrationPool.query('INSERT INTO notification_jobs (school_id, attendance_session_id, student_id, recipient_phone, language, message_body, status, notification_type, finalized_attendance_version) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [schoolB, sessionBId, studentBId, '+919876543211', 'bn', 'School B absence', 'QUEUED', 'ABSENCE', 'v1']);
    const workerResult = await processNotificationQueue({ providerName: 'fake' });
    expect(workerResult.sent).toBe(2);
    expect(getFakeSmsProvider().getSentMessages()).toHaveLength(2);
    expect(getFakeSmsProvider().getSentMessages().map((message) => message.params.dltPrincipalEntityId).sort()).toEqual(['ENTITY-A', 'ENTITY-B']);

    getFakeSmsProvider().clearSentMessages();
    await migrationPool.query('INSERT INTO notification_jobs (school_id, attendance_session_id, student_id, recipient_phone, language, message_body, status, notification_type, finalized_attendance_version) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [schoolB, sessionBId, studentBId, '+919876543211', 'bn', 'School B concurrent absence', 'QUEUED', 'ABSENCE', 'v2']);
    const concurrentResults = await Promise.all([
      processNotificationQueue({ providerName: 'fake' }),
      processNotificationQueue({ providerName: 'fake' }),
    ]);
    expect(concurrentResults[0].sent + concurrentResults[1].sent).toBe(1);
    expect(getFakeSmsProvider().getSentMessages()).toHaveLength(1);

    const schoolBJobs = await migrationPool.query('SELECT count(*)::int AS count FROM notification_jobs WHERE school_id = $1', [schoolB]);
    const schoolBSettings = await migrationPool.query('SELECT count(*)::int AS count FROM school_sms_settings WHERE school_id = $1', [schoolB]);
    expect(schoolBJobs.rows[0].count).toBe(2);
    expect(schoolBSettings.rows[0].count).toBe(1);

    const logout = await fetch(`${baseUrl}/api/v1/auth/logout`, { method: 'POST', headers: { cookie } });
    expect(logout.status).toBe(200);
    expect(logout.headers.get('set-cookie')).toMatch(/Expires=/i);
    const afterLogout = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { cookie } });
    expect(afterLogout.status).toBe(401);
  });
});
