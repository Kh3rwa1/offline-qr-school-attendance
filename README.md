# Hybrid Offline QR + Production RFID/NFC School Attendance Platform

An enterprise-grade hybrid attendance platform supporting school-issued QR credentials, MIFARE DESFire EV2/EV3 RFID cards, and NFC hardware gateways. Features multi-tenant PostgreSQL Row-Level Security (RLS), atomic Redis idempotency, AES-256-GCM encrypted per-reader secrets, and offline outbox synchronization.

---

## 🚀 Quality Gates & Verification

```bash
npm run check          # TypeScript static analysis (0 errors)
npm test               # 100% passing unit & integration test suite
npm run test:e2e       # Playwright browser end-to-end tests
npm run test:postgres  # Restricted PostgreSQL RLS & Schema Completeness Audit
npm run test:load-smoke# Mandatory Pull-Request Load Smoke Gate
npm run test:load-full # 10-scenario full-scale business load benchmark
npm run build          # Vite production SPA + Node CJS bundles
```

---

## 🛡️ Architecture & Security Model

1. **Multi-Tenant Row-Level Security (RLS)**:
   - Every tenant table enforces `rowsecurity = true` and `forcerowsecurity = true`.
   - Application connections run as `attendance_app` (`NOSUPERUSER`, `NOBYPASSRLS`).
   - Every request executes inside `withTenantContext(schoolId)` setting `app.current_school_id` transactionally.

2. **DESFire EV2/EV3 RFID & Reader Security**:
   - AES-128 3-Pass Mutual Authentication & AN10922 key diversification.
   - Per-reader HMAC secrets encrypted via AES-256-GCM (`shared_secret_encrypted`).
   - mTLS client certificate fingerprint matching and canonical envelope signature verification.

3. **Redis Multi-Replica & Rate Limiting**:
   - Shared sliding-window rate limiter powered by atomic Lua scripts.
   - HMAC-SHA256 hashed rate limit keys eliminate raw IP/phone exposure in Redis storage.
   - Resilient fallback returning HTTP 503 during Redis infrastructure outages.

4. **Offline Sync & Idempotency**:
   - Dexie/IndexedDB transactional outbox storing client event UUIDs.
   - Signed offline rosters with tamper-evident HMAC validation.
   - Batch synchronization with chunked concurrency meeting < 10,000 ms SLO for 5,000 events.

---

## 🇮🇳 Indian Production DLT/SMS Prerequisites

For live production SMS delivery in India:
- **DLT Telemarketer Registration**: Entity ID and Principal Entity (PE) registration with telecom operators.
- **Header Registration**: Registered 6-alpha Sender ID (e.g. `SCHATT`).
- **Template ID**: Approved Content Template ID containing variables (e.g., `{#var#}`).
- Set production environment variables:
  ```env
  SMS_PROVIDER=dlt
  DLT_ENTITY_ID=1001xxxxxxxxxxxxxx
  DLT_HEADER_ID=SCHATT
  DLT_TEMPLATE_ID=1107xxxxxxxxxxxxxx
  ```

---

## 📦 Container & Kubernetes Operations

- **Docker Compose**: `docker compose up -d --build` bootstraps PostgreSQL 16, Redis 7, database role setup, Drizzle migrations, web app, and SMS worker container.
- **Kubernetes**: Production manifests located in `k8s/` including Deployments, Services, Ingress, NetworkPolicies, ServiceMonitor, HPA, PDB, and ExternalSecrets integration templates.

---

## 📚 Incident Runbooks

Detailed operational runbooks are maintained in [`docs/runbooks/INCIDENT_RUNBOOKS.md`](docs/runbooks/INCIDENT_RUNBOOKS.md):
- Runbook 1: PostgreSQL Outage & Connection Recovery
- Runbook 2: Redis Failure & Outage Recovery
- Runbook 3: SMS Worker Queue Backlog Clearing
- Runbook 4: Encrypted Backup & Restore Execution

---

## 📋 RFID Production Certification Matrix

- [x] **Schema & Migrations**: RFID tables (`rfid_readers`, `rfid_credentials`, `rfid_scan_events`, `rfid_key_versions`) with RLS policies enabled.
- [x] **Per-Reader Keys**: AES-256-GCM encrypted reader secret storage and dynamic decryption.
- [x] **DESFire EV2/EV3**: AN10922 key diversification, AES-128 CMAC, and 3-pass mutual auth APDU framing.
- [x] **Credential Lifecycle**: Strict status validation (`ACTIVE` required; `PENDING`, `REPLACED`, `SUSPENDED`, `REVOKED`, `EXPIRED` rejected).
- [x] **Offline SLO**: 5,000-event batch sync processing benchmark completing in < 10,000 ms (6.1s).
- [x] **mTLS & Fingerprints**: Optional `x-reader-cert-fingerprint` header validation against database records.
