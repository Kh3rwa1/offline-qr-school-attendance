# Offline Storage & Synchronization Protocol

## 1. Client-Side Offline Data Architecture (Dexie.js / IndexedDB)

To ensure rapid scan resolution without network access, the PWA utilizes Dexie.js over browser IndexedDB.

### Local Tables Schema
1. **`localSchool`**: Basic school profile, timezone, preferred language.
2. **`localUser`**: Authenticated teacher session profile and assignments.
3. **`authorizedClasses`**: Class sections assigned to the logged-in teacher.
4. **`classRosters`**: Complete roster for assigned classes (student ID, student code, English name, Bengali name, roll number, photo URL, status). *Note: Guardian phone numbers are strictly excluded from client caching.*
5. **`qrLookup`**: Local index mapping SHA-256 digests of active QR credentials to `studentId`.
6. **`localSessions`**: Active and past attendance sessions (`id`, `classSectionId`, `sessionDate`, `status`, `finalizedAt`).
7. **`attendanceEvents`**: Log of locally generated scan and status update events.
8. **`syncOutbox`**: Outbox queue holding un-acknowledged events to send to the server.
9. **`syncResults`**: History of synchronization responses and conflict flags.
10. **`appSettings`**: App version, last roster sync timestamp, camera settings.

---

## 2. Cryptographic QR Resolution (Offline)

1. **Card Generation:** Server creates a 128-bit cryptographically secure secret `S` (e.g., 32 hex characters) for student `X`.
2. **Hash Digest Storage:** Server stores `SHA-256(S)` in `qr_credentials`. Raw `S` is printed onto the physical card inside the QR code (`VERSION:1|SECRET:S`).
3. **Offline Lookup Bundle:** When a teacher downloads the class roster, the endpoint delivers a mapping of `{ SHA-256(S): studentId }`. Raw secrets are never sent to or stored on the client.
4. **Offline Scanning:** 
   - Camera scans QR code string `VERSION:1|SECRET:S`.
   - Client computes `D = SHA-256(S)`.
   - Client queries `qrLookup` index for `D`.
   - If found, retrieves `studentId`, matches student in `classRosters`, updates local attendance, and displays visual verification (Name, Bengali Name, Roll No, Photo).
   - If digest is marked revoked or absent, displays error ("Unrecognized or Revoked QR Card").

---

## 3. Synchronization Protocol & Payload Contracts

When internet connectivity is available, the client transmits queued outbox events to the server in batches of 50–100 events.

### API Endpoint
`POST /api/v1/sync/attendance-events`

### Client Request Payload Example
```json
{
  "schoolId": "11111111-2222-3333-4444-555555555555",
  "deviceId": "dev-9999-8888-7777",
  "batchId": "batch-101-abc",
  "events": [
    {
      "clientEventId": "evt-20260811-001-xyz",
      "attendanceSessionId": "sess-8888-9999",
      "studentId": "stud-1234-5678",
      "eventType": "QR_SCANNED",
      "statusValue": "PRESENT",
      "clientTimestamp": "2026-08-11T10:15:00.000Z",
      "metadata": {
        "scannerType": "CAMERA",
        "rawDigestPrefix": "a1b2c3d4"
      }
    }
  ]
}
```

### Server Response Payload Example
```json
{
  "batchId": "batch-101-abc",
  "processedAt": "2026-08-11T10:15:05.120Z",
  "results": [
    {
      "clientEventId": "evt-20260811-001-xyz",
      "status": "ACCEPTED",
      "recordStatus": "PRESENT",
      "hasConflict": false
    }
  ]
}
```

### Response Status Codes per Event
- **`ACCEPTED`**: Successfully ingested and projected into `attendance_records`.
- **`ALREADY_PROCESSED`**: Event was already processed in a previous attempt (Idempotent response).
- **`CONFLICT`**: Event accepted, but conflicts with an existing finalized or manual status. Flagged for admin review.
- **`QR_REVOKED`**: QR credential was revoked on server prior to scan. Event rejected.
- **`STUDENT_NOT_IN_ROSTER`**: Student is not enrolled in the session's roster snapshot.
- **`SESSION_FINALIZED`**: Attendance session is already finalized on server and locked against standard scans.
- **`DEVICE_REVOKED`**: Device authorization has been revoked by admin.
- **`UNAUTHORIZED`**: Teacher no longer has permission for this class section.

---

## 4. Conflict Handling & Reconciliation Rules

1. **Idempotency Guarantee:** Every client event contains a globally unique `client_event_id` (UUID v4 or nanoid). Re-sending the same payload repeatedly produces identical database outcomes.
2. **Server Record Projections:** `attendance_events` is append-only. The projection table `attendance_records` maintains current status.
3. **Conflict Scenario (Concurrent Edits):**
   - Offline Teacher A scans Student X as `PRESENT` at 10:05 AM.
   - Online Admin B marks Student X as `LEAVE` at 10:10 AM and finalizes session.
   - Teacher A connects and syncs at 10:20 AM.
4. **Resolution Rules:**
   - Server ingests Teacher A's event into `attendance_events`.
   - Server detects session was finalized by Admin B.
   - Event status returned as `CONFLICT`.
   - The original finalized status (`LEAVE`) is preserved.
   - An audit flag (`has_conflict = true`) is set on `attendance_records`, surfacing in the School Admin correction queue for manual review.

---

## 5. Persistence, Crash Recovery & Background Sync

- **Durable Write Sequence:**
  1. Open IndexedDB transaction.
  2. Put record in `attendanceEvents`.
  3. Put event payload in `syncOutbox`.
  4. Commit transaction.
  5. Play visual/audio feedback to teacher.
- **Crash / Reboot Recovery:** Because writes commit to IndexedDB before any network request or UI unlock, force-closing the browser or restarting the device preserves 100% of queued events in `syncOutbox`.
- **Automatic Sync Triggers:**
  - On PWA load / startup.
  - On browser `online` network event detection.
  - On explicit user tap of "Sync Now" button.
  - Background Sync API trigger (when supported by browser engine).
- **Queue Clearing Rule:** Events remain in `syncOutbox` until the server returns explicit individual status confirmation (`ACCEPTED` or `ALREADY_PROCESSED` or terminal rejection).
