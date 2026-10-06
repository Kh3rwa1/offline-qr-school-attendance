---
title: "School User Acceptance Testing (UAT) Protocol & Sign-Off Matrix"
owner: "@Kh3rwa1"
applies_to: ">=2.0.0"
last_verified: 2026-10-06
---

# School User Acceptance Testing (UAT) Protocol & Sign-Off Matrix

## 1. Objectives & Scope
This protocol establishes the formal end-user acceptance testing (UAT) criteria required prior to institutional rollout of the **Offline QR School Attendance Platform**.

> [!IMPORTANT]
> **Current UAT Status**: **PENDING SCHOOL STAKEHOLDER EXECUTION**  
> Automated end-to-end integration tests and the developer sanity drill ([`scripts/run-school-uat-drill.ts`](../scripts/run-school-uat-drill.ts)) pass in CI. Formal commercial acceptance requires real human execution by the evaluation committee and written sign-offs below.

The evaluation committee consists of:
1. **Head Teacher / Principal** (Institutional oversight, compliance, and reporting)
2. **School Administrator** (Student management, class configuration, master rosters, audit logs)
3. **Primary Teacher 1** (Grade 5A - Daily attendance, offline scanning, camera & USB scanner)
4. **Primary Teacher 2** (Grade 6B - Absence markings, offline sync, session finalization)

---

## 2. Stakeholder UAT Execution Matrix

### Role A: School Administrator & Head Teacher

| ID | Test Scenario | Acceptance Criteria | Tested By | Verification Status | Stakeholder Sign-Off |
|:---:|---|---|:---:|:---:|:---:|
| **UAT-01** | **Bulk Student CSV/Excel Import** | Upload 500+ student roster with roll numbers, class IDs, and guardian phone numbers. 100% created without validation errors. | Admin | **NOT TESTED** | `_______________` |
| **UAT-02** | **Class & Section Lifecycle Setup** | Create new academic year, configure Grade 5A & 6B, assign class teachers, and configure timetable slots. | Admin | **NOT TESTED** | `_______________` |
| **UAT-03** | **Absence Corrections & Manual Overrides** | Correct an accidental absent mark to present with mandatory audit note reason; change logged in audit trail. | Admin | **NOT TESTED** | `_______________` |
| **UAT-04** | **DLT SMS Delivery & Queue Verification** | Trigger attendance finalization; confirm SMS notifications dispatch via simulated/DLT gateway with correct guardian phone. | Head Teacher | **NOT TESTED** | `_______________` |
| **UAT-05** | **Comprehensive Report Exports** | Generate daily attendance summary, monthly trend analysis, and download Excel/CSV export files with valid data. | Head Teacher | **NOT TESTED** | `_______________` |

---

### Role B: Class Teachers (Teacher 1 & Teacher 2)

| ID | Test Scenario | Acceptance Criteria | Tested By | Verification Status | Stakeholder Sign-Off |
|:---:|---|---|:---:|:---:|:---:|
| **UAT-06** | **Daily Morning Attendance Collection** | Teacher signs into Teacher Dashboard, selects assigned section, launches camera scanner, and scans student QR tokens. | Teacher 1 | **NOT TESTED** | `_______________` |
| **UAT-07** | **Offline Attendance Collection Drill** | Disconnect browser network (DevTools offline mode). Collect 25 scans. Verify records persist in browser Dexie IndexedDB. | Teacher 2 | **NOT TESTED** | `_______________` |
| **UAT-08** | **Reconnection & End-of-Day Sync** | Reconnect internet network. Verify pending scans synchronize automatically to backend PostgreSQL without data loss. | Teacher 1 & 2 | **NOT TESTED** | `_______________` |

---

## 3. Automated Developer Sanity Drill
To verify the system workflow programmatically prior to stakeholder sessions:
```bash
npx tsx scripts/run-school-uat-drill.ts
```
Outputs sanity report to `output/school-uat-execution-report.md`.

