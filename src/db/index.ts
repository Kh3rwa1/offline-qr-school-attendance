import { drizzle } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import { AsyncLocalStorage } from 'node:async_hooks';
import * as schema from './schema';
import { env } from '../env';

let client: PGlite | pg.Pool;
let dbInstance: any;
const tenantTransaction = new AsyncLocalStorage<any>();

export function getDb() {
  if (dbInstance) return dbInstance;

  if (env.DATABASE_URL && env.NODE_ENV !== 'test') {
    const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
    client = pool;
    dbInstance = drizzlePg(pool, { schema });
  } else {
    const pglite = new PGlite();
    client = pglite;
    dbInstance = drizzle(pglite, { schema });
  }
  return dbInstance;
}

const rawDb = getDb();

// Services can continue using the shared `db` import while request middleware
// transparently routes their queries to the request's tenant transaction.
export const db = new Proxy(rawDb, {
  get(target, property, receiver) {
    const active = tenantTransaction.getStore();
    if (property === 'transaction' && active) {
      return async (callback: (tx: any) => Promise<unknown>) => callback(active);
    }
    const source = active && property in active ? active : target;
    const value = Reflect.get(source, property, receiver);
    return typeof value === 'function' ? value.bind(source) : value;
  },
});

export async function executeSql(sqlQuery: string) {
  if (client && 'query' in client) return (client as any).query(sqlQuery);
  if (client && 'exec' in client) return (client as any).exec(sqlQuery);
  throw new Error('DATABASE_CLIENT_UNAVAILABLE');
}

export async function setTenantContext(schoolId: string) {
  if (!isUuid(schoolId)) throw new Error('INVALID_SCHOOL_ID');
  // Kept for explicit scripts/tests; request handling uses withTenantContext.
  await rawDb.execute(sql`SELECT set_config('app.current_school_id', ${schoolId}, false)`);
}

export async function resetTenantContext() {
  await executeSql('RESET app.current_school_id;');
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Execute all tenant-sensitive work on one transaction/connection. */
export async function withTenantContext<T>(schoolId: string, fn: (tx: any) => Promise<T>): Promise<T> {
  if (!isUuid(schoolId)) throw new Error('INVALID_SCHOOL_ID');
  return rawDb.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT set_config('app.current_school_id', ${schoolId}, true)`);
    return tenantTransaction.run(tx, () => fn(tx));
  });
}

/** Execute system, authentication or background worker tasks with SYSTEM context. */
export async function withSystemContext<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  return rawDb.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT set_config('app.current_school_id', 'SYSTEM', true)`);
    return tenantTransaction.run(tx, () => fn(tx));
  });
}
