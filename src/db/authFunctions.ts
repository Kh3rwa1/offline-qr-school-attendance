import { db, executeSql } from './index';
import { verifyPassword } from '../auth/password';
import pg from 'pg';

// Pre-computed Argon2id dummy hash for timing-safe password check when user is not found
const DUMMY_PASSWORD_HASH = '$argon2id$v=19$m=65536,t=3,p=4$ZHVtbXlzYWx0MTIzNDU2Nw$8xN4T3nF1zK9W7p0L2m5Q6v8R1y3U5i7O9p4S2a5D8f';

let authPoolInstance: pg.Pool | undefined;

function getAuthPool(): pg.Pool | null {
  if (authPoolInstance) return authPoolInstance;
  const authUrl = process.env.AUTH_DATABASE_URL;
  if (authUrl) {
    authPoolInstance = new pg.Pool({
      connectionString: authUrl,
      max: 5,
      idleTimeoutMillis: 30000,
    });
    return authPoolInstance;
  }
  return null;
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
  status: string;
} | null> {
  const pool = getAuthPool();
  if (pool) {
    const res = await pool.query('SELECT id, full_name, phone_number, password_hash, status FROM lookup_auth_user_by_phone($1)', [phoneNumber]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      fullName: row.full_name,
      phoneNumber: row.phone_number,
      passwordHash: row.password_hash,
      status: row.status,
    };
  }

  // Fallback for PGlite / in-memory unit tests
  try {
    const res = await executeSql(`SELECT id, full_name, phone_number, password_hash, status FROM lookup_auth_user_by_phone('${phoneNumber.replace(/'/g, "''")}')`);
    if (res?.rows && res.rows.length > 0) {
      const row = res.rows[0];
      return {
        id: row.id,
        fullName: row.full_name,
        phoneNumber: row.phone_number,
        passwordHash: row.password_hash,
        status: row.status,
      };
    }
  } catch {
    // If function is not defined in PGlite mock, fallback to direct query
  }

  const result = await db.execute(`SELECT id, full_name, phone_number, password_hash, status FROM users WHERE phone_number = '${phoneNumber.replace(/'/g, "''")}' LIMIT 1`);
  const rows = (result as any)?.rows || (Array.isArray(result) ? result : []);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id || r.id,
    fullName: r.full_name || r.fullName,
    phoneNumber: r.phone_number || r.phoneNumber,
    passwordHash: r.password_hash || r.passwordHash,
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
    const res = await pool.query('SELECT school_id, school_name, role, status FROM get_user_school_memberships($1)', [userId]);
    return res.rows.map((r) => ({
      schoolId: r.school_id,
      schoolName: r.school_name,
      role: r.role,
      status: r.status,
    }));
  }

  try {
    const res = await executeSql(`SELECT school_id, school_name, role, status FROM get_user_school_memberships('${userId}')`);
    if (res?.rows) {
      return res.rows.map((r: any) => ({
        schoolId: r.school_id,
        schoolName: r.school_name,
        role: r.role,
        status: r.status,
      }));
    }
  } catch {
    // Fallback
  }

  const result = await db.execute(`
    SELECT m.school_id, s.name AS school_name, m.role, m.status
    FROM school_memberships m
    JOIN schools s ON s.id = m.school_id
    WHERE m.user_id = '${userId}' AND m.status = 'ACTIVE' AND s.status = 'ACTIVE'
  `);
  const rows = (result as any)?.rows || (Array.isArray(result) ? result : []);
  return rows.map((r: any) => ({
    schoolId: r.school_id,
    schoolName: r.school_name,
    role: r.role,
    status: r.status,
  }));
}
