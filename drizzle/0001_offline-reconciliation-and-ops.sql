ALTER TABLE "attendance_sessions" ADD COLUMN "client_session_id" uuid;--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD COLUMN "claimed_by" varchar(255);--> statement-breakpoint
ALTER TABLE "notification_jobs" ADD COLUMN "next_attempt_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_sessions_client_session_unique_idx" ON "attendance_sessions" USING btree ("school_id","client_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "qr_credentials_active_student_unique_idx" ON "qr_credentials" USING btree ("school_id","student_id") WHERE "qr_credentials"."status" = 'ACTIVE';