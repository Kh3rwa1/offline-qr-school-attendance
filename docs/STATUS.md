# AttendEase OS — System Status & Feature Truth

**Last Updated**: 2026-08-16  
**Target Persona**: Primary & Secondary School Teachers and School Administrators in Rural West Bengal  
**Primary Product**: UHF RFID Gate Attendance Appliance for Zebra FX9600 (EPC Class 1 Gen 2 / ISO 18000-63) with Legacy Offline QR Support.

---

## 1. Works (Production-Ready Code)

- **Zebra FX9600 IoT Connector Ingest API (`/api/v1/schools/:schoolId/rfid/zebra/reads`)**: Ingests Zebra IoT Connector JSON tag-read events over HTTP/HTTPS, normalizes payloads, enforces HMAC-SHA256 signature verification or per-reader Bearer tokens, executes idempotency and duplicate debounce filtering, resolves student class enrollments, and atomically marks attendance `PRESENT`.
- **UHF EPC Gen2 Credential Management (`/api/v1/schools/:schoolId/rfid/credentials`)**: Securely binds student IDs to SHA-256 digests of canonical EPC hex strings. Never logs or stores raw EPC values after enrollment; stores only digests and last-4 characters for operational auditing.
- **Teacher Attendance Review & Finalization Dashboard**: Today's gate attendance session overview, live tap feed from FX9600 gate antennas, unmarked student roster with one-click manual overrides (Present/Absent/Late/Excused), and atomic session finalization.
- **Session Finalization & Auto-Absent**: Finalization locks the session, automatically marks remaining UNMARKED students as ABSENT, and queues parent absence SMS jobs.
- **Parent Absence SMS Queue**: Transactional PostgreSQL queue creation for guardian absence notifications upon session finalization.
- **Legacy Offline QR Attendance**: Client-side SHA-256 token matching, IndexedDB outbox sync, camera viewfinder (`getUserMedia`), and USB keyboard-wedge barcode scanner support retained as fallback.
- **Server Multi-Tenant Isolation**: PostgreSQL Row-Level Security (RLS) enforcing strict tenant separation via `app.current_school_id`.
- **Dedicated Encrypted Backup Custody**: OpenSSL AES-256-CBC envelope encryption with dedicated `BACKUP_ENCRYPTION_KEY`, SHA-256 manifests, and R2 replication.
- **One-Command Production Appliance Installer (`scripts/install.sh`)**: Automated installer supporting Ubuntu LTS (x86_64 and ARM64) with pre-flight diagnostics, secret generation (`0600`), Caddy reverse proxy, update, and rollback.
- **Bilingual Interface (English + বাংলা)**: Localized dashboards, review screens, reader management, and setup wizard.

---

## 2. Simulated (Software Emulation / Staged)

- **Live Physical Zebra FX9600 Hardware Gate**: The Zebra IoT Connector webhook ingest service, cryptographic verification, normalization, idempotency, debouncing, and attendance marking are 100% coded and verified with authentic fixtures. The physical FX9600 reader, antenna array (India 865–867 MHz band), and live Ethernet IoT Connector push are simulated in automated CI until physical on-site deployment.
- **Telecom Carrier DLT SMS Gateway**: Absence SMS job queue creation in PostgreSQL works; telecom SMS dispatch (Jio DLT, Airtel, Vi) uses console/webhook mode unless live credentials are provided.
- **Cloudflare R2 Backup Replication**: Local encrypted database backups work; remote replication to Cloudflare R2 is staged and verified via automated round-trip drill (`scripts/runR2LiveDrill.ts`).

---

## 3. Broken / Unsupported (Explicit Limitations)

- **MIFARE / DESFire EV2/EV3 Smartcards & PC/SC Readers**: Not supported. AttendEase uses passive UHF EPC Class 1 Gen 2 / ISO 18000-63 badges with fixed Zebra FX9600 gate readers. PC/SC APDU smartcard reader code is legacy/unsupported.
- **Firefox Mobile Offline Background Sync**: Service worker background sync in older mobile Firefox versions requires user interaction on reconnect.
