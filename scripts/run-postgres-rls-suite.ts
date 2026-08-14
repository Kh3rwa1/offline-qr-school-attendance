process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.RUN_SERVER = 'false';
process.env.TEST_SERVER_STATIC = 'true';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'integration-test-session-secret-01234567890123456789';
process.env.METRICS_AUTH_TOKEN = process.env.METRICS_AUTH_TOKEN || 'integration-test-metrics-token-01234567890123456789';
process.env.REDIS_KEY_HMAC_SECRET = process.env.REDIS_KEY_HMAC_SECRET || 'integration-test-redis-hmac-secret-0123456789';
process.env.RFID_HMAC_SECRET = process.env.RFID_HMAC_SECRET || 'integration-test-rfid-hmac-secret-0123456789';
process.env.KMS_MASTER_KEY = process.env.KMS_MASTER_KEY || 'integration-test-kms-master-key-0123456789';
process.env.ALLOW_FAKE_SMS_IN_PRODUCTION = 'true';

import pg from 'pg';
import crypto from 'node:crypto';
import argon2 from 'argon2';
import fs from 'node:fs';

const migrationUrl = process.env.PG_RLS_MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
const appUrl = process.env.PG_RLS_APPLICATION_DATABASE_URL || process.env.DATABASE_URL;
const authUrl = process.env.PG_RLS_AUTH_DATABASE_URL || process.env.AUTH_DATABASE_URL || migrationUrl;
const systemUrl = process.env.PG_RLS_SYSTEM_DATABASE_URL || appUrl;

if (!migrationUrl || !appUrl) {
  console.error('FATAL: PG_RLS_MIGRATION_DATABASE_URL and PG_RLS_APPLICATION_DATABASE_URL are required.');
  process.exit(1);
}

process.env.DATABASE_URL = appUrl;
process.env.SYSTEM_DATABASE_URL = systemUrl;
process.env.AUTH_DATABASE_URL = authUrl;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`ASSERTION_FAILED: ${message}`);
  }
}

async function runCompletenessAudit(migrationPool: pg.Pool, appPool: pg.Pool) {
  console.log('\n--- 1. Phase 7: Programmatic PostgreSQL RLS & Schema Completeness Audit ---');
  
  // 1.1 Row security & Force row security
  console.log('[Audit 1.1] Checking rowsecurity and forcerowsecurity on all public tables...');
  const tablesRes = await migrationPool.query(`
    SELECT
      t.tablename,
      c.relrowsecurity AS rowsecurity,
      c.relforcerowsecurity AS forcerowsecurity
    FROM pg_catalog.pg_tables AS t
    JOIN pg_catalog.pg_namespace AS n ON n.nspname = t.schemaname
    JOIN pg_catalog.pg_class AS c ON c.relnamespace = n.oid AND c.relname = t.tablename
    WHERE t.schemaname = 'public' AND c.relkind = 'r';
  `);
  assert(tablesRes.rows.length > 0, 'Must find public tables in database');
  console.log(`Found ${tablesRes.rows.length} public tables:`);
  for (const row of tablesRes.rows) {
    const isDrizzle = row.tablename.includes('drizzle');
    console.log(`  - ${row.tablename}: rls=${row.rowsecurity}, force=${row.forcerowsecurity} ${isDrizzle ? '(drizzle-skipped)' : ''}`);
    if (isDrizzle) continue;
    assert(row.rowsecurity === true, `Table ${row.tablename} must have RLS enabled (relrowsecurity=true)`);
    assert(row.forcerowsecurity === true, `Table ${row.tablename} must have FORCE RLS enabled (relforcerowsecurity=true)`);
  }
  console.log(`  ✅ All ${tablesRes.rows.length} public tables validated.`);

  // 1.2 Non-superuser & No bypass RLS on roles
  console.log('[Audit 1.2] Checking database roles are NOSUPERUSER and NOBYPASSRLS...');
  const rolesRes = await migrationPool.query(`
    SELECT rolname, rolsuper, rolbypassrls
    FROM pg_roles
    WHERE rolname IN ('attendance_app', 'attendance_auth', 'attendance_worker')
  `);
  console.log('Roles found:', JSON.stringify(rolesRes.rows));
  assert(rolesRes.rows.length >= 1, 'Restricted application roles must exist in database');
  for (const row of rolesRes.rows) {
    assert(row.rolsuper === false, `Role ${row.rolname} must be NOSUPERUSER`);
    assert(row.rolbypassrls === false, `Role ${row.rolname} must be NOBYPASSRLS`);
  }
  console.log(`  ✅ Verified ${rolesRes.rows.length} application roles are NOSUPERUSER and NOBYPASSRLS`);

  // 1.3 Privilege elevation denial
  console.log('[Audit 1.3] Verifying attendance_app cannot elevate privileges with app.is_system=true...');
  const client = await appPool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.is_system', 'true', true), set_config('app.current_school_id', '', true)");
    const res = await client.query('SELECT COUNT(*) FROM students');
    console.log('Audit 1.3 students count with app.is_system=true:', res.rows[0]);
    assert(Number(res.rows[0].count) === 0, 'attendance_app role setting app.is_system=true must see 0 rows');
    await client.query('ROLLBACK');

    console.log('[Audit 1.4] Verifying empty tenant context fails closed (0 rows)...');
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.is_system', 'false', true), set_config('app.current_school_id', '', true)");
    const resEmpty = await client.query('SELECT COUNT(*) FROM students');
    console.log('Audit 1.4 students count with empty school_id:', resEmpty.rows[0]);
    assert(Number(resEmpty.rows[0].count) === 0, 'attendance_app role with empty school_id must see 0 rows');
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
  console.log('  ✅ Privilege elevation denial & fail-closed tenant context passed.');
}

