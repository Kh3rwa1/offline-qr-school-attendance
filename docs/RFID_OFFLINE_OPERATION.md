# RFID Offline Operation

## Architecture
The Gateway can operate offline, storing scans locally and syncing when connectivity is restored. Optionally, the Gateway can cache an encrypted credential roster to authorize scans locally.

## Offline Policy Configuration
- **Max Offline Duration:** E.g., 24 hours.
- **Max Roster Age:** How stale the cached roster can be.
- **Queue Capacity:** Maximum events to buffer (e.g., 10,000).
- **Fail Mode:** Fail-open (allow any scan and verify later) vs Fail-closed (only allow if in local cached roster).

## Credential Roster
- Downloaded periodically.
- Contains only HMAC digests, never raw UIDs or secrets.

## Sync Reconciliation
- **Timestamp Ordering:** Events synced in order of occurrence.
- **Idempotency:** Server deduplicates events based on event ID.
- **Deterministic Decisions:** Server makes final attendance determination, reconciling Gateway offline approvals with current server state (e.g., card revoked while offline).

## UI Indicators
The frontend dashboard displays:
- Gateway Status (Online/Offline)
- Current Queue Depth
- Last Sync Time
- Roster Age
