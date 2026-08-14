-- Migration 0011: Add canonical payload_hash column to rfid_scan_events for complete envelope conflict detection

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rfid_scan_events' AND column_name = 'payload_hash'
  ) THEN
    ALTER TABLE rfid_scan_events ADD COLUMN payload_hash VARCHAR(64);
  END IF;
END $$;
