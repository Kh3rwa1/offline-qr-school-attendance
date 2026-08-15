-- Migration 0014: School Slugs & Demo Requests
-- 1. Add slug column to schools
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "slug" varchar(80);
--> statement-breakpoint

-- Backfill slugs from existing school names and udise codes
UPDATE "schools"
SET "slug" = substring(
  regexp_replace(
    regexp_replace(
      lower(trim("name")),
      '[^a-z0-9]+', '-', 'g'
    ),
    '^-+|-+$', '', 'g'
  ),
  1, 65
) || '-' || substring(COALESCE("udise_code", replace(id::text, '-', '')), 1, 4)
WHERE "slug" IS NULL OR "slug" = '';
--> statement-breakpoint

-- Ensure valid format fallback
UPDATE "schools"
SET "slug" = 'school-' || substring(replace(id::text, '-', ''), 1, 8)
WHERE "slug" IS NULL OR "slug" = '' OR NOT ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
--> statement-breakpoint

ALTER TABLE "schools" ALTER COLUMN "slug" SET NOT NULL;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schools_slug_format_chk'
  ) THEN
    ALTER TABLE "schools" ADD CONSTRAINT "schools_slug_format_chk" CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  END IF;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "schools_slug_idx" ON "schools" ("slug");
--> statement-breakpoint

-- 2. Create demo_requests table for landing page lead capture
CREATE TABLE IF NOT EXISTS "demo_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "phone" varchar(30) NOT NULL,
  "email" varchar(255),
  "school_name" varchar(255) NOT NULL,
  "district" varchar(100) NOT NULL,
  "student_count" varchar(50) NOT NULL,
  "source" varchar(50) NOT NULL DEFAULT 'landing',
  "status" varchar(30) NOT NULL DEFAULT 'NEW',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "demo_requests_created_at_idx" ON "demo_requests" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "demo_requests_status_idx" ON "demo_requests" ("status");
--> statement-breakpoint

-- 3. Row Level Security for demo_requests
ALTER TABLE "demo_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "demo_requests" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

DO $$
BEGIN
  DROP POLICY IF EXISTS demo_requests_system_policy ON "demo_requests";
  CREATE POLICY demo_requests_system_policy ON "demo_requests"
    USING (
      (
        pg_has_role(current_user, 'attendance_system_rls', 'member')
        AND current_setting('app.is_system', true) = 'true'
      )
    )
    WITH CHECK (
      (
        pg_has_role(current_user, 'attendance_system_rls', 'member')
        AND current_setting('app.is_system', true) = 'true'
      )
    );

  DROP POLICY IF EXISTS demo_requests_app_insert_policy ON "demo_requests";
  CREATE POLICY demo_requests_app_insert_policy ON "demo_requests"
    FOR INSERT
    WITH CHECK (true);
END $$;
--> statement-breakpoint

-- Grant permissions to db roles
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'attendance_app') THEN
    GRANT INSERT ON TABLE "demo_requests" TO attendance_app;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'attendance_system') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE "demo_requests" TO attendance_system;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'attendance_worker') THEN
    GRANT SELECT, UPDATE ON TABLE "demo_requests" TO attendance_worker;
  END IF;
END $$;

