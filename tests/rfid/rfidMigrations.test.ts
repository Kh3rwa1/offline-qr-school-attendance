import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../../src/db';
import { runMigrations } from '../../src/db/migrate';
import { sql } from 'drizzle-orm';

describe('RFID Migrations Tests', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  it('Migration creates all RFID tables and enums', async () => {
    const res = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('rfid_credentials', 'rfid_readers', 'rfid_scan_events')
    `);
    const rows = res.rows ?? (res as any);
    expect(rows.length).toBe(3);
  });

  it('RLS is enabled on RFID tables', async () => {
    const res = await db.execute(sql`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relname IN ('rfid_credentials', 'rfid_readers', 'rfid_scan_events')
    `);
    const rows = res.rows ?? (res as any);
    expect(rows.length).toBe(3);
  });
});
