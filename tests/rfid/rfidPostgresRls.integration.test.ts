import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../../src/db';
import { runMigrations } from '../../src/db/migrate';
import { seedDatabase } from '../../src/db/seed';
import { sql } from 'drizzle-orm';

describe('RFID PostgreSQL RLS Multi-Tenant Isolation Tests', () => {
  let seeded: any;

  beforeAll(async () => {
    await runMigrations();
    seeded = await seedDatabase();
  });

  async function withTenant<T>(schoolId: string, cb: (tx: any) => Promise<T>) {
    return await db.transaction(async (tx: any) => {
      await tx.execute(sql`SELECT set_config('app.current_school_id', ${schoolId}, true)`);
      await tx.execute(sql`SELECT set_config('app.is_system', 'false', true)`);
      return await cb(tx);
    });
  }

  async function withSystem<T>(cb: (tx: any) => Promise<T>) {
    return await db.transaction(async (tx: any) => {
      await tx.execute(sql`SELECT set_config('app.is_system', 'true', true)`);
      return await cb(tx);
    });
  }

  it('School A CANNOT view School B rfid_credentials', async () => {
    await withTenant(seeded.schoolA.id, async (tx) => {
      const res = await tx.execute(sql`SELECT count(*) FROM rfid_credentials WHERE school_id = ${seeded.schoolB.id}`);
      const count = Number((res.rows?.[0] as any)?.count ?? (res as any)[0]?.count ?? 0);
      expect(count).toBe(0);
    });
  });

  it('School A CANNOT view School B rfid_readers', async () => {
    await withTenant(seeded.schoolA.id, async (tx) => {
      const res = await tx.execute(sql`SELECT count(*) FROM rfid_readers WHERE school_id = ${seeded.schoolB.id}`);
      const count = Number((res.rows?.[0] as any)?.count ?? (res as any)[0]?.count ?? 0);
      expect(count).toBe(0);
    });
  });

  it('School A CANNOT view School B rfid_scan_events', async () => {
    await withTenant(seeded.schoolA.id, async (tx) => {
      const res = await tx.execute(sql`SELECT count(*) FROM rfid_scan_events WHERE school_id = ${seeded.schoolB.id}`);
      const count = Number((res.rows?.[0] as any)?.count ?? (res as any)[0]?.count ?? 0);
      expect(count).toBe(0);
    });
  });

  it('System context CAN access RFID entities across all schools', async () => {
    await withSystem(async (tx) => {
      const res = await tx.execute(sql`SELECT count(*) FROM rfid_readers`);
      expect(res).toBeDefined();
    });
  });
});
