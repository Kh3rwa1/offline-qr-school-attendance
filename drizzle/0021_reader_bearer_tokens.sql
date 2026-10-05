ALTER TABLE rfid_readers
  ADD COLUMN IF NOT EXISTS bearer_token_hash text,
  ADD COLUMN IF NOT EXISTS bearer_token_hint varchar(8),
  ADD COLUMN IF NOT EXISTS bearer_token_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS bearer_token_last_used_at timestamptz;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS rfid_readers_bearer_token_hash_uq ON rfid_readers (bearer_token_hash) WHERE bearer_token_hash IS NOT NULL;
