-- Migration 0015: Cursor Pagination & Query Plan Optimization Indexes

CREATE INDEX IF NOT EXISTS idx_audit_logs_school_cursor ON audit_logs(school_id, created_at DESC, id DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_audit_logs_platform_cursor ON audit_logs(created_at DESC, id DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_school_date_cursor ON attendance_sessions(school_id, session_date DESC, id DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_scan ON attendance_records(school_id, student_id, first_scanned_at DESC, id DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_attendance_records_session_status_student ON attendance_records(school_id, attendance_session_id, status, student_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_attendance_events_session_cursor ON attendance_events(school_id, attendance_session_id, server_received_at DESC, id DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_attendance_corrections_school_cursor ON attendance_corrections(school_id, corrected_at DESC, id DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_students_school_cursor ON students(school_id, created_at DESC, id DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_students_school_name_cursor ON students(school_id, name, id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_guardians_school_phone_cursor ON guardians(school_id, phone_number, id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_import_jobs_school_cursor ON import_jobs(school_id, created_at DESC, id DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_notification_jobs_school_queued_cursor ON notification_jobs(school_id, queued_at DESC, id DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_notification_jobs_student_history_cursor ON notification_jobs(school_id, student_id, queued_at DESC, id DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_rfid_scan_events_school_cursor ON rfid_scan_events(school_id, scan_timestamp DESC, id DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_rfid_credentials_school_cursor ON rfid_credentials(school_id, created_at DESC, id DESC);
