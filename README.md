# AttendEase OS — Bilingual Offline QR School Attendance

An offline-first, bilingual (**English** + **বাংলা**) QR card attendance system built specifically for government schools in rural West Bengal. Designed to run reliably on low-end Android smartphones (2–4 GB RAM, Chrome browser) over intermittent 2G/4G mobile networks.

---

## 🎯 What It Does

1. **Teacher Daily Workflow**:
   - **Download Roster**: Teacher downloads their assigned classroom roster before class.
   - **Offline Scanning**: Works 100% offline using phone camera viewfinder or USB/OTG plug-in barcode scanners.
   - **Live Audio & Haptic Feedback**: Positive chime on success, distinctive alert on duplicate scans, buzzer on errors.
   - **Duplicate Protection**: Prevents double-marking with clear messages like *"Aniket Mondal (Roll #1) already marked PRESENT at 10:15"*.
   - **Crash-Proof Local Storage**: Attendance records are saved locally to IndexedDB/Dexie immediately upon scan.
   - **Finalization & Auto-Absent**: Teacher reviews unmarked students, overrides to LATE / LEAVE / EXCUSED, and finalizes the session (auto-marking remaining unmarked students as ABSENT).
   - **Idempotent Sync**: Reconnects when network is available to synchronize attendance events without duplicate records.
   - **Parent Absence SMS**: Server automatically queues transactional DLT SMS notifications in Bengali / English to primary guardians of absent students.

2. **Security & Data Integrity**:
   - **PostgreSQL Row-Level Security (RLS)**: Strict tenant isolation (`app.current_school_id`) prevents cross-school data access.
   - **Role-Based Access Control**: Teachers can only take attendance for their explicitly assigned classes.
   - **Session-Bound CSRF**: Cryptographic token signing prevents cross-site request forgery attacks.
   - **Nightly Encrypted Backups**: Automated AES-256 encrypted database backups to local storage; off-site Cloudflare R2 replication available when configured.

---

## ⚡ Quick Start

### Prerequisites
- Node.js 20+ and npm
- PostgreSQL 16 (or built-in PGlite for local development/testing)
- Redis 7 (optional for single-node development; required for multi-replica production)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Kh3rwa1/offline-qr-school-attendance.git
cd offline-qr-school-attendance

# 2. Copy environment file
cp .env.example .env

# 3. Install dependencies
npm install

# 4. Run database migrations & seed test data
npm run migrate
npm run seed

# 5. Start development server
npm run dev
```

Visit `http://localhost:3000` to log in with your seeded development credentials (see `src/db/seed.ts`).

---

## 🧪 Verification & Quality Gates

Run all automated checks and tests:

```bash
# Type check and forbidden-string security scan
npm run check

# Full Vitest unit and integration test suite
npm test

# Production build
npm run build
```

---

## 🧭 Hardware & Feature Status

We maintain complete honesty about feature maturity. See [`docs/STATUS.md`](docs/STATUS.md) for full details:

| Module | Status | Notes |
| :--- | :--- | :--- |
| **Bilingual UI (EN / বাংলা)** | ✅ **Working** | One-tap language toggle; localized Bengali login and classroom dashboard |
| **Phone Camera QR Scanner** | ✅ **Working** | Live `getUserMedia` stream with active viewfinder & permission error recovery |
| **USB / OTG Barcode Scanner** | ✅ **Working** | Keyboard-wedge hardware listener with audio & haptic feedback |
| **Offline IndexedDB Outbox** | ✅ **Working** | Atomic Dexie transactions with SHA-256 token digest validation |
| **Session Finalize & Auto-Absent** | ✅ **Working** | Atomic database transaction creating parent absence SMS jobs on finalize |
| **Indian DLT SMS Gateway** | ⚠️ *Simulated* | Database absence queue works; live telecom carrier dispatch is simulated unless provider credentials are set |
| **PostgreSQL RLS & Tenant Guard** | ✅ **Working** | Enforced in PostgreSQL with fail-closed security invariants |
| **Encrypted Backups (AES-256 / R2)** | ✅ **Working** | Automated AES-256-CBC local dumps; Cloudflare R2 replication requires bucket config |
| **RFID / DESFire Card Gateway** | ⚠️ *Simulated* | Frozen / emulation mode. Feature-flagged **OFF** (`FEATURE_RFID=false`) by default for the QR pilot |

---

## 🇮🇳 Indian DLT SMS Configuration

For live production SMS dispatch to parents via Indian telecom carriers:
1. Register with a DLT-approved telemarketer (e.g. Jio DLT, Airtel, Vodafone Idea).
2. Obtain your **Principal Entity ID** (PE ID) and 6-character **Sender Header** (e.g., `SCHATT`).
3. Create and approve the standard Bengali / English absence message templates.
4. Configure in `.env`:
   ```env
   SMS_PROVIDER=console          # Use 'console' for testing or 'dlt' / real webhook in production
   DLT_ENTITY_ID=1001000000000000
   DLT_HEADER_ID=SCHATT
   ```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
