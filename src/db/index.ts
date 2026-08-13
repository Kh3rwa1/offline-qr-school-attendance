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
let appPoolInstance: pg.Pool | undefined;
let systemPoolInstance: pg.Pool | undefined;

type ContextMode = 'TENANT' | 'SYSTEM';
type ContextStore = { tx: any; mode: ContextMode; schoolId?: string };
const tenantTransaction = new AsyncLocalStorage<ContextStore>();

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

export function getDb() {
  if (dbInstance) return dbInstance;

  if (env.DATABASE_URL) {
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
  await rawDb.execute(sql`SELECT set_config('app.is_system', 'false', false), set_config('app.current_school_id', ${schoolId}, false)`);
}

export async function resetTenantContext() {
  await rawDb.execute(sql`SELECT set_config('app.is_system', 'false', false), set_config('app.current_school_id', '', false)`);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function withTenantContext<T>(schoolId: string, fn: (tx: any) => Promise<T>): Promise<T> {
  if (!isUuid(schoolId)) throw new Error('INVALID_SCHOOL_ID');
  const active = tenantTransaction.getStore();
  if (active) {
    if (active.mode === 'SYSTEM') throw new Error('TENANT_CONTEXT_INSIDE_SYSTEM_CONTEXT_FORBIDDEN');
    if (active.schoolId !== schoolId) throw new Error('TENANT_CONTEXT_SWITCH_FORBIDDEN');
    return fn(active.tx);
  }
  const isLocal = Boolean(env.DATABASE_URL);
  return rawDb.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT set_config('app.is_system', 'false', ${isLocal}), set_config('app.current_school_id', ${schoolId}, ${isLocal})`);
    return tenantTransaction.run({ tx, mode: 'TENANT', schoolId }, () => fn(tx));
  });
}

export async function withSystemContext<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  const active = tenantTransaction.getStore();
  if (active) {
    if (active.mode !== 'SYSTEM') throw new Error('SYSTEM_CONTEXT_INSIDE_TENANT_CONTEXT_FORBIDDEN');
    return fn(active.tx);
  }
  const isLocal = Boolean(env.DATABASE_URL);
  return getSystemDb().transaction(async (tx: any) => {
    await tx.execute(sql`SELECT set_config('app.is_system', 'true', ${isLocal}), set_config('app.current_school_id', '', ${isLocal})`);
    return tenantTransaction.run({ tx, mode: 'SYSTEM' }, () => fn(tx));
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
  try {
    const { closeAuthPool } = await import('./authFunctions');
    await closeAuthPool();
  } catch {}
}
