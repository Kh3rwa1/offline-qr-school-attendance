# Threat Model & Security Controls

## Overview
This document outlines the threat model, security controls, tenant isolation guarantees, and operational procedures for the Offline QR School Attendance & Guardian Notification System.

---

## 1. Asset Classification
- **Student PII**: Names, Bangla names, roll numbers, class/section assignments, photos.
- **Guardian PII**: Names, phone numbers, relationship, notification opt-out status.
- **Attendance Records**: Date, session, timestamp, status, verification source, scanning actor.
- **QR Credentials**: HMAC signature secret key, SHA-256 token digests.
- **User Credentials**: Argon2id password hashes, HTTP-only session cookies.

---

## 2. Threat Analysis & Mitigations

### T1: Cross-Tenant Data Access
- **Threat**: A teacher or admin from School A attempts to view or modify sessions/students in School B.
- **Mitigation**:
  - PostgreSQL Row Level Security (RLS) with `FORCE ROW LEVEL SECURITY` on all tenant-isolated tables.
  - Strict system role isolation (`attendance_system_rls` role required for system bypass).
  - Explicit multi-tenant application context (`app.current_school_id`) validated via Express middleware (`requireTenant`).

### T2: Attendance Verification Bypass / Spoofing
- **Threat**: Fraudulent QR code presentation or replay of attendance scan events.
- **Mitigation**:
  - Ed25519/HMAC signed QR payload verification with expiration timestamp enforcement.
  - Mandatory teacher assignment check on active session before scan processing.
  - Server-side idempotency evaluation scoped to `(school_id, attendance_session_id, client_event_id)`.
  - QR credentials stored only as SHA-256 hashes (`rawToken` never persisted).

### T3: Offline Sync Manipulation & Overwrites
- **Threat**: Tampered offline sync payload or batch submission by unauthorized client.
- **Mitigation**:
  - Device identifier validation against active school device registry.
  - Strict Zod schema validation limiting batch sizes (max 100 events, max 20 session objects).
  - Reconciled server session ID validation in sync conflict handling.
  - Locked finalized sessions (`FINALIZED` status immutable without school admin role and audit reason).

### T4: Import Pipeline Data Injection
- **Threat**: Uploading malformed XLSX files containing unauthorized fields or oversized payloads.
- **Mitigation**:
  - Validation endpoint returns only sanitized summary counts and max 50-row preview (never full dataset).
  - Staged import data stored securely in `import_jobs.staged_data` and cleared immediately upon execution or failure.
  - Re-validation of uniqueness and foreign key constraints inside transaction block (`executeTransactionalImport`).

### T5: Session Hijacking & Token Theft
- **Threat**: Session token interception via XSS or network sniffing.
- **Mitigation**:
  - Session tokens stored exclusively as SHA-256 hashes in database.
  - HttpOnly, Secure, SameSite=Lax session cookies.
  - `Cache-Control: no-store, no-cache, must-revalidate, private` headers on all sensitive API routes.
  - Content Security Policy (CSP) enforcing strict `default-src 'self'`.

---

## 3. Residual Risks & Operational Recommendations
- **Device Theft**: Physical theft of an authorized offline tablet requires immediate admin action to revoke device binding via `/api/v1/schools/:schoolId/devices/:deviceId/revoke`.
- **Database Backup Security**: Production database backups contain encrypted/hashed credentials and must be encrypted at rest (AES-256).
