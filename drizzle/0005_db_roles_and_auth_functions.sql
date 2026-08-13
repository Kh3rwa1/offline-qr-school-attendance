-- Migration 0005: Dedicated Database Roles, SECURITY DEFINER Auth Functions & Security Hardening

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'attendance_migration') THEN
    CREATE ROLE attendance_migration WITH LOGIN PASSWORD 'migration_password_123!';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'attendance_app') THEN
    CREATE ROLE attendance_app WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'app_password_123!';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'attendance_auth') THEN
    CREATE ROLE attendance_auth WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'auth_password_123!';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'attendance_worker') THEN
    CREATE ROLE attendance_worker WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD 'worker_password_123!';
  END IF;
END $$;

-- SECURITY DEFINER function for pre-tenant authentication user lookup
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
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.full_name, u.phone_number, u.password_hash, u.status
  FROM public.users u
  WHERE u.phone_number = p_phone
  LIMIT 1;
END;
$$;

-- SECURITY DEFINER function for pre-tenant user school membership lookup
CREATE OR REPLACE FUNCTION get_user_school_memberships(p_user_id uuid)
RETURNS TABLE (
  school_id uuid,
  school_name text,
  role text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
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

-- Function security hardening: assign owner, revoke PUBLIC, grant attendance_auth
ALTER FUNCTION lookup_auth_user_by_phone(text) OWNER TO CURRENT_USER;
ALTER FUNCTION get_user_school_memberships(uuid) OWNER TO CURRENT_USER;

REVOKE EXECUTE ON FUNCTION lookup_auth_user_by_phone(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_user_school_memberships(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION lookup_auth_user_by_phone(text) TO attendance_auth;
GRANT EXECUTE ON FUNCTION get_user_school_memberships(uuid) TO attendance_auth;
