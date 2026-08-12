import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  integer,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 1. Schools (Tenants)
export const schools = pgTable('schools', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  udiseCode: varchar('udise_code', { length: 50 }).unique(),
  district: varchar('district', { length: 100 }).notNull(),
  block: varchar('block', { length: 100 }),
  preferredLanguage: varchar('preferred_language', { length: 10 }).notNull().default('bn'), // 'bn' | 'en'
  timezone: varchar('timezone', { length: 50 }).notNull().default('Asia/Kolkata'),
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'), // 'ACTIVE' | 'SUSPENDED'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 2. Academic Years
export const academicYears = pgTable(
  'academic_years',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 50 }).notNull(), // e.g. "2026"
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    isCurrent: boolean('is_current').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    schoolNameUnique: uniqueIndex('academic_years_school_name_idx').on(table.schoolId, table.name),
  })
);

// 3. Users (System Users)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 20 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(), // Argon2id
  status: varchar('status', { length: 20 }).notNull().default('ACTIVE'), // 'ACTIVE' | 'SUSPENDED'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 4. School Memberships (Links User to School with Role)
export const schoolMemberships = pgTable(
  'school_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 30 }).notNull(), // 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'REPORT_VIEWER'
    status: varchar('status', { length: 20 }).notNull().default('ACTIVE'), // 'ACTIVE' | 'SUSPENDED'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    schoolUserUnique: uniqueIndex('school_memberships_school_user_idx').on(table.schoolId, table.userId),
  })
);

// 5. Teacher Profiles
export const teacherProfiles = pgTable(
  'teacher_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    employeeId: varchar('employee_id', { length: 50 }),
    designation: varchar('designation', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    schoolUserUnique: uniqueIndex('teacher_profiles_school_user_idx').on(table.schoolId, table.userId),
  })
);

// 6. Devices (Authorized Teacher Phones)
export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    deviceIdentifier: varchar('device_identifier', { length: 255 }).notNull(),
    deviceModel: varchar('device_model', { length: 100 }),
    status: varchar('status', { length: 20 }).notNull().default('AUTHORIZED'), // 'AUTHORIZED' | 'REVOKED'
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    schoolDeviceUnique: uniqueIndex('devices_school_device_idx').on(table.schoolId, table.deviceIdentifier),
  })
);

// 7. Auth Sessions
export const authSessions = pgTable('auth_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 8. Class Sections
export const classSections = pgTable(
  'class_sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
    academicYearId: uuid('academic_year_id').notNull().references(() => academicYears.id, { onDelete: 'cascade' }),
    className: varchar('class_name', { length: 50 }).notNull(),
    sectionName: varchar('section_name', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    classSecUnique: uniqueIndex('class_sections_unique_idx').on(
      table.schoolId,
      table.academicYearId,
      table.className,
      table.sectionName
    ),
  })
);

// 9. Teacher Assignments
export const teacherAssignments = pgTable(
  'teacher_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
    teacherId: uuid('teacher_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    classSectionId: uuid('class_section_id').notNull().references(() => classSections.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    assignmentUnique: uniqueIndex('teacher_assignments_unique_idx').on(
      table.schoolId,
      table.teacherId,
      table.classSectionId
    ),
  })
);

// 10. Students
export const students = pgTable(
  'students',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
    studentCode: varchar('student_code', { length: 50 }).notNull(),
    banglarShikshaId: varchar('banglar_shiksha_id', { length: 100 }),
    name: varchar('name', { length: 255 }).notNull(),
    nameBn: varchar('name_bn', { length: 255 }),
    dateOfBirth: date('date_of_birth'),
    gender: varchar('gender', { length: 20 }),
    photoUrl: text('photo_url'),
    status: varchar('status', { length: 20 }).notNull().default('ACTIVE'), // 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    schoolStudentCodeUnique: uniqueIndex('students_school_code_idx').on(table.schoolId, table.studentCode),
  })
);

// 11. Guardians
export const guardians = pgTable('guardians', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 20 }).notNull(),
  relationship: varchar('relationship', { length: 50 }).notNull().default('PARENT'),
  smsOptOut: boolean('sms_opt_out').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 12. Student Guardians Junction
export const studentGuardians = pgTable(
  'student_guardians',
  {
    studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
    guardianId: uuid('guardian_id').notNull().references(() => guardians.id, { onDelete: 'cascade' }),
    isPrimary: boolean('is_primary').notNull().default(true),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.studentId, table.guardianId] }),
  })
);

