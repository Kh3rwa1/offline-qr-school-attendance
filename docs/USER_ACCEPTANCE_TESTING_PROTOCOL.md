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
