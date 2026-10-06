# AttendEase OS — UHF RFID Gate Attendance Appliance for Zebra FX9600

An enterprise, bilingual (**English** + **বাংলা**) UHF RFID gate attendance appliance built for **Zebra FX9600** fixed RFID readers (EPC Class 1 Gen 2 / ISO 18000-63) with legacy offline QR support. Engineered for walk-through gate attendance in schools, supporting Zebra IoT Connector HTTP webhooks, HMAC-SHA256 signature verification, per-reader Bearer authentication, duplicate debounce filtering, teacher review/finalization, automated AES-256 encrypted backups, and fail-closed tenant security.

> **Hardware Architecture**:
> - **Fixed Reader**: Zebra FX9600 UHF Fixed Reader (Ethernet / PoE, 4 or 8 antenna ports).
> - **Tags**: Passive UHF EPC Gen2 badges/cards (ISO 18000-63).
> - **Integration**: Zebra IoT Connector HTTP/HTTPS webhook (`POST /api/v1/schools/:schoolId/rfid/zebra/reads`).
> - **Legacy / Unsupported**: MIFARE / DESFire / PC/SC smartcard readers are **not supported**.

---

## 🚀 One-Command Production Installation

On an Ubuntu 22.04/24.04 LTS (x86_64 or ARM64) server or appliance:

```bash
# 1. Clone repository
git clone https://github.com/Kh3rwa1/attendease-os.git /opt/attendease
cd /opt/attendease

# 2. Run the production installer
./scripts/install.sh install
```

The installer performs pre-flight system diagnostics (RAM, disk, architecture, ports, Docker Engine & Compose v2), generates cryptographically secure secrets (with restrictive `0600` permissions), provisions the Caddy reverse proxy, and verifies system readiness probes (`/readyz`).

---

## 🌐 First-Run Setup Wizard (`/setup`)

Once installed, open your browser and navigate to:
```
http://<server-ip-or-domain>/setup
```

The 4-step web setup wizard guides the school operator through:
1. **Pre-flight Readiness**: Live diagnostics for PostgreSQL, encrypted backup keys, background workers, and optional Cloudflare R2 staging.
2. **Platform Super Administrator**: Create the master administrative account (Argon2id password hashing, E.164 phone number).
3. **School Provisioning & Roster CSV Import**: Register the primary school, district, UDISE+ code, and optionally upload a student roster CSV (`studentName`, `rollNumber`, `className`, `sectionName`, `guardianPhone`).
4. **Permanent Lockdown**: Once completed, the setup wizard is permanently locked against further execution, with full audit trail logging.

---

## 🛠️ Appliance Management CLI (`bin/attendease`)

AttendEase OS includes a dedicated CLI helper for daily operations:

```bash
# Check service health and latest backup status
./bin/attendease status

# Execute an immediate AES-256 encrypted local backup snapshot
./bin/attendease backup

# Restore database from an encrypted backup archive
./bin/attendease restore ./backups/attendease-YYYYMMDDHHMMSS.sql.gz.enc

# Run comprehensive diagnostic report
./bin/attendease diagnostics

# Trigger self-healing container restart
./bin/attendease repair

# Safe application upgrade with automatic rollback on health failure
./bin/attendease update

# Safe rollback to previous container state
./bin/attendease rollback

# Stop appliance (add --purge to erase database volumes)
./bin/attendease uninstall
```

---

## 🔐 Backup Encryption & Key Custody

AttendEase OS utilizes envelope encryption for all local and off-site database archives:
- **Dedicated Backup Key**: Configured via `BACKUP_ENCRYPTION_KEY` in `.env` (strictly independent of web session secrets).
- **Encryption Standard**: OpenSSL `AES-256-CBC` with PBKDF2 key derivation and random salt.
- **Integrity Manifest**: Every backup generates a SHA-256 checksum manifest (`.checksums.sha256`) and metadata JSON manifest (`.manifest.json`).
- **Cloudflare R2 Off-Site Replication**: When `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` are provided, backups are automatically replicated to off-site S3-compatible cloud storage.

---

