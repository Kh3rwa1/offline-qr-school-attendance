ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
--> statement-breakpoint
UPDATE auth_sessions SET last_accessed_at = created_at;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS auth_sessions_last_accessed_at_idx ON auth_sessions (last_accessed_at);
