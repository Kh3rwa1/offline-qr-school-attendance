-- 0022_ingest_v2.sql
-- Forward-only schema migration for RFID Ingest V2 gate pipeline

-- 1. Ensure all scan decision enum values exist
DO $$
BEGIN
  ALTER TYPE scan_decision ADD VALUE IF NOT EXISTS 'MALFORMED_READ';
  ALTER TYPE scan_decision ADD VALUE IF NOT EXISTS 'FUTURE_SKEW';
  ALTER TYPE scan_decision ADD VALUE IF NOT EXISTS 'WRONG_SCHOOL_DAY';
  ALTER TYPE scan_decision ADD VALUE IF NOT EXISTS 'UNREGISTERED_CARD';
  ALTER TYPE scan_decision ADD VALUE IF NOT EXISTS 'CREDENTIAL_ORPHANED';
  ALTER TYPE scan_decision ADD VALUE IF NOT EXISTS 'STUDENT_INACTIVE';
  ALTER TYPE scan_decision ADD VALUE IF NOT EXISTS 'NOT_ENROLLED';
  ALTER TYPE scan_decision ADD VALUE IF NOT EXISTS 'SCHOOL_CLOSED';
  ALTER TYPE scan_decision ADD VALUE IF NOT EXISTS 'SESSION_FINALIZED';
  ALTER TYPE scan_decision ADD VALUE IF NOT EXISTS 'NO_TEACHER_ASSIGNED';
  ALTER TYPE scan_decision ADD VALUE IF NOT EXISTS 'MANUAL_OVERRIDE_PRESERVED';
  ALTER TYPE scan_decision ADD VALUE IF NOT EXISTS 'DUPLICATE_IN_BATCH';
  ALTER TYPE scan_decision ADD VALUE IF NOT EXISTS 'DUPLICATE_DEBOUNCED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- Convert rfid_scan_events decision column to VARCHAR(50) so all decision types are supported seamlessly
ALTER TABLE rfid_scan_events ALTER COLUMN decision TYPE VARCHAR(50);
--> statement-breakpoint

-- 2. Unique indexes and performance indexes for high-concurrency gate ingest
DROP INDEX IF EXISTS rfid_credentials_active_student_idx;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS rfid_credentials_school_epc_uq
  ON rfid_credentials (school_id, credential_digest);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS attendance_sessions_natural_uq
  ON attendance_sessions (school_id, class_section_id, session_date, session_type);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_session_student_uq
  ON attendance_records (attendance_session_id, student_id);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS rfid_scan_events_idem_uq
  ON rfid_scan_events (idempotency_key);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS enrollments_student_year_idx
  ON enrollments (school_id, student_id, academic_year_id);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS rfid_scan_events_school_time_idx
  ON rfid_scan_events (school_id, scan_timestamp DESC);
--> statement-breakpoint

-- 3. New columns for attendance_records
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS source varchar(30) DEFAULT 'RFID',
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_reason varchar(30);
--> statement-breakpoint

-- 4. New telemetry columns for rfid_scan_events
ALTER TABLE rfid_scan_events
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_flag VARCHAR(30);
