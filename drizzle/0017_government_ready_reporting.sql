-- 0017_government_ready_reporting.sql
-- Schema migration for 10/10 Government-Ready Reporting, Academic Calendar & Internal Approval System

-- 1. School Reporting Profile Fields
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "school_code" VARCHAR(50);
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "circle" VARCHAR(100);
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "address" TEXT;
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "headmaster_name" VARCHAR(255);
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "contact_number" VARCHAR(20);
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "report_footer_text" TEXT;
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "logo_url" TEXT;
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "default_attendance_cutoff" VARCHAR(10) DEFAULT '10:30';
--> statement-breakpoint

-- 2. Academic Calendar Days Table
CREATE TABLE IF NOT EXISTS "academic_calendar_days" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "calendar_date" DATE NOT NULL,
  "classification" VARCHAR(50) NOT NULL DEFAULT 'WORKING_DAY',
  "reason" VARCHAR(255),
  "is_working_day" BOOLEAN NOT NULL DEFAULT true,
  "created_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "academic_calendar_days_school_date_idx" 
  ON "academic_calendar_days" ("school_id", "calendar_date");
--> statement-breakpoint

-- 3. Reporting Profiles Table
CREATE TABLE IF NOT EXISTS "reporting_profiles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" UUID REFERENCES "schools"("id") ON DELETE CASCADE,
  "profile_name" VARCHAR(100) NOT NULL,
  "version" VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "configuration" JSONB NOT NULL,
  "created_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reporting_profiles_school_idx" 
  ON "reporting_profiles" ("school_id");
--> statement-breakpoint

-- 4. Report Approvals & Audit Trail Table
CREATE TABLE IF NOT EXISTS "report_approvals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "report_type" VARCHAR(50) NOT NULL,
  "scope_type" VARCHAR(50) NOT NULL,
  "scope_parameters" JSONB,
  "period_type" VARCHAR(50) NOT NULL,
  "period_start_date" DATE NOT NULL,
  "period_end_date" DATE NOT NULL,
  "profile_id" UUID REFERENCES "reporting_profiles"("id") ON DELETE SET NULL,
  "profile_version" VARCHAR(20) DEFAULT '1.0.0',
  "report_version" INTEGER NOT NULL DEFAULT 1,
  "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  "file_hash_sha256" VARCHAR(64),
  "validation_summary" JSONB,
  "metadata" JSONB,
  "generated_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "generated_at" TIMESTAMPTZ DEFAULT now(),
  "approved_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "approved_at" TIMESTAMPTZ,
  "download_count" INTEGER NOT NULL DEFAULT 0,
  "superseded_at" TIMESTAMPTZ,
  "superseded_by" UUID REFERENCES "users"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_approvals_school_type_period_idx" 
  ON "report_approvals" ("school_id", "report_type", "period_start_date", "period_end_date");
--> statement-breakpoint

-- 5. Row-Level Security for New Tables
DO $$
DECLARE
  table_name text;
  tenant_policy text := $policy$
    AS RESTRICTIVE
    FOR ALL
    USING (
      (
        pg_has_role(current_user, 'attendance_system_rls', 'member')
        AND current_setting('app.is_system', true) = 'true'
      )
      OR school_id = CASE
        WHEN current_setting('app.current_school_id', true)
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN current_setting('app.current_school_id', true)::uuid
        ELSE NULL
      END
    )
    WITH CHECK (
      (
        pg_has_role(current_user, 'attendance_system_rls', 'member')
        AND current_setting('app.is_system', true) = 'true'
      )
      OR school_id = CASE
        WHEN current_setting('app.current_school_id', true)
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN current_setting('app.current_school_id', true)::uuid
        ELSE NULL
      END
    )
  $policy$;
  reporting_profiles_policy text := $policy$
    AS RESTRICTIVE
    FOR ALL
    USING (
      (
        pg_has_role(current_user, 'attendance_system_rls', 'member')
        AND current_setting('app.is_system', true) = 'true'
      )
      OR school_id IS NULL
      OR school_id = CASE
        WHEN current_setting('app.current_school_id', true)
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN current_setting('app.current_school_id', true)::uuid
        ELSE NULL
      END
    )
    WITH CHECK (
      (
        pg_has_role(current_user, 'attendance_system_rls', 'member')
        AND current_setting('app.is_system', true) = 'true'
      )
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
    'academic_calendar_days', 'report_approvals'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', table_name);
    EXECUTE format('CREATE POLICY tenant_isolation_policy ON %I %s', table_name, tenant_policy);
  END LOOP;

  -- Reporting profiles allows built-in system profiles (school_id IS NULL) or tenant profiles
  EXECUTE 'ALTER TABLE reporting_profiles ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE reporting_profiles FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_policy ON reporting_profiles';
  EXECUTE format('CREATE POLICY tenant_isolation_policy ON reporting_profiles %s', reporting_profiles_policy);
END $$;

