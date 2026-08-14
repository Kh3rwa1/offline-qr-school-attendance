import { db, executeSql } from './index';
import { verifyPassword } from '../auth/password';
import pg from 'pg';
import { sql } from 'drizzle-orm';

// Pre-computed Argon2id dummy hash for timing-safe password check when user is not found
const DUMMY_PASSWORD_HASH = '$argon2id$v=19$m=65536,t=3,p=4$ZHVtbXlzYWx0MTIzNDU2Nw$8xN4T3nF1zK9W7p0L2m5Q6v8R1y3U5i7O9p4S2a5D8f';

let authPoolInstance: pg.Pool | undefined;

if (
  process.env.NODE_ENV === 'production' &&
  !process.env.AUTH_DATABASE_URL &&
  process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.startsWith('postgres://') || process.env.DATABASE_URL.startsWith('postgresql://'))
) {
  throw new Error('AUTH_DATABASE_URL is required in production for role-separated authentication.');
}

function getAuthPool(): pg.Pool | null {
  if (authPoolInstance) return authPoolInstance;
  const authUrl = process.env.AUTH_DATABASE_URL;
  if (authUrl && (authUrl.startsWith('postgres://') || authUrl.startsWith('postgresql://'))) {
    authPoolInstance = new pg.Pool({
      connectionString: authUrl,
      max: 5,
      idleTimeoutMillis: 30000,
    });
    return authPoolInstance;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL_AUTH_DATABASE_CONFIG: Production mode requires a valid PostgreSQL URL for AUTH_DATABASE_URL.');
  }
  return null;
}

export async function closeAuthPool(): Promise<void> {
  if (authPoolInstance) {
    await authPoolInstance.end().catch(() => {});
    authPoolInstance = undefined;
  }
}

export async function timingSafeVerifyPassword(userHash: string | null | undefined, passwordAttempt: string): Promise<boolean> {
  const hashToVerify = userHash && userHash.startsWith('$argon2') ? userHash : DUMMY_PASSWORD_HASH;
  try {
    const isValid = await verifyPassword(hashToVerify, passwordAttempt);
    return Boolean(userHash && isValid);
  } catch (err) {
    return false;
  }
}

export async function lookupAuthUserByPhone(phoneNumber: string): Promise<{
  id: string;
  fullName: string;
  phoneNumber: string;
  passwordHash: string;
  platformRole?: string | null;
  status: string;
} | null> {
  const pool = getAuthPool();
  if (pool) {
    const res = await pool.query('SELECT id, full_name, phone_number, password_hash, platform_role, status FROM users WHERE phone_number = $1::text LIMIT 1', [phoneNumber]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      fullName: row.full_name,
      phoneNumber: row.phone_number,
      passwordHash: row.password_hash,
      platformRole: row.platform_role || null,
      status: row.status,
    };
  }

  if (
    process.env.NODE_ENV === 'production' &&
    process.env.DATABASE_URL &&
    (process.env.DATABASE_URL.startsWith('postgres://') || process.env.DATABASE_URL.startsWith('postgresql://'))
  ) {
    throw new Error('FATAL_AUTH_DATABASE_UNAVAILABLE: Dedicated auth database pool required in production mode.');
  }

  const result = await db.execute(sql`SELECT id, full_name, phone_number, password_hash, platform_role, status FROM users WHERE phone_number = ${phoneNumber}::text LIMIT 1`);
  const rows = (result as any)?.rows || (Array.isArray(result) ? result : []);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    fullName: r.full_name || r.fullName,
    phoneNumber: r.phone_number || r.phoneNumber,
    passwordHash: r.password_hash || r.passwordHash,
    platformRole: r.platform_role || r.platformRole || null,
    status: r.status,
  };
}

export async function getUserSchoolMemberships(userId: string): Promise<Array<{
  schoolId: string;
  schoolName: string;
  role: string;
  status: string;
}>> {
  const pool = getAuthPool();
  if (pool) {
    const res = await pool.query('SELECT school_id, school_name, role, status FROM public.get_user_school_memberships($1::uuid)', [userId]);
    return res.rows.map((row: any) => ({
      schoolId: row.school_id,
      schoolName: row.school_name,
      role: row.role,
      status: row.status,
    }));
  }

  if (
    process.env.NODE_ENV === 'production' &&
    process.env.DATABASE_URL &&
    (process.env.DATABASE_URL.startsWith('postgres://') || process.env.DATABASE_URL.startsWith('postgresql://'))
  ) {
    throw new Error('FATAL_AUTH_DATABASE_UNAVAILABLE: Dedicated auth database pool required in production mode.');
  }

  try {
    const res = await db.execute(sql`SELECT school_id, school_name, role, status FROM public.get_user_school_memberships(${userId}::uuid)`);
    const rows = (res as any)?.rows || (Array.isArray(res) ? res : []);
    if (rows && rows.length > 0) {
      return rows.map((row: any) => ({
        schoolId: row.school_id || row.schoolId,
        schoolName: row.school_name || row.schoolName,
        role: row.role,
        status: row.status,
      }));
    }
  } catch {
    // If function is not defined in PGlite mock, fallback to direct join query
  }

  const result = await db.execute(sql`
    SELECT sm.school_id, s.name as school_name, sm.role, sm.status
    FROM school_memberships sm
    JOIN schools s ON sm.school_id = s.id
    WHERE sm.user_id = ${userId}::uuid AND sm.status = 'ACTIVE' AND s.status = 'ACTIVE'
  `);
  const rows = (result as any)?.rows || (Array.isArray(result) ? result : []);
  return rows.map((r: any) => ({
    schoolId: r.school_id || r.schoolId,
    schoolName: r.school_name || r.schoolName,
    role: r.role,
    status: r.status,
  }));
}
