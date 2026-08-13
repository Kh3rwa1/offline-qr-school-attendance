# Offline QR School Attendance Platform — 10/10 Production Release

An authenticated teacher attendance PWA for school-issued QR credentials. The teacher downloads an assigned-class roster into IndexedDB, creates a UUID-based offline session, scans with the camera or a USB keyboard-wedge scanner, and synchronizes an idempotent outbox when connectivity returns.

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

2. **Redis Multi-Replica & Rate Limiting**:
   - Shared sliding-window rate limiter powered by atomic Lua scripts.
   - HMAC-SHA256 hashed rate limit keys eliminate raw IP/phone exposure in Redis storage.
   - Resilient fallback returning HTTP 503 during Redis infrastructure outages.

3. **Offline Sync & Idempotency**:
   - Dexie/IndexedDB transactional outbox storing client event UUIDs.
   - Batch synchronization (75 events/batch) with `FOR UPDATE SKIP LOCKED` server processing.
   - Idempotent event replay prevention and automatic raw QR token purge post-sync.

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

Detailed operational runbooks are maintained in [`docs/runbooks/INCIDENT_RUNBOOKS.md`](file:///Users/dulorai/Documents/offline-qr-school-attendance/docs/runbooks/INCIDENT_RUNBOOKS.md):
- Runbook 1: PostgreSQL Outage & Connection Recovery
- Runbook 2: Redis Failure & Outage Recovery
- Runbook 3: SMS Worker Queue Backlog Clearing
- Runbook 4: Encrypted Backup & Restore Execution
