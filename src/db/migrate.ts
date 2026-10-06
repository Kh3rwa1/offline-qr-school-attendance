import path from 'node:path';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { migrate as migratePostgres } from 'drizzle-orm/node-postgres/migrator';
import { getDb } from './index';
import { env } from '../env';

export async function runMigrations() {
  console.log('Running versioned Drizzle migrations...');
  const migrationsFolder = path.join(process.cwd(), 'drizzle');
  const isPlaceholderDbUrl = env.DATABASE_URL?.includes('replace-with-') || env.DATABASE_URL?.includes('replace_with_');

  let attempts = 0;
  const maxAttempts = 10;
  while (attempts < maxAttempts) {
    try {
      attempts++;
      const db = getDb();
      if (env.DATABASE_URL && !isPlaceholderDbUrl) {
        await migratePostgres(db, { migrationsFolder });
      } else {
        await migratePglite(db as unknown as Parameters<typeof migratePglite>[0], { migrationsFolder });
      }
      console.log('Database migrations completed.');
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempts >= maxAttempts || env.NODE_ENV === 'test') {
        throw err;
      }
      console.warn(`Migration attempt ${attempts}/${maxAttempts} failed (${msg}). Retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

if (process.argv[1]?.includes('migrate')) {
  runMigrations()
    .then(() => {
      console.log('Migration finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
