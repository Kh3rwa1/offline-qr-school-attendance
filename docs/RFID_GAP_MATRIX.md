# RFID/NFC Gap Analysis Matrix

**Baseline Commit**: `208485bbcae6a75406394a16d3f98eb1c559e692`
**Audit Date**: 2026-08-13
**Auditor**: Principal RFID/NFC Architect

---

## Executive Summary

The existing platform is a mature, well-structured QR-based school attendance system with:
- 24 PostgreSQL tables with full RLS coverage
- 8 sequential migrations with hardened tenant isolation
- Redis-backed distributed rate limiting
- Cookie-based session auth with Argon2id
- Comprehensive offline sync with idempotent event processing
- 23 unit/integration test files + 2 Playwright E2E specs
- Docker, Kubernetes, Prometheus/Grafana monitoring stack
- CI pipeline with real PostgreSQL and Redis integration tests

**No RFID/NFC functionality exists.** The entire RFID subsystem must be designed and built from scratch while preserving all existing QR functionality.

---

## 1. Existing Reusable Components

| Component | Location | Reuse Strategy |
|-----------|----------|----------------|
| Tenant isolation (`withTenantContext`) | [`src/db/index.ts`](file:///Users/dulorai/Documents/offline-qr-school-attendance/src/db/index.ts) | Direct reuse — RFID operations run inside same tenant context |
| RLS policy pattern | [`drizzle/0007_hardened_rls_and_staged_data.sql`](file:///Users/dulorai/Documents/offline-qr-school-attendance/drizzle/0007_hardened_rls_and_staged_data.sql) | Extend to new RFID tables using identical policy template |
| System context (`withSystemContext`) | [`src/db/index.ts`](file:///Users/dulorai/Documents/offline-qr-school-attendance/src/db/index.ts) | Reuse for background RFID processing |
| `tenantHandler` wrapper | [`src/middleware/tenantHandler.ts`](file:///Users/dulorai/Documents/offline-qr-school-attendance/src/middleware/tenantHandler.ts) | Reuse for all RFID admin API routes |
| Auth middleware | [`src/middleware/authMiddleware.ts`](file:///Users/dulorai/Documents/offline-qr-school-attendance/src/middleware/authMiddleware.ts) | Reuse for human-initiated RFID operations |
| Distributed rate limiter | [`src/middleware/distributedRateLimiter.ts`](file:///Users/dulorai/Documents/offline-qr-school-attendance/src/middleware/distributedRateLimiter.ts) | Extend with RFID-specific policies |
| Prometheus metrics | [`src/middleware/metrics.ts`](file:///Users/dulorai/Documents/offline-qr-school-attendance/src/middleware/metrics.ts) | Extend with RFID counters and histograms |
| Audit log service | [`src/services/auditLogService.ts`](file:///Users/dulorai/Documents/offline-qr-school-attendance/src/services/auditLogService.ts) | Extend with RFID-specific action types |
| Offline sync pattern | [`src/services/offlineSyncService.ts`](file:///Users/dulorai/Documents/offline-qr-school-attendance/src/services/offlineSyncService.ts) | Adapt pattern for RFID offline queue |
| QR credential lifecycle | [`src/services/qrService.ts`](file:///Users/dulorai/Documents/offline-qr-school-attendance/src/services/qrService.ts) | Mirror digest-based pattern for RFID credentials |
| Attendance event engine | [`src/services/attendanceService.ts`](file:///Users/dulorai/Documents/offline-qr-school-attendance/src/services/attendanceService.ts) | Extend to accept RFID-sourced events |
| DB pool budget validation | [`src/db/index.ts`](file:///Users/dulorai/Documents/offline-qr-school-attendance/src/db/index.ts) | Reuse for RFID gateway connections |
| K8s manifests | [`k8s/`](file:///Users/dulorai/Documents/offline-qr-school-attendance/k8s) | Extend with RFID gateway deployment |
| Grafana dashboards | [`monitoring/`](file:///Users/dulorai/Documents/offline-qr-school-attendance/monitoring) | Extend with RFID panels |

---

## 2. Required Database Additions

### New Tables

| Table | Purpose | Gap Level |
|-------|---------|-----------|
| `rfid_credentials` | Card credential storage (digest, status, lifecycle) | 🔴 Missing |
| `rfid_readers` | Reader device registry (model, location, security) | 🔴 Missing |
| `rfid_scan_events` | Raw scan event log (decision, timing, audit) | 🔴 Missing |
| `rfid_key_versions` | HMAC/crypto key version tracking | 🔴 Missing |

### Schema Modifications to Existing Tables

| Table | Change | Gap Level |
|-------|--------|-----------|
| `attendance_events` | Add `capture_method` column | 🔴 Missing |
| `attendance_events` | Add `source_reader_id` column | 🔴 Missing |
| `attendance_events` | Add `source_rfid_event_id` column | 🔴 Missing |
| `attendance_records` | Add `capture_method` column | 🔴 Missing |
| `attendance_records` | Add `confidence_level` column | 🔴 Missing |
| `attendance_records` | Add `direction` column | 🔴 Missing |

### New Enums / Types Needed

| Type | Values |
|------|--------|
| `capture_method` | `QR`, `RFID_SECURE`, `RFID_UID_LEGACY`, `MANUAL` |
| `rfid_credential_status` | `PENDING`, `ACTIVE`, `SUSPENDED`, `REVOKED`, `REPLACED`, `EXPIRED` |
| `rfid_reader_status` | `PENDING`, `ACTIVE`, `SUSPENDED`, `REVOKED`, `RETIRED` |
| `rfid_security_mode` | `SECURE`, `UID_LEGACY` |
| `rfid_adapter_type` | `GATEWAY`, `USB_HID`, `WEB_SERIAL`, `NETWORK` |
| `scan_decision` | `ACCEPTED`, `DUPLICATE`, `UNKNOWN_CARD`, `REVOKED_CARD`, etc. |
| `direction_mode` | `ENTRY`, `EXIT`, `BIDIRECTIONAL`, `NONE` |

---

## 3. API Additions Required

### RFID Scan Endpoint
| Method | Path | Purpose | Gap |
|--------|------|---------|-----|
| `POST` | `/api/v1/schools/:schoolId/rfid/scans` | Process RFID scan from reader | 🔴 Missing |

### RFID Credential Management
| Method | Path | Purpose | Gap |
|--------|------|---------|-----|
| `POST` | `/api/v1/schools/:schoolId/rfid/credentials/enroll` | Begin card enrollment | 🔴 Missing |
| `GET` | `/api/v1/schools/:schoolId/rfid/credentials` | List credentials | 🔴 Missing |
| `GET` | `/api/v1/schools/:schoolId/rfid/credentials/:id` | Get credential details | 🔴 Missing |
| `POST` | `/api/v1/schools/:schoolId/rfid/credentials/:id/activate` | Activate card | 🔴 Missing |
| `POST` | `/api/v1/schools/:schoolId/rfid/credentials/:id/suspend` | Suspend card | 🔴 Missing |
| `POST` | `/api/v1/schools/:schoolId/rfid/credentials/:id/reactivate` | Reactivate card | 🔴 Missing |
| `POST` | `/api/v1/schools/:schoolId/rfid/credentials/:id/revoke` | Revoke card | 🔴 Missing |
| `POST` | `/api/v1/schools/:schoolId/rfid/credentials/:id/replace` | Replace card atomically | 🔴 Missing |
| `POST` | `/api/v1/schools/:schoolId/rfid/credentials/bulk-enroll` | Bulk enrollment | 🔴 Missing |
| `GET` | `/api/v1/schools/:schoolId/rfid/credentials/:id/history` | Card history | 🔴 Missing |

### RFID Reader Management
| Method | Path | Purpose | Gap |
|--------|------|---------|-----|
| `POST` | `/api/v1/schools/:schoolId/rfid/readers/register` | Register reader | 🔴 Missing |
| `GET` | `/api/v1/schools/:schoolId/rfid/readers` | List readers | 🔴 Missing |
| `POST` | `/api/v1/schools/:schoolId/rfid/readers/:id/approve` | Approve reader | 🔴 Missing |
| `POST` | `/api/v1/schools/:schoolId/rfid/readers/:id/suspend` | Suspend reader | 🔴 Missing |
| `POST` | `/api/v1/schools/:schoolId/rfid/readers/:id/revoke` | Revoke reader | 🔴 Missing |
| `PATCH` | `/api/v1/schools/:schoolId/rfid/readers/:id` | Update reader config | 🔴 Missing |
| `GET` | `/api/v1/schools/:schoolId/rfid/readers/:id/health` | Reader health | 🔴 Missing |

### RFID Offline Sync
| Method | Path | Purpose | Gap |
|--------|------|---------|-----|
| `GET` | `/api/v1/schools/:schoolId/rfid/offline/roster` | Download credential roster | 🔴 Missing |
| `POST` | `/api/v1/schools/:schoolId/rfid/offline/sync` | Upload queued scans | 🔴 Missing |

### RFID Reporting
| Method | Path | Purpose | Gap |
|--------|------|---------|-----|
| `GET` | `/api/v1/schools/:schoolId/rfid/reports/scans` | Scan report | 🔴 Missing |
| `GET` | `/api/v1/schools/:schoolId/rfid/reports/readers` | Reader status report | 🔴 Missing |
| `GET` | `/api/v1/schools/:schoolId/rfid/reports/rejections` | Rejection diagnostics | 🔴 Missing |

---

## 4. Reader Integration Architecture

### Current State
- **Scanner service** ([`src/services/scannerService.ts`](file:///Users/dulorai/Documents/offline-qr-school-attendance/src/services/scannerService.ts)): QR-only, uses `html5-qrcode` in browser
- **No reader abstraction layer** exists
- **No device authentication** beyond cookie-based user sessions
- **No hardware adapter interface**

### Required Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Reader Adapter Layer                         │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│   Gateway    │   USB HID    │  Web Serial  │  Network Reader   │
│   Adapter    │   Adapter    │   Adapter    │    Adapter        │
│  (Production)│  (Legacy)    │  (Browser)   │  (Enterprise)     │
├──────────────┴──────────────┴──────────────┴───────────────────┤
│                    Common Adapter Interface                      │
│  connect, disconnect, readCredential, cancelRead, health        │
│  readerIdentifier, firmwareMetadata, securityCapability         │
├─────────────────────────────────────────────────────────────────┤
│                  Normalized Scan Envelope                        │
│  version, schoolId, readerId, credentialDigest/proof,           │
│  timestamp, sequence, nonce, direction, sessionContext,         │
│  securityMode, signature/MAC                                    │
├─────────────────────────────────────────────────────────────────┤
│                   Scan Processing Engine                        │
│  Validate → Authenticate → Lookup → Decide → Record → Respond  │
├─────────────────────────────────────────────────────────────────┤
│                Existing Attendance Engine                        │
│  Same idempotency, audit, reporting for QR + RFID              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Offline Security Model

### Current Offline Model
- Client downloads roster (students, enrollments, QR digests) to IndexedDB
- Events created offline with `clientEventId` for idempotency
- Sync uploads events; server resolves conflicts via timestamp

### Required RFID Offline Model

| Requirement | Current State | Gap |
|-------------|--------------|-----|
| Encrypted credential allow-list on gateway | Not applicable (QR is different) | 🔴 Missing |
| Gateway-signed offline events | No gateway concept | 🔴 Missing |
| Bounded offline queue with encryption | Browser IndexedDB only | 🔴 Missing |
| Revocation freshness limit | No revocation checking | 🔴 Missing |
| Offline policy (max duration, max drift) | Not configured | 🔴 Missing |
| Fail-open/fail-closed configuration | Not implemented | 🔴 Missing |
| Queue depth monitoring | Not tracked | 🔴 Missing |
| UI: reader online/offline indicator | Basic offline indicator exists | 🟡 Partial |

---

## 6. Hardware Certification Requirements

| Requirement | Status |
|-------------|--------|
| Defined reader adapter interface | 🔴 Missing |
| At least one real reader integration | 🔴 Missing |
| MIFARE DESFire EV2/EV3 support documented | 🔴 Missing |
| USB HID/keyboard-wedge support | 🔴 Missing |
| Web Serial/WebUSB support | 🔴 Missing |
| Hardware certification test matrix | 🔴 Missing |
| Reader firmware inventory tracking | 🔴 Missing |
| Clock drift detection | 🔴 Missing |

---

## 7. Migration and Rollback Strategy

### Proposed Migration Sequence

| Migration | Purpose | Rollback Strategy |
|-----------|---------|-------------------|
| `0009_rfid_enums_and_types.sql` | Create enums for capture methods, statuses | DROP TYPE statements |
| `0010_rfid_credentials.sql` | Create rfid_credentials table with RLS | DROP TABLE |
| `0011_rfid_readers.sql` | Create rfid_readers table with RLS | DROP TABLE |
| `0012_rfid_scan_events.sql` | Create rfid_scan_events table with RLS | DROP TABLE |
| `0013_rfid_key_versions.sql` | Key version tracking | DROP TABLE |
| `0014_attendance_capture_method.sql` | Add capture_method to attendance tables | ALTER TABLE DROP COLUMN |
| `0015_rfid_rls_policies.sql` | Apply hardened RLS to all RFID tables | Revert policies |

### Migration Principles
- All migrations are additive (new tables/columns)
- No existing table modifications that break QR
- Default `capture_method = 'QR'` for existing records
- Each migration independently rollback-safe
- Test with real PostgreSQL before merge

---

## 8. Security Gap Summary

| Security Requirement | Status | Risk |
|---------------------|--------|------|
| Never store raw RFID UID | 🔴 Not implemented | HIGH — must enforce from day 1 |
| HMAC-based UID transformation | 🔴 Not implemented | HIGH — core security control |
| Timing-safe comparison | 🔴 Not implemented | MEDIUM — side-channel risk |
| Reader mutual authentication | 🔴 Not implemented | HIGH — reader spoofing |
| Replay resistance | 🔴 Not implemented | HIGH — attendance fraud |
| Key versioning/rotation | 🔴 Not implemented | MEDIUM — operational necessity |
| Legacy mode disabled by default | 🔴 Not implemented | HIGH — security posture |
| Input sanitization for reader data | 🔴 Not implemented | HIGH — injection prevention |
| No card secrets in browser JS | 🔴 Not applicable yet | HIGH — architecture constraint |

---

## 9. Testing Gap Summary

| Test Category | Existing Coverage | RFID Gap |
|---------------|------------------|----------|
| Unit tests | 23 files | 🔴 0 RFID tests |
| PostgreSQL RLS integration | 1 file, real PG | 🔴 No RFID RLS tests |
| Redis multi-replica | 1 file, real Redis | 🔴 No RFID rate limit tests |
| API integration | Multiple files | 🔴 No RFID API tests |
| Playwright E2E | 2 specs | 🔴 No RFID UI tests |
| Load tests | Directory exists | 🔴 No RFID load tests |
| Hardware tests | None | 🔴 No hardware certification |
| Offline sync | 1 file | 🔴 No RFID offline tests |

---

## 10. Infrastructure Gap Summary

| Component | Status | Gap |
|-----------|--------|-----|
| Docker: RFID gateway container | 🔴 Missing | New container needed |
| K8s: Gateway deployment | 🔴 Missing | New manifests |
| K8s: NetworkPolicy for readers | 🔴 Missing | Ingress rules |
| Monitoring: RFID Grafana panels | 🔴 Missing | New dashboards |
| Monitoring: RFID alert rules | 🔴 Missing | New alert config |
| CI: RFID test jobs | 🔴 Missing | New workflow jobs |
| CI: Hardware certification job | 🔴 Missing | Manual + automated |
| Security: SBOM for RFID deps | 🔴 Missing | New scan config |
| ENV: RFID configuration variables | 🔴 Missing | New env vars needed |

---

## 11. Documentation Gap Summary

| Document | Status |
|----------|--------|
| `docs/RFID_ARCHITECTURE.md` | 🔴 Missing |
| `docs/RFID_SECURITY_MODEL.md` | 🔴 Missing |
| `docs/RFID_HARDWARE_COMPATIBILITY.md` | 🔴 Missing |
| `docs/RFID_READER_GATEWAY.md` | 🔴 Missing |
| `docs/RFID_CARD_ENROLLMENT.md` | 🔴 Missing |
| `docs/RFID_OFFLINE_OPERATION.md` | 🔴 Missing |
| `docs/RFID_KEY_ROTATION.md` | 🔴 Missing |
| `docs/RFID_INCIDENT_RESPONSE.md` | 🔴 Missing |
| `docs/RFID_PRODUCTION_CERTIFICATION.md` | 🔴 Missing |

---

## Estimated Scope

| Category | Items | Complexity |
|----------|-------|------------|
| New database tables | 4 | Medium |
| Schema modifications | 6 columns across 2 tables | Low |
| New migrations | 7 | Medium |
| New API endpoints | ~25 | High |
| New services | 5-6 (rfid, reader, scan, credential, offline, crypto) | High |
| New middleware | 2-3 (reader auth, RFID rate limit) | Medium |
| Frontend components | 8-10 (dashboard, enrollment, reader mgmt, reports) | High |
| Test files | 15-20 new test files | High |
| Documentation | 9 new docs | Medium |
| Infrastructure | 4-5 new configs | Medium |
| **Total new files** | **~60-80** | **Very High** |
