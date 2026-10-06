---
title: "Ingest Decision Reference"
owner: "@Kh3rwa1"
applies_to: ">=2.0.0"
last_verified: 2026-10-06
---

# Ingest Decision Reference

Dictionary of all possible decision outcomes emitted by the AttendEase OS Zebra FX9600 gate ingest pipeline (`src/services/rfid/ingest/decide.ts`).

## Decision Matrix

| Decision Code | Category | Outcome | Meaning & Root Cause | Teacher / Admin Action |
|---|---|---|---|---|
| `ACCEPTED` | **Accepted** | Recorded as PRESENT in section daily attendance session. | Valid badge, student actively enrolled, session open and within school hours. | None required. Student arrival recorded on live dashboard. |
| `ALREADY_PRESENT` | **Accepted** | Ignored as redundant (student already marked present today). | Student tapped again after earlier accepted entry. | None required. Prior arrival status maintained. |
| `DUPLICATE_IN_BATCH` | **Debounced Duplicate** | Deduplicated in memory; counted in batch statistics, not logged per-row. | UHF tag bounced multiple times in a single reader transmission window. | None required. UHF tags naturally produce multiple reads in dwell area. |
| `DUPLICATE_DEBOUNCED` | **Debounced Duplicate** | Filtered by Redis cache; counted in statistics, not logged per-row. | Tag read within 30-second cooldown window following accepted tap. | None required. Prevents gate loitering from creating duplicate logs. |
| `MALFORMED_READ` | **Rejected** | Rejected with 400 or skipped in batch error collection. | Missing valid EPC hexadecimal string or unexpected JSON schema. | Inspect reader antenna cabling, RF power levels, or tag physical damage. |
| `FUTURE_SKEW` | **Rejected** | Rejected without updating attendance. | Reader hardware timestamp is >30 seconds ahead of appliance clock. | Verify reader NTP client configuration and synchronize appliance clock. |
| `WRONG_SCHOOL_DAY` | **Rejected** | Rejected without updating attendance. | Read timestamp does not fall on the active calendar date in school timezone. | Verify reader timezone configuration (`Asia/Kolkata` default) and calendar settings. |
| `UNREGISTERED_CARD` | **Rejected** | Rejected and logged to security audit trail. | EPC digest does not match any enrolled credential in the school database. | Verify badge assignment in Admin > Badges. If lost or new, issue badge to student. |
| `SUSPENDED_CARD` | **Rejected** | Rejected; student remains unmarked. | Credential status is set to SUSPENDED, REVOKED, or LOST. | Send student to school office to resolve suspension or replace lost badge. |
| `CREDENTIAL_ORPHANED` | **Rejected** | Rejected; system alert logged. | Credential row exists but associated student record was deleted. | Administrator must re-assign or delete orphaned credential in Admin > Badges. |
| `STUDENT_INACTIVE` | **Rejected** | Rejected; attendance not credited. | Linked student status is INACTIVE or TRANSFERRED. | School administrator should review enrollment records with principal/registrar. |
| `NOT_ENROLLED` | **Rejected** | Rejected; attendance not credited. | Student is active but has no enrollment in an active section for this academic year. | Enroll student into their designated grade and class section. |
| `SCHOOL_CLOSED` | **Rejected** | Rejected; attendance sessions not opened. | School calendar designates today as weekend, holiday, or emergency closure. | Verify academic calendar holiday dates if school is operating on a special day. |
| `SESSION_FINALIZED` | **Rejected** | Rejected; finalized attendance is immutable to automated gate taps. | Classroom teacher already finalized the session (absentees locked & SMS sent). | Teacher must apply a Manual Override in Teacher Dashboard if admitting late arrival. |
| `NO_TEACHER_ASSIGNED` | **Rejected** | Rejected; auto-session creation requires assigned teacher context. | Student section has no primary teacher assigned in the timetable. | Assign a designated teacher to the class section in Admin > Classes. |
| `MANUAL_OVERRIDE_PRESERVED` | **Rejected** | Rejected; teacher manual status preserved. | Teacher previously marked student EXCUSED or ABSENT with manual priority. | None required. Teacher manual discretion always overrides automated gate reads. |

## Ingest Categories

- **Accepted (2 codes)**: Tag validated; updates student arrival state or notes existing presence.
- **Debounced Duplicates (2 codes)**: High-frequency UHF RFID bounces suppressed by in-memory deduplication and Redis cooldown cache to protect database write capacity.
- **Rejected (12 codes)**: Reads failing cryptographic, temporal, enrollment, or operational boundary checks. Logged with failure diagnostic for review.
