# Master Implementation Plan

## Overview & Execution Strategy
The project is executed sequentially across 8 distinct milestones (Milestone 0 to Milestone 7). Each milestone focuses on a complete vertical slice of functionality, ending with strict automated linting, compilation, unit/integration testing, and verification against the acceptance test suite.

---

## Milestone Breakdown & Roadmaps

### Milestone 0: Architecture & Foundation Design (CURRENT)
- **Goal:** Complete architectural specifications, threat models, database schemas, and sync contracts without writing application code.
- **Deliverables:**
  - `docs/PRODUCT_REQUIREMENTS.md`
  - `docs/architecture/SYSTEM_ARCHITECTURE.md`
  - `docs/architecture/DATABASE_MODEL.md`
  - `docs/architecture/OFFLINE_SYNC.md`
  - `docs/architecture/SECURITY_THREAT_MODEL.md`
  - `docs/architecture/API_CONTRACTS.md`
  - `docs/IMPLEMENTATION_PLAN.md`
  - `docs/ACCEPTANCE_TESTS.md`
  - `docs/architecture-decisions/ADR-001` through `ADR-005`
- **Verification:** Architectural consistency check & approval.

---

### Milestone 1: Project Core & Authentication (COMPLETED)
- **Goal:** Setup modular monolith repository structure, database connection, Drizzle ORM migrations, Argon2id auth, multi-tenant middleware, RLS policies, audit logging, device management, and English/Bengali localization framework.
- **Deliverables:**
  - Full PostgreSQL & Drizzle ORM database schema (24 domain tables).
  - Argon2id password hashing and database-backed HTTP-only session authentication (`/api/v1/auth/login`, `/logout`, `/me`).
  - PostgreSQL Row-Level Security (RLS) policies and tenant isolation middleware using `app.current_school_id`.
  - Device authorization and token management service & endpoints.
  - PII-masked audit log engine (`auditLogService`).
  - English/Bengali localization framework (`i18n`).
  - Docker Compose development infrastructure (`docker-compose.yml`, `Dockerfile`).
  - Automated integration test suite (`tests/sessionAuth.test.ts`, `tests/tenantIsolation.test.ts`, `tests/rbac.test.ts`, `tests/auditLog.test.ts`) passing 13/13 security assertions.

---

### Milestone 2: School Administration & Student QR Credentials (COMPLETED)
- **Goal:** Build administrative management for Academic Years, Class Sections, Teacher Assignments, Student Roster CRUD, Staged XLSX Roster Imports, and Cryptographic QR Generation/Printing.
- **Deliverables:**
  - Admin UI & APIs for managing classes, teachers, students, and enrollments.
  - Staged XLSX import workflow (`Upload` -> `Validate` -> `Preview` -> `Confirm`).
  - QR Code service: 128-bit random token generation, SHA-256 digest hashing, credential revocation.
  - Printable bulk QR card PDF/HTML template rendering.

---

### Milestone 3: Online Attendance Engine & Scanner Hardware Support (COMPLETED)
- **Goal:** Build core attendance domain logic, session state transitions (`DRAFT` -> `OPEN` -> `REVIEW` -> `FINALIZED` -> `REOPENED`), camera-based scanning, USB hardware barcode scanner support, and roster snapshotting.
- **Deliverables:**
  - Attendance session lifecycle services & REST APIs (`/api/v1/attendance/*`).
  - Camera QR scanner using `@zxing/browser` and native `BarcodeDetector` API.
  - USB scanner keyboard-wedge buffer component with fast inter-keystroke input thresholding.
  - Injected test adapter (`window.__injectedScannerAdapter`, `window.__scanQRCode`) for automated test execution.
  - Audio/Visual scan feedback & visual photo/name confirmation UI.
  - Duplicate scan detection, WRONG_SCHOOL_QR alerts, REVOKED_QR_TOKEN alerts, and un-rostered student handling.
  - Session finalization locking and School Admin reopening audit workflow.
  - Comprehensive unit/integration test suite (`tests/onlineAttendance.test.ts`, `tests/scannerAdapter.test.ts`) passing 100%.

---

### Milestone 4: Offline PWA & Idempotent Synchronization Engine
- **Goal:** Implement Dexie.js IndexedDB offline storage, PWA Service Worker (Serwist), offline roster package downloads, offline QR hash matching, outbox queue, force-close/reboot persistence, batch sync endpoint, and conflict flag handling.
- **Deliverables:**
  - Dexie.js offline database abstraction.
  - Offline QR digest lookup engine.
  - Outbox manager with crash-resilient write sequence.
  - Sync endpoint (`POST /api/v1/sync/attendance-events`) with per-event idempotent response handling.
  - Network status indicator UI (Online/Offline status pill, pending outbox count).

---

### Milestone 5: Admin Reports, Corrections & Audit Trail
- **Goal:** Build School Admin attendance dashboard, attendance correction workflows with audit trails, session reopening, and report exports.
- **Deliverables:**
  - Monthly register, daily class attendance, and absent-student reports.
  - XLSX and CSV export generators using `ExcelJS`.
  - Attendance correction modal with required audit reason field.
  - Comprehensive audit log viewer for administrative actions.

---

### Milestone 6: Asynchronous SMS Background Worker Process
- **Goal:** Build PostgreSQL-backed background job queue (`pg-boss` or custom DB queue), SMS provider interface, deduplicated job creation upon session finalization, retry logic with backoff, and delivery status tracking.
- **Deliverables:**
  - Background worker process script.
  - Provider adapters (Test Console Provider, Real HTTP SMS Provider).
  - DLT template support for Indian regulatory compliance (English & Bengali).
  - SMS delivery status dashboard and usage metrics.

---

### Milestone 7: Security Hardening, Automated E2E Testing & Deployment
- **Goal:** Execute Playwright end-to-end tests covering all critical acceptance criteria, run load tests (1,400 students, 60 teachers), harden security (CSP, rate limiting, PII logging filters), create Docker Compose configuration, backup/restore runbooks, and pilot documentation.
- **Deliverables:**
  - Playwright test suite for critical acceptance criteria.
  - Docker Compose deployment files (Caddy/Nginx, Web, Worker, Postgres).
  - Backup & restore CLI scripts.
  - Operational runbooks in `docs/deployment/`.
