# AttendEase OS — System Status & Feature Truth

**Last Updated**: 2026-08-15  
**Target Environment**: Rural West Bengal Government Schools (Primary & Secondary)  
**Primary Product**: Bilingual Offline-First QR Attendance for Low-End Android Phones (Chrome, 2–4 GB RAM, intermittent 2G/4G).

---

## 1. Works (Production-Ready Code)

- **Offline QR Code Token Digest Matching**: Client-side SHA-256 digest computation and fast lookup (<200ms) against the school-signed downloaded roster package.
- **Teacher Mobile Attendance Loop**: Live environment-facing camera viewfinder stream (`getUserMedia`) and USB / OTG keyboard-wedge hardware scanner listeners with audio chimes and haptic feedback.
- **IndexedDB Local Data Store (Dexie)**: Client-side persistent storage of class rosters, active sessions, and crash-proof atomic sync outbox (survives app close and phone reboot).
- **Duplicate Scan Protection**: Prevents double-marking with clear timestamps: `"Student Name (Roll #X) already marked PRESENT at HH:MM"`.
- **Manual Review & Status Overrides**: Teacher can review unmarked students and set ABSENT / LATE / LEAVE / EXCUSED; every update enters the atomic outbox.
- **Session Finalization & Auto-Absent**: Finalization auto-marks remaining UNMARKED students as ABSENT, syncs outbox events, calls server finalization API, and locks the local session.
- **Parent Absence SMS Jobs**: Server-side transactional queue creation for guardian absence notifications during session finalization.
- **Server Multi-Tenant Isolation**: PostgreSQL Row-Level Security (RLS) enforcing strict tenant separation via `app.current_school_id`.
- **Teacher Assignment Authorization**: Teachers can only take attendance for class sections to which they are assigned.
- **Session-Bound Anti-CSRF**: Cryptographic token signing preventing cross-site request forgery on state-modifying requests.
- **Bilingual Interface (English + বাংলা)**: Full bilingual dictionary and one-tap language switch pill tailored for rural West Bengal educators.
- **Automated Encrypted Backups**: Local AES-256-CBC PBKDF2 database dump encryption and Cloudflare R2 object storage replication.
- **UDISE+ Data Portability**: Un-truncated student and attendance exports for government reporting.

---

## 2. Simulated (Software Emulation / Staged)

- **RFID / DESFire Hardware**: The RFID module (Mifare DESFire EV2/EV3, reader authentication, APDU gateway daemon) is a software emulation model. Feature-flagged **OFF** (`FEATURE_RFID=false`) by default for the QR pilot.
- **Telecom Carrier DLT SMS Pipe**: Live SMS delivery uses console and webhook dispatchers. Production carrier routing (Jio DLT, Airtel, Vodafone Idea) requires registered Entity and Template IDs.

---

## 3. Broken / Untested (Explicit Limitations)

- **Physical USB PC/SC Smartcard Readers**: No physical hardware certification; frozen and simulated.
- **Automated Offline PWA Shell Pre-caching in Firefox Mobile**: While `sw.js` caches the app shell in Chromium, service worker background sync behavior in older Firefox versions requires user interaction on reconnect.