## 🧭 Hardware & Subsystem Status

We maintain complete honesty regarding hardware maturity and subsystem status:

<!-- status:start -->
| Subsystem | Status | What that means | Evidence |
|---|---|---|---|
| **Zebra FX9600 ingest** | `Software-verified` | Webhook contract tested against recorded payloads; batched ingest, idempotent, p95 < 300 ms on 4 GB ARM appliance. _Limits: No physical reader commissioning yet; Read rate in real gate conditions unmeasured._ | [test](tests/rfid/zebraIotConnector.test.ts), [load-test](docs/evidence/2026-10-load-test.md) |
| **UHF EPC Credential Vault** | `Software-verified` | Salted SHA-256 EPC digests, HKDF per-reader secret derivation, canonicalized hex representation. _Limits: UHF EPC tags can be read and cloned with inexpensive writers; hashing EPCs at rest does not prevent physical over-the-air tag cloning._ | [test](tests/rfid/rfidCrypto.test.ts), [test](tests/rfid/rfidCredentialLifecycle.test.ts) |
| **Encrypted Backups** | `Software-verified` | Automated pg_dump extraction, age key encryption, Cloudflare R2 offsite replication, and restore drill script. _Limits: Cloudflare R2 offsite sync requires external credentials; automated restores verified in container drills._ | [test](tests/disasterRecovery.test.ts), [load-test](docs/evidence/2026-10-load-test.md) |
| **Tenant isolation (RLS)** | `Software-verified` | FORCE RLS on tenant tables; transaction-local tenant context; pooled-connection leak tests. _Limits: System-level super-admin queries bypass tenant scoping; requires audited session context._ | [test](tests/security/csrf-exemptions.test.ts), [load-test](docs/evidence/2026-10-load-test.md) |
| **Offline QR Attendance** | `Software-verified` | Dexie.js indexed storage, cryptographically signed event queue, mobile camera scanning, and idempotent reconnect sync. _Limits: Requires browser camera permissions; iOS background sync requires foreground tab reactivation._ | [test](tests/crossSchoolOfflineScoping.test.ts), [test](tests/offlineDbMigration.test.ts) |
| **Session Finalization & DLT SMS Queue** | `Software-verified` | Atomic attendance session lock, idempotent SMS job generation, Telecom DLT template formatting, and HMAC callback processing. _Limits: Real SMS transmission requires approved DLT headers, templates, and active telecom gateway account._ | [test](tests/notificationsAndSms.test.ts), [test](tests/dltSmsProvider.test.ts) |
| **Multilingual UI** | `Software-verified` | Complete trilingual English, Bengali, and Hindi localization across all role dashboards and forms. _Limits: Field pilot linguistic validation across rural districts is ongoing._ | [test](tests/i18nCompleteness.test.ts), [test](tests/landingPageLocalization.test.ts) |
| **Administrative Reporting** | `Software-verified` | ExcelJS monthly registers, daily rosters, absentee breakdowns, and corrections audit exports. _Limits: Exports are designed for internal school management; school headmaster must review before external submission._ | [test](tests/dailyReportsFormatting.test.ts) |
<!-- status:end -->

---

## 👨‍💻 Developer & Local Testing Guide

### Prerequisites
- Node.js 20+ and npm
- PostgreSQL 16 (or built-in PGlite engine for local tests)
- Docker & Docker Compose v2

### Local Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Run database migrations & seed development tenant
npm run migrate
npm run seed

# 4. Start local development server
npm run dev
```

### Test & Quality Gates

```bash
# Run TypeScript typecheck, forbidden strings, and product claims guardrail
npm run check

# Run full Vitest unit and integration test suite
npm test

# Run Playwright end-to-end browser tests
npm run test:e2e

# Run Cloudflare R2 Disaster Recovery round-trip drill
npx tsx scripts/runR2LiveDrill.ts

# Production build
npm run build
```

---

## 📄 License & Compliance

Licensed under the MIT License. Designed in alignment with Indian Digital Personal Data Protection (DPDP) privacy principles and school administrative reporting workflows. Attendance exports are prepared for school internal administrative review.
