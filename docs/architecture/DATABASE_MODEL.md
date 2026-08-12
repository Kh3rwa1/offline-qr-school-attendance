# Database Model & Schema Specification

## 1. Multi-Tenancy & Security Rules
- **Primary Tenant Key:** `school_id UUID NOT NULL` present on every tenant-scoped table.
- **Foreign Keys:** Composite foreign keys referencing `(id, school_id)` where appropriate to ensure cross-tenant references are structurally impossible.
- **Row-Level Security (RLS):** RLS enabled on all tenant tables with policies checking `current_setting('app.current_school_id')`.

---

## 2. Entity Relationship & Table Specifications

### 2.1 Core System & Tenant Tables

```sql
-- Schools (Tenants)
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  udise_code VARCHAR(50) UNIQUE,
  district VARCHAR(100) NOT NULL,
  block VARCHAR(100),
  preferred_language VARCHAR(10) NOT NULL DEFAULT 'bn', -- 'bn' or 'en'
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'SUSPENDED'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Academic Years
CREATE TABLE academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL, -- e.g. "2026", "2026-2027"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, name)
);

-- Users (System Users)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL, -- Argon2id
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'SUSPENDED'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- School Memberships (Links User to School with Role)
CREATE TABLE school_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL, -- 'SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'REPORT_VIEWER'
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'SUSPENDED'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, user_id)
);

-- Teacher Profiles & Assignments
CREATE TABLE teacher_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_id VARCHAR(50),
  designation VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, user_id)
);

-- Devices (Authorized Teacher Phones)
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_identifier VARCHAR(255) NOT NULL, -- Fingerprint / Unique Token
  device_model VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'AUTHORIZED', -- 'AUTHORIZED', 'REVOKED'
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, device_identifier)
);

-- Auth Sessions
CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.2 Students, Enrollments & QR Credentials

```sql
-- Class Sections
CREATE TABLE class_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  class_name VARCHAR(50) NOT NULL, -- e.g. "Class VIII"
  section_name VARCHAR(50) NOT NULL, -- e.g. "A"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, academic_year_id, class_name, section_name)
);

-- Teacher Class Assignments
CREATE TABLE teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_section_id UUID NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, teacher_id, class_section_id)
);

-- Students
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_code VARCHAR(50) NOT NULL, -- School-assigned ID
  banglar_shiksha_id VARCHAR(100), -- Govt West Bengal Education ID
  name VARCHAR(255) NOT NULL,
  name_bn VARCHAR(255), -- Bengali name
  date_of_birth DATE,
  gender VARCHAR(20), -- 'MALE', 'FEMALE', 'OTHER'
  photo_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE', 'TRANSFERRED'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, student_code)
);

-- Guardians
CREATE TABLE guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL, -- Used for SMS alerts
  relationship VARCHAR(50) NOT NULL DEFAULT 'PARENT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Student Guardians Junction
CREATE TABLE student_guardians (
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (student_id, guardian_id)
);

-- Enrollments (Preserves Historical Class Membership)
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_section_id UUID NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  roll_number INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'COMPLETED', 'WITHDRAWN'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, class_section_id, roll_number, academic_year_id)
);

-- QR Credentials
CREATE TABLE qr_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  token_digest VARCHAR(255) NOT NULL, -- SHA-256 hash of opaque secret
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'REVOKED'
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE(school_id, token_digest)
);
```

### 2.3 Attendance Session & Event Sourcing Tables

```sql
-- Attendance Sessions
CREATE TABLE attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_section_id UUID NOT NULL REFERENCES class_sections(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  session_type VARCHAR(20) NOT NULL DEFAULT 'DAILY', -- 'DAILY'
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'OPEN', 'REVIEW', 'FINALIZED', 'REOPENED'
  finalized_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, class_section_id, session_date, session_type)
);

-- Attendance Session Roster Snapshot
CREATE TABLE attendance_session_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  attendance_session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  roll_number_snapshot INT NOT NULL,
  student_name_snapshot VARCHAR(255) NOT NULL,
  is_expected BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(attendance_session_id, student_id)
);

-- Attendance Events (Append-Only Log)
CREATE TABLE attendance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  client_event_id VARCHAR(255) UNIQUE NOT NULL, -- Collision-resistant ID from client
  attendance_session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL, -- 'SESSION_STARTED', 'QR_SCANNED', 'MANUALLY_PRESENT', 'MARKED_LATE', 'MARKED_LEAVE', 'MARKED_ABSENT', 'STATUS_CORRECTED', 'SESSION_FINALIZED', 'SESSION_REOPENED'
  status_value VARCHAR(20) NOT NULL, -- 'UNMARKED', 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED', 'LEAVE'
  client_timestamp TIMESTAMPTZ NOT NULL,
  server_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_id UUID REFERENCES devices(id),
  actor_id UUID NOT NULL REFERENCES users(id),
  metadata JSONB
);

-- Attendance Records (Projected State for Reporting)
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  attendance_session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL, -- 'UNMARKED', 'PRESENT', 'LATE', 'ABSENT', 'EXCUSED', 'LEAVE'
  first_scanned_at TIMESTAMPTZ,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  has_conflict BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(school_id, attendance_session_id, student_id)
);

-- Attendance Corrections Audit Log
CREATE TABLE attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  attendance_record_id UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  previous_status VARCHAR(20) NOT NULL,
  new_status VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  corrected_by UUID NOT NULL REFERENCES users(id),
  corrected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.4 Notifications, Imports, Exports & Audit

```sql
-- Notification Templates
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE, -- NULL for default system templates
  template_code VARCHAR(50) NOT NULL, -- 'ABSENT_ALERT_BN', 'ABSENT_ALERT_EN'
  language VARCHAR(10) NOT NULL, -- 'bn', 'en'
  content TEXT NOT NULL,
  dlt_template_id VARCHAR(100), -- Regulatory ID in India
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification Jobs
CREATE TABLE notification_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  attendance_session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  recipient_phone VARCHAR(20) NOT NULL,
  language VARCHAR(10) NOT NULL DEFAULT 'bn',
  message_body TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'QUEUED', -- 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED'
  provider_message_id VARCHAR(255),
  attempt_count INT NOT NULL DEFAULT 0,
  failure_reason TEXT,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  UNIQUE(school_id, attendance_session_id, student_id) -- Deduplication constraint
);

-- Notification Attempts
CREATE TABLE notification_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES notification_jobs(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  response_payload JSONB,
  error_message TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Import Jobs
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'VALIDATED', 'COMPLETED', 'FAILED'
  total_rows INT NOT NULL DEFAULT 0,
  successful_rows INT NOT NULL DEFAULT 0,
  failed_rows INT NOT NULL DEFAULT 0,
  error_summary JSONB,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
