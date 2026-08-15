# AttendEase OS — System Status & Feature Truth

**Last Updated**: 2026-08-15  
**Target Persona**: Primary & Secondary School Teachers and School Administrators in Rural West Bengal  
**Primary Product**: Bilingual Offline-First QR Attendance Appliance for Low-End Android Smartphones (Chrome, 2–4 GB RAM, intermittent 2G/4G, Asia/Kolkata).

---

## 1. Works (Production-Ready Code)

- **One-Command Production Appliance Installer (`scripts/install.sh`)**: Automated installer supporting Ubuntu LTS (x86_64 and ARM64) with pre-flight RAM/disk/Docker validation, automated secret generation (`0600`), and Caddy reverse proxy.
- **First-Run Web Setup Wizard (`/setup`)**: 4-step onboarding creating the initial Super Administrator, primary school provisioning, optional CSV roster import, rate limiting, and permanent lockdown upon completion.
- **Appliance Management CLI (`bin/attendease`)**: Operational CLI supporting `status`, `backup`, `restore`, `repair`, `diagnostics`, `update`, and `rollback`.
- **Dedicated Encrypted Backup Custody**: OpenSSL AES-256-CBC PBKDF2 envelope encryption using dedicated `BACKUP_ENCRYPTION_KEY`, SHA-256 integrity manifest generation, and verified R2 disaster recovery drill.
- **Offline QR Code Token Digest Matching**: Client-side SHA-256 digest computation and instant local match (<200ms) against the downloaded class section roster package.
- **Teacher Mobile Attendance Loop**: Live environment-facing camera viewfinder stream (`getUserMedia`) and USB / OTG keyboard-wedge hardware scanner listeners with audio chimes and haptic feedback.
- **IndexedDB Local Data Store (Dexie)**: Client-side persistent storage of class rosters, active sessions, and crash-proof atomic sync outbox (survives app close and phone reboot).
- **Duplicate Scan Protection**: Prevents duplicate recording with clear timestamped alert: `"Student Name (Roll #X) already marked PRESENT at HH:MM"`.
- **Manual Review & Status Overrides**: Teacher can review unmarked students and set ABSENT / LATE / LEAVE / EXCUSED; every update enters the atomic outbox.
- **Session Finalization & Auto-Absent**: Finalization auto-marks remaining UNMARKED students as ABSENT, syncs outbox events, calls server finalization API, and locks the local session.
- **Parent Absence SMS Jobs**: Server-side transactional queue creation for guardian absence notifications during session finalization.
- **Server Multi-Tenant Isolation**: PostgreSQL Row-Level Security (RLS) enforcing strict tenant separation via `app.current_school_id`.
- **Teacher Assignment Authorization**: Teachers can only take attendance for class sections to which they are assigned.
- **Session-Bound Anti-CSRF**: Cryptographic token signing preventing cross-site request forgery on state-modifying requests.
- **Bilingual Interface (English + বাংলা)**: Localized login, dashboard, viewfinder HUD, error states, and setup wizard for rural West Bengal educators.
- **UDISE+ Data Portability**: Un-truncated student and attendance exports for school administrators.
- **FEATURE_RFID Isolation**: RFID feature flag defaults to false (`FEATURE_RFID=false`), Docker profile `["rfid"]` omitted, disabling all RFID API endpoints (404) and hiding RFID UI navigation.
- **License**: MIT Open Source License.

---

## 2. Simulated (Software Emulation / Staged)

- **RFID / DESFire Hardware**: The RFID module (Mifare DESFire EV2/EV3, reader authentication, APDU gateway daemon) is a software emulation model. Feature-flagged **OFF** (`FEATURE_RFID=false`) by default for the QR pilot.
- **Telecom Carrier DLT SMS Gateway**: Absence SMS job queue creation in PostgreSQL works; actual telecom SMS dispatch (Jio DLT, Airtel, Vi) uses console/webhook simulation unless live credentials are provided.
- **Cloudflare R2 Backup Replication**: Local encrypted database backups work; remote replication to Cloudflare R2 is staged and verified via automated round-trip drill (`scripts/runR2LiveDrill.ts`), requiring active Cloudflare R2 bucket credentials for live cloud uploads.

---

## 3. Broken / Untested (Explicit Limitations)

- **Physical USB OTG PC/SC Smartcard Readers on Android**: No physical hardware certification; frozen and simulated.
- **Firefox Mobile Offline Background Sync**: Service worker background sync in older mobile Firefox versions requires user interaction on reconnect.
