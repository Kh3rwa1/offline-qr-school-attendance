ALTER TABLE "school_sms_settings" ADD COLUMN "segment_balance" integer;--> statement-breakpoint
ALTER TABLE "school_sms_settings" ADD COLUMN "max_segments_per_message" integer DEFAULT 4 NOT NULL;