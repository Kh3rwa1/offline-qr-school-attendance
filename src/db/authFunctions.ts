import { db, withSystemContext } from './index';
import { verifyPassword } from '../auth/password';

// Pre-computed Argon2id dummy hash for timing-safe password check when user is not found
const DUMMY_PASSWORD_HASH = '$argon2id$v=19$m=65536,t=3,p=4$ZHVtbXlzYWx0MTIzNDU2Nw$8xN4T3nF1zK9W7p0L2m5Q6v8R1y3U5i7O9p4S2a5D8f';

export async function timingSafeVerifyPassword(userHash: string | null | undefined, passwordAttempt: string): Promise<boolean> {
  const hashToVerify = userHash && userHash.startsWith('$argon2') ? userHash : DUMMY_PASSWORD_HASH;
  const isValid = await verifyPassword(hashToVerify, passwordAttempt);
  return Boolean(userHash && isValid);
}

export const AUTH_SECURITY_DEFINER_SQL = `
-- SECURITY DEFINER function for pre-tenant user lookup
CREATE OR REPLACE FUNCTION lookup_auth_user_by_phone(p_phone text)
RETURNS TABLE (
  id uuid,
  full_name text,
  phone_number text,
  password_hash text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.full_name, u.phone_number, u.password_hash, u.status
  FROM public.users u
  WHERE u.phone_number = p_phone
  LIMIT 1;
END;
$$;

-- SECURITY DEFINER function for loading school memberships for pre-tenant auth
CREATE OR REPLACE FUNCTION get_user_school_memberships(p_user_id uuid)
RETURNS TABLE (
  school_id uuid,
  school_name text,
  role text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT m.school_id, s.name AS school_name, m.role, m.status
  FROM public.school_memberships m
  JOIN public.schools s ON s.id = m.school_id
  WHERE m.user_id = p_user_id
    AND m.status = 'ACTIVE'
    AND s.status = 'ACTIVE';
END;
$$;

-- Security hardening for SECURITY DEFINER functions
ALTER FUNCTION lookup_auth_user_by_phone(text) OWNER TO attendance_migration;
ALTER FUNCTION get_user_school_memberships(uuid) OWNER TO attendance_migration;

REVOKE EXECUTE ON FUNCTION lookup_auth_user_by_phone(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_user_school_memberships(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION lookup_auth_user_by_phone(text) TO attendance_auth;
GRANT EXECUTE ON FUNCTION get_user_school_memberships(uuid) TO attendance_auth;
`;
