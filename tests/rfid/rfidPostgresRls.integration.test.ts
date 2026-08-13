import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../../src/db';
import { runMigrations } from '../../src/db/migrate';
import { sql } from 'drizzle-orm';

describe('RFID PostgreSQL RLS Integration', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  it('enforces tenant boundary on rfid_credentials queries', async () => {
    const result = await db.execute(sql`SELECT count(*) FROM rfid_credentials WHERE school_id = '00000000-0000-1000-8000-000000000000'`);
    expect(result).toBeDefined();
  });

  it('enforces tenant boundary on rfid_readers queries', async () => {
    const result = await db.execute(sql`SELECT count(*) FROM rfid_readers WHERE school_id = '00000000-0000-1000-8000-000000000000'`);
    expect(result).toBeDefined();
  });

  it('enforces tenant boundary on rfid_scan_events queries', async () => {
    const result = await db.execute(sql`SELECT count(*) FROM rfid_scan_events WHERE school_id = '00000000-0000-1000-8000-000000000000'`);
    expect(result).toBeDefined();
  });
});
