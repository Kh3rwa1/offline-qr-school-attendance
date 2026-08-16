import path from 'node:path';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { migrate as migratePostgres } from 'drizzle-orm/node-postgres/migrator';
import { getDb } from './index';
import { env } from '../env';

export async function runMigrations() {
  console.log('Running versioned Drizzle migrations...');
  const db = getDb();

  const migrationsFolder = path.join(process.cwd(), 'drizzle');
  const isPlaceholderDbUrl = env.DATABASE_URL?.includes('replace-with-') || env.DATABASE_URL?.includes('replace_with_');
  if (env.DATABASE_URL && !isPlaceholderDbUrl) {
    await migratePostgres(db, { migrationsFolder });
  } else {
    await migratePglite(db, { migrationsFolder });
  }
  console.log('Database migrations completed.');
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
