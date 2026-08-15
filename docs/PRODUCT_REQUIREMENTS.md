# Product Requirements Document (PRD)

## 1. Executive Summary & Context

**Project Name:** Offline-First QR & RFID School Attendance System for Government Schools (West Bengal)  
**Target Region:** Rural West Bengal, India  
**Timezone Default:** `Asia/Kolkata` (IST)  
**Primary Users:** Primary & Secondary Government School Teachers, School Headmasters/Admins, District Super Admins, RFID Hardware Operators.

In rural government schools across West Bengal, daily student attendance is often logged on paper registers, leading to administrative overhead, delayed reporting, and lack of real-time parent notifications. Existing digital solutions fail due to poor, intermittent, or non-existent 2G/3G/4G mobile network connectivity in rural blocks.

This application is a **bilingual (English & Bengali / বাংলা), offline-first, multi-tenant dual-modality (Optical QR & MIFARE DESFire RFID) attendance SaaS**. It enables teachers to download class rosters when online, scan student QR cards continuously without any internet connection, capture high-throughput student taps at physical school gates using hardware-secured RFID terminals, store attendance durably on local devices, and automatically sync events idempotently when connectivity is restored.

---

## 2. Scope Boundaries

### In-Scope Core Capabilities
- **Multi-Tenancy:** Strict tenant isolation where each school operates as a distinct tenant (`school_id`).
- **Offline-First PWA:** Full application shell caching, offline QR scanning, IndexedDB persistence, force-close/reboot resilience, and background outbox sync.
- **Dual Language:** Complete English and Bengali (বাংলা) localized UI and SMS templates.
- **QR Code Lifecycle:** Cryptographically secure 128-bit opaque QR credentials, bulk card PDF generation, credential revocation, and reissuance.
- **Dual Modality Attendance Capture:**
  1. *Optical QR Code Scanning:* Built-in phone camera scanning (via BarcodeDetector API or `@zxing/browser` fallback) and USB 2D hardware barcode scanner (keyboard wedge buffer).
  2. *Hardware-Secured RFID Gate Terminals:* Physical gate tap terminals (ESP32/PN532, Raspberry Pi) using MIFARE DESFire EV2/EV3 smartcards with AES-128 CMAC challenge-response mutual authentication and monotonic sequence replay protection.
- **RFID Personalization & Lifecycle:** PC/SC USB station card personalization, key diversification from school master secrets, instant card suspension/revocation, and gate anomaly monitoring.
- **Roster Snapshotting:** Freeze class rosters and roll numbers at session start to preserve historical accuracy regardless of mid-year student transfers.
- **Attendance Workflow:** Multi-state lifecycle (`DRAFT`, `OPEN`, `REVIEW`, `FINALIZED`, `REOPENED`) and attendance states (`UNMARKED`, `PRESENT`, `LATE`, `ABSENT`, `EXCUSED`, `LEAVE`).
- **Server-Driven Notifications:** Asynchronous SMS job queuing upon finalization, duplicate prevention, and retry handling via background worker process.
- **Staged XLSX Imports & Exports:** Bulk student enrollment import with validation/preview and attendance register exports (XLSX, CSV, Print HTML).
- **Audit Logging & Device Revocation:** Detailed event tracking and instant revocation of lost/compromised teacher devices and gate readers.

### Explicit Out-of-Scope Items (Non-Goals)
To maintain high performance on low-end hardware and focus on core operational reliability, the following features are **strictly prohibited**:
- General School ERP modules (Fees, Transport, Examinations, Marksheets, Hostel, Library).
- Raw biometric sensors (Fingerprint/Iris scanners) and continuous Facial Recognition algorithms.
- Continuous GPS tracking or geofencing enforcement for scanning.
- Native mobile applications for parents.
- Integrated payment gateways or subscription billing engines in the MVP.

---

## 3. Target User Personas & Workflows

