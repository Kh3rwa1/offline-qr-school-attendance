-- 0023_audit_actor_fix.sql
-- Fix sentinel UUID in audit trail and add NO_ACTIVE_SESSION decision

DO $$
BEGIN
  ALTER TYPE scan_decision ADD VALUE IF NOT EXISTS 'NO_ACTIVE_SESSION';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE attendance_events
  ADD COLUMN IF NOT EXISTS actor_type varchar(10) DEFAULT 'USER',
  ADD COLUMN IF NOT EXISTS actor_reader_id uuid REFERENCES rfid_readers(id) ON DELETE SET NULL;
--> statement-breakpoint

ALTER TABLE attendance_events ALTER COLUMN actor_id DROP NOT NULL;
--> statement-breakpoint

-- Repair rows written with the fake actor
UPDATE attendance_events
   SET actor_id = NULL, actor_type = 'READER'
 WHERE actor_id = '00000000-0000-0000-0000-000000000001';
--> statement-breakpoint

UPDATE attendance_events SET actor_type = 'USER' WHERE actor_type IS NULL AND actor_id IS NOT NULL;
--> statement-breakpoint

UPDATE attendance_events SET actor_type = 'SYSTEM' WHERE actor_type IS NULL;
--> statement-breakpoint

ALTER TABLE attendance_events ALTER COLUMN actor_type SET DEFAULT 'USER';
--> statement-breakpoint

ALTER TABLE attendance_events ALTER COLUMN actor_type SET NOT NULL;
--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE attendance_events ADD CONSTRAINT attendance_events_actor_ck CHECK (
    (actor_type = 'USER'   AND actor_id IS NOT NULL) OR
    (actor_type = 'READER') OR
    (actor_type = 'SYSTEM' AND actor_id IS NULL)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
