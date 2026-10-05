import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import * as schema from './schema';
import { env } from '../env';
import { isUuid } from '../lib/ids';

const require = createRequire(import.meta.url);

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

let client: any;
let dbInstance: Db | undefined;
let systemDbInstance: Db | undefined;
let appPoolInstance: pg.Pool | undefined;
let systemPoolInstance: pg.Pool | undefined;

type ContextMode = 'TENANT' | 'SYSTEM';
interface ContextStore { tx: Tx; mode: ContextMode; schoolId?: string }
export const tenantTransaction = new AsyncLocalStorage<ContextStore>();
const store = tenantTransaction;

// PostgreSQL Connection Pool Budget Configuration
const PG_POOL_MAX_APP = parseInt(process.env.PG_POOL_MAX_APP || process.env.PG_POOL_MAX || '15', 10);
const PG_POOL_MAX_SYS = parseInt(process.env.PG_POOL_MAX_SYS || '5', 10);
const PG_POOL_MIN = parseInt(process.env.PG_POOL_MIN || '2', 10);
const PG_IDLE_TIMEOUT_MS = parseInt(process.env.PG_IDLE_TIMEOUT_MS || '30000', 10);
const PG_CONNECTION_TIMEOUT_MS = parseInt(process.env.PG_CONNECTION_TIMEOUT_MS || '5000', 10);
const PG_STATEMENT_TIMEOUT_MS = parseInt(process.env.PG_STATEMENT_TIMEOUT_MS || '10000', 10);
const PG_IDLE_IN_TRANSACTION_TIMEOUT_MS = parseInt(process.env.PG_IDLE_IN_TRANSACTION_TIMEOUT_MS || '5000', 10);

const WEB_REPLICA_COUNT = parseInt(process.env.WEB_REPLICA_COUNT || '2', 10);
const SMS_WORKER_REPLICA_COUNT = parseInt(process.env.SMS_WORKER_REPLICA_COUNT || '2', 10);
const MAX_ALLOWED_DB_CONNECTIONS = parseInt(process.env.MAX_ALLOWED_DB_CONNECTIONS || '100', 10);

/**
 * Validates connection pool budget on startup accounting for app and system pools per replica.
 */
export function validateDatabaseConnectionBudget(): { totalBudget: number; maxAllowed: number; valid: boolean } {
  const processBudget = PG_POOL_MAX_APP + PG_POOL_MAX_SYS;
  const totalBudget = (WEB_REPLICA_COUNT * processBudget) + (SMS_WORKER_REPLICA_COUNT * processBudget);
  const valid = totalBudget <= MAX_ALLOWED_DB_CONNECTIONS;

  if (!valid && process.env.NODE_ENV === 'production') {
    throw new Error(
      `DB_CONNECTION_BUDGET_EXCEEDED: Configured pool budget (${totalBudget}) exceeds max allowed database connections (${MAX_ALLOWED_DB_CONNECTIONS}). ` +
      `Web replicas (${WEB_REPLICA_COUNT} x ${processBudget}) + Worker replicas (${SMS_WORKER_REPLICA_COUNT} x ${processBudget}).`
    );
  }

  return { totalBudget, maxAllowed: MAX_ALLOWED_DB_CONNECTIONS, valid };
}

export function getDbPoolMetrics() {
  if (appPoolInstance) {
    return {
      totalCount: appPoolInstance.totalCount,
      idleCount: appPoolInstance.idleCount,
      waitingCount: appPoolInstance.waitingCount,
      maxAllowed: PG_POOL_MAX_APP,
    };
  }
  return { totalCount: 0, idleCount: 0, waitingCount: 0, maxAllowed: PG_POOL_MAX_APP };
}

export function isDbPoolOverloaded(): boolean {
  if (!appPoolInstance) return false;
  const activeCount = appPoolInstance.totalCount - appPoolInstance.idleCount;
  return activeCount >= Math.floor(PG_POOL_MAX_APP * 0.9);
}

const isPlaceholder = (url?: string) => !url || /replace[-_]with[-_]/.test(url);