// 13. Enrollments
export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
    classSectionId: uuid('class_section_id').notNull().references(() => classSections.id, { onDelete: 'cascade' }),
    academicYearId: uuid('academic_year_id').notNull().references(() => academicYears.id, { onDelete: 'cascade' }),
    rollNumber: integer('roll_number').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    status: varchar('status', { length: 20 }).notNull().default('ACTIVE'), // 'ACTIVE' | 'COMPLETED' | 'WITHDRAWN'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    rollUnique: uniqueIndex('enrollments_roll_unique_idx').on(
      table.schoolId,
      table.classSectionId,
      table.rollNumber,
      table.academicYearId
    ),
  })
);

// 14. QR Credentials
export const qrCredentials = pgTable(
  'qr_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
    tokenDigest: varchar('token_digest', { length: 255 }).notNull(),
    version: integer('version').notNull().default(1),
    status: varchar('status', { length: 20 }).notNull().default('ACTIVE'), // 'ACTIVE' | 'REVOKED'
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => ({
    digestUnique: uniqueIndex('qr_credentials_digest_unique_idx').on(table.schoolId, table.tokenDigest),
    activeStudentUnique: uniqueIndex('qr_credentials_active_student_unique_idx')
      .on(table.schoolId, table.studentId)
      .where(sql`${table.status} = 'ACTIVE'`),
  })
);

// 15. Attendance Sessions
export const attendanceSessions = pgTable(
  'attendance_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
    classSectionId: uuid('class_section_id').notNull().references(() => classSections.id, { onDelete: 'cascade' }),
    teacherId: uuid('teacher_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    clientSessionId: uuid('client_session_id'),
    sessionDate: date('session_date').notNull(),
    sessionType: varchar('session_type', { length: 20 }).notNull().default('DAILY'),
    status: varchar('status', { length: 20 }).notNull().default('DRAFT'), // 'DRAFT' | 'OPEN' | 'REVIEW' | 'FINALIZED' | 'REOPENED'
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    finalizedBy: uuid('finalized_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionUnique: uniqueIndex('attendance_sessions_unique_idx').on(
      table.schoolId,
      table.classSectionId,
      table.sessionDate,
      table.sessionType
    ),
    clientSessionUnique: uniqueIndex('attendance_sessions_client_session_unique_idx').on(
      table.schoolId,
      table.clientSessionId
    ),
    schoolDateIdx: index('attendance_sessions_school_date_idx').on(table.schoolId, table.sessionDate),
  })
);

// 16. Attendance Session Roster Snapshot
export const attendanceSessionRoster = pgTable(
  'attendance_session_roster',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
    attendanceSessionId: uuid('attendance_session_id')
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
    enrollmentId: uuid('enrollment_id').notNull().references(() => enrollments.id, { onDelete: 'cascade' }),
    rollNumberSnapshot: integer('roll_number_snapshot').notNull(),
    studentNameSnapshot: varchar('student_name_snapshot', { length: 255 }).notNull(),
    isExpected: boolean('is_expected').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    rosterSessionUnique: uniqueIndex('roster_session_student_idx').on(table.attendanceSessionId, table.studentId),
  })
);

// 17. Attendance Events (Append-Only Log)
export const attendanceEvents = pgTable(
  'attendance_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
    clientEventId: varchar('client_event_id', { length: 255 }).notNull().unique(),
    attendanceSessionId: uuid('attendance_session_id')
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 30 }).notNull(),
    statusValue: varchar('status_value', { length: 20 }).notNull(),
    clientTimestamp: timestamp('client_timestamp', { withTimezone: true }).notNull(),
    serverReceivedAt: timestamp('server_received_at', { withTimezone: true }).notNull().defaultNow(),
    deviceId: uuid('device_id').references(() => devices.id),
    actorId: uuid('actor_id').notNull().references(() => users.id),
    metadata: jsonb('metadata'),
  },
  (table) => ({
    schoolSessionIdx: index('attendance_events_school_session_idx').on(table.schoolId, table.attendanceSessionId),
  })
);

