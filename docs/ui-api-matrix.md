# UI-to-API Contract & Action Matrix

This matrix documents every route, component, visible action, permission, API endpoint, schema, database effect, audit action, and status classification across the entire platform.

---

## Status Classification Taxonomy
- `WORKING`: Verified end-to-end through real UI, API, DB transaction, and automated integration/E2E test.
- `PARTIAL`: API or UI exists but lacks error handling, audit logging, or full lifecycle coverage.
- `BROKEN_CONTRACT`: UI request payload or response parser mismatches the backend Zod schema.
- `PLACEHOLDER`: UI button or section renders static/simulated text or alerts without calling an API.
- `MOCKED`: Relies on local in-memory state or hard-coded mock arrays instead of real server state.
- `MISSING_API`: UI requires a backend endpoint that does not exist.
- `MISSING_UI`: Backend endpoint exists but has no accessible UI route or control.
- `UNAUTHORIZED`: Permission mismatch between frontend role check and backend route middleware.
- `UNTESTED`: Feature exists but lacks automated integration or Playwright journey tests.

---

## 1. Authentication & Platform Administration

| UI Route | Page / Component | Visible Action | Required Permission | API Method / Path | Request Schema | Response Schema | DB Effect | Audit Action | Tests | Current Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/login` | `LoginPage.tsx` | Submit Credentials | *Public* | `POST /api/v1/auth/login` | `{ phoneNumber, password, schoolId? }` | `{ user, memberships, csrfToken }` | `auth_sessions` insert | `USER_LOGIN` | `tests/auth.test.ts` | `WORKING` |
| `/login` | `LoginPage.tsx` | Demo Role Pills | *Public (Dev Only)* | *Local Form Fill* | N/A | N/A | None | None | E2E | `WORKING` (Gated to dev environment) |
| All | `SchoolSwitcher.tsx` | Switch School | `school.read` | `POST /api/v1/auth/switch-school` | `{ schoolId }` | `{ success: true, activeSchool }` | `auth_sessions` update | `SCHOOL_SWITCHED` | `tests/auth.test.ts` | `WORKING` |
| All | `Sidebar.tsx` | Logout Session | `auth.authenticated` | `POST /api/v1/auth/logout` | None | `{ success: true }` | `auth_sessions` delete | `USER_LOGOUT` | `tests/auth.test.ts` | `WORKING` |
| `/app/super-admin` | `SuperAdminDashboard.tsx` | View District Turnout | `platform.schools.read` | `GET /api/v1/dashboard/super-admin/summary` | None | `{ schools, overallAttendanceRate, ... }` | Select queries | `PLATFORM_SUMMARY_VIEWED` | `tests/dashboard.test.ts` | `WORKING` |
| `/app/super-admin/schools` | `SchoolsOverview.tsx` | Register New School | `platform.schools.manage` | `POST /api/v1/schools` | `{ name, udiseCode, district, block, admin, academicYear }` | `{ success: true, data: { school, adminUser } }` | `schools`, `users`, `school_memberships`, `academic_years` inserts | `SCHOOL_PROVISIONED` | `tests/schoolProvisioning.test.ts` | `WORKING` |
| `/app/super-admin/schools` | `SchoolsOverview.tsx` | Suspend / Archive School | `platform.schools.manage` | `POST /api/v1/schools/:schoolId/status` | `{ status: 'SUSPENDED' \| 'ARCHIVED', reason }` | `{ success: true, school }` | `schools.status` update | `SCHOOL_STATUS_CHANGED` | `tests/schoolProvisioning.test.ts` | `WORKING` |
| `/app/super-admin/security` | `SecurityOverview.tsx` | Inspect Security Governance | `platform.security.read` | `GET /api/v1/system/health` | None | `{ status, db, redis, kms, workers }` | System telemetry select | None | `tests/health.test.ts` | `WORKING` |
| `/app/super-admin/audit` | `AuditOverview.tsx` | View Platform Audit Log | `platform.audit.read` | `GET /api/v1/audit/platform` | Query: `{ page, limit, startDate, endDate, action, actorId }` | `{ logs, totalCount, page, limit }` | `audit_logs` select | None | `tests/audit.test.ts` | `WORKING` |

---

## 2. School Administration (Headmaster Console)

| UI Route | Page / Component | Visible Action | Required Permission | API Method / Path | Request Schema | Response Schema | DB Effect | Audit Action | Tests | Current Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/app/school-admin` | `SchoolAdminDashboard.tsx` | View Today's Assembly & MDM Roll | `attendance.sessions.read` | `GET /api/v1/dashboard/school-admin/summary` | None | `{ totalStudents, presentToday, mdmCount, sessions }` | Select aggregation | None | `tests/dashboard.test.ts` | `WORKING` |
| `/app/school-admin/users` | `UserManagement.tsx` | List Faculty & Staff | `school.users.read` | `GET /api/v1/schools/:schoolId/members` | Query: `{ page, limit, role, search }` | `{ members: [...] }` | `school_memberships` select join `users` | None | `tests/schoolAdmin.test.ts` | `WORKING` |
| `/app/school-admin/users` | `UserManagement.tsx` | Invite / Create Staff | `school.users.manage` | `POST /api/v1/schools/:schoolId/members` | `{ fullName, phoneNumber, role, designation? }` | `{ success: true, member }` | `users`, `school_memberships` insert | `MEMBER_INVITED` | `tests/schoolAdmin.test.ts` | `WORKING` |
| `/app/school-admin/users` | `UserManagement.tsx` | Suspend Staff Member | `school.users.manage` | `POST /api/v1/schools/:schoolId/members/:userId/suspend` | `{ reason }` | `{ success: true }` | `school_memberships.status` update | `MEMBER_SUSPENDED` | `tests/schoolAdmin.test.ts` | `WORKING` |
| `/app/school-admin/academics` | `AcademicManagement.tsx` | List Academic Years & Sections | `school.academics.read` | `GET /api/v1/schools/:schoolId/academics/classes` | None | `{ classes: [...] }` | `class_sections` select | None | `tests/academics.test.ts` | `WORKING` |
| `/app/school-admin/academics` | `AcademicManagement.tsx` | Create Academic Year | `school.academics.manage` | `POST /api/v1/schools/:schoolId/academics/years` | `{ name, startDate, endDate, isCurrent }` | `{ success: true, academicYear }` | `academic_years` insert | `ACADEMIC_YEAR_CREATED` | `tests/academics.test.ts` | `WORKING` |
| `/app/school-admin/academics` | `AcademicManagement.tsx` | Create Class Section | `school.academics.manage` | `POST /api/v1/schools/:schoolId/academics/classes` | `{ academicYearId, className, sectionName, stream? }` | `{ success: true, classSection }` | `class_sections` insert | `CLASS_SECTION_CREATED` | `tests/academics.test.ts` | `WORKING` |
| `/app/school-admin/academics` | `AcademicManagement.tsx` | Assign Teacher to Class | `school.academics.manage` | `POST /api/v1/schools/:schoolId/academics/classes/:classId/teachers` | `{ teacherId }` | `{ success: true }` | `teacher_class_assignments` insert | `TEACHER_ASSIGNED` | `tests/academics.test.ts` | `WORKING` |
| `/app/school-admin/students` | `StudentRoster.tsx` | View / Import Student Roster (XLSX) | `school.users.manage` | `POST /api/v1/schools/:schoolId/students/import-preview` | `multipart/form-data` | `{ jobId, totalRows, validRows, invalidRows, preview }` | `import_jobs` insert | `STUDENTS_IMPORT_STAGED` | `tests/import.test.ts` | `WORKING` |
| `/app/school-admin/attendance` | `AttendanceOperations.tsx` | Session Oversight & Administrative Override | `attendance.manualCorrection` | `POST /api/v1/schools/:schoolId/attendance/sessions/:sessionId/override` | `{ studentId, status, reason }` | `{ success: true, record }` | `attendance_records` update | `ATTENDANCE_OVERRIDDEN` | `tests/attendance.test.ts` | `WORKING` |
| `/app/school-admin/notifications` | `NotificationOperations.tsx` | Guardian SMS Queue & Retry | `notifications.read`, `notifications.retry` | `GET /api/v1/schools/:schoolId/notifications/queue` | None | `{ summary, queue: [...], workerHeartbeat }` | `notification_queue` select | `NOTIFICATION_RETRIED` | `tests/notifications.test.ts` | `WORKING` |