---

## 4. Formal Stakeholder Acceptance Sign-Off

Formal acceptance is granted only upon execution of all 8 scenarios above and physical signatures below:

| Role | Name | Signature | Date |
|---|---|---|---|
| **Head Teacher / Principal** | _______________________ | _______________________ | ______________ |
| **School Administrator** | _______________________ | _______________________ | ______________ |
| **Teacher (Class 5A)** | _______________________ | _______________________ | ______________ |
| **Teacher (Class 6B)** | _______________________ | _______________________ | ______________ |


---

# West Bengal Rural School Plain-Language UAT Protocol & Verification Guide

## 1. Target User Persona & Device Baseline
- **Primary Persona**: 55-year-old Bengali-first primary school teacher in rural Purulia / Bankura, West Bengal.
- **Hardware Profile**: ₹10,000 Android smartphone (360px viewport width, low touch precision, 2G/3G intermittent connectivity).
- **Digital Literacy**: Basic smartphone knowledge (WhatsApp, YouTube, voice calling). Intimidated by English developer jargon and acronyms.
- **Language**: Reads Bengali (বাংলা) fluently; understands simple school-related English terms.

---

## 2. Core Usability Mandates Verified
1. **Zero Technical Jargon**: No raw UUIDs, cryptographic acronyms (AES, RLS, SHA, SigV4), or database terms exposed in normal teacher, gate operator, school admin, or report viewer workflows.
2. **Complete Bilingual Reactivity**: 100% reactive toggle between English and Bengali across all headers, cards, dialogs, form inputs, status chips, and error messages.
3. **Budget Mobile Touch Target Compliance**: All clickable elements (buttons, dropdowns, inputs, quick-action tiles) adhere to $\ge 44\text{px}$ touch targets (with $\ge 48\text{px}$ on bottom navigation bars).
4. **No Fake / Hardcoded Numbers**: All dashboards display real live data from SQLite/PostgreSQL APIs or honest empty states.
5. **Reassuring Offline & Error States**: Network interruptions clearly communicate that attendance is safely stored on the device with zero risk of data loss.

---

## 3. End-to-End Task Verification Scripts

### Script 1: Teacher Daily Classroom Roll (শ্রেণীকক্ষের উপস্থিতি)
1. **Start Attendance**:
   - Open Teacher Dashboard.
   - Choose assigned class from large dropdown (`min-h-[44px]`).
   - Observe live count of students who walked through the school gate today.
2. **Review & Adjust**:
   - Tap large **"Present" (উপস্থিত)**, **"Late" (দেরিতে এসেছে)**, or **"Leave" (ছুটি)** buttons on any student row.
   - Touch targets are large and provide immediate colored badge feedback.
3. **Finish Attendance**:
   - Tap **"Finish Attendance for Today" (উপস্থিতি শেষ করুন)**.
   - Read plain modal warning: Unmarked students will be marked Absent.
   - Tap confirm: Success toast appears ("Attendance saved on server" or "Saved on mobile").

### Script 2: Gate Operator Badges & Problem Cards (গেট ও ব্যাজ পরিচালনা)
1. **Monitor Gate Arrivals**:
   - View live stream of student check-ins with Bengali/English timestamps.
2. **Inspect Scan Issues**:
   - Open **"Gate Problems" (গেটের সমস্যা)**.
   - See plain-language reasons: "Unregistered Badge" (অচেনা ব্যাজ) or "Repeated Scan" (একই ব্যাজ একাধিকবার স্ক্যান হয়েছে).
   - Tap **"Give Badge" (ব্যাজ দিন)** directly from the issue row to assign a new badge.
3. **Manage Student Badges**:
   - Temporarily stop or reactivate badges with accessible confirmation dialogs.

