-- Hardened RLS System Context Migration
-- Prevents attendance_app application role from bypassing tenant isolation by setting app.is_system=true.
DO $$
DECLARE
  table_name text;
  tenant_policy text := $policy$
    USING (
      (current_setting('app.is_system', true) = 'true' AND current_user != 'attendance_app')
      OR school_id = CASE
        WHEN current_setting('app.current_school_id', true)
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN current_setting('app.current_school_id', true)::uuid
        ELSE NULL
      END
    )
    WITH CHECK (
      (current_setting('app.is_system', true) = 'true' AND current_user != 'attendance_app')
      OR school_id = CASE
        WHEN current_setting('app.current_school_id', true)
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN current_setting('app.current_school_id', true)::uuid
        ELSE NULL
      END
    )
  $policy$;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'academic_years', 'school_memberships', 'teacher_profiles', 'devices',
    'class_sections', 'teacher_assignments', 'students', 'guardians',
    'enrollments', 'qr_credentials', 'attendance_sessions',
    'attendance_session_roster', 'attendance_events', 'attendance_records',
    'attendance_corrections', 'school_sms_settings', 'notification_jobs',
    'import_jobs'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', table_name);
    EXECUTE format('CREATE POLICY tenant_isolation_policy ON %I %s', table_name, tenant_policy);
  END LOOP;

  ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_policy ON audit_logs;
  CREATE POLICY tenant_isolation_policy ON audit_logs
    USING (
      (current_setting('app.is_system', true) = 'true' AND current_user != 'attendance_app')
      OR school_id = CASE
        WHEN current_setting('app.current_school_id', true)
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN current_setting('app.current_school_id', true)::uuid
        ELSE NULL
      END
    )
    WITH CHECK (
      (current_setting('app.is_system', true) = 'true' AND current_user != 'attendance_app')
      OR school_id = CASE
        WHEN current_setting('app.current_school_id', true)
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN current_setting('app.current_school_id', true)::uuid
        ELSE NULL
      END
    );

  ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_policy ON notification_templates;
  CREATE POLICY tenant_isolation_policy ON notification_templates
    USING (
      (current_setting('app.is_system', true) = 'true' AND current_user != 'attendance_app')
      OR school_id IS NULL
      OR school_id = CASE
        WHEN current_setting('app.current_school_id', true)
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN current_setting('app.current_school_id', true)::uuid
        ELSE NULL
      END
    )
    WITH CHECK (
      (current_setting('app.is_system', true) = 'true' AND current_user != 'attendance_app')
      OR school_id IS NOT NULL AND school_id = CASE
        WHEN current_setting('app.current_school_id', true)
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN current_setting('app.current_school_id', true)::uuid
        ELSE NULL
      END
    );

  ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_policy ON student_guardians;
  CREATE POLICY tenant_isolation_policy ON student_guardians
    USING (
      (current_setting('app.is_system', true) = 'true' AND current_user != 'attendance_app')
      OR EXISTS (
        SELECT 1 FROM students
        WHERE students.id = student_guardians.student_id
          AND students.school_id = CASE
            WHEN current_setting('app.current_school_id', true)
              ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            THEN current_setting('app.current_school_id', true)::uuid
            ELSE NULL
          END
      )
    )
    WITH CHECK (
      (current_setting('app.is_system', true) = 'true' AND current_user != 'attendance_app')
      OR EXISTS (
        SELECT 1 FROM students
        WHERE students.id = student_guardians.student_id
          AND students.school_id = CASE
            WHEN current_setting('app.current_school_id', true)
              ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            THEN current_setting('app.current_school_id', true)::uuid
            ELSE NULL
          END
      )
    );

  ALTER TABLE notification_attempts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_policy ON notification_attempts;
  CREATE POLICY tenant_isolation_policy ON notification_attempts
    USING (
      (current_setting('app.is_system', true) = 'true' AND current_user != 'attendance_app')
      OR EXISTS (
        SELECT 1 FROM notification_jobs
        WHERE notification_jobs.id = notification_attempts.job_id
          AND notification_jobs.school_id = CASE
            WHEN current_setting('app.current_school_id', true)
              ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            THEN current_setting('app.current_school_id', true)::uuid
            ELSE NULL
          END
      )
    )
    WITH CHECK (
      (current_setting('app.is_system', true) = 'true' AND current_user != 'attendance_app')
      OR EXISTS (
        SELECT 1 FROM notification_jobs
        WHERE notification_jobs.id = notification_attempts.job_id
          AND notification_jobs.school_id = CASE
            WHEN current_setting('app.current_school_id', true)
              ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            THEN current_setting('app.current_school_id', true)::uuid
            ELSE NULL
          END
      )
    );

  ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS system_only_policy ON auth_sessions;
  CREATE POLICY system_only_policy ON auth_sessions
    USING ((current_setting('app.is_system', true) = 'true' AND current_user != 'attendance_app'))
    WITH CHECK ((current_setting('app.is_system', true) = 'true' AND current_user != 'attendance_app'));
END $$;