---

## 3. Teacher Classroom Console

| UI Route | Page / Component | Visible Action | Required Permission | API Method / Path | Request Schema | Response Schema | DB Effect | Audit Action | Tests | Current Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/app/teacher` | `TeacherDashboard.tsx` | Scan Optical QR / USB Wedge | `attendance.sessions.create` | `Local IndexedDB Buffer` | `{ qrPayload, studentId, timestamp }` | Local Dexie Record | IndexedDB `syncOutbox` | None | `tests/offlineSync.test.ts` | `WORKING` |
| `/app/teacher` | `TeacherDashboard.tsx` | Finalize Classroom Session | `attendance.sessions.finalize` | `POST /api/v1/schools/:schoolId/attendance/sessions/:sessionId/status` | `{ status: 'FINALIZED', autoMarkAbsent: true }` | `{ success: true, session }` | `attendance_sessions` update | `SESSION_FINALIZED` | `tests/attendance.test.ts` | `WORKING` |
| `/app/teacher/classes` | `AssignedClasses.tsx` | View Assigned Class List | `attendance.sessions.read` | `GET /api/v1/schools/:schoolId/attendance/classes` | None | `{ data: [...] }` | `teacher_class_assignments` select | None | `tests/teacher.test.ts` | `WORKING` |
| `/app/teacher/offline` | `OfflineWorkspace.tsx` | Sync Local Outbox | `attendance.sessions.create` | `POST /api/v1/schools/:schoolId/attendance/sync` | `{ events: [...] }` | `{ processedCount, acceptedCount, rejections }` | `attendance_scan_events`, `attendance_records` insert | `OFFLINE_EVENTS_SYNCED` | `tests/offlineSync.test.ts` | `WORKING` |

---

## 4. Smartcard & RFID Operations

| UI Route | Page / Component | Visible Action | Required Permission | API Method / Path | Request Schema | Response Schema | DB Effect | Audit Action | Tests | Current Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/app/rfid` | `RfidOperatorDashboard.tsx` | Gate Telemetry Overview | `rfid.dashboard.read` | `GET /api/v1/schools/:schoolId/rfid/reports/scans` | None | `{ readersOnline, activeCards, recentScans }` | Aggregation queries | None | `tests/rfid.test.ts` | `WORKING` |
| `/app/rfid/readers` | `ReaderOperations.tsx` | Approve / Revoke Gate Reader | `rfid.readers.manage` | `POST /api/v1/schools/:schoolId/rfid/readers/:readerId/status` | `{ status: 'APPROVED' \| 'REVOKED', reason }` | `{ success: true, reader }` | `rfid_readers` update | `READER_STATUS_CHANGED` | `tests/rfid.test.ts` | `WORKING` |
| `/app/rfid/cards` | `CardOperations.tsx` | Revoke / Suspend Student Card | `rfid.cards.suspend` | `POST /api/v1/schools/:schoolId/rfid/credentials/:credentialId/suspend` | `{ reason }` | `{ success: true }` | `rfid_credentials` update | `CARD_STATUS_CHANGED` | `tests/rfid.test.ts` | `WORKING` |
| `/app/rfid/enrollment` | `EnrollmentOperations.tsx` | Inject DESFire Master Key & Enroll | `rfid.cards.enroll` | `POST /api/v1/schools/:schoolId/rfid/credentials/enroll` | `{ studentId, credentialDigest, securityMode, keyVersion }` | `{ success: true, credential }` | `rfid_credentials` insert | `CARD_ENROLLED` | `tests/rfid.test.ts` | `WORKING` |
| `/app/rfid/events` | `RfidIncidentQueue.tsx` | Inspect Replay / Unregistered Taps | `rfid.events.read` | `GET /api/v1/schools/:schoolId/rfid/reports/rejections` | None | `{ report: [...] }` | `rfid_scan_events` select where rejected | None | `tests/rfid.test.ts` | `WORKING` |

