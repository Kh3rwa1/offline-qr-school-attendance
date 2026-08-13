-- Migration 0005: Dedicated Database Roles, SECURITY DEFINER Auth Functions & Security Hardening

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'attendance_migration') THEN
    CREATE ROLE attendance_migration WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'attendance_app') THEN
    CREATE ROLE attendance_app WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'attendance_auth') THEN
    CREATE ROLE attendance_auth WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'attendance_worker') THEN
    CREATE ROLE attendance_worker WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'attendance_system') THEN
    CREATE ROLE attendance_system WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN insufficient_privilege THEN NULL;
END $$;

-- SECURITY DEFINER function for pre-tenant authentication user lookup
CREATE OR REPLACE FUNCTION public.lookup_auth_user_by_phone(p_phone text)
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
CREATE OR REPLACE FUNCTION public.get_user_school_memberships(p_user_id uuid)
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

-- Function security hardening: assign owner, REVOKE ALL FROM PUBLIC, grant explicit EXECUTE to application & auth roles
ALTER FUNCTION public.lookup_auth_user_by_phone(text) OWNER TO CURRENT_USER;
ALTER FUNCTION public.get_user_school_memberships(uuid) OWNER TO CURRENT_USER;

REVOKE ALL ON FUNCTION public.lookup_auth_user_by_phone(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_school_memberships(uuid) FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO attendance_auth, attendance_app, attendance_system, attendance_worker, attendance_migration;
GRANT EXECUTE ON FUNCTION public.lookup_auth_user_by_phone(text) TO attendance_auth, attendance_app, attendance_system;
GRANT EXECUTE ON FUNCTION public.get_user_school_memberships(uuid) TO attendance_auth, attendance_app, attendance_system;