async function runRfidIsolationSuite(migrationPool: pg.Pool, appPool: pg.Pool) {
  console.log('\n--- 2. RFID PostgreSQL RLS Multi-Tenant Isolation Suite ---');
  const schoolA = crypto.randomUUID();
  const schoolB = crypto.randomUUID();
  const userAId = crypto.randomUUID();
  const readerAId = crypto.randomUUID();
  const readerBId = crypto.randomUUID();
  const credentialAId = crypto.randomUUID();
  const studentAId = crypto.randomUUID();
  const studentBId = crypto.randomUUID();
  const userPhone = `+9199${String(Date.now()).slice(-8)}`;

  console.log('[RFID 2.1] Seeding multi-tenant test data using migration pool...');
  const migClient = await migrationPool.connect();
  try {
    await migClient.query('BEGIN');
    await migClient.query(
      'INSERT INTO schools (id, name, district, status) VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)',
      [schoolA, 'RFID RLS School A', 'Test', 'ACTIVE', schoolB, 'RFID RLS School B', 'Test', 'ACTIVE']
    );
    await migClient.query(
      'INSERT INTO users (id, full_name, phone_number, password_hash, status) VALUES ($1, $2, $3, $4, $5)',
      [userAId, 'RLS Admin User A', userPhone, 'hash', 'ACTIVE']
    );
    await migClient.query(
      'INSERT INTO students (id, school_id, student_code, name, status) VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)',
      [studentAId, schoolA, 'RLS-RFID-01', 'RLS Student A', 'ACTIVE', studentBId, schoolB, 'RLS-RFID-02', 'RLS Student B', 'ACTIVE']
    );
    await migClient.query(
      'INSERT INTO rfid_readers (id, school_id, device_id, name, adapter_type, status) VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)',
      [readerAId, schoolA, 'reader_a_rls', 'Gate A', 'GATEWAY', 'ACTIVE', readerBId, schoolB, 'reader_b_rls', 'Gate B', 'GATEWAY', 'ACTIVE']
    );
    await migClient.query(
      'INSERT INTO rfid_credentials (id, school_id, student_id, credential_digest, security_mode, key_version, status, created_by_user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [credentialAId, schoolA, studentAId, 'digest_rls_test_card_a', 'SECURE', 1, 'ACTIVE', userAId]
    );
    await migClient.query('COMMIT');
  } finally {
    migClient.release();
  }
  console.log('  ✅ RFID test data seeded.');

  console.log('[RFID 2.2] Verifying tenant isolation on RFID readers and credentials...');
  const appClient = await appPool.connect();
  try {
    await appClient.query('BEGIN');
    await appClient.query("SELECT set_config('app.is_system', 'false', true), set_config('app.current_school_id', $1, true)", [schoolA]);

    const readersA = await appClient.query('SELECT id, school_id FROM rfid_readers WHERE school_id = $1', [schoolA]);
    assert(readersA.rows.length === 1 && readersA.rows[0].id === readerAId, 'Must see school A reader');

    const readersB = await appClient.query('SELECT id, school_id FROM rfid_readers WHERE school_id = $1', [schoolB]);
    assert(readersB.rows.length === 0, 'Must not see school B reader');

    const creds = await appClient.query('SELECT id, school_id FROM rfid_credentials');
    assert(creds.rows.length === 1 && creds.rows[0].school_id === schoolA, 'Must see only school A credentials');

    console.log('[RFID 2.3] Verifying cross-tenant update denial...');
    const updateRes = await appClient.query("UPDATE rfid_readers SET name = 'Hacked Gate' WHERE id = $1", [readerBId]);
    assert(updateRes.rowCount === 0, 'Cannot update school B readers under school A tenant context');

    console.log('[RFID 2.4] Verifying cross-tenant insert denial...');
    let insertFailed = false;
    try {
      await appClient.query(
        "INSERT INTO rfid_readers (id, school_id, device_id, name, adapter_type, status) VALUES ($1, $2, $3, $4, 'GATEWAY', 'PENDING')",
        [crypto.randomUUID(), schoolB, 'illegal_device_b', 'Illegal Reader']
      );
    } catch {
      insertFailed = true;
    }
    assert(insertFailed, 'Cannot insert school B readers under school A tenant context');
    await appClient.query('ROLLBACK');
  } finally {
    appClient.release();
  }

  // Cleanup
  console.log('[RFID 2.5] Cleaning up RFID test data...');
  const cleanClient = await migrationPool.connect();
  try {
    await cleanClient.query('DELETE FROM rfid_credentials WHERE school_id IN ($1, $2)', [schoolA, schoolB]);
    await cleanClient.query('DELETE FROM rfid_readers WHERE school_id IN ($1, $2)', [schoolA, schoolB]);
    await cleanClient.query('DELETE FROM students WHERE school_id IN ($1, $2)', [schoolA, schoolB]);
    await cleanClient.query('DELETE FROM users WHERE id = $1', [userAId]);
    await cleanClient.query('DELETE FROM schools WHERE id IN ($1, $2)', [schoolA, schoolB]);
  } finally {
    cleanClient.release();
  }
  console.log('  ✅ RFID multi-tenant isolation tests passed.');
}