### Script 3: Headmaster Staff & Class Management (বিদ্যালয় প্রশাসন)
1. **School Staff**:
   - View authorized teachers and staff without raw database IDs.
   - Add new staff with full name, 10-digit mobile number, role dropdown, and temporary password.
   - Stop or restore access with single-tap confirmation dialogs.
2. **Attendance Roll Adjustments**:
   - Inspect daily class attendance.
   - Make audit corrections with mandatory plain-language reason.
   - Review clear before/after comparison modal before applying.

### Script 4: District Officer & Headmaster Reports (সরকারি রিপোর্ট ও খাতা)
1. **Daily Roll Sheet**:
   - View class attendance percentage, absentees, and Mid-Day Meal (মিড-ডে মিল) headcounts.
   - Tap **"Print Sheet" (প্রিন্ট করুন)** or **"Export CSV" (সিএসভি ডাউনলোড)**.
2. **Monthly Government Registers**:
   - Open **"Download Official Reports" (সরকারি রিপোর্ট ডাউনলোড)**.
   - Select Class, Month, and Year with large dropdowns.
   - Tap **"Download Excel File" (এক্সেল ফাইল ডাউনলোড করুন)** for UDISE+ and Banglar Shiksha compliant sheets.

---

## 4. Automated Verification Summary
- **Guardrail Test**: `npm run check:guardrail` (0 forbidden strings across 169 source files).
- **Unit & Usability Test Suites**:
  - `tests/i18nCompleteness.test.ts` (100% key parity between `en` and `bn`).
  - `tests/plainLanguageAndErrors.test.ts` (User-safe error & RFID code translations).
  - `tests/noFakeDataGuardrail.test.ts` (Zero fake statistics in production views).
  - `tests/a11yAndMobileUx.test.tsx` (Accessible touch heights $\ge 44\text{px}$).
- **TypeScript Typecheck**: `npm run lint` (`tsc --noEmit`) $\to$ 0 errors.
- **Production Build**: `npm run build` $\to$ clean bundle generation.


---

# User Acceptance Testing (UAT) Protocol & Field Execution Pack

> **PROJECT**: AttendEase — Offline QR + RFID School Attendance Platform  
> **STATUS**: **PENDING INDEPENDENT HUMAN FIELD VERIFICATION**  
> **INTENDED AUDIENCE**: School Pilots, District Field Teams, Accessibility Evaluators

---

## 1. Objective & Scope

This test pack establishes the formal evaluation protocol for field trials of AttendEase in rural and semi-urban school environments across West Bengal. 

The protocol validates:
1. **Offline Classroom Attendance**: Reliability during continuous power or cellular data blackouts.
2. **Bengalish Language Ergonomics**: Clarity and ease of use for non-technical teachers and gate staff.
3. **Accessibility**: One-handed mobile operation, $\ge 44 \times 44\text{px}$ touch targets on compact devices (360px–390px screens), and screen-reader navigable reports.
4. **Data Integrity**: Local Dexie IndexedDB storage, compound tenant isolation, and conflict-free cloud synchronization.

---

## 2. Participant Inclusion Criteria & Cohorts

| Cohort | Target Role | Age & Experience Profile | Device / Environment Profile |
| :--- | :--- | :--- | :--- |
| **Cohort 1** | Senior Classroom Teacher | 50+ yrs, non-tech-native, Bengali primary | 360px screen (Android 10/11), low sunlight / outdoor |
| **Cohort 2** | Junior Teacher | 22–35 yrs, tech-familiar, bilingual | 390px screen (Android 13/14), standard classroom |
| **Cohort 3** | Headmaster / School Admin | Experienced administrator | Desktop / Laptop (Chrome / Firefox) |
| **Cohort 4** | Gate / Security Operator | Entry-level staff, fast scan focus | Dedicated 360px handheld / Tablet |
| **Cohort 5** | District Report Viewer | Administrative oversight | Tablet / Desktop (1280px+) |

---

## 3. Informed Consent & Privacy Instructions

