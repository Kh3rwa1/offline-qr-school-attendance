# API Contracts Specification

All REST endpoints return standard JSON responses and enforce Zod validation schemas. All school-scoped endpoints require valid authentication and active membership in the target tenant (`school_id`).

---

## 1. Authentication Endpoints

### `POST /api/v1/auth/login`
- **Description:** Authenticates a user with phone number and password.
- **Request Body:**
  ```json
  {
    "phoneNumber": "+919876543210",
    "password": "SecurePassword123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "user": {
      "id": "usr-1111-2222",
      "fullName": "Amitav Roy",
      "phoneNumber": "+919876543210"
    },
    "memberships": [
      {
        "schoolId": "sch-0001-0002",
        "schoolName": "Rampur High School",
        "role": "TEACHER"
      }
    ]
  }
  ```

---

## 2. Roster Download & Sync Endpoints

### `GET /api/v1/schools/:schoolId/teacher/rosters`
- **Description:** Downloads assigned classes, student roster snapshots, and QR lookup hashes for offline caching.
- **Headers:** `Cookie: session=...`
- **Response (200 OK):**
  ```json
  {
    "school": {
      "id": "sch-0001-0002",
      "name": "Rampur High School",
      "preferredLanguage": "bn",
      "timezone": "Asia/Kolkata"
    },
    "assignedClasses": [
      {
        "classSectionId": "cs-8888-1111",
        "className": "Class VIII",
        "sectionName": "A",
        "academicYear": "2026"
      }
    ],
    "rosters": [
      {
        "classSectionId": "cs-8888-1111",
        "students": [
          {
            "id": "stud-001",
            "studentCode": "STU-801",
            "name": "Subhash Chandra",
            "nameBn": "সুভাষ চন্দ্র",
            "rollNumber": 1,
            "photoUrl": "/assets/photos/stu-001.jpg",
            "status": "ACTIVE"
          }
        ]
      }
    ],
    "qrLookup": [
      {
        "digest": "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
        "studentId": "stud-001"
      }
    ]
  }
  ```

---

## 3. Attendance Sync & Session Endpoints

### `POST /api/v1/sync/attendance-events`
- **Description:** Submits offline attendance event batches idempotently.
- **Request Body:**
  ```json
  {
    "schoolId": "sch-0001-0002",
    "deviceId": "dev-001",
    "batchId": "batch-8823",
    "events": [
      {
        "clientEventId": "evt-unique-001",
        "attendanceSessionId": "sess-9901",
        "studentId": "stud-001",
        "eventType": "QR_SCANNED",
        "statusValue": "PRESENT",
        "clientTimestamp": "2026-08-11T10:15:00.000Z",
        "metadata": { "scannerType": "CAMERA" }
      }
    ]
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "batchId": "batch-8823",
    "processedAt": "2026-08-11T10:15:02.450Z",
    "results": [
      {
        "clientEventId": "evt-unique-001",
        "status": "ACCEPTED",
        "recordStatus": "PRESENT",
        "hasConflict": false
      }
    ]
  }
  ```

### `POST /api/v1/schools/:schoolId/sessions/:sessionId/finalize`
- **Description:** Finalizes an attendance session, triggers server record projection lock, and queues SMS notification jobs for missing/absent students.
- **Response (200 OK):**
  ```json
  {
    "sessionId": "sess-9901",
    "status": "FINALIZED",
    "finalizedAt": "2026-08-11T10:30:00.000Z",
    "totalStudents": 40,
    "presentCount": 38,
    "absentCount": 2,
    "smsJobsCreated": 2
  }
  ```

---

## 4. Administrative & Import Endpoints

### `POST /api/v1/schools/:schoolId/students/import-xlsx`
- **Description:** Staged XLSX student roster import endpoint.
- **Form Data:** `file` (Multipart XLSX upload)
- **Response (200 OK):**
  ```json
  {
    "importJobId": "imp-1234",
    "status": "VALIDATED",
    "totalRows": 150,
    "validRows": 148,
    "invalidRows": 2,
    "errors": [
      { "row": 12, "column": "phone", "error": "Invalid 10-digit phone number format" }
    ]
  }
  ```

### `POST /api/v1/schools/:schoolId/qr/print-batch`
- **Description:** Generates bulk PDF/HTML print-ready QR cards for a class section.
- **Response (200 OK):** Binary PDF or HTML document containing cards with QR codes, Bengali/English student name, roll number, and school logo.
## Dashboard summary contracts

All dashboard summaries return `{ success: true, data: { ...dto, generatedAt } }`.
The server derives the school and role from the authenticated session; browser
`role`, `userId`, and `schoolId` values are not authorization inputs.

| Endpoint | Required active role | Scope |
| --- | --- | --- |
| `GET /api/v1/dashboard/super-admin/summary` | `SUPER_ADMIN` | audited platform/system context |
| `GET /api/v1/dashboard/school-admin/summary` | `SCHOOL_ADMIN` | active school tenant |
| `GET /api/v1/dashboard/teacher/summary` | `TEACHER` | active school + authenticated teacher assignments |
| `GET /api/v1/dashboard/report-viewer/summary` | `REPORT_VIEWER` or `SCHOOL_ADMIN` | active school, read-only |
| `GET /api/v1/dashboard/rfid-operator/summary` | `RFID_OPERATOR` | active school RFID telemetry |
| `POST /api/v1/auth/switch-school` | authenticated member or Super Admin support flow | authenticated session mutation |

Dashboard responses are DTOs, never raw ORM rows, and do not include password
hashes, secrets, card keys, reader secrets, session tokens, or guardian phone
numbers. School-local “today” uses the school timezone, currently defaulting to
`Asia/Kolkata` where no configured timezone is present.
