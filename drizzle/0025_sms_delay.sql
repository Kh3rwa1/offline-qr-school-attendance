-- 0025_sms_delay.sql
-- Add delay, attendance record link, kind, and cancellation reason to notification_jobs
ALTER TABLE notification_jobs
  ADD COLUMN IF NOT EXISTS send_after           timestamptz,
  ADD COLUMN IF NOT EXISTS attendance_record_id  uuid REFERENCES attendance_records(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS kind                 varchar(20) NOT NULL DEFAULT 'ABSENCE',
  ADD COLUMN IF NOT EXISTS cancelled_reason     varchar(40);
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE notification_jobs ADD CONSTRAINT notification_jobs_kind_ck CHECK (kind IN ('ABSENCE', 'CORRECTION'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS notification_jobs_due_idx ON notification_jobs (status, send_after);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS notification_jobs_record_kind_uq ON notification_jobs (attendance_record_id, kind) WHERE attendance_record_id IS NOT NULL;
