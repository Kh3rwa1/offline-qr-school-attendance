-- Migration 0009: RFID/NFC Types, Credentials, Readers, Scan Events, Key Versions
-- Adds all RFID entities with full RLS coverage matching the hardened pattern from 0007.

-- 1. Create enums safely
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfid_credential_status') THEN
    CREATE TYPE rfid_credential_status AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'REPLACED', 'EXPIRED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfid_reader_status') THEN
    CREATE TYPE rfid_reader_status AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'RETIRED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfid_security_mode') THEN
    CREATE TYPE rfid_security_mode AS ENUM ('SECURE', 'UID_LEGACY');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfid_adapter_type') THEN
    CREATE TYPE rfid_adapter_type AS ENUM ('GATEWAY', 'USB_HID', 'WEB_SERIAL', 'NETWORK');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'capture_method') THEN
    CREATE TYPE capture_method AS ENUM ('QR', 'RFID_SECURE', 'RFID_UID_LEGACY', 'MANUAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scan_decision') THEN
    CREATE TYPE scan_decision AS ENUM (
      'ACCEPTED', 'DUPLICATE', 'UNKNOWN_CARD', 'REVOKED_CARD', 'EXPIRED_CARD',
      'SUSPENDED_CARD', 'READER_REVOKED', 'WRONG_SCHOOL', 'NO_ACTIVE_SESSION',
      'ALREADY_PRESENT', 'REPLAY_REJECTED', 'CLOCK_SKEW', 'RATE_LIMITED',
      'DEPENDENCY_UNAVAILABLE'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'direction_mode') THEN
    CREATE TYPE direction_mode AS ENUM ('ENTRY', 'EXIT', 'BIDIRECTIONAL', 'NONE');
  END IF;
END $$;
--> statement-breakpoint

-- 2. RFID Key Versions table
CREATE TABLE IF NOT EXISTS rfid_key_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  key_version INTEGER NOT NULL,
  security_mode rfid_security_mode NOT NULL DEFAULT 'SECURE',
  algorithm VARCHAR(50) NOT NULL DEFAULT 'HMAC-SHA256',
  secret_reference VARCHAR(255) NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, key_version)
);
--> statement-breakpoint

-- 3. RFID Credentials table
CREATE TABLE IF NOT EXISTS rfid_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  credential_digest VARCHAR(255) NOT NULL,
  security_mode rfid_security_mode NOT NULL DEFAULT 'SECURE',
  key_version INTEGER NOT NULL DEFAULT 1,
  status rfid_credential_status NOT NULL DEFAULT 'PENDING',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  replaced_by_credential_id UUID REFERENCES rfid_credentials(id),
  created_by_user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS rfid_credentials_active_student_idx
  ON rfid_credentials (school_id, student_id)
  WHERE status = 'ACTIVE';
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS rfid_credentials_digest_school_idx
  ON rfid_credentials (school_id, credential_digest)
  WHERE status IN ('PENDING', 'ACTIVE', 'SUSPENDED');
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS rfid_credentials_lookup_idx
  ON rfid_credentials (school_id, credential_digest, status);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS rfid_credentials_student_idx
  ON rfid_credentials (school_id, student_id, created_at);
--> statement-breakpoint

-- 4. RFID Readers table
CREATE TABLE IF NOT EXISTS rfid_readers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  direction_mode direction_mode NOT NULL DEFAULT 'NONE',
  reader_model VARCHAR(100),
  firmware_version VARCHAR(100),
  adapter_type rfid_adapter_type NOT NULL DEFAULT 'GATEWAY',
  security_capability VARCHAR(100) NOT NULL DEFAULT 'UID_ONLY',
  certificate_fingerprint VARCHAR(255),
  status rfid_reader_status NOT NULL DEFAULT 'PENDING',
  last_seen_at TIMESTAMPTZ,
  key_version INTEGER NOT NULL DEFAULT 1,
  clock_drift_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS rfid_readers_school_device_idx
  ON rfid_readers (school_id, device_id);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS rfid_readers_device_global_idx
  ON rfid_readers (device_id)
  WHERE status IN ('PENDING', 'ACTIVE', 'SUSPENDED');
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS rfid_readers_status_idx
  ON rfid_readers (school_id, status);
--> statement-breakpoint

-- 5. RFID Scan Events table
CREATE TABLE IF NOT EXISTS rfid_scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  reader_id UUID NOT NULL REFERENCES rfid_readers(id),
  credential_id UUID REFERENCES rfid_credentials(id),
  attendance_session_id UUID REFERENCES attendance_sessions(id),
  client_event_id VARCHAR(255) NOT NULL,
  sequence_number BIGINT,
  scan_timestamp TIMESTAMPTZ NOT NULL,
  server_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  direction direction_mode,
  decision scan_decision NOT NULL,
  rejection_code VARCHAR(100),
  capture_method capture_method NOT NULL DEFAULT 'RFID_SECURE',
  security_mode rfid_security_mode NOT NULL DEFAULT 'SECURE',
  processing_latency_ms INTEGER,
  is_offline BOOLEAN NOT NULL DEFAULT false,
  nonce VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS rfid_scan_events_client_event_idx
  ON rfid_scan_events (school_id, client_event_id);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS rfid_scan_events_reader_idx
  ON rfid_scan_events (school_id, reader_id, scan_timestamp);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS rfid_scan_events_decision_idx
  ON rfid_scan_events (school_id, decision, scan_timestamp);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS rfid_scan_events_session_idx
  ON rfid_scan_events (school_id, attendance_session_id, scan_timestamp);
--> statement-breakpoint

-- 6. Apply RLS to all new RFID tables
DO $$
DECLARE
  table_name text;
  tenant_policy text := $policy$
    USING (
      (
        pg_has_role(current_user, 'attendance_system_rls', 'member')
        AND current_setting('app.is_system', true) = 'true'
      )
      OR school_id = CASE
        WHEN current_setting('app.current_school_id', true)
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN current_setting('app.current_school_id', true)::uuid
        ELSE NULL
      END
    )
    WITH CHECK (
      (
        pg_has_role(current_user, 'attendance_system_rls', 'member')
        AND current_setting('app.is_system', true) = 'true'
      )
      OR school_id = CASE
        WHEN current_setting('app.current_school_id', true)
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        THEN current_setting('app.current_school_id', true)::uuid
        ELSE NULL
      END
    )
  $policy$;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'rfid_key_versions', 'rfid_credentials', 'rfid_readers', 'rfid_scan_events'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', table_name);
    EXECUTE format('CREATE POLICY tenant_isolation_policy ON %I %s', table_name, tenant_policy);
  END LOOP;

  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'attendance_app') THEN
    REVOKE attendance_system_rls FROM attendance_app;
  END IF;
END $$;
