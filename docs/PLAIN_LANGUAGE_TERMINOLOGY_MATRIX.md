# Plain-Language & Bengalish Terminology Matrix

This document defines the strict, plain-language and **Bengalish** (`বাংলা + English`) terminology standards for all non-super-admin dashboards across the AttendEase platform. Default interfaces must never expose raw database concepts, cryptographic primitives, or low-level protocol names to rural West Bengal school teachers, administrators, gate operators, or report viewers.

---

## 1. Domain Terminology Mapping

| Internal / Technical Concept | English User-Facing (Class 6 Reading Level) | Bengalish User-Facing (`বাংলা + English`) | Rationale & Context |
| :--- | :--- | :--- | :--- |
| **IndexedDB / SQLite local table** | Saved on this mobile | এই ফোনে Safe আছে | Teachers do not know browser database names. Focus on the benefit (data is safe on this device). |
| **Offline Synchronization Ledger** | Saved Attendance | Saved Attendance | Abstract database outbox into tangible school attendance records. |
| **Monotonic Counter / Client Event ID** | Attendance Record ID / Time Recorded | Time Recorded | Internal UUIDs and counters confuse non-technical users. Replace with localized time and student name. |
| **Replay Protection / Cryptographic Digest** | Protected student records | Student Records Safe আছে | Security guarantees expressed as safety reassurance rather than math terms. |
| **HMAC SHA-256 Seal / Auditor Stream** | Official Reports | Official Reports | Government compliance expressed simply as official school records. |
| **RFID EPC / Tag UID** | Student Badge Code | Badge Code | Gate cards are badges given to students for daily tap-in. |
| **Reader Device Provisioning / Fixed Gateway** | School Gate Box / Device | Gate Device / Gate Box | Clear physical metaphor for hardware installed at school entrance. |
| **Pending Outbox Push** | Send Saved Attendance | Saved Attendance Send করুন | Clear, actionable verb that indicates uploading queued marks to the cloud. |
| **Session Finalization / Lock State** | Finish Attendance | Attendance Finish করুন | Familiar classroom routine ("attendance is finished for today"). |
| **Chronic Absenteeism Flagging** | Frequently Absent | Frequently Absent | Plain educational term understood by Headmasters and teachers alike. |
| **Mid-Day Meal Headcount** | Mid-Day Meal Count | Mid-Day Meal Count | Primary statutory daily requirement for West Bengal government schools. |

---

## 2. Status Badge Terminology Matrix

| System State | English Status Badge | Bengalish Status Badge | Visual Treatment |
| :--- | :--- | :--- | :--- |
| `PRESENT` | Present | Present | Green chip (`bg-success-50 text-forest-700`) |
| `LATE` | Late | Late | Amber chip (`bg-amber-50 text-amber-800`) |
| `ABSENT` | Absent | Absent | Red chip (`bg-danger-50 text-danger-800`) |
| `EXCUSED` / `LEAVE` | On Leave | On Leave | Soft slate chip (`bg-surface-soft text-ink-soft`) |
| `ACTIVE` (Badge/Device) | Active | Active | Green chip (`bg-success-50 text-forest-700`) |
| `SUSPENDED` (Badge/Device) | Stopped | Stopped | Amber chip (`bg-warning-50 text-warning-800`) |
| `REVOKED` (Badge/Device) | Cancelled | Cancelled | Red chip (`bg-danger-50 text-danger-800`) |
| `SYNCED` | Sent Successfully | Sent Successfully | Green check chip |
| `SYNCING` | Sending… | Sending… | Blue progress chip |
| `PENDING` | Waiting to Send | Waiting to Send | Amber clock chip |
| `CONFLICT` | Needs Review | Review প্রয়োজন | Amber alert chip |
| `FAILED` | Could Not Send | Send হয়নি | Red alert chip with friendly error |

---

## 3. Error Translation Protocol

All backend errors (`FOREIGN_KEY_VIOLATION`, `NETWORK_TIMEOUT`, `INVALID_CREDENTIALS`, etc.) must pass through `getUserSafeError(err, language)`:

1. **Network drop**: "No internet connection right now. Your attendance is saved safely on this phone." / "Internet নেই — Attendance এই ফোনে Safe আছে। Internet এলে Auto Send হবে।"
2. **Session expired**: "Your session has ended. Please log in again to continue." / "Security-র কারণে আপনার Login Session শেষ হয়েছে। দয়া করে আবার Login করুন।"
3. **Card already assigned**: "This badge is already assigned to another student." / "এই Badge already অন্য Student-কে দেওয়া আছে।"
4. **Duplicate mark**: "Attendance has already been marked for this student today." / "এই Student-এর Attendance আজকের জন্য already Mark করা আছে।"
