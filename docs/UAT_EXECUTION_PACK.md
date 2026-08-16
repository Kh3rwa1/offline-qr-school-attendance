# User Acceptance Testing (UAT) Protocol & Execution Pack

> **PROJECT**: AttendEase — Offline QR + RFID School Attendance Platform  
> **STATUS**: **PROTOCOL SPECIFICATION & READINESS (HUMAN FIELD TESTING PENDING)**  
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

## 2. Target User Cohorts & Evaluation Profiles

| Profile Category | Target User Role | Primary Device Profile | Key Testing Focus |
| :--- | :--- | :--- | :--- |
| **Cohort A** | Senior Classroom Teacher (50+ yrs) | 360px viewport (Android 10/11) | Large typography ($\ge 14\text{px}$), visual color coding, one-handed roll call |
| **Cohort B** | Primary / Junior Teacher (18–35 yrs) | 390px viewport (Android 12/13/14) | Fast camera QR HUD scanning, rapid manual override, outbox sync |
| **Cohort C** | Headmaster / School Administrator | Desktop / Tablet (Chrome / Edge) | Roster management, student enrollment, attendance audit & correction |
| **Cohort D** | Gate / Security Operator | Dedicated Gateway / Mobile Scanner | Fast badge recognition, incident queue handling, offline queue status |
| **Cohort E** | District Inspector / Report Viewer | Tablet / Desktop | Monthly attendance turnout gauge, CSV/Excel official export |

---

## 3. Standardized Test Scenarios & Step-by-Step Protocols

### Scenario 1: Offline Classroom Attendance Roll Call
- **Precondition**: Teacher logged in; device placed in Airplane Mode (offline).
- **Execution Steps**:
  1. Open Teacher Dashboard.
  2. Select assigned class section (e.g., Class 5-A).
  3. Scan available student QR cards using the Camera HUD.
  4. Manually mark remaining students (Present, Absent, or Late) from the missing list.
  5. Tap "Attendance Finish করুন" / "Finish Attendance" and confirm the modal dialog.
  6. Reconnect network and verify that the sync outbox uploads all records to the school server without duplication.
- **Pass Criteria**:
  - Zero fatal errors or unhandled exceptions during offline operation.
  - All records saved to IndexedDB with compound tenant scoping `[schoolId+classSectionId]`.
  - 100% successful sync upon network restoration.

---

### Scenario 2: School Admin Student Enrollment & Audit Trail
- **Precondition**: School Administrator logged in to School Admin portal.
- **Execution Steps**:
  1. Navigate to Student Roster.
  2. Add new student with Student Code, Full Name, Bengali Name, and Banglar Shiksha ID.
  3. Assign student to an active Class Section and Academic Year.
  4. Navigate to Daily Attendance Operations, locate a finalized session, and perform an audit-tracked status correction with reason.
- **Pass Criteria**:
  - Student appears immediately in class roster.
  - Correction is persisted with timestamp, previous status, new status, and audit reason.

---

### Scenario 3: Gate Arrival & RFID Incident Handling
- **Precondition**: Gate Operator logged in to Gate Operations station.
- **Execution Steps**:
  1. Open Live Gate Feed.
  2. Scan an enrolled badge and verify immediate visual feedback.
  3. Scan an unregistered badge and verify entry in Incident Queue with actionable recovery guidance.
- **Pass Criteria**:
  - Live arrival feed updates without page reload.
  - Incident queue displays user-friendly resolution recommendation.

---

### Scenario 4: Official Report Export & Data Accessibility
- **Precondition**: Report Viewer or Administrator logged in.
- **Execution Steps**:
  1. Navigate to Reports Dashboard.
  2. Verify that attendance gauge displays accessible summary table for screen readers.
  3. Navigate to Export Center and download Monthly Attendance Register (`.xlsx`) and Daily Summary (`.csv`).
- **Pass Criteria**:
  - Screen reader data table contains `<caption>` and column headers.
  - Exported Excel and CSV files contain complete school, class, roll number, and timestamp data.

---

## 4. Usability Metrics & Evaluation Criteria

Field pilots will record:
1. **Task Completion Rate**: Target $\ge 98\%$ across all scenarios.
2. **System Usability Scale (SUS)**: Standardized 10-question SUS post-test survey (Target score $\ge 85 / 100$).
3. **Scan Latency**: Average time per QR badge scan (Target $\le 1.0\text{s}$).
4. **Error Recovery**: Proportion of user-correctable errors resolved without administrator intervention (Target $100\%$).

---

## 5. Verification Status

```text
================================================================================
UAT STATUS: SPECIFICATION COMPLETE
================================================================================
Test Scenarios:                 4 Standard Protocols Defined
Target Device Viewports:        360px, 390px, Tablet, Desktop
Accessibility Thresholds:       WCAG 2.2 Level AA / AAA Compliant
Field Pilot Execution:          PENDING INDEPENDENT VERIFICATION
================================================================================
```
