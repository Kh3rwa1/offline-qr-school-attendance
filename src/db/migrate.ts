import { getDb, setupRlsPolicies } from './index';
import { seedDatabase } from './seed';

export async function runMigrations() {
  console.log('Running database setup and schema initialization...');
  const db = getDb();

  // Ensure RLS policies and table structures are configured
  await setupRlsPolicies();

  console.log('Database initialization completed.');
}

if (process.argv[1]?.includes('migrate')) {
  runMigrations()
    .then(() => seedDatabase())
    .then(() => {
      console.log('Migration & Seed finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
