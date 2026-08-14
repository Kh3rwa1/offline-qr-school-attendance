# Manual Acceptance Checklist

This checklist provides a structured protocol for manual quality assurance across all user journeys, roles, viewport sizes, and connectivity conditions.

---

## 1. Platform Governance Journey (`SUPER_ADMIN`)

- [ ] **1.1 Zero-School Platform Login**
  - Sign in with a Super Admin account having `platformRole: 'SUPER_ADMIN'` and zero assigned school memberships.
  - Verify that login succeeds without throwing `SCHOOL_ACCESS_DENIED`.
  - Confirm the platform dashboard loads with "No school selected" tenant state.

- [ ] **1.2 Register New School**
  - Navigate to `/app/super-admin/schools`.
  - Click **"Register New School"**.
  - Fill in Name, 11-digit UDISE code (`19060100999`), District, Block, Initial Administrator phone/email, and Academic Year.
  - Submit and verify progress indicator.
  - Verify that the school is created, appears in the directory, and the initial administrator is created with `SCHOOL_ADMIN` role.
  - Verify duplicate UDISE submission returns a clear `409 DUPLICATE_UDISE_CODE` error.

- [ ] **1.3 School Lifecycle (Suspend / Reactivate / Archive)**
  - Select a school and choose **"Suspend School"**.
  - Enter a mandatory reason and type the school name to confirm.
  - Verify status changes to `SUSPENDED` and audit log records `SCHOOL_STATUS_CHANGED`.
  - Reactivate the school and confirm immediate operational recovery.

- [ ] **1.4 Platform Audit & System Health**
  - Navigate to `/app/super-admin/security` and `/app/super-admin/audit`.
  - Verify database readiness, Redis health, KMS provider status, and worker heartbeat.
  - Filter platform audit records by date and action type.

---

## 2. School Administration Journey (`SCHOOL_ADMIN`)

- [ ] **2.1 Staff & Faculty Roster**
  - Navigate to `/app/school-admin/users`.
  - Verify real staff list loaded from `GET /api/v1/schools/:schoolId/members`.
  - Invite a new teacher with phone number `+919876543299` and role `TEACHER`.
  - Verify teacher appears in the table.
  - Attempt to suspend the final active `SCHOOL_ADMIN` and confirm the UI disables or rejects the action with a clear warning.

- [ ] **2.2 Academic Class Sections & Teacher Assignment**
  - Navigate to `/app/school-admin/academics`.
  - Create a new class section (e.g. `Class XI - Science`).
  - Assign an active teacher to the section.
  - Verify assignment persists and reflects in the teacher's console.

- [ ] **2.3 Student Roster & XLSX Bulk Staged Import**
  - Navigate to `/app/school-admin/students`.
  - Download official student roster template.
  - Upload sample XLSX file with 5 valid rows and 1 invalid row.
  - Inspect preview modal showing 5 valid / 1 invalid count with row-level error descriptions.
  - Commit import and verify 5 students enrolled in database.

- [ ] **2.4 Attendance Session Oversight & Manual Override**
  - Navigate to `/app/school-admin/attendance`.
  - Select an active or finalized session.
  - Open an unexcused absence and apply an administrative correction to `PRESENT (EXCUSED)` with a mandatory reason.
  - Verify audit trail records actor, timestamp, before value, and after value.

- [ ] **2.5 Guardian SMS Dispatch Console**
  - Navigate to `/app/school-admin/notifications`.
  - Verify queue summary, recent dispatches, and worker heartbeat.
  - Trigger a retry on a failed SMS job and verify state changes to `QUEUED` with audit log.

---

## 3. Classroom Teaching Journey (`TEACHER`)

- [ ] **3.1 Classroom Scanner Station**
  - Navigate to `/app/teacher`.
  - Select assigned class section.
  - Trigger optical QR scan or input test barcode.
  - Verify instant audio/haptic feedback and student presence punch in local outbox.

- [ ] **3.2 Offline Resilience & Session Finalization**
  - Disconnect network (DevTools Offline mode).
  - Record 3 student attendance punches into Dexie IndexedDB outbox.
  - Reload page and confirm outbox events remain safely preserved.
  - Reconnect network.
  - Click **"Sync Local Queue Now"**.
  - Click **"Finalize Attendance Session"**.
  - Verify server acknowledges `FINALIZED` before UI marks the session as complete.

---

## 4. Smartcard & RFID Gate Operator Journey (`RFID_OPERATOR`)

- [ ] **4.1 Gate Reader Management**
  - Navigate to `/app/rfid/readers`.
  - View physical gate reader terminals (Gate 1, Gate 2).
  - Verify reader heartbeat timestamps and hardware sequence counters.
  - Suspend a reader with reason and verify turnstile rejects scans.

- [ ] **4.2 Card Key Personalization & Enrollment**
  - Navigate to `/app/rfid/enrollment`.
  - Search for an unenrolled student.
  - Transceive card digest from authorized station in `SECURE` mode (AES-128 CMAC).
  - Confirm card enrollment in database.

- [ ] **4.3 Anomaly & Incident Queue**
  - Navigate to `/app/rfid/events`.
  - Verify live feed of debounced double-taps and unregistered visitor card taps.

---

## 5. Inspection & Reporting Journey (`REPORT_VIEWER`)

- [ ] **5.1 Read-Only Daily Roll Sheet**
  - Log in as `REPORT_VIEWER`.
  - Navigate to `/app/reports/daily`.
  - Select class and date.
  - Verify student roll table displays with Bengali student names, timestamps, and Mid-Day Meal eligibility.
  - Confirm that mutation controls (finalize, edit, delete) are completely hidden/absent.

- [ ] **5.2 Statutory Exports (UDISE+ & MDM)**
  - Navigate to `/app/reports/exports`.
  - Download UDISE+ CSV format 1.4 and Mid-Day Meal quarterly register.
  - Verify valid CSV/XLSX download with proper `Content-Disposition` filenames.
  - Verify export event is logged in tenant audit table.

---

## 6. Accessibility, Responsiveness & Cross-Browser

- [ ] **6.1 Responsive Breakpoints**: Test at 375px (Mobile), 768px (Tablet), and 1440px (Desktop).
- [ ] **6.2 Keyboard Navigation**: Full tab navigation across all interactive buttons, modals, and tables.
- [ ] **6.3 Screen Reader ARIA Attributes**: Proper `aria-label`, `role="dialog"`, and `aria-live` status regions on live gauges and scanners.
