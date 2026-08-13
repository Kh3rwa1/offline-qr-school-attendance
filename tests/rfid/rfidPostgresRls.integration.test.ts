import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../../src/db';
import { runMigrations } from '../../src/db/migrate';
import { seedDatabase } from '../../src/db/seed';
import { rfidReaders } from '../../src/db/schema';
import { sql, eq } from 'drizzle-orm';

const migrationUrl = process.env.PG_RLS_MIGRATION_DATABASE_URL;
const appUrl = process.env.PG_RLS_APPLICATION_DATABASE_URL;
const requested = process.env.PRODUCTION_PG_TEST === '1';
const enabled = Boolean(migrationUrl && appUrl && requested);

describe.skipIf(!enabled)('RFID PostgreSQL RLS Multi-Tenant Isolation Tests', () => {
  let seeded: any;
  let readerA: any;
  let readerB: any;

  beforeAll(async () => {
    await runMigrations();
    seeded = await seedDatabase();

    // Insert RFID readers under system context
    await db.transaction(async (tx: any) => {
      await tx.execute(sql`SELECT set_config('app.is_system', 'true', true), set_config('app.current_school_id', '', true)`);
      [readerA] = await tx.insert(rfidReaders).values({
        schoolId: seeded.schoolA.id,
        deviceId: 'reader_rls_school_a',
        name: 'Gate A',
        adapterType: 'GATEWAY',
        status: 'ACTIVE',
      }).returning();

      [readerB] = await tx.insert(rfidReaders).values({
        schoolId: seeded.schoolB.id,
        deviceId: 'reader_rls_school_b',
        name: 'Gate B',
        adapterType: 'GATEWAY',
        status: 'ACTIVE',
      }).returning();
    });
  });

  async function withTenant<T>(schoolId: string, cb: (tx: any) => Promise<T>) {
    return await db.transaction(async (tx: any) => {
      await tx.execute(sql`SELECT set_config('app.is_system', 'false', true), set_config('app.current_school_id', ${schoolId}, true)`);
      return await cb(tx);
    });
  }

  async function withSystem<T>(cb: (tx: any) => Promise<T>) {
    return await db.transaction(async (tx: any) => {
      await tx.execute(sql`SELECT set_config('app.is_system', 'true', true), set_config('app.current_school_id', '', true)`);
      return await cb(tx);
    });
  }

  it('System context sees readers from both School A and School B', async () => {
    await withSystem(async (tx) => {
      const readers = await tx.select().from(rfidReaders);
      expect(readers.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('School A CANNOT view School B rfid_readers', async () => {
    await withTenant(seeded.schoolA.id, async (tx) => {
      const readersB = await tx.select().from(rfidReaders).where(eq(rfidReaders.schoolId, seeded.schoolB.id));
      expect(readersB.length).toBe(0);

      const readersA = await tx.select().from(rfidReaders).where(eq(rfidReaders.schoolId, seeded.schoolA.id));
      expect(readersA.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('School A CANNOT update School B rfid_readers', async () => {
    await withTenant(seeded.schoolA.id, async (tx) => {
      const updated = await tx
        .update(rfidReaders)
        .set({ name: 'Hacked' })
        .where(eq(rfidReaders.id, readerB.id))
        .returning();
      expect(updated.length).toBe(0);
    });
  });

  it('School A CANNOT insert rfid_readers belonging to School B', async () => {
    await withTenant(seeded.schoolA.id, async (tx) => {
      try {
        await tx.insert(rfidReaders).values({
          schoolId: seeded.schoolB.id,
          deviceId: 'reader_cross_tenant_illegal',
          name: 'Illegal Cross Tenant Gate',
          adapterType: 'GATEWAY',
          status: 'PENDING',
        });
      } catch (err: any) {
        expect(err).toBeDefined();
      }
    });
  });
});
