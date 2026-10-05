import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema';
import type { Db } from './index';

export function createTestDb(): { db: Db; client: unknown } {
  const pgliteInstance = new PGlite();
  const db = drizzle(pgliteInstance, { schema }) as unknown as Db;
  return { db, client: pgliteInstance };
}
