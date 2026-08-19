# Changelog

All notable changes to AttendEase OS are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Version numbers follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased] — main branch only

### Fixed — CI Reliability
- **Playwright browser timeout (CRITICAL BLOCKER)**: Added `actions/cache` for Playwright browser binaries keyed by `runner.os + runner.arch + PLAYWRIGHT_VERSION + package-lock.json hash`. Cache-hit path runs `install-deps` only (~5s); cache-miss path runs full `install --with-deps` (~2–3 min). Timeout raised from 30 → 45 minutes with explicit diagnosis comment.
- Added npm cache (`cache: npm`) to Playwright E2E Node.js setup step.
- Added Redis health options (`--health-cmd`, `--health-interval`) to Playwright E2E service container (was missing).
- Added `concurrency:` rules to CI workflow to cancel superseded runs on same branch/PR without cancelling release tag runs.
- Added `PLAYWRIGHT_VERSION` environment variable for reproducible cache keys.
- Pinned `actions/github-script@v7` in `record-deployment` job to SHA `60a0d83039c74a4aee543508d2ffcb1c3799cdea`.
- Upgraded artifact uploads with `retention-days: 14`.

### Added — CI Gates
- **`docs-truth-validator` CI job**: Runs `validate-product-claims-registry.ts` to enforce machine-readable product claims JSON registry on every commit.
- **`arm64-architecture-note` CI job**: Explicitly annotates arm64 EXTERNALLY_PENDING status rather than silently omitting it.

### Added — Product Claims Registry
- `docs/product-claims.json`: Machine-readable claims registry with 16 claims, each tagged with `VERIFIED_AUTOMATION`, `EXPERIMENTAL`, or `EXTERNALLY_PENDING` status, evidence file references, and limitations.
- `scripts/validate-product-claims-registry.ts`: CI validator enforcing 8 truth rules on the registry.

### Added — Monitoring & Alerting
- `monitoring/appliance-alerts.yml`: Added alert groups for:
  - `disk_capacity`: `DiskSpaceWarning` (< 20%) and `DiskSpaceCritical` (< 5%)
  - `certificate_expiry`: `TlsCertExpiryWarning` (< 14 days) and `TlsCertExpiryCritical` (< 3 days) with runbook links
  - `clock_integrity`: `ClockDriftHigh` (> 1s) and `NtpUnsynchronized`
  - `update_health`: `UpdateRollbackOccurred` and `RestoreDrillOverdue` (> 30 days)
  - `sms_worker_health`: `SmsWorkerHeartbeatStale`, `SmsWorkerDown`, `SmsQueueOldestMessageStale`
  - `auth_anomalies`: `ElevatedAuthFailures` and `AttendanceRejectionRateHigh`

### Fixed — Security
- `scripts/install.sh` `cmd_backup`: Backup encryption key was passed via `openssl -pass pass:KEY` which exposes the key in `/proc/*/cmdline`. Fixed to use `pass file:<tmpfile>` with `chmod 0600` and immediate `rm -f` after use.
- `scripts/install.sh` `cmd_restore`: Same fix applied to restore path.
- `scripts/install.sh`: Added minimum key length check (≥ 32 characters) in backup path.

### Added — Installer
- `scripts/install.sh`: Added NTP/clock synchronization check in `check_preflight()` using `timedatectl show`. Reports warning (not fatal) if clock is not synchronized; includes install instructions for `chrony`.

### Fixed — Metadata
- `metadata.json`: Removed stale `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` claim. No Gemini API code exists in the codebase.

### Added — Documentation
- `docs/audit/BASELINE_AUDIT.md`: Full baseline audit with verified/unverified/contradictions matrix.
- `docs/audit/FINAL_10_OF_10_AUDIT.md`: Final engineering and production readiness audit.
- `docs/audit/EXTERNAL_EVIDENCE_REQUIRED.md`: Evidence registry for 8 externally pending items with procedures.
- `docs/operations/INSTALL_AND_FORGET_BOUNDARIES.md`: Operator responsibility matrix and DR runbook.

---

## [1.3.0] — 2026-08-13

### Added
- Zebra FX9600 IoT Connector ingest API with HMAC-SHA256 and Bearer token authentication
- UHF EPC Credential Vault with SHA-256 digest storage (zero raw EPC logging)
- Teacher Gate Review & Finalization dashboard with live tap feed
- Session finalization with auto-absent and SMS queue creation
- PostgreSQL RLS multi-tenant isolation
- AES-256-CBC encrypted backup with off-site R2 replication
- Ubuntu 22.04/24.04 installer with pre-flight diagnostics
- Prometheus + Alertmanager monitoring with dead-man heartbeat
- Hindi localization for public pages
- Cosign keyless image signing and SLSA build provenance
- CycloneDX SBOM generation
- Kubernetes Kind cluster drill
- Full-scale business load benchmark (14,765 requests, 0.0% error rate)

---

## [1.2.0] — 2026-07-15

### Added
- Bengali (বাংলা) localization for all teacher and admin screens
- Playwright browser E2E suite (Chromium + Firefox)
- axe-core WCAG 2.1/2.2 AA automated accessibility checks
- RFID contract simulation hardware runner
- Offline QR scenarios (revoke, expire, reconnect, duplicate)

---

## [1.0.0] — 2026-05-01

### Added
- Initial release: offline QR attendance with IndexedDB outbox sync
- PostgreSQL multi-tenant schema with Drizzle ORM
- Express server with session authentication
- React 19 frontend with Tailwind CSS
- English-only interface
