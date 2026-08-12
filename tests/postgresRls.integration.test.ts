import pg from 'pg';
import crypto from 'node:crypto';
import { describe, expect, it, afterAll } from 'vitest';

const migrationUrl = process.env.PG_RLS_MIGRATION_DATABASE_URL;
const appUrl = process.env.PG_RLS_APPLICATION_DATABASE_URL;
const enabled = Boolean(migrationUrl && appUrl && process.env.PRODUCTION_PG_TEST === '1');

describe.skipIf(!enabled)('Production PostgreSQL RLS integration', () => {
  const migrationPool = new pg.Pool({ connectionString: migrationUrl });
  const appPool = new pg.Pool({ connectionString: appUrl });
  const schoolA = crypto.randomUUID();
  const schoolB = crypto.randomUUID();

  it('denies unscoped cross-tenant reads and writes for the restricted app role', async () => {
    await migrationPool.query('INSERT INTO schools (id, name, district) VALUES ($1, $2, $3), ($4, $5, $6)', [schoolA, 'RLS A', 'Test', schoolB, 'RLS B', 'Test']);
    await migrationPool.query('INSERT INTO students (school_id, student_code, name, status) VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)', [schoolA, 'RLS-A-1', 'A Student', 'ACTIVE', schoolB, 'RLS-B-1', 'B Student', 'ACTIVE']);

    const client = await appPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT set_config($1, $2, true)', ['app.current_school_id', schoolA]);
      const read = await client.query('SELECT school_id, student_code FROM students');
      expect(read.rows).toHaveLength(1);
      expect(read.rows[0].school_id).toBe(schoolA);

      await expect(client.query('INSERT INTO students (school_id, student_code, name, status) VALUES ($1, $2, $3, $4)', [schoolB, 'RLS-B-2', 'Blocked', 'ACTIVE'])).rejects.toThrow();
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    await migrationPool.query('DELETE FROM schools WHERE id IN ($1, $2)', [schoolA, schoolB]);
  });

  afterAll(async () => {
    await appPool.end();
    await migrationPool.end();
  });
});
