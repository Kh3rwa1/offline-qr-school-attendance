-- 0026_consent_retention.sql
-- Add guardian_consents, retention_policies, and anomaly index on rfid_scan_events

CREATE TABLE IF NOT EXISTS guardian_consents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id  uuid REFERENCES guardians(id) ON DELETE SET NULL,
  purpose      varchar(30) NOT NULL CHECK (purpose IN ('RFID_ATTENDANCE','ABSENCE_SMS','PHOTO')),
  granted      boolean NOT NULL,
  evidence_ref text,
  recorded_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  recorded_at  timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS guardian_consents_student_purpose_idx ON guardian_consents (school_id, student_id, purpose) WHERE withdrawn_at IS NULL;
--> statement-breakpoint
ALTER TABLE guardian_consents ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE guardian_consents FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY guardian_consents_tenant_isolation ON guardian_consents
    USING (
      school_id = current_setting('app.current_school_id', true)::uuid
      OR current_setting('app.is_system', true) = 'true'
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS retention_policies (
  school_id                 uuid PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  scan_events_days          int NOT NULL DEFAULT 180,
  attendance_years          int NOT NULL DEFAULT 5,
  notification_log_days     int NOT NULL DEFAULT 365,
  updated_by                uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at                timestamptz DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE retention_policies ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE retention_policies FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  CREATE POLICY retention_policies_tenant_isolation ON retention_policies
    USING (
      school_id = current_setting('app.current_school_id', true)::uuid
      OR current_setting('app.is_system', true) = 'true'
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS rfid_scan_events_digest_timestamp_idx ON rfid_scan_events (school_id, epc_digest, scan_timestamp);
