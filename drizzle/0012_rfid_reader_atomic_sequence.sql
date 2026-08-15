ALTER TABLE "rfid_readers" ADD COLUMN IF NOT EXISTS "last_sequence_number" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rfid_scan_events_reader_seq_unique" ON "rfid_scan_events" ("school_id", "reader_id", "sequence_number");
