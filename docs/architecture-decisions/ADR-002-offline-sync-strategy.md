# ADR-002: Offline Synchronization Strategy and Event Sourcing

* **Status:** Approved
* **Date:** 2026-08-11
* **Context:** Rural West Bengal schools frequently experience complete loss of internet connectivity. Attendance scans must be captured offline, persisted across app restarts, and synchronized idempotently upon network restoration.

## Decision
1. **Append-Only Event Stream:** Client actions create append-only events stored locally in Dexie.js (`syncOutbox`) and transmitted via `POST /api/v1/sync/attendance-events`.
2. **Client Event IDs:** Every event generated on the client includes a unique `client_event_id` (UUID v4 / nanoid).
3. **Per-Event Response Matrix:** The server processes event batches item-by-item and returns explicit results per event (`ACCEPTED`, `ALREADY_PROCESSED`, `CONFLICT`, `QR_REVOKED`, etc.).
4. **Outbox Guarantee:** Client retains outbox records until server explicitly acknowledges ingestion.
5. **Conflict Preservation:** Offline scans do not silently overwrite finalized admin overrides. Conflicts are preserved in the event log and flagged on `attendance_records.has_conflict` for admin audit.

## Consequences
* **Positives:** Complete crash durability, zero scan data loss, transparent audit trail, robust idempotency under network retry loops.
* **Negatives:** Requires server-side event projection engine to translate raw events into projected `attendance_records` state.
