-- RLS is part of the deployment migration, not application startup.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'academic_years', 'school_memberships', 'teacher_profiles', 'devices',
    'class_sections', 'teacher_assignments', 'students', 'guardians',
    'enrollments', 'qr_credentials', 'attendance_sessions',
    'attendance_session_roster', 'attendance_events', 'attendance_records',
    'attendance_corrections', 'school_sms_settings', 'notification_jobs',
    'import_jobs', 'audit_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_policy ON %I USING (school_id = NULLIF(current_setting(''app.current_school_id'', true), '''')::uuid) WITH CHECK (school_id = NULLIF(current_setting(''app.current_school_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END $$;
