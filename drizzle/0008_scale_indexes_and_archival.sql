CREATE INDEX IF NOT EXISTS idx_school_memberships_user_status ON school_memberships(user_id, status, school_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_guardians_school_phone ON guardians(school_id, phone_number);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_enrollments_school_class_year ON enrollments(school_id, class_section_id, academic_year_id, status, student_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_attendance_session_roster_session ON attendance_session_roster(school_id, attendance_session_id, student_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_attendance_records_session_status ON attendance_records(school_id, attendance_session_id, status, student_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_attendance_events_session_time ON attendance_events(school_id, attendance_session_id, server_received_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_notification_jobs_status_next ON notification_jobs(school_id, status, next_attempt_at, queued_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_notification_attempts_job ON notification_attempts(job_id, attempted_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_audit_logs_school_created ON audit_logs(school_id, created_at, id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_import_jobs_school_status ON import_jobs(school_id, status, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_students_school_status ON students(school_id, status, id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_devices_school_user ON devices(school_id, user_id, status);