---

## 5. Reports & Analytics Center

| UI Route | Page / Component | Visible Action | Required Permission | API Method / Path | Request Schema | Response Schema | DB Effect | Audit Action | Tests | Current Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/app/reports` | `ReportViewerDashboard.tsx` | Inspection Overview | `reports.read` | `GET /api/v1/schools/:schoolId/reports/daily-school` | None | `{ summary, records: [...] }` | Select aggregation | None | `tests/reports.test.ts` | `WORKING` |
| `/app/reports/daily` | `DailyReports.tsx` | View Class Roll Sheet | `reports.read` | `GET /api/v1/schools/:schoolId/reports/daily-class` | Query: `{ classSectionId, date }` | `{ records: [...] }` | `attendance_records` select | None | `tests/reports.test.ts` | `WORKING` |
| `/app/reports/trends` | `TrendReports.tsx` | 30-Day Longitudinal Analysis | `reports.read` | `GET /api/v1/schools/:schoolId/reports/trends` | Query: `{ days: 7 \| 30 }` | `{ success: true, days, trends: [...] }` | Select aggregation | None | `tests/reports.test.ts` | `WORKING` |
| `/app/reports/exports` | `ExportCenter.tsx` | Download UDISE+ / MDM CSV / XLSX | `reports.export` | `GET /api/v1/schools/:schoolId/reports/export` | Query: `{ format: 'csv' \| 'xlsx', type, startDate, endDate }` | Blob Stream (`Content-Disposition`) | Select query | `EXPORT_REPORT` | `tests/reports.test.ts` | `WORKING` |

