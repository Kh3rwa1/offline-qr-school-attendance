# ADR-005: Asynchronous SMS Job Queue and Deduplication

* **Status:** Approved
* **Date:** 2026-08-11
* **Context:** When a daily class attendance session is finalized, SMS alerts must be dispatched to guardians of absent students. SMS dispatch must never block API requests, run directly from the browser, or send duplicate notifications under network retries.

## Decision
1. **Server-Side Finalization Trigger:** SMS jobs are created exclusively on the backend when an attendance session reaches `FINALIZED` state.
2. **Database Deduplication Constraint:** `notification_jobs` enforces a unique constraint on `(school_id, attendance_session_id, student_id)`. Re-submitting session finalization cannot produce duplicate SMS rows.
3. **Background Worker Isolation:** A separate background worker process polls `notification_jobs` using PostgreSQL transactional locking (`FOR UPDATE SKIP LOCKED`).
4. **Retry with Exponential Backoff:** Transient provider failures trigger automated job retries with exponential backoff (e.g. 1m, 5m, 15m) up to a maximum of 3 attempts.

## Consequences
* **Positives:** Zero duplicate SMS delivery to guardians; zero client UI blocking; full delivery audit history.
* **Negatives:** Requires running a background worker process alongside the web server container.