### Anonymization Protocol
- No student full names, photographs, or personal biometric details are stored in raw logs.
- All evaluation sessions record only Participant ID (`P01`, `P02`, etc.) and system telemetry.
- Audio/video recordings (if captured with consent) must be stored in encrypted local storage and retained for maximum 30 days.

### Consent Template (বাংলা ও ইংরেজি)
```text
I voluntarily agree to participate in the AttendEase usability evaluation session.
I understand that my feedback will be used to improve school attendance software.
No personal identification information will be publicly disclosed.

আমি স্বেচ্ছায় AttendEase মূল্যায়ন প্রক্রিয়ায় অংশগ্রহণ করতে সম্মত হচ্ছি।
আমার মতামত শুধুমাত্র সফটওয়্যার উন্নতির জন্য ব্যবহৃত হবে।

Participant ID: _______________    Date: _______________
Signature / নাম স্বাক্ষর: ________________________________
```

---

## 4. Bengali-Language Task Scripts

### Task 1: শ্রেণিকক্ষে অফলাইন হাজিরা (Offline Classroom Roll Call)
> **প্রশিক্ষক নির্দেশিকা**: শিক্ষককে মোবাইল দিন এবং অফলাইন মোড চালু করুন।
> **কাজের বিবরণ**:
> ১. আপনার নির্ধারিত শ্রেণি (যেমন Class 5-A) নির্বাচন করুন।
> ২. ক্যামেরা স্ক্যানার দিয়ে উপস্থিত শিক্ষার্থীদের কিউআর কোড স্ক্যান করুন।
> ৩. যারা কিউআর কার্ড আনেনি তাদের নামের পাশে "উপস্থিত" / "দেরি" বোতাম চাপুন।
> ৪. "হাজিরা শেষ করুন" বোতাম চেপে সম্পন্ন করুন।

### Task 2: নতুন কর্মী যুক্তকরণ (Add Staff Member)
> **কাজের বিবরণ**:
> ১. বিদ্যালয় প্রশাসন (School Admin) পোর্টালে লগইন করুন।
> ২. "কর্মী ও ভূমিকা" মেনুতে প্রবেশ করুন।
> ৩. "নতুন কর্মী" বোতাম চাপুন এবং নাম, ফোন ও ভূমিকা নির্বাচন করে সাবমিট করুন।
> ৪. পাসওয়ার্ড ফিল্ডের চোখ আইকন (Eye icon) স্পর্শ করে দৃশ্যমানতা যাচাই করুন।

### Task 3: গেট অপারেটর স্ক্যানিং (Gate Scanning)
> **কাজের বিবরণ**:
> ১. গেট অপারেটর পোর্টালে প্রবেশ করুন।
> ২. আগমন তালিকায় শিক্ষার্থীর নাম ও সময় যাচাই করুন।
> ৩. অজানা কার্ড স্ক্যানের ক্ষেত্রে সতর্কতা বার্তা লক্ষ্য করুন।

---

## 5. System Usability Scale (SUS) Questionnaire

Each item is scored from 1 (Strongly Disagree / দৃঢ়ভাবে অসম্মত) to 5 (Strongly Agree / দৃঢ়ভাবে সম্মত):

1. I think that I would like to use this system frequently.  
   *(আমি প্রতিনিয়ত এই সিস্টেমটি ব্যবহার করতে আগ্রহী।)*
2. I found the system unnecessarily complex.  
   *(সিস্টেমটি অপ্রয়োজনীয়ভাবে জটিল মনে হয়েছে।)*
3. I thought the system was easy to use.  
   *(সিস্টেমটি ব্যবহার করা অত্যন্ত সহজ ছিল।)*
4. I think that I would need the support of a technical person to be able to use this system.  
   *(এটি ব্যবহারের জন্য কারিগরি সহায়তার প্রয়োজন হবে।)*
5. I found the various functions in this system were well integrated.  
   *(সিস্টেমের বিভিন্ন ফিচারগুলো সুসংগঠিত।)*
