# Fake Data Removal Inventory

This inventory documents all hardcoded, fallback, fabricated, and demo business values audited and completely eliminated across the AttendEase non-super-admin dashboards.

## 1. Inventory of Removals

| Component / File | Old Fabricated Value / Pattern | Replaced With | Truthful Behavior when Data is Missing |
| :--- | :--- | :--- | :--- |
| `ReportViewerDashboard.tsx` | Hardcoded `95.4%` fallback rate | `summary.overallAttendanceRate` from `/api/v1/dashboard/report-viewer/summary` | Displays `—` and empty state: "No attendance data recorded yet." |
| `ReportViewerDashboard.tsx` | Hardcoded `142` verified sessions | `summary.totalSessionsRecorded` from live database query | Displays `0` and empty state guiding teacher/admin to record attendance. |
| `ReportViewerDashboard.tsx` | Hardcoded `3` chronic absence flags | `summary.flaggedAbsenceCount` from live database query | Displays `0` with "Normal Attendance" reassurance. |
| `ReportViewerDashboard.tsx` | Static weekly attendance array `[96, 74, 98, 92, 97, 89]` | Dynamic gauge and real session summaries | Renders empty state card if total sessions is 0. |
| `ReportViewerDashboard.tsx` | Hardcoded class roster list (`Class 10-A`, `Class 10-B`, etc.) | Direct navigation to `/app/reports/daily` backed by live class sections query | Shows honest empty state if school has no registered class sections. |
| `ReportViewerDashboard.tsx` | Artificial `5048s` countdown timer with "HMAC Cryptographic Seal Active" | Official report download shortcuts | Replaced with clean official export links (`/app/reports/exports`). |
| `OfflineWorkspace.tsx` | Hardcoded technical descriptions ("Browser IndexedDB local queue for uninterrupted attendance") | `useLanguage()` localized user-friendly reassurance | Clearly explains data safety on this mobile device. |
| `OfflineWorkspace.tsx` | Raw `e.syncError` dump in UI | `getUserSafeError(e.syncError, language)` | User-safe explanation in English or Bengali without stack traces. |
| `AssignedClasses.tsx` | Hardcoded "Available in IndexedDB" & "Offline-First Sync" | Localized `useLanguage()` status cards | Displays real assigned classes or "No assigned classes yet" empty state. |
| `RfidDashboard.tsx` | Hardcoded English table headers and legacy security warnings | Localized headers and conditional legacy security notice | Shows "No one has walked in yet today" when no gate scans are present. |

---

## 2. Verification Protocol

The automated test suite `tests/antiCheatingReportViewerAndTeacher.test.ts` scans all dashboard files on every CI build to guarantee that no mock constants, fake arrays, or artificial timers are reintroduced.
