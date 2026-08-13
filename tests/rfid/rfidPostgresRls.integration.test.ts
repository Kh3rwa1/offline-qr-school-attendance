import pg from 'pg';
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const migrationUrl = process.env.PG_RLS_MIGRATION_DATABASE_URL;
const appUrl = process.env.PG_RLS_APPLICATION_DATABASE_URL;
const requested = process.env.PRODUCTION_PG_TEST === '1';
const enabled = Boolean(migrationUrl && appUrl && requested);

describe.skipIf(!enabled)('RFID PostgreSQL RLS Multi-Tenant Isolation Tests (Production PG Roles)', () => {
  let migrationPool: pg.Pool;
  let appPool: pg.Pool;
  const schoolA = crypto.randomUUID();
  const schoolB = crypto.randomUUID();
  const userAId = crypto.randomUUID();
  const readerAId = crypto.randomUUID();
  const readerBId = crypto.randomUUID();
  const credentialAId = crypto.randomUUID();
  const studentAId = crypto.randomUUID();
  const studentBId = crypto.randomUUID();

  beforeAll(async () => {
    migrationPool = new pg.Pool({ connectionString: migrationUrl });
    appPool = new pg.Pool({ connectionString: appUrl });

    // Seed baseline multi-tenant test data using Migration Role (Superuser context)
    const client = await migrationPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO schools (id, name, district, status) VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)',
        [schoolA, 'RFID RLS School A', 'Test', 'ACTIVE', schoolB, 'RFID RLS School B', 'Test', 'ACTIVE']
      );

      await client.query(
        'INSERT INTO users (id, full_name, phone_number, password_hash, status) VALUES ($1, $2, $3, $4, $5)',
        [userAId, 'RLS Admin User A', '+919999999999', 'hash', 'ACTIVE']
      );

      await client.query(
        'INSERT INTO students (id, school_id, student_code, name, status) VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)',
        [studentAId, schoolA, 'RLS-RFID-01', 'RLS Student A', 'ACTIVE', studentBId, schoolB, 'RLS-RFID-02', 'RLS Student B', 'ACTIVE']
      );

      await client.query(
        'INSERT INTO rfid_readers (id, school_id, device_id, name, adapter_type, status) VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)',
        [readerAId, schoolA, 'reader_a_rls', 'Gate A', 'GATEWAY', 'ACTIVE', readerBId, schoolB, 'reader_b_rls', 'Gate B', 'GATEWAY', 'ACTIVE']
      );

      await client.query(
        'INSERT INTO rfid_credentials (id, school_id, student_id, credential_digest, security_mode, key_version, status, created_by_user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [credentialAId, schoolA, studentAId, 'digest_rls_test_card_a', 'SECURE', 1, 'ACTIVE', userAId]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    if (migrationPool) {
      const client = await migrationPool.connect();
      try {
        await client.query('DELETE FROM rfid_credentials WHERE school_id IN ($1, $2)', [schoolA, schoolB]);
        await client.query('DELETE FROM rfid_readers WHERE school_id IN ($1, $2)', [schoolA, schoolB]);
        await client.query('DELETE FROM students WHERE school_id IN ($1, $2)', [schoolA, schoolB]);
        await client.query('DELETE FROM users WHERE id = $1', [userAId]);
        await client.query('DELETE FROM schools WHERE id IN ($1, $2)', [schoolA, schoolB]);
      } catch (err) {
        // Ignore cleanup errors
      } finally {
        client.release();
      }
      await migrationPool.end();
    }
    if (appPool) {
      await appPool.end();
    }
  });

  it('Restricted application role (attendance_app) under School A context CANNOT view School B rfid_readers or rfid_credentials', async () => {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.is_system', 'false', true), set_config('app.current_school_id', $1, true)", [schoolA]);

      // Query readers (should see 1 row for School A, 0 rows for School B)
      const readersA = await client.query('SELECT id, school_id FROM rfid_readers WHERE school_id = $1', [schoolA]);
      expect(readersA.rows).toHaveLength(1);
      expect(readersA.rows[0].id).toBe(readerAId);

      const readersB = await client.query('SELECT id, school_id FROM rfid_readers WHERE school_id = $2', [schoolA, schoolB]);
      expect(readersB.rows).toHaveLength(0);

      // Query credentials
      const creds = await client.query('SELECT id, school_id FROM rfid_credentials');
      expect(creds.rows).toHaveLength(1);
      expect(creds.rows[0].school_id).toBe(schoolA);

      await client.query('ROLLBACK');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  it('Restricted application role (attendance_app) CANNOT update School B rfid_readers', async () => {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.is_system', 'false', true), set_config('app.current_school_id', $1, true)", [schoolA]);

      const updateRes = await client.query("UPDATE rfid_readers SET name = 'Hacked Gate' WHERE id = $1", [readerBId]);
      expect(updateRes.rowCount).toBe(0);

      await client.query('ROLLBACK');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  it('Restricted application role (attendance_app) CANNOT insert rfid_readers belonging to School B', async () => {
    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.is_system', 'false', true), set_config('app.current_school_id', $1, true)", [schoolA]);

      await expect(
        client.query(
          "INSERT INTO rfid_readers (id, school_id, device_id, name, adapter_type, status) VALUES ($1, $2, $3, $4, 'GATEWAY', 'PENDING')",
          [crypto.randomUUID(), schoolB, 'illegal_device_b', 'Illegal Reader']
        )
      ).rejects.toThrow();

      await client.query('ROLLBACK');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });
});
