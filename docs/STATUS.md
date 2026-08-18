# AttendEase OS — System Status & Feature Truth

**Last Updated**: 2026-08-18  
**Target Persona**: Primary & Secondary School Teachers and School Administrators in Rural West Bengal  
**Primary Product**: UHF RFID Gate Attendance Appliance for Zebra FX9600 (EPC Class 1 Gen 2 / ISO 18000-63) with Offline QR Support.

---

## 1. Works (Production-Ready Code / Automation Verified)

- **Zebra FX9600 IoT Connector Ingest API (`/api/v1/schools/:schoolId/rfid/zebra/reads`)**: Ingests Zebra IoT Connector JSON tag-read events over HTTP/HTTPS, normalizes payloads, enforces HMAC-SHA256 signature verification or per-reader Bearer tokens, executes idempotency and duplicate debounce filtering, resolves student class enrollments, and atomically marks attendance `PRESENT`.
- **UHF EPC Gen2 Credential Management (`/api/v1/schools/:schoolId/rfid/credentials`)**: Securely binds student IDs to SHA-256 digests of canonical EPC hex strings. Never logs or stores raw EPC values after enrollment; stores only digests and last-4 characters for operational auditing.
- **Teacher Attendance Review & Finalization Dashboard**: Today's gate attendance session overview, live tap feed from FX9600 gate antennas, unmarked student roster with one-click manual overrides (Present/Absent/Late/Excused), and atomic session finalization.
- **Session Finalization & Auto-Absent**: Finalization locks the session, automatically marks remaining UNMARKED students as ABSENT, and queues parent absence SMS jobs.
- **Parent Absence SMS Queue**: Transactional PostgreSQL queue creation for guardian absence notifications upon session finalization.
- **Offline Mobile QR Attendance**: Client-side SHA-256 token matching, IndexedDB outbox sync, camera viewfinder (`getUserMedia`), and fallback scanning support.
- **Server Multi-Tenant Isolation**: PostgreSQL Row-Level Security (RLS) enforcing strict tenant separation via `app.current_school_id`.
- **Dedicated Encrypted Backup Custody**: OpenSSL AES-256-CBC envelope encryption with dedicated `BACKUP_ENCRYPTION_KEY`, SHA-256 manifests, and R2 replication drill.
- **One-Command Production Appliance Installer (`scripts/install.sh`)**: Automated installer supporting Ubuntu LTS (x86_64 and ARM64) with pre-flight diagnostics, secret generation (`0600`), Caddy reverse proxy, update, and rollback.
- **Multilingual Interface (English, বাংলা, हिंदी)**: Localized dashboards, review screens, reader management, setup wizard, and public landing pages.

---

## 2. Simulated & Pending External Validation (Explicit Status)

- **Physical Zebra FX9600 Hardware Commissioning**:
  - **Level 1 (Unit Tested)**: `AUTOMATION_VERIFIED` — Payload parsers, HMAC validation, and EPC normalization pass automated unit tests.
  - **Level 2 (Simulator Validated)**: `AUTOMATION_VERIFIED` — End-to-end simulated webhook ingest and doorway burst testing pass in CI (`scripts/hardware-runner.ts`).
  - **Level 3 (Physically Commissioned)**: `EXTERNALLY_PENDING` — Physical reader deployment, on-site RF antenna tuning, and technician sign-off are pending real-world installation. (See [`docs/hardware/FX9600_COMMISSIONING_TEMPLATE.md`](hardware/FX9600_COMMISSIONING_TEMPLATE.md) and [`docs/hardware/FX9600_EVIDENCE_REQUIREMENTS.md`](hardware/FX9600_EVIDENCE_REQUIREMENTS.md)).
- **Telecom Carrier DLT SMS Dispatch**: Database SMS job queue creation in PostgreSQL is `AUTOMATION_VERIFIED`; live carrier SMS delivery (Jio DLT, Airtel, Vi) is `EXTERNALLY_PENDING` and requires active school DLT principal credentials.
- **Government Authority Acceptance**: Export formats are structured for internal school review (`AUTOMATION_VERIFIED`); formal department acceptance is `EXTERNALLY_PENDING` and determined by education authorities.
- **Human Assistive Technology Certification**: Automated WCAG 2.2 AA testing is `AUTOMATION_VERIFIED`; human screen-reader UAT (TalkBack, VoiceOver, NVDA) is `EXTERNALLY_PENDING`.

---

## 3. Broken / Unsupported (Explicit Limitations)

- **MIFARE / DESFire EV2/EV3 Smartcards & PC/SC Readers**: Not supported. AttendEase uses passive UHF EPC Class 1 Gen 2 / ISO 18000-63 badges with fixed Zebra FX9600 gate readers. PC/SC APDU smartcard reader code is legacy/unsupported.
- **Firefox Mobile Offline Background Sync**: Service worker background sync in older mobile Firefox versions requires user interaction on reconnect.
