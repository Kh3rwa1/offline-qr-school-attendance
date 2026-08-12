-- Update school_memberships RLS policy to support SYSTEM context and self-user membership lookups
DROP POLICY IF EXISTS tenant_isolation_policy ON school_memberships;
CREATE POLICY tenant_isolation_policy ON school_memberships
  USING (
    school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    OR current_setting('app.current_school_id', true) = 'SYSTEM'
    OR user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );

-- Update audit_logs RLS policy to support SYSTEM context and global system logs
DROP POLICY IF EXISTS tenant_isolation_policy ON audit_logs;
CREATE POLICY tenant_isolation_policy ON audit_logs
  USING (
    school_id IS NULL
    OR school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    OR current_setting('app.current_school_id', true) = 'SYSTEM'
  );

-- Update notification_jobs RLS policy to support SYSTEM background worker context
DROP POLICY IF EXISTS tenant_isolation_policy ON notification_jobs;
CREATE POLICY tenant_isolation_policy ON notification_jobs
  USING (
    school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    OR current_setting('app.current_school_id', true) = 'SYSTEM'
  );

-- Update notification_templates RLS policy to restrict WITH CHECK on global templates
DROP POLICY IF EXISTS tenant_isolation_policy ON notification_templates;
CREATE POLICY tenant_isolation_policy ON notification_templates
  USING (
    school_id IS NULL
    OR school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    OR current_setting('app.current_school_id', true) = 'SYSTEM'
  )
  WITH CHECK (
    school_id = NULLIF(current_setting('app.current_school_id', true), '')::uuid
    OR current_setting('app.current_school_id', true) = 'SYSTEM'
  );