async function runPostgresRlsIntegrationSuite(migrationPool: pg.Pool, appPool: pg.Pool) {
  console.log('\n--- 3. Multi-Tenant PostgreSQL RLS, Auth & Worker Integration Suite ---');
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

  console.log('[Integration 3.1] Seeding multi-tenant test database...');
  const teacherHash = await argon2.hash(teacherPassword, { type: argon2.argon2id });
  const adminHash = await argon2.hash('AdminPassword123!', { type: argon2.argon2id });

  await migrationPool.query('BEGIN');
  await migrationPool.query('INSERT INTO schools (id, name, district, status) VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)', [schoolA, 'RLS School A', 'Test', 'ACTIVE', schoolB, 'RLS School B', 'Test', 'ACTIVE']);
  await migrationPool.query('INSERT INTO users (id, full_name, phone_number, password_hash, status) VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)', [teacherId, 'RLS Teacher', teacherPhone, teacherHash, 'ACTIVE', adminId, 'RLS Admin', `+9197${String(Date.now()).slice(-8)}`, adminHash, 'ACTIVE']);
  await migrationPool.query('INSERT INTO school_memberships (school_id, user_id, role, status) VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)', [schoolA, teacherId, 'TEACHER', 'ACTIVE', schoolB, adminId, 'SCHOOL_ADMIN', 'ACTIVE']);
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

  console.log('[Integration 3.2] Booting application HTTP server in test harness...');
  process.env.NODE_ENV = 'production';
  process.env.RUN_SERVER = 'false';
  process.env.TEST_SERVER_STATIC = 'true';
  process.env.DATABASE_URL = appUrl!;
  process.env.SYSTEM_DATABASE_URL = systemUrl!;
  process.env.AUTH_DATABASE_URL = authUrl || migrationUrl!;
  process.env.SESSION_SECRET = 'integration-test-session-secret-01234567890123456789';
  process.env.METRICS_AUTH_TOKEN = 'integration-test-metrics-token-01234567890123456789';
  process.env.REDIS_KEY_HMAC_SECRET = 'integration-test-redis-hmac-secret-0123456789';
  process.env.RFID_HMAC_SECRET = 'integration-test-rfid-hmac-secret-0123456789';
  process.env.KMS_MASTER_KEY = 'integration-test-kms-master-key-0123456789';
  process.env.ALLOW_FAKE_SMS_IN_PRODUCTION = 'true';

  const { createApp } = await import('../server');
  const app = await createApp();
  let server: any;
  let baseUrl = '';

  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${(address as any).port}`;
      resolve();
    });
    server.on('error', reject);
  });
  console.log(`  ✅ HTTP server listening on ${baseUrl}`);

  try {
    console.log('[Integration 3.3] Testing teacher login via POST /api/v1/auth/login...');
    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneNumber: teacherPhone, password: teacherPassword, schoolId: schoolA }),
    });
    const loginBody = await login.json();
    assert(login.status === 200, `Login failed with status ${login.status}: ${JSON.stringify(loginBody)}`);
    const setCookieHeader = login.headers.get('set-cookie') || '';
    assert(/HttpOnly/i.test(setCookieHeader), 'Session cookie must have HttpOnly');
    assert(/SameSite=Lax/i.test(setCookieHeader), 'Session cookie must have SameSite=Lax');
    const rawSetCookies = (login.headers as any).getSetCookie
      ? (login.headers as any).getSetCookie()
      : setCookieHeader.split(/,\s*(?=[A-Za-z0-9_-]+=)/);
    const cookie = rawSetCookies
      .map((c: string) => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');
    const csrfToken = loginBody.csrfToken;

    console.log('[Integration 3.4] Testing GET /api/v1/auth/me session context...');
    const me = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { cookie } });
    const meData = await me.json();
    assert(me.status === 200, `/me returned status ${me.status}: ${JSON.stringify(meData)}`);
    assert(meData.sessionContext.schoolId === schoolA, 'Session context must be school A');

    console.log('[Integration 3.5] Testing cross-tenant route protection...');
    const crossTenant = await fetch(`${baseUrl}/api/v1/schools/${schoolB}/attendance/classes`, { headers: { cookie } });
    const crossTenantData = await crossTenant.json();
    assert(crossTenant.status === 403, `Cross-tenant access must return 403 (got ${crossTenant.status}): ${JSON.stringify(crossTenantData)}`);

    console.log('[Integration 3.6] Testing attendance session creation...');
    const sessionResponse = await fetch(`${baseUrl}/api/v1/schools/${schoolA}/attendance/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': csrfToken },
      body: JSON.stringify({ classSectionId, sessionDate: '2026-08-12', sessionType: 'DAILY' }),
    });
    const sessionData = await sessionResponse.json();
    const session = sessionData.session || sessionData.data?.session || sessionData.data;
    assert(Boolean(session && session.id), `Session must have valid ID: ${JSON.stringify(sessionData)}`);

    console.log('[Integration 3.7] Finalizing attendance session (auto-marking absent)...');
    const finalizeResponse = await fetch(`${baseUrl}/api/v1/schools/${schoolA}/attendance/sessions/${session.id}/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': csrfToken },
      body: JSON.stringify({ status: 'FINALIZED', autoMarkAbsentForUnmarked: true }),
    });
    const finalizeData = await finalizeResponse.json();
    assert(finalizeResponse.status === 200, `Finalize session failed with ${finalizeResponse.status}: ${JSON.stringify(finalizeData)}`);

    console.log('[Integration 3.8] Processing SMS notification queue via background worker...');
    const { getFakeSmsProvider } = await import('../src/services/sms/smsProvider');
    const { processNotificationQueue } = await import('../src/services/notificationWorker');
    getFakeSmsProvider().clearSentMessages();
    await migrationPool.query(
      'INSERT INTO attendance_sessions (id, school_id, class_section_id, teacher_id, session_date, session_type, status, finalized_at, finalized_by) VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $4)',
      [sessionBId, schoolB, classSectionBId, adminId, '2026-08-12', 'DAILY', 'FINALIZED']
    );
    await migrationPool.query(
      'INSERT INTO notification_jobs (school_id, attendance_session_id, student_id, recipient_phone, language, message_body, status, notification_type, finalized_attendance_version) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [schoolB, sessionBId, studentBId, '+919876543211', 'bn', 'School B absence', 'QUEUED', 'ABSENCE', 'v1']
    );

    const workerResult = await processNotificationQueue({ providerName: 'fake' });
    assert(workerResult.sent === 2, `Expected 2 sent SMS messages (got ${workerResult.sent})`);
    const sentMessages = getFakeSmsProvider().getSentMessages();
    assert(sentMessages.length === 2, `Expected 2 messages in provider (got ${sentMessages.length})`);
    const dltIds = sentMessages.map((m) => m.params.dltPrincipalEntityId).sort();
    assert(dltIds[0] === 'ENTITY-A' && dltIds[1] === 'ENTITY-B', 'DLT principal entities must match ENTITY-A and ENTITY-B');

    console.log('[Integration 3.9] Testing concurrent atomic queue worker claiming...');
    getFakeSmsProvider().clearSentMessages();
    await migrationPool.query(
      'INSERT INTO notification_jobs (school_id, attendance_session_id, student_id, recipient_phone, language, message_body, status, notification_type, finalized_attendance_version) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [schoolB, sessionBId, studentBId, '+919876543211', 'bn', 'School B concurrent absence', 'QUEUED', 'ABSENCE', 'v2']
    );
    const concurrentResults = await Promise.all([
      processNotificationQueue({ providerName: 'fake' }),
      processNotificationQueue({ providerName: 'fake' }),
    ]);
    assert(concurrentResults[0].sent + concurrentResults[1].sent === 1, 'Exactly one concurrent worker must claim and send the job');

    console.log('[Integration 3.10] Testing user logout...');
    const logout = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { cookie, 'x-csrf-token': csrfToken },
    });
    assert(logout.status === 200, `Logout failed with status ${logout.status}`);
    const afterLogout = await fetch(`${baseUrl}/api/v1/auth/me`, { headers: { cookie } });
    assert(afterLogout.status === 401, `Accessing /me after logout must return 401 (got ${afterLogout.status})`);
  } finally {
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await migrationPool.query('DELETE FROM schools WHERE id IN ($1, $2)', [schoolA, schoolB]).catch(() => {});
    const { closeDatabasePools } = await import('../src/db');
    await closeDatabasePools();
    const { closeRedisConnection } = await import('../src/services/redisService');
    await closeRedisConnection();
  }
  console.log('  ✅ Multi-tenant integration suite passed.');
}

async function main() {
  console.log('=== Starting Complete PostgreSQL RLS & Redis Production Integration Suite ===');
  const migrationPool = new pg.Pool({ connectionString: migrationUrl });
  const appPool = new pg.Pool({ connectionString: appUrl });

  try {
    await runCompletenessAudit(migrationPool, appPool);
    await runRfidIsolationSuite(migrationPool, appPool);
    await runPostgresRlsIntegrationSuite(migrationPool, appPool);
    console.log('\n🎉 ALL POSTGRESQL RLS & REDIS PRODUCTION INTEGRATION CHECKS PASSED SUCCESSFULLY!\n');
    if (process.env.GITHUB_STEP_SUMMARY) {
      try {
        fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '\n### ✅ PostgreSQL RLS & Redis Integration Suite: ALL CHECKS PASSED\n');
      } catch {}
    }
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ POSTGRESQL RLS INTEGRATION SUITE FAILED:', err);
    if (process.env.GITHUB_STEP_SUMMARY) {
      try {
        fs.appendFileSync(
          process.env.GITHUB_STEP_SUMMARY,
          `\n### ❌ PostgreSQL RLS Integration Suite Failed\n\`\`\`\n${err?.stack || err?.message || err}\n\`\`\`\n`
        );
      } catch {}
    }
    process.exit(1);
  } finally {
    await appPool.end().catch(() => {});
    await migrationPool.end().catch(() => {});
  }
}

void main();
