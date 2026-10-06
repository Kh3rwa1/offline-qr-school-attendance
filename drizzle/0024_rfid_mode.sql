-- 0024_rfid_mode.sql
-- Add rfid_mode column with SHADOW, ASSISTED, LIVE check constraint
ALTER TABLE schools ADD COLUMN IF NOT EXISTS rfid_mode varchar(10) NOT NULL DEFAULT 'SHADOW';
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE schools ADD CONSTRAINT schools_rfid_mode_ck CHECK (rfid_mode IN ('SHADOW', 'ASSISTED', 'LIVE'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
