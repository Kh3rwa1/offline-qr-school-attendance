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
let systemDbInstance: any;
let systemClient: pg.Pool | undefined;
type ContextMode = 'TENANT' | 'SYSTEM';
type ContextStore = { tx: any; mode: ContextMode; schoolId?: string };
const tenantTransaction = new AsyncLocalStorage<ContextStore>();

export function getDb() {
  if (dbInstance) return dbInstance;

  if (env.DATABASE_URL) {
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

function getSystemDb() {
  if (systemDbInstance) return systemDbInstance;
  if (!env.SYSTEM_DATABASE_URL || env.SYSTEM_DATABASE_URL === env.DATABASE_URL) {
    systemDbInstance = rawDb;
    return systemDbInstance;
  }
  systemClient = new pg.Pool({ connectionString: env.SYSTEM_DATABASE_URL });
  systemDbInstance = drizzlePg(systemClient, { schema });
  return systemDbInstance;
}

// Services can continue using the shared `db` import while request middleware
// transparently routes their queries to the request's tenant transaction.
export const db = new Proxy(rawDb, {
  get(target, property, receiver) {
    const active = tenantTransaction.getStore();
    if (property === 'transaction' && active) {
      return async (callback: (tx: any) => Promise<unknown>) => callback(active.tx);
    }
    const source = active && property in active.tx ? active.tx : target;
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
  await rawDb.execute(sql`SELECT set_config('app.is_system', 'false', false), set_config('app.current_school_id', ${schoolId}, false)`);
}

export async function resetTenantContext() {
  await rawDb.execute(sql`SELECT set_config('app.is_system', 'false', false), set_config('app.current_school_id', '', false)`);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Execute all tenant-sensitive work on one transaction/connection. */
export async function withTenantContext<T>(schoolId: string, fn: (tx: any) => Promise<T>): Promise<T> {
  if (!isUuid(schoolId)) throw new Error('INVALID_SCHOOL_ID');
  const active = tenantTransaction.getStore();
  if (active) {
    if (active.mode === 'SYSTEM') throw new Error('TENANT_CONTEXT_INSIDE_SYSTEM_CONTEXT_FORBIDDEN');
    if (active.schoolId !== schoolId) throw new Error('TENANT_CONTEXT_SWITCH_FORBIDDEN');
    return fn(active.tx);
  }
  return rawDb.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT set_config('app.is_system', 'false', true), set_config('app.current_school_id', ${schoolId}, true)`);
    return tenantTransaction.run({ tx, mode: 'TENANT', schoolId }, () => fn(tx));
  });
}

/**
 * Execute narrowly scoped authentication or background-worker work without
 * putting a non-UUID sentinel into app.current_school_id. Nested system work
 * reuses the active transaction rather than opening a second connection.
 */
export async function withSystemContext<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  const active = tenantTransaction.getStore();
  if (active) {
    if (active.mode !== 'SYSTEM') throw new Error('SYSTEM_CONTEXT_INSIDE_TENANT_CONTEXT_FORBIDDEN');
    return fn(active.tx);
  }
  return getSystemDb().transaction(async (tx: any) => {
    // Never use values such as SYSTEM here: RLS policies must remain UUID-safe.
    await tx.execute(sql`SELECT set_config('app.is_system', 'true', true), set_config('app.current_school_id', '', true)`);
    return tenantTransaction.run({ tx, mode: 'SYSTEM' }, () => fn(tx));
  });
}
