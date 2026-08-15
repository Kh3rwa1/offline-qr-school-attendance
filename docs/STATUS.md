# AttendEase OS — System Status & Feature Truth

Last Updated: 2026-08-15
Target Environment: Rural West Bengal Government Schools (Primary & Secondary)
Primary Product: Bilingual Offline-First QR Attendance for Low-End Android Phones (Chrome, 2–4GB RAM, intermittent 2G/4G).

---

## 1. Works (Production-Ready Code)

- **Offline QR Code Cryptographic Verification**: Ed25519 asymmetric and HMAC-SHA256 signature verification in browser client (<200ms) with tenant seed binding.
- **IndexedDB Local Data Store (Dexie)**: Client-side storage of class rosters, active sessions, offline scan queue, and unsynced attendance records.
- **Server Multi-Tenant Isolation**: PostgreSQL Row-Level Security (RLS) enforcing tenant separation via `app.current_school_id`.
- **Encrypted Local Backups**: Automated database dumps encrypted via AES-256-CBC with PBKDF2 salt and SHA-256 integrity verification.
- **Cloudflare R2 Storage Client**: Direct AWS4-HMAC-SHA256 SigV4 client for Cloudflare R2 backup archiving with exponential backoff and remote HEAD verification.
- **Universal Data Export**: Full-tenant un-truncated exports for UDISE+ compliance, absentee lists, corrections, and monthly registers.
- **RFC 4180 CSV / Excel Import**: Student roster import supporting `CREATE_ONLY`, `UPDATE_EXISTING`, and `UPSERT` modes with single-use timing-safe confirmation tokens.
- **Audit Logging**: Structured server-side audit logs capturing user actions, timestamps, IP addresses, and resource IDs.
- **PostgreSQL Compound Index Optimization**: Covered indexes for roster retrieval, cursor pagination, report aggregations, and notification queues.

---

## 2. Simulated (Not Physical Hardware)

- **RFID / NFC Card Scanning**: The RFID scan pipeline (DESFire EV2 / Mifare Classic emulation, gateway daemon, software card emulation) is a software simulation model. Physical USB PC/SC reader drivers are not certified on real hardware in this release.
- **SMS Gateway Delivery**: SMS notifications use console logging and webhook dispatch. Production DLT-registered telecom SMS pipes (e.g. Jio/Airtel/BSNL DLT) require local provider credentials.

---

## 3. Broken / In Progress (Being Fixed in `fix/qr-pilot-10`)

- **Teacher Dashboard Camera Scanning**: Camera preview `<video>` was not rendered on the main dashboard; scanner service was disconnected. *(Fixing in WP1)*
- **Offline Review Status Syncing**: Manual status changes (ABSENT, LATE, LEAVE) in teacher review UI only modified Dexie and did not queue into the sync outbox. *(Fixing in WP1 & WP2)*
- **Session Finalization Loop**: Finalize button did not trigger server finalization API, did not auto-mark unmarked students as ABSENT, and did not lock local sessions. *(Fixing in WP1 & WP3)*
- **Full Bengali (বাংলা) i18n Coverage**: Teacher and admin interfaces had partial English-only UI strings. *(Fixing in WP5)*
- **Service Worker Shell Caching**: Production service worker caching was unverified on low-end mobile viewports. *(Fixing in WP5)*
- **Security Guardrails**: Production startup fail-closed checks, session-bound CSRF validation, and route-scoped rate limiters needed tightening. *(Fixing in WP4)*