function createDb(): Db {
  if (isPlaceholder(env.DATABASE_URL)) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL is missing or a placeholder. Refusing to start on an in-memory database.');
    }
    // Dev/test only. Kept behind this branch so it can move to an injected driver.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PGlite } = require('@electric-sql/pglite');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require('drizzle-orm/pglite');
    const pgliteInstance = new PGlite();
    client = pgliteInstance;
    return drizzle(pgliteInstance, { schema }) as unknown as Db; // the ONE sanctioned cast
  }

  validateDatabaseConnectionBudget();
  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: PG_POOL_MAX_APP,
    min: PG_POOL_MIN,
    idleTimeoutMillis: PG_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: PG_CONNECTION_TIMEOUT_MS,
    statement_timeout: PG_STATEMENT_TIMEOUT_MS,
    idle_in_transaction_session_timeout: PG_IDLE_IN_TRANSACTION_TIMEOUT_MS,
    application_name: process.env.PG_APPLICATION_NAME || 'school_attendance_web',
  });
  appPoolInstance = pool;
  client = pool;
  return drizzlePg(pool, { schema });
}

export function getDb(): Db {
  if (dbInstance) return dbInstance;
  dbInstance = createDb();
  return dbInstance;
}

const rawDb: Db = getDb();

function getSystemDb(): Db {
  if (systemDbInstance) return systemDbInstance;
  if (!env.SYSTEM_DATABASE_URL || isPlaceholder(env.SYSTEM_DATABASE_URL) || env.SYSTEM_DATABASE_URL === env.DATABASE_URL) {
    systemDbInstance = rawDb;
    return systemDbInstance;
  }
  systemPoolInstance = new pg.Pool({
    connectionString: env.SYSTEM_DATABASE_URL,
    max: PG_POOL_MAX_SYS,
    min: PG_POOL_MIN,
    idleTimeoutMillis: PG_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: PG_CONNECTION_TIMEOUT_MS,
    statement_timeout: PG_STATEMENT_TIMEOUT_MS,
    idle_in_transaction_session_timeout: PG_IDLE_IN_TRANSACTION_TIMEOUT_MS,
    application_name: 'school_attendance_system',
  });
  systemDbInstance = drizzlePg(systemPoolInstance, { schema });
  return systemDbInstance;
}

export const db: Db = new Proxy(rawDb, {
  get(target, prop, receiver) {
    const active = store.getStore();
    if (prop === 'transaction' && active) {
      // Real nested semantics: SAVEPOINT, not "pretend"
      return (cb: (tx: Tx) => Promise<unknown>) => active.tx.transaction(cb);
    }
    const source = active && prop in active.tx ? active.tx : target;
    const value = Reflect.get(source, prop, receiver);
    return typeof value === 'function' ? value.bind(source) : value;
  },
});

export async function executeSql(sqlQuery: string) {
  if (client && 'query' in client) return client.query(sqlQuery);
  if (client && 'exec' in client) return client.exec(sqlQuery);
  throw new Error('DATABASE_CLIENT_UNAVAILABLE');
}

export async function withTenantContext<T>(schoolId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!isUuid(schoolId)) throw new Error('INVALID_SCHOOL_ID');
  const active = store.getStore();
  if (active) {
    if (active.mode === 'SYSTEM') throw new Error('TENANT_CONTEXT_INSIDE_SYSTEM_CONTEXT_FORBIDDEN');
    if (active.schoolId !== schoolId) throw new Error('TENANT_CONTEXT_SWITCH_FORBIDDEN');
    return fn(active.tx);
  }
  return rawDb.transaction(async (tx) => {
    // ALWAYS transaction-local (true). Never leaks to the pooled connection.
    await tx.execute(sql`SELECT set_config('app.is_system', 'false', true), set_config('app.current_school_id', ${schoolId}, true)`);
    return store.run({ tx, mode: 'TENANT', schoolId }, () => fn(tx));
  });
}

export async function withSystemContext<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const active = store.getStore();
  if (active) {
    if (active.mode !== 'SYSTEM') throw new Error('SYSTEM_CONTEXT_INSIDE_TENANT_CONTEXT_FORBIDDEN');
    return fn(active.tx);
  }
  return getSystemDb().transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.is_system', 'true', true), set_config('app.current_school_id', '', true)`);
    return store.run({ tx, mode: 'SYSTEM' }, () => fn(tx));
  });
}

export async function closeDatabasePools(): Promise<void> {
  if (appPoolInstance) {
    await appPoolInstance.end().catch(() => {});
    appPoolInstance = undefined;
  }
  if (systemPoolInstance) {
    await systemPoolInstance.end().catch(() => {});
    systemPoolInstance = undefined;
  }
  dbInstance = undefined;
  systemDbInstance = undefined;
  try {
    const { closeAuthPool } = await import('./authFunctions');
    await closeAuthPool();
  } catch {}
}
