DO $$
BEGIN
  ALTER TABLE student_guardians ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_policy ON student_guardians;
  CREATE POLICY tenant_isolation_policy ON student_guardians
    USING (EXISTS (
      SELECT 1 FROM students
      WHERE students.id = student_guardians.student_id
        AND students.school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM students
      WHERE students.id = student_guardians.student_id
        AND students.school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    ));

  ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS tenant_isolation_policy ON notification_templates;
  CREATE POLICY tenant_isolation_policy ON notification_templates
    USING (school_id IS NULL OR school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid)
    WITH CHECK (school_id IS NULL OR school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid);
END $$;
