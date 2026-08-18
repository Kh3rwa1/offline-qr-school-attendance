-- 0018_reporting_contract_integrity.sql
-- Makes reporting artifacts immutable, format-correct and reproducible; adds
-- governed calendar versions so approximate movable holidays cannot silently
-- become authoritative attendance rules.

-- ---------------------------------------------------------------------------
-- 1. Versioned, approvable academic calendars
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "academic_calendar_versions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "academic_year" INTEGER NOT NULL CHECK ("academic_year" BETWEEN 2000 AND 2100),
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK ("status" IN ('DRAFT', 'APPROVED', 'SUPERSEDED')),
  "source_type" VARCHAR(40) NOT NULL DEFAULT 'SCHOOL_CONFIRMED'
    CHECK ("source_type" IN ('SCHOOL_CONFIRMED', 'DEPARTMENT_ORDER', 'LEGACY_UNVERIFIED', 'SYSTEM_TEMPLATE')),
  "source_reference" TEXT,
  "notes" TEXT,
  "created_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "approved_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "approved_at" TIMESTAMPTZ,
  "superseded_at" TIMESTAMPTZ,
  CONSTRAINT "academic_calendar_versions_school_year_version_uq"
    UNIQUE ("school_id", "academic_year", "version"),
  CONSTRAINT "academic_calendar_versions_approval_fields_ck" CHECK (
    ("status" = 'APPROVED' AND "approved_by" IS NOT NULL AND "approved_at" IS NOT NULL)
    OR "status" <> 'APPROVED'
  )
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "academic_calendar_one_approved_per_year_idx"
  ON "academic_calendar_versions" ("school_id", "academic_year")
  WHERE "status" = 'APPROVED';
--> statement-breakpoint

ALTER TABLE "academic_calendar_days"
  ADD COLUMN IF NOT EXISTS "calendar_version_id" UUID REFERENCES "academic_calendar_versions"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "academic_calendar_days"
  ADD COLUMN IF NOT EXISTS "source_type" VARCHAR(40) NOT NULL DEFAULT 'SCHOOL_CONFIRMED';
--> statement-breakpoint
ALTER TABLE "academic_calendar_days"
  ADD COLUMN IF NOT EXISTS "source_reference" TEXT;
--> statement-breakpoint
ALTER TABLE "academic_calendar_days"
  ADD COLUMN IF NOT EXISTS "is_approximate" BOOLEAN NOT NULL DEFAULT false;
--> statement-breakpoint

-- Existing rows pre-date calendar governance. Preserve them for review but do
-- not allow them to affect attendance calculations until an administrator
-- verifies and approves the draft.
INSERT INTO "academic_calendar_versions" (
  "school_id", "academic_year", "version", "status", "source_type", "notes"
)
SELECT DISTINCT
  d."school_id",
  EXTRACT(YEAR FROM d."calendar_date")::INTEGER,
  1,
  'DRAFT',
  'LEGACY_UNVERIFIED',
  'Migrated from pre-governance calendar. Review exact dates and approve before use.'
FROM "academic_calendar_days" d
WHERE d."calendar_version_id" IS NULL
ON CONFLICT ("school_id", "academic_year", "version") DO NOTHING;
--> statement-breakpoint

UPDATE "academic_calendar_days" d
SET
  "calendar_version_id" = v."id",
  "source_type" = 'LEGACY_UNVERIFIED',
  "is_approximate" = CASE
    WHEN COALESCE(d."reason", '') ~* '(Saraswati|Panchami|Doljatra|Holi|Good Friday|Eid|Bakrid|Muharram|Janmashtami|Mahalaya|Durga|Lakshmi|Kali|Diwali|Bhai|Chhath|Guru Nanak)'
      THEN true
    ELSE d."is_approximate"
  END
FROM "academic_calendar_versions" v
WHERE d."calendar_version_id" IS NULL
  AND v."school_id" = d."school_id"
  AND v."academic_year" = EXTRACT(YEAR FROM d."calendar_date")::INTEGER
  AND v."version" = 1;
--> statement-breakpoint

