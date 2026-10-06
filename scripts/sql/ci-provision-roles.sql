-- CI / disposable-cluster only: provision the least-privilege login roles the app
-- expects (attendance_app, attendance_auth, attendance_system, attendance_worker).
-- Idempotent; safe to run before OR after migrations. Run as the migration/owner role:
--   psql "$OWNER_URL" -v pw=ci_password -f scripts/sql/ci-provision-roles.sql
-- Never used by production installs (scripts/generate-secrets.sh + bootstrap-db own that).
\set ON_ERROR_STOP on

SELECT format('CREATE ROLE %I WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE', r)
  FROM unnest(ARRAY['attendance_app', 'attendance_auth', 'attendance_system', 'attendance_worker']) AS r
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) \gexec

SELECT 'CREATE ROLE attendance_system_rls NOLOGIN'
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'attendance_system_rls') \gexec

SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', r, :'pw')
  FROM unnest(ARRAY['attendance_app', 'attendance_auth', 'attendance_system', 'attendance_worker']) AS r \gexec

GRANT attendance_system_rls TO attendance_system, attendance_worker;

SELECT format('GRANT CONNECT ON DATABASE %I TO attendance_app, attendance_auth, attendance_system, attendance_worker',
              current_database()) \gexec

GRANT USAGE ON SCHEMA public TO attendance_app, attendance_auth, attendance_system, attendance_worker;

-- Existing objects (when run after migrations)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO attendance_app, attendance_system, attendance_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO attendance_app, attendance_system, attendance_worker;

-- Future objects created by this (owner) role (when run before migrations)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO attendance_app, attendance_system, attendance_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO attendance_app, attendance_system, attendance_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO attendance_auth;