### Roles
1. **SUPER_ADMIN (State/District Level):** Creates new school tenants, manages system subscriptions, monitors global tenant health, platform audit logs, and SMS delivery quotas.
2. **SCHOOL_ADMIN (Headmaster/Principal):** Manages school settings, academic years, class sections, teacher assignments, student enrollments, QR card printing, manual corrections, reopened sessions, and statutory exports (UDISE+/Banglar Shiksha).
3. **TEACHER:** Logs into assigned phone device, syncs rosters, executes daily QR scanning offline, confirms missing/absent students, finalizes daily attendance sessions.
4. **REPORT_VIEWER (Inspector/Auditor):** Read-only access to attendance registers, longitudinal trend reports, correction logs, and summary dashboards for compliance auditing.
5. **RFID_OPERATOR (Gate Specialist / Hardware Admin):** Provisions physical gate readers, executes smartcard personalization, handles card lifecycle (suspend/reactivate/revoke), and investigates gate rejection telemetry.

### Key Operational Workflows

#### A. Mobile Optical QR Workflow
1. **Online Provisioning:** Teacher logs into PWA over mobile data/Wi-Fi. Device downloads authorized class rosters and offline QR lookup hashes.
2. **Offline Field Scanning:** Internet drops completely. Teacher opens assigned class session (`OPEN`), scans student QR cards via camera or USB scanner.
3. **Local Resolution & Verification:** PWA matches QR hash against local IndexedDB, plays audio/vibration feedback, displays student photo, name (Bengali/English), and roll number for visual confirmation.
4. **Duplicate Prevention:** Re-scanning an already marked student alerts the teacher ("Already Present at 10:04 AM") without duplicating attendance events.
5. **Durability Guarantee:** If the phone battery dies or the browser app is force-closed, all queued events remain intact in IndexedDB.
6. **Review & Absence Confirmation:** Teacher switches to `REVIEW` mode to see unmarked students, marks confirmed absences, and finalizes session (`FINALIZED`).
7. **Idempotent Sync:** When connectivity returns, the PWA sends queued events in batches (`POST /api/v1/sync/attendance-events`).
8. **Server Processing & SMS:** The backend validates events, projects attendance records, flags conflicts if any, and queues SMS alert jobs for absent students.

#### B. Physical RFID Gate Workflow
1. **Gate Turnstile Tap:** Student taps MIFARE DESFire EV2/EV3 card at entrance terminal.
2. **Mutual Cryptographic Challenge:** Terminal and card perform AES-128 CMAC mutual authentication.
3. **Hardware Sequence & Anti-Replay:** Monotonic sequence counter increments; reader posts payload with mTLS certificate over secure LAN/WAN.
4. **Live Verification:** Server verifies credential status (`ACTIVE`), marks gate attendance, and mirrors record to daily class register.

---

## 4. Hardware & Infrastructure Constraints

- **Target Hardware:** Low-end Android devices (2GB–4GB RAM, Android 8.0+, Chrome v90+).
- **Scale Assumptions per School:**
  - Up to 1,400 enrolled students per school.
  - 30 to 60 active teachers per school.
  - Multi-tenant architecture supporting thousands of schools on a shared database with RLS.
- **Host Infrastructure:** Low-cost VPS running Docker Compose (Reverse Proxy, Web/API app, Background Worker, PostgreSQL database).
- **Timezone & Locale Defaults:** `Asia/Kolkata`, default language preference per school (`bn` or `en`).

---

## 5. Non-Functional Requirements (NFRs)

| NFR Domain | Requirement | Benchmark / Verification |
| :--- | :--- | :--- |
| **Performance** | QR Code Scan Resolution Time | < 200ms per scan on low-end Android phone |
| **Offline Reliability** | Local Storage Persistence | IndexedDB storage up to 50MB per school roster |
| **Data Integrity** | Event Deduplication | 100% duplicate suppression via `client_event_id` |
| **Security** | Tenant Isolation | Zero cross-tenant data leakage (verified via RLS & automated unit tests) |
| **Privacy** | Sensitive PII Caching | Zero guardian phone numbers cached on teacher client storage |
| **Localization** | Multi-lingual Completeness | 100% string coverage in English and Bengali |
