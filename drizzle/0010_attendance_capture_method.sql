-- Migration 0010: Add capture_method and RFID source columns to attendance tables
-- Additive only — existing records default to 'QR' for backward compatibility.

ALTER TABLE attendance_events ADD COLUMN IF NOT EXISTS capture_method VARCHAR(30) NOT NULL DEFAULT 'QR';
--> statement-breakpoint
ALTER TABLE attendance_events ADD COLUMN IF NOT EXISTS source_reader_id UUID REFERENCES rfid_readers(id);
--> statement-breakpoint
ALTER TABLE attendance_events ADD COLUMN IF NOT EXISTS source_rfid_event_id UUID REFERENCES rfid_scan_events(id);
--> statement-breakpoint
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS capture_method VARCHAR(30) NOT NULL DEFAULT 'QR';
--> statement-breakpoint
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS confidence_level VARCHAR(20) NOT NULL DEFAULT 'HIGH';
--> statement-breakpoint
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS direction VARCHAR(20);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS attendance_events_capture_method_idx ON attendance_events (school_id, capture_method);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS attendance_records_capture_method_idx ON attendance_records (school_id, capture_method);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS attendance_events_source_reader_idx ON attendance_events (source_reader_id) WHERE source_reader_id IS NOT NULL;
