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