6. I thought there was too much inconsistency in this system.  
   *(সিস্টেমটিতে অসঙ্গতি বেশি ছিল।)*
7. I would imagine that most people would learn to use this system very quickly.  
   *(অধিকাংশ শিক্ষক খুব দ্রুত এটি শিখে নিতে পারবেন।)*
8. I found the system very cumbersome to use.  
   *(সিস্টেমটি ব্যবহার করা কষ্টসাধ্য ছিল।)*
9. I felt very confident using the system.  
   *(সিস্টেমটি ব্যবহারের সময় আমি আত্মবিশ্বাসী অনুভব করেছি।)*
10. I needed to learn a lot of things before I could get going with this system.  
    *(এটি ব্যবহারের আগে অনেক কিছু শেখার প্রয়োজন ছিল।)*

$$\text{SUS Score} = \left[ \sum (\text{Odd items} - 1) + \sum (5 - \text{Even items}) \right] \times 2.5$$

---

## 6. Issue Severity & Defect Rubric

| Severity Level | Definition | Field Action |
| :--- | :--- | :--- |
| **Critical (P0)** | Data loss, cross-school data leak, unhandled app crash, sync failure | Release blocker; immediate patch required |
| **Major (P1)** | Touch target $< 44\text{px}$, confusing translation, missing offline button | Must fix before district pilot expansion |
| **Moderate (P2)** | Minor color contrast issue, slow list rendering with $>1000$ rows | Optimize in next sprint |
| **Minor (P3)** | Cosmetic spacing or minor wording enhancement | Backlog enhancement |

---

## 7. Sign-off & Audit Status

```text
================================================================================
UAT STATUS: PENDING INDEPENDENT HUMAN FIELD VERIFICATION
================================================================================
Automated Test Coverage:        100% (71 Vitest suites, 16 CI checks green)
Playwright E2E Verification:    Touch-targets, Axe, Keyboard, Reflow, Bengali
Field Pilot Status:             READY FOR ON-SITE DEPLOYMENT & EVALUATION
================================================================================
```


---

# Critical Acceptance Test Suite

This document defines the 25 Critical Acceptance Tests required to verify system readiness. All 25 scenarios must pass in end-to-end testing before production readiness is declared.

---

## Acceptance Matrix (25 Scenarios)