DROP INDEX IF EXISTS "academic_calendar_days_school_date_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "academic_calendar_days_version_date_idx"
  ON "academic_calendar_days" ("school_id", "calendar_version_id", "calendar_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_calendar_days_approved_lookup_idx"
  ON "academic_calendar_days" ("school_id", "calendar_date", "calendar_version_id");
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. Exact immutable report artifacts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "report_artifacts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" UUID NOT NULL REFERENCES "schools"("id") ON DELETE CASCADE,
  "report_id" UUID NOT NULL UNIQUE REFERENCES "report_approvals"("id") ON DELETE CASCADE,
  "format" VARCHAR(10) NOT NULL CHECK ("format" IN ('xlsx', 'csv', 'html')),
  "content_type" VARCHAR(120) NOT NULL,
  "filename" VARCHAR(255) NOT NULL,
  "byte_size" BIGINT NOT NULL CHECK ("byte_size" > 0),
  "sha256" VARCHAR(64) NOT NULL CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  "storage_backend" VARCHAR(20) NOT NULL DEFAULT 'database'
    CHECK ("storage_backend" IN ('database', 'filesystem')),
  "storage_key" TEXT,
  "content" BYTEA,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "report_artifacts_storage_ck" CHECK (
    ("storage_backend" = 'database' AND "content" IS NOT NULL AND "storage_key" IS NULL)
    OR
    ("storage_backend" = 'filesystem' AND "content" IS NULL AND "storage_key" IS NOT NULL)
  )
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "report_artifacts_school_report_idx"
  ON "report_artifacts" ("school_id", "report_id");
--> statement-breakpoint

-- Tighten existing report rows without breaking legacy EXPORTED records.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_approvals_date_range_ck') THEN
    ALTER TABLE "report_approvals"
      ADD CONSTRAINT "report_approvals_date_range_ck"
      CHECK ("period_start_date" <= "period_end_date");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_approvals_scope_ck') THEN
    ALTER TABLE "report_approvals"
      ADD CONSTRAINT "report_approvals_scope_ck"
      CHECK ("scope_type" IN ('WHOLE_SCHOOL', 'ALL_CLASSES', 'SELECTED_CLASSES', 'SELECTED_SECTION', 'SELECTED_STUDENTS', 'ONE_STUDENT'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_approvals_status_ck') THEN
    ALTER TABLE "report_approvals"
      ADD CONSTRAINT "report_approvals_status_ck"
      CHECK ("status" IN ('DRAFT', 'VALIDATED', 'READY_FOR_REVIEW', 'APPROVED_INTERNALLY', 'SUPERSEDED', 'EXPORTED'));
  END IF;
END $$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. Real built-in profile (UUID is accepted by the API and snapshot later)
-- ---------------------------------------------------------------------------
INSERT INTO "reporting_profiles" (
  "id", "school_id", "profile_name", "version", "is_default", "configuration"
) VALUES (
  '00000000-0000-4000-8000-000000000070',
  NULL,
  'West Bengal School Management Register',
  '2.0.0',
  true,
  '{
    "layout":"LANDSCAPE",
    "language":"BILINGUAL",
    "includeSheets":{"cover":true,"summary":true,"registers":true,"absentees":true,"consecutiveAbsences":true,"corrections":true,"calendar":true,"metadata":true},
    "columns":{"studentCode":true,"banglarShikshaId":true,"nameEnglish":true,"nameBengali":true,"gender":false,"dailyGrid":true,"totals":true},
    "signatureBlocks":["Class Teacher","Report Verification In-Charge","Headmaster / Teacher-in-Charge"],
    "disclaimer":{"en":"Institutional attendance report generated for school management records. This is not official certification and does not prove submission to any government portal.","bn":"বিদ্যালয়ের ব্যবস্থাপনা রেকর্ডের জন্য তৈরি হাজিরা রিপোর্ট। এটি সরকারি সার্টিফিকেশন নয় এবং কোনো সরকারি পোর্টালে জমা দেওয়ার প্রমাণ নয়।","hi":"विद्यालय प्रबंधन रिकॉर्ड के लिए तैयार उपस्थिति रिपोर्ट। यह सरकारी प्रमाणन नहीं है और किसी सरकारी पोर्टल पर जमा करने का प्रमाण नहीं है।"}
  }'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "profile_name" = EXCLUDED."profile_name",
  "version" = EXCLUDED."version",
  "is_default" = EXCLUDED."is_default",
  "configuration" = EXCLUDED."configuration",
  "updated_at" = now();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. Tenant RLS. Artifacts intentionally have SELECT + INSERT only: no normal
-- application role can mutate or delete an already generated artifact.
-- ---------------------------------------------------------------------------
ALTER TABLE "academic_calendar_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "academic_calendar_versions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "academic_calendar_versions";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "academic_calendar_versions"
  AS RESTRICTIVE FOR ALL
  USING (
    (pg_has_role(current_user, 'attendance_system_rls', 'member') AND current_setting('app.is_system', true) = 'true')
    OR "school_id" = CASE
      WHEN current_setting('app.current_school_id', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN current_setting('app.current_school_id', true)::uuid ELSE NULL END
  )
  WITH CHECK (
    (pg_has_role(current_user, 'attendance_system_rls', 'member') AND current_setting('app.is_system', true) = 'true')
    OR "school_id" = CASE
      WHEN current_setting('app.current_school_id', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN current_setting('app.current_school_id', true)::uuid ELSE NULL END
  );
--> statement-breakpoint
ALTER TABLE "report_artifacts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "report_artifacts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "report_artifacts_select" ON "report_artifacts";
--> statement-breakpoint
DROP POLICY IF EXISTS "report_artifacts_insert" ON "report_artifacts";
--> statement-breakpoint
CREATE POLICY "report_artifacts_select" ON "report_artifacts"
  AS RESTRICTIVE FOR SELECT
  USING (
    (pg_has_role(current_user, 'attendance_system_rls', 'member') AND current_setting('app.is_system', true) = 'true')
    OR "school_id" = CASE
      WHEN current_setting('app.current_school_id', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN current_setting('app.current_school_id', true)::uuid ELSE NULL END
  );
--> statement-breakpoint
CREATE POLICY "report_artifacts_insert" ON "report_artifacts"
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (
    (pg_has_role(current_user, 'attendance_system_rls', 'member') AND current_setting('app.is_system', true) = 'true')
    OR "school_id" = CASE
      WHEN current_setting('app.current_school_id', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN current_setting('app.current_school_id', true)::uuid ELSE NULL END
  );
