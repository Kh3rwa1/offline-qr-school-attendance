import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema';
import type { Db, QueryableClient } from './index';

export function createTestDb(): { db: Db; client: QueryableClient } {
  const pgliteInstance = new PGlite();
  const db = drizzle(pgliteInstance, { schema }) as unknown as Db;
  return { db, client: pgliteInstance as unknown as QueryableClient };
}