| # | Scenario | Steps & Actions | Expected Outcome | Verification Method |
| :---: | :--- | :--- | :--- | :--- |
| **1** | Online Teacher Authentication | Teacher enters phone number & password on online Android device. | Successful authentication, HTTP-only session cookie issued, assigned schools listed. | Playwright E2E |
| **2** | Roster Package Download | Teacher selects Class VIII-A and taps "Download Roster for Offline Use". | Class VIII-A roster and active QR credential digests downloaded to IndexedDB. | Dexie Inspector / Playwright |
| **3** | Offline Mode Transition | Disable internet connection (simulate airplane mode). | PWA status pill changes to **OFFLINE (Orange)**. Application functions normally without errors. | Playwright offline mode |
| **4** | Offline Session Creation | Teacher selects Class VIII-A and starts daily attendance session. | Session created in IndexedDB with status `OPEN`. Roster snapshot frozen locally. | Dexie Inspection |
| **5** | Offline QR Scanning (38 Cards) | Teacher scans 38 distinct student QR cards using phone camera / USB scanner. | Each scan computes SHA-256 digest, matches student locally, plays audio beep, and shows visual photo/name/roll no confirmation. | Scanner Simulation Test |
| **6** | Duplicate Scan Suppression | Teacher scans Student #12's QR card a second time. | System plays warning sound, displays alert ("Student already marked PRESENT at 10:04 AM"), and suppresses duplicate event. | Scan Simulation Test |
| **7** | Force-Close App Recovery | Force-close browser tab / PWA process while offline with 38 pending scans. | Process terminated abruptly. | Process Signal / Automation |
| **8** | Application Reopen State | Reopen PWA while still offline. | Session displays 38 scanned students intact. Unsent outbox count shows 38. | Playwright E2E |
| **9** | Device Reboot Simulation | Refresh/reload page & clear volatile memory while offline. | All 38 queued outbox events persist in IndexedDB. | Playwright E2E |
| **10** | Outbox Event Integrity | Inspect IndexedDB `syncOutbox`. | Exactly 38 `QR_SCANNED` events stored with unique `clientEventId` values. | Dexie Direct Test |
| **11** | Internet Reconnection | Re-enable internet connection. | PWA status pill updates to **ONLINE (Green)**. Background sync process triggers automatically. | Network Emulation |
| **12** | Batch Re-submission Safety | Re-transmit the exact same batch payload twice to `/api/v1/sync/attendance-events`. | Server processes batch 1 as `ACCEPTED` and batch 2 as `ALREADY_PROCESSED`. Database contains zero duplicate records. | Integration Test |
| **13** | Server Attendance Uniqueness | Query `attendance_records` table on backend PostgreSQL. | Exactly 38 records created for the session, each student appearing exactly once. | SQL Assertion |
| **14** | Concurrent Conflict Preservation | Teacher A (offline) marks Student #5 Present. Teacher B (online) marks Student #5 Absent & finalizes. Teacher A syncs later. | Both events saved in `attendance_events`. Student #5 flagged with `has_conflict = true` for Admin review. Finalized correction preserved. | Integration Test |
| **15** | Missing Student Review | Teacher switches session state from `OPEN` to `REVIEW`. | UI lists remaining 2 unmarked students in Class VIII-A. | Playwright E2E |
| **16** | Absence Confirmation | Teacher confirms the 2 unmarked students as `ABSENT`. | 2 `MARKED_ABSENT` events created in local outbox and synced to server. | Playwright E2E |
| **17** | Session Finalization Sync | Teacher taps "Finalize Attendance". | Session status updated to `FINALIZED` locally and on server. Roster lock applied. | Integration Test |
| **18** | Asynchronous SMS Creation | Inspect PostgreSQL `notification_jobs` table post-finalization. | Exactly 2 SMS jobs created for the guardians of the 2 absent students. | SQL Assertion |
| **19** | Finalization Re-execution Safety | Trigger session finalization API endpoint a second time. | Server acknowledges request without creating duplicate SMS jobs in `notification_jobs`. | Integration Test |
| **20** | SMS Retry with Exponential Backoff | Simulate SMS gateway transient error (503 Service Unavailable) on attempt 1. | Background worker logs failure, schedules attempt 2 with exponential delay, and successfully sends on retry. | Worker Integration Test |
| **21** | Principal Attendance Report | Login as School Admin and generate Daily Class Attendance Report for Class VIII-A. | Report correctly shows 38 Present, 2 Absent, 0 Unmarked (95% attendance rate). | Playwright E2E |
| **22** | Cross-Tenant Access Denial | Authenticated User of School A attempts to access `/api/v1/schools/School-B/students`. | Request denied with HTTP `403 Forbidden` / RLS empty result set. | Security Unit Test |
| **23** | Revoked QR Credential Rejection | Admin revokes Student #10's QR credential. Teacher scans Student #10's revoked card. | Scan rejected with error message ("Revoked QR Credential"). Event rejected on sync as `QR_REVOKED`. | Integration Test |
| **24** | Revoked Device Sync Block | Admin revokes Teacher Phone Device #1. Teacher Phone Device #1 attempts sync. | Endpoint returns HTTP `403 Forbidden` (`DEVICE_REVOKED`). Sync halted. | Integration Test |
| **25** | Database Backup & Restore | Run `pg_dump` backup script, drop database, recreate schema, and run restore script. | Database restored with 100% data integrity, valid foreign keys, and matching hash counts. | CLI Script Test |


---

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
