# AttendEase OS — Rural School QR Attendance Appliance

An offline-first, bilingual (**English** + **বাংলা**) QR card attendance appliance built specifically for rural government schools in West Bengal. Engineered to run reliably on low-end Android smartphones (2–4 GB RAM, Chrome browser) over intermittent 2G/4G connectivity, with one-command installation, browser setup wizard, automated AES-256 encrypted backups, and fail-closed tenant security.

---

## 🚀 One-Command Production Installation

On an Ubuntu 22.04/24.04 LTS (x86_64 or ARM64) server or appliance:

```bash
# 1. Clone repository
git clone https://github.com/Kh3rwa1/offline-qr-school-attendance.git /opt/attendease
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

| Subsystem | Scope / Maturity | Status | Configuration Notes |
| :--- | :--- | :--- | :--- |
| **Bilingual UI (English / বাংলা)** | Production QR Pilot | 🟢 **Production Ready** | One-tap language switcher across login, classroom scanner, roll review, and setup wizard. |
| **Phone Camera Viewfinder** | Production QR Pilot | 🟢 **Production Ready** | `getUserMedia` with environment-facing autofocus, permission recovery HUD, and sound/haptics. |
| **USB / OTG Barcode Scanner** | Production QR Pilot | 🟢 **Production Ready** | High-speed keyboard-wedge hardware listener with audio chimes and duplicate protection. |
| **IndexedDB Offline Outbox** | Production QR Pilot | 🟢 **Production Ready** | Atomic Dexie outbox with SHA-256 cryptographic verification and duplicate rejection. |
| **Session Finalization & Auto-Absent**| Production QR Pilot | 🟢 **Production Ready** | Atomic PostgreSQL transaction converting unmarked students to ABSENT and queuing parent alerts. |
| **Tenant Isolation (PostgreSQL RLS)**| Production QR Pilot | 🟢 **Production Ready** | Row-Level Security enforced at the database level with strict multi-tenant boundary isolation. |
| **Encrypted Backups & Recovery** | Production QR Pilot | 🟢 **Production Ready** | Automated AES-256 PBKDF2 local dumps with tested R2 disaster recovery replication drill. |
| **Indian DLT SMS Gateway** | Optional Add-on | 🟡 *Provider Dependent* | Database queue active; dispatches to real telecom carrier if credentials provided, falls back safely to console mock. |
| **RFID / DESFire Gateway** | Experimental | ⚪ *Isolated (OFF)* | Gated behind `FEATURE_RFID=false` and Docker Compose profile `["rfid"]`. Excluded from standard QR deployments. |

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
# Run TypeScript typecheck and forbidden-string security scan
npm run check

# Run full Vitest unit and integration test suite (62 test files)
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

Licensed under the MIT License. Designed in compliance with Indian Digital Personal Data Protection (DPDP) standards and West Bengal school administration guidelines.
