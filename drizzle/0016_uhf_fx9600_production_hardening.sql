-- 0016_uhf_fx9600_production_hardening.sql
-- Forward-only schema migration for Zebra FX9600 UHF RFID production certification

-- 1. UHF Credential Enhancements
ALTER TABLE "rfid_credentials" ADD COLUMN IF NOT EXISTS "credential_type" VARCHAR(50) DEFAULT 'UHF_EPC_GEN2' NOT NULL;
--> statement-breakpoint
ALTER TABLE "rfid_credentials" ADD COLUMN IF NOT EXISTS "epc_last_four" VARCHAR(8);
--> statement-breakpoint
ALTER TABLE "rfid_credentials" ADD COLUMN IF NOT EXISTS "tid_digest" VARCHAR(255);
--> statement-breakpoint

-- 2. Reader Routing & Antenna Config
ALTER TABLE "rfid_readers" ADD COLUMN IF NOT EXISTS "assigned_class_section_id" UUID REFERENCES "class_sections"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "rfid_readers" ADD COLUMN IF NOT EXISTS "antenna_config" JSONB;
--> statement-breakpoint
ALTER TABLE "rfid_readers" ADD COLUMN IF NOT EXISTS "bearer_token_digest" VARCHAR(255);
--> statement-breakpoint

-- 3. Scan Event Idempotency & Telemetry
ALTER TABLE "rfid_scan_events" ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(128);
--> statement-breakpoint
ALTER TABLE "rfid_scan_events" ADD COLUMN IF NOT EXISTS "epc_digest" VARCHAR(255);
--> statement-breakpoint
ALTER TABLE "rfid_scan_events" ADD COLUMN IF NOT EXISTS "epc_last_four" VARCHAR(8);
--> statement-breakpoint
ALTER TABLE "rfid_scan_events" ADD COLUMN IF NOT EXISTS "tid_digest" VARCHAR(255);
--> statement-breakpoint
ALTER TABLE "rfid_scan_events" ADD COLUMN IF NOT EXISTS "antenna_port" INTEGER;
--> statement-breakpoint
ALTER TABLE "rfid_scan_events" ADD COLUMN IF NOT EXISTS "peak_rssi" INTEGER;
--> statement-breakpoint
ALTER TABLE "rfid_scan_events" ADD COLUMN IF NOT EXISTS "read_count" INTEGER DEFAULT 1;
--> statement-breakpoint
ALTER TABLE "rfid_scan_events" ADD COLUMN IF NOT EXISTS "vendor_event_id" VARCHAR(255);
--> statement-breakpoint

-- 4. High-Performance Indexes for Concurrent Ingest & Debounce
CREATE UNIQUE INDEX IF NOT EXISTS "rfid_scan_events_idempotency_idx" 
  ON "rfid_scan_events" ("school_id", "idempotency_key") 
  WHERE "idempotency_key" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfid_scan_events_epc_digest_idx" 
  ON "rfid_scan_events" ("school_id", "epc_digest", "scan_timestamp");