// 18. Attendance Records (Projected State for Reporting)
export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
    attendanceSessionId: uuid('attendance_session_id')
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull(),
    firstScannedAt: timestamp('first_scanned_at', { withTimezone: true }),
    lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).notNull().defaultNow(),
    hasConflict: boolean('has_conflict').notNull().default(false),
  },
  (table) => ({
    recordUnique: uniqueIndex('attendance_records_unique_idx').on(
      table.schoolId,
      table.attendanceSessionId,
      table.studentId
    ),
    schoolStatusIdx: index('attendance_records_school_status_idx').on(table.schoolId, table.status),
  })
);

// 19. Attendance Corrections Audit Log
export const attendanceCorrections = pgTable('attendance_corrections', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
  attendanceRecordId: uuid('attendance_record_id')
    .notNull()
    .references(() => attendanceRecords.id, { onDelete: 'cascade' }),
  previousStatus: varchar('previous_status', { length: 20 }).notNull(),
  newStatus: varchar('new_status', { length: 20 }).notNull(),
  reason: text('reason').notNull(),
  correctedBy: uuid('corrected_by').notNull().references(() => users.id),
  correctedAt: timestamp('corrected_at', { withTimezone: true }).notNull().defaultNow(),
});

// 20. Notification Templates
export const notificationTemplates = pgTable('notification_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
  templateCode: varchar('template_code', { length: 50 }).notNull(),
  language: varchar('language', { length: 10 }).notNull(),
  content: text('content').notNull(),
  dltTemplateId: varchar('dlt_template_id', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 21. School SMS Settings
export const schoolSmsSettings = pgTable('school_sms_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull().unique().references(() => schools.id, { onDelete: 'cascade' }),
  smsEnabled: boolean('sms_enabled').notNull().default(true),
  dltPrincipalEntityId: varchar('dlt_principal_entity_id', { length: 100 }),
  dltHeader: varchar('dlt_header', { length: 20 }),
  allowlistEnabled: boolean('allowlist_enabled').notNull().default(false),
  allowlist: jsonb('allowlist').$type<string[]>().default([]),
  segmentBalance: integer('segment_balance'),
  maxSegmentsPerMessage: integer('max_segments_per_message').notNull().default(4),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 22. Notification Jobs
export const notificationJobs = pgTable(
  'notification_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
    attendanceSessionId: uuid('attendance_session_id')
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
    recipientPhone: varchar('recipient_phone', { length: 20 }).notNull(),
    language: varchar('language', { length: 10 }).notNull().default('bn'),
    messageBody: text('message_body').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('QUEUED'), // 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'PERMANENT_FAILURE' | 'CANCELLED'
    notificationType: varchar('notification_type', { length: 50 }).notNull().default('ABSENCE'),
    finalizedAttendanceVersion: varchar('finalized_attendance_version', { length: 100 }).notNull().default('v1'),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    claimedBy: varchar('claimed_by', { length: 255 }),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    providerMessageId: varchar('provider_message_id', { length: 255 }),
    attemptCount: integer('attempt_count').notNull().default(0),
    failureReason: text('failure_reason'),
    queuedAt: timestamp('queued_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  },
  (table) => ({
    jobDeduplicationUnique: uniqueIndex('notification_jobs_dedup_idx').on(
      table.schoolId,
      table.studentId,
      table.attendanceSessionId,
      table.notificationType,
      table.finalizedAttendanceVersion
    ),
    workerClaimIdx: index('notification_jobs_worker_claim_idx').on(
      table.status,
      table.attemptCount,
      table.nextAttemptAt
    ),
  })
);

// 23. Notification Attempts
export const notificationAttempts = pgTable('notification_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => notificationJobs.id, { onDelete: 'cascade' }),
  attemptNumber: integer('attempt_number').notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  responsePayload: jsonb('response_payload'),
  errorMessage: text('error_message'),
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
});

// 23. Import Jobs
export const importJobs = pgTable('import_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  schoolId: uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('PENDING'), // 'PENDING' | 'VALIDATED' | 'COMPLETED' | 'FAILED'
  totalRows: integer('total_rows').notNull().default(0),
  successfulRows: integer('successful_rows').notNull().default(0),
  failedRows: integer('failed_rows').notNull().default(0),
  errorSummary: jsonb('error_summary'),
  stagedData: jsonb('staged_data'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// 24. Audit Logs
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    resourceType: varchar('resource_type', { length: 100 }).notNull(),
    resourceId: varchar('resource_id', { length: 255 }),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    schoolCreatedIdx: index('audit_logs_school_created_idx').on(table.schoolId, table.createdAt),
  })
);
