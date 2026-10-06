import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import * as s from './schema';

// Core Schools & Academic
export type School = InferSelectModel<typeof s.schools>;
export type NewSchool = InferInsertModel<typeof s.schools>;

export type AcademicYear = InferSelectModel<typeof s.academicYears>;
export type NewAcademicYear = InferInsertModel<typeof s.academicYears>;

export type AcademicCalendarDay = InferSelectModel<typeof s.academicCalendarDays>;
export type NewAcademicCalendarDay = InferInsertModel<typeof s.academicCalendarDays>;

// Users & Auth
export type User = InferSelectModel<typeof s.users>;
export type NewUser = InferInsertModel<typeof s.users>;

export type SchoolMembership = InferSelectModel<typeof s.schoolMemberships>;
export type NewSchoolMembership = InferInsertModel<typeof s.schoolMemberships>;

export type TeacherProfile = InferSelectModel<typeof s.teacherProfiles>;
export type NewTeacherProfile = InferInsertModel<typeof s.teacherProfiles>;

export type AuthSession = InferSelectModel<typeof s.authSessions>;
export type NewAuthSession = InferInsertModel<typeof s.authSessions>;

// Classes & Enrollments
export type ClassSection = InferSelectModel<typeof s.classSections>;
export type NewClassSection = InferInsertModel<typeof s.classSections>;

export type TeacherAssignment = InferSelectModel<typeof s.teacherAssignments>;
export type NewTeacherAssignment = InferInsertModel<typeof s.teacherAssignments>;

export type Student = InferSelectModel<typeof s.students>;
export type NewStudent = InferInsertModel<typeof s.students>;

export type Guardian = InferSelectModel<typeof s.guardians>;
export type NewGuardian = InferInsertModel<typeof s.guardians>;

export type StudentGuardian = InferSelectModel<typeof s.studentGuardians>;
export type NewStudentGuardian = InferInsertModel<typeof s.studentGuardians>;

export type Enrollment = InferSelectModel<typeof s.enrollments>;
export type NewEnrollment = InferInsertModel<typeof s.enrollments>;

// Credentials & Devices
export type QrCredential = InferSelectModel<typeof s.qrCredentials>;
export type NewQrCredential = InferInsertModel<typeof s.qrCredentials>;

export type Device = InferSelectModel<typeof s.devices>;
export type NewDevice = InferInsertModel<typeof s.devices>;

// Attendance
export type AttendanceSession = InferSelectModel<typeof s.attendanceSessions>;
export type NewAttendanceSession = InferInsertModel<typeof s.attendanceSessions>;

export type AttendanceSessionRoster = InferSelectModel<typeof s.attendanceSessionRoster>;
export type NewAttendanceSessionRoster = InferInsertModel<typeof s.attendanceSessionRoster>;

export type AttendanceEvent = InferSelectModel<typeof s.attendanceEvents>;
export type NewAttendanceEvent = InferInsertModel<typeof s.attendanceEvents>;

export type AttendanceRecord = InferSelectModel<typeof s.attendanceRecords>;
export type NewAttendanceRecord = InferInsertModel<typeof s.attendanceRecords>;

export type AttendanceCorrection = InferSelectModel<typeof s.attendanceCorrections>;
export type NewAttendanceCorrection = InferInsertModel<typeof s.attendanceCorrections>;

// Notifications & Imports
export type NotificationTemplate = InferSelectModel<typeof s.notificationTemplates>;
export type NewNotificationTemplate = InferInsertModel<typeof s.notificationTemplates>;

export type SchoolSmsSetting = InferSelectModel<typeof s.schoolSmsSettings>;
export type NewSchoolSmsSetting = InferInsertModel<typeof s.schoolSmsSettings>;

export type NotificationJob = InferSelectModel<typeof s.notificationJobs>;
export type NewNotificationJob = InferInsertModel<typeof s.notificationJobs>;

export type NotificationAttempt = InferSelectModel<typeof s.notificationAttempts>;
export type NewNotificationAttempt = InferInsertModel<typeof s.notificationAttempts>;

export type ImportJob = InferSelectModel<typeof s.importJobs>;
export type NewImportJob = InferInsertModel<typeof s.importJobs>;

export type AuditLog = InferSelectModel<typeof s.auditLogs>;
export type NewAuditLog = InferInsertModel<typeof s.auditLogs>;

// RFID Subsystem
export type RfidKeyVersion = InferSelectModel<typeof s.rfidKeyVersions>;
export type NewRfidKeyVersion = InferInsertModel<typeof s.rfidKeyVersions>;

export type RfidCredential = InferSelectModel<typeof s.rfidCredentials>;
export type NewRfidCredential = InferInsertModel<typeof s.rfidCredentials>;

export type RfidReader = InferSelectModel<typeof s.rfidReaders>;
export type NewRfidReader = InferInsertModel<typeof s.rfidReaders>;

export type RfidScanEvent = InferSelectModel<typeof s.rfidScanEvents>;
export type NewRfidScanEvent = InferInsertModel<typeof s.rfidScanEvents>;

// Reports & Platform
export type DemoRequest = InferSelectModel<typeof s.demoRequests>;
export type NewDemoRequest = InferInsertModel<typeof s.demoRequests>;

export type ReportingProfile = InferSelectModel<typeof s.reportingProfiles>;
export type NewReportingProfile = InferInsertModel<typeof s.reportingProfiles>;

export type ReportApproval = InferSelectModel<typeof s.reportApprovals>;
export type NewReportApproval = InferInsertModel<typeof s.reportApprovals>;

export type PlatformSetting = InferSelectModel<typeof s.platformSettings>;
export type NewPlatformSetting = InferInsertModel<typeof s.platformSettings>;
