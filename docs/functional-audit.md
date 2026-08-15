# Functional Audit Report

**Repository**: `offline-qr-school-attendance`  
**Audit Target**: Surgical End-to-End Product Completion Pass  
**Date**: 2026-08-14  

---

## 1. Executive Summary

This functional audit provides a complete, grounded baseline analysis of the entire application stack—from routing and permissions to database schemas, API contracts, background workers, and client state.

The application possesses robust cryptographic foundations (AES-CMAC for DESFire EV2/EV3, Argon2id hashing, monotonic sequence enforcement, PostgreSQL Row-Level Security, and CSRF protection). However, several UI controls, dashboard cards, and workflow states currently diverge from backend contracts or rely on local simulations.

---

## 2. Architectural Overview

### 2.1 Technology Stack
- **Frontend**: React 19, TypeScript, Vite, TailwindCSS (v4), Motion, TanStack Query (v5), Dexie (IndexedDB), Lucide Icons.
- **Backend**: Node.js, Express, Drizzle ORM, PostgreSQL (`pg` / `@electric-sql/pglite` for tests), Redis / `ioredis`, Zod.
- **Security & Hardware**: WebCrypto, Native PC/SC (`pcsclite`), AES-128 CMAC, HMAC-SHA256, mTLS certificate binding.

### 2.2 Role Hierarchy
1. `SUPER_ADMIN` (Platform Administrator): Platform-level governance, school provisioning, system health, and cross-district audits.
2. `SCHOOL_ADMIN` (Headmaster / Principal): School settings, faculty directory, academic year/sections, attendance review/override, SMS broadcasts, and device oversight.
3. `TEACHER` (Classroom Instructor): Optical QR scanning, USB wedge capture, offline IndexedDB queuing, and daily roll finalization.
4. `RFID_OPERATOR` (Gate Turnstile In-Charge): Physical reader provisioning, DESFire smartcard enrollment, and real-time gate anomaly triage.
5. `REPORT_VIEWER` (District Education Inspector): Read-only daily attendance roll inspection, longitudinal trends, and statutory UDISE+ / Mid-Day Meal exports.

---

## 3. Detailed Component & Contract Findings

### 3.1 Authentication & Multi-Tenancy (Phase 1)
- **Finding 1 (Super Admin School Lockout)**: `authRoutes.ts` currently expects `memberships[0]?.schoolId` during login. When a pure platform `SUPER_ADMIN` has no tenant memberships, login throws `SCHOOL_ACCESS_DENIED`.
- **Finding 2 (Client Mock Fallbacks)**: `SessionProvider.tsx` falls back to `'default-school'`, `'Primary School'`, and `'TEACHER'` when `sessionContext` lacks an active membership.
- **Finding 3 (Non-Authoritative Switch)**: `switchSchool()` updates React state before the server confirms the switch, risking cross-tenant state desynchronization.
- **Finding 4 (Demo Credentials in Client)**: `LoginPage.tsx` embedded demo credentials directly into the client bundle.

### 3.2 School Provisioning (Phase 2)
- **Finding 1 (Missing Provisioning Slice)**: No `POST /api/v1/schools` endpoint existed to provision schools atomically with initial school admin users, memberships, and academic years.
- **Finding 2 (UDISE Normalization & Uniqueness)**: `SchoolsOverview.tsx` referenced `s.code` while database schema uses `udiseCode`. Normalization and uniqueness must be enforced at the database level.

### 3.3 School Administration (Phase 3)
- **Finding 1 (Static Staff Roster)**: `UserManagement.tsx` displayed hard-coded faculty entries rather than executing `GET /api/v1/schools/:schoolId/members`.
- **Finding 2 (Academics Endpoint Mismatch)**: `AcademicManagement.tsx` queried `/attendance/classes` rather than the canonical academic configuration endpoints (`/academics/years`, `/academics/classes`).
- **Finding 3 (Missing Student Roster Page & Staged Import)**: Staged XLSX student upload workflow was not connected to a dedicated UI route.

### 3.4 Attendance Operations (Phase 4)
- **Finding 1 (Session Oversight Text)**: `AttendanceOperations.tsx` rendered static guidelines rather than an interactive session management table.
- **Finding 2 (Teacher ID Fallbacks)**: Teacher dashboard referenced literal string `'teacher'` for actor/teacher IDs instead of the authenticated user's UUID.
- **Finding 3 (Premature Finalization Claim)**: Syncing local events was reported as "Finalized" before the server acknowledged session status transition to `FINALIZED`.

### 3.5 Reports, Audit & Notifications (Phase 5)
- **Finding 1 (Report Viewer Permission Gap)**: Backend `reportRoutes.ts` required `SCHOOL_ADMIN` or `SUPER_ADMIN`, rejecting `REPORT_VIEWER` despite frontend permissions granting `reports.read`.
- **Finding 2 (Raw JSON Rendering)**: `DailyReports.tsx` previously used `JSON.stringify(report)` instead of structured tables.
- **Finding 3 (Fabricated Notification Status)**: `NotificationOperations.tsx` displayed static "Worker Active" without querying queue telemetry or heartbeat timestamps.

### 3.6 RFID Operations (Phase 6)
- **Finding 1 (Enrollment Payload Contract Mismatch)**: `CardEnrollmentWizard.tsx` sent mismatched field names instead of the backend's expected `POST /api/v1/schools/:schoolId/rfid/credentials/enroll` payload (`studentId`, `credentialDigest`, `securityMode`, `keyVersion`).
- **Finding 2 (Mock Reader Mutations)**: `ReaderManagement.tsx` performed in-memory mutations for approving/revoking readers.

---

## 4. Remediation Plan

All findings will be resolved systematically across Phases 1 through 9. No visible control will remain a placeholder or mock; each action will be backed by verified database transactions, audit records, and automated test coverage.
