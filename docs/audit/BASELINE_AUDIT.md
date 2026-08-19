# AttendEase OS — Baseline Audit Report

> **Audit Date**: 2026-08-18  
> **Auditor**: Principal Production Engineer / SRE  
> **Repository**: `Kh3rwa1/offline-qr-school-attendance`  
> **Latest Tagged Release**: `v1.3.0`  
> **Current main SHA**: _see git log_  
> **Audit Methodology**: Full repository inspection — code, CI workflows, scripts, tests, documentation, Compose, Kubernetes, monitoring. No claims accepted without supporting file paths.

---

## 1. Verified Capabilities (Automation Evidence Exists)

| Capability | Evidence Files | CI Job |
|---|---|---|
| TypeScript typecheck (strict) | `tsconfig.json`, `package.json#check` | `static-check-and-unit-tests` |
| Forbidden-string guardrail | `scripts/verify-no-forbidden-strings.ts` | `static-check-and-unit-tests` |
| Product-claims scan | `scripts/verify-product-claims.ts`, `src/config/productClaims.ts` | `static-check-and-unit-tests` |
| Inline i18n ternary check | `scripts/verify-no-inline-i18n-ternaries.ts` | `static-check-and-unit-tests` |
| Vitest unit & integration suite (80+ test files) | `tests/*.test.ts` | `static-check-and-unit-tests` |
| PostgreSQL RLS tenant isolation | `tests/postgresRls.integration.test.ts`, `scripts/run-postgres-rls-suite.ts` | `postgres-rls-redis-integration` |
| Redis integration | `tests/redisMultiReplica.test.ts` | `postgres-rls-redis-integration` |
| Encrypted backup + restore + RLS-after-restore | `scripts/backupAndRestore.sh` | `backup-and-restore-drill` |
| Docker Compose stack smoke | `docker-compose.yml` | `docker-compose-production-smoke` |
| Ubuntu 22.04 appliance lifecycle | `scripts/install.sh` | `installer-matrix-test` |
| Ubuntu 24.04 appliance lifecycle | `scripts/install.sh` | `installer-matrix-test` |
| Playwright Chromium + Firefox E2E | `tests/e2e/*.spec.ts`, `playwright.config.ts` | `playwright-e2e` |
| axe-core WCAG 2.1/2.2 AA automated | `tests/e2e/axe-matrix.spec.ts` | `playwright-e2e` |
| Offline QR scenarios | `tests/e2e/offline-scenarios.spec.ts` | `playwright-e2e` |
| RFID contract simulation E2E | `tests/e2e/rfid-attendance.spec.ts`, `scripts/hardware-runner.ts` | `playwright-e2e`, `hardware-gate` |
| Kubernetes schema + security validation | `scripts/validate-k8s-manifests.ts` | `k8s-manifest-validation` |
| Kind cluster deployment + rollback drill | `scripts/test-k8s-kind.sh` | `k8s-kind-cluster-drill` |
| Gitleaks full-history secret scan | `.gitleaks.toml`, `.github/workflows/ci.yml` | `security-scan` |
| Trivy filesystem + container image scan (exit-code 1) | `.github/workflows/ci.yml` | `security-scan` |
| CodeQL analysis | `.github/workflows/codeql.yml` | separate workflow |
| Dependency license policy | `scripts/validate-license-policy.ts` | `static-check-and-unit-tests` |
| CycloneDX npm SBOM generation | `scripts/generate-sbom.ts` | `static-check-and-unit-tests` |
| Container image Cosign keyless signing | `.github/workflows/release.yml` | `build-scan-sign-release` |
| SLSA build-provenance attestation | `.github/workflows/release.yml` | `build-scan-sign-release` |
| Monitoring alert rules (Prometheus) | `monitoring/*.yml` | reviewed only |
| AES-256-CBC backup encryption with PBKDF2 | `docker/backup-entrypoint.sh` | `backup-and-restore-drill` |
| Backup integrity self-test before publish | `docker/backup-entrypoint.sh` lines 113–117 | `backup-and-restore-drill` |
| Off-site backup replication hook | `docker/offsite-upload.sh`, `docker-compose.yml` | reviewed |
| Non-root container execution | `Dockerfile` `USER node` | `security-scan` |
| Monitoring opt-in by default in installer | `scripts/install.sh` resolve_compose_profiles | `installer-matrix-test` |
| Multi-language UI (EN/BN/HI) | `tests/i18nCompleteness.test.ts` | `static-check-and-unit-tests` |
| Load smoke gate (business load benchmark) | `scripts/runLoadSmokeBenchmark.ts` | `pr-load-smoke-gate` |
| Release same-SHA gate check | `.github/workflows/release.yml` lines 29–56 | `build-scan-sign-release` |

---

## 2. Unverified Capabilities (Claimed in Docs, No Green CI Evidence)

| Capability | Where Claimed | Reason Unverified |
|---|---|---|
| Browser E2E tests completed without timeout | `docs/FINAL_PRODUCTION_CERTIFICATION.md`, README | **Playwright job timed out / was cancelled** in latest main CI run. Browser binary install occurred without caching; 30-minute timeout may be insufficient. |
| arm64 native execution validation | README "ARM64 supported" | `installer-matrix-test` runs only on `ubuntu-22.04` and `ubuntu-24.04` — both are amd64 GitHub-hosted runners. No arm64 runner or QEMU emulation step exists in any CI job. |
| Migration from previous stable release (`v1.2.x` → `v1.3.0`) | `docs/IMPLEMENTATION_PLAN.md` | No CI job tests upgrade from the prior tagged release database schema. |
| Image digest pinned in production Compose | `docker-compose.yml` | Default `ATTENDEASE_IMAGE` resolves to `:v1.3.0` tag — mutable tag, not immutable digest. |
| Release manifest with Git SHA / image digest / SBOM ref | `.github/workflows/release.yml` | Workflow generates `release-binaries.sha256` and `release-artifacts.sha256` but no structured JSON manifest linking Git SHA + semver + image digest + Node version + schema version. |
| Post-release smoke install on clean environment | described in mission | No post-release workflow exists that clones + installs from the released immutable digest. |
| Alert destinations verified at startup | `scripts/install.sh` | Installation warns but does not fail if `ALERT_EMAIL_TO` and `ALERT_WEBHOOK_URL` are both empty. |
| Clock sync / NTP check in pre-flight | described | `check_preflight()` in install.sh has no `timedatectl` / NTP status check. |
| Backup key entropy validation in installer | described | `scripts/generate-secrets.sh` generates key; installer reads it but does not enforce ≥32 chars for keys it reads from existing `.env`. |
| Concurrency rules cancelling superseded runs | described | No `concurrency:` key in `ci.yml`. |
| Documentation truth validator in CI | docs/IMPLEMENTATION_PLAN.md | `verify-product-claims.ts` scans for prohibited strings but does not validate that every claim in README/STATUS.md appears in the structured registry. |
| Machine-readable `docs/product-claims.json` | described in mission | Does not exist. `src/config/productClaims.ts` is TypeScript, not a JSON registry referenced by CI. |

---

## 3. Unsupported / Externally Pending Capabilities (Correctly Labelled)

| Capability | Status in Docs | Honest Assessment |
|---|---|---|
| Physical Zebra FX9600 commissioning | EXTERNALLY_PENDING | ✅ Correct. No real hardware. Contract simulation only. |
| Indian DLT carrier SMS delivery | EXTERNALLY_PENDING | ✅ Correct. DB queue works; real delivery unproven. |
| Government/education authority acceptance | EXTERNALLY_PENDING | ✅ Correct. |
| Human screen-reader UAT (TalkBack/VoiceOver/NVDA) | EXTERNALLY_PENDING | ✅ Correct. |
| Independent third-party VAPT | EXTERNALLY_PENDING | ✅ Correct. |
| DPDP legal compliance review | EXTERNALLY_PENDING | ✅ Correct. |
| Real off-site R2/S3 replication (live credentials) | EXTERNALLY_PENDING | ✅ Correct. Unit tests mock the API. |
| Production uptime / independent external monitor | EXTERNALLY_PENDING | ✅ Correct. GitHub deployment record ≠ production uptime. |
| Pilot school deployments | EXTERNALLY_PENDING | ✅ Correct. |

---

## 4. Contradictions Found Between README / STATUS.md / CI / Compose

| # | Location A | Location B | Contradiction |
|---|---|---|---|
| C-1 | README "one-command install" claims production-ready | `installer-matrix-test` runs amd64 only | arm64 install path has no CI validation |
| C-2 | `docs/STATUS.md` claims "Tested R2 disaster recovery replication drill" | `src/config/productClaims.ts` marks `r2Replication` as `AUTOMATION_VERIFIED` | `scripts/runR2LiveDrill.ts` requires live R2 credentials; CI test `tests/cloudflareR2Replication.test.ts` likely uses mocks |
| C-3 | `docs/FINAL_PRODUCTION_CERTIFICATION.md` claims "E2E: ✅ CERTIFIED" | Known blocker: latest CI Playwright job was cancelled | CI evidence missing for this claim |
| C-4 | `docker-compose.yml` app image defaults to `ghcr.io/kh3rwa1/offline-qr-school-attendance:v1.3.0` | Main branch has commits beyond v1.3.0 | Default image may not include main-branch features |
| C-5 | `metadata.json` lists `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` | No Gemini API code found in source | Stale metadata capability claim |
| C-6 | `docs/FINAL_PRODUCTION_CERTIFICATION.md` (9.6/10 CERTIFIED) | Is labelled as "Historical reference document" | Potentially misleading to casual readers; header note is correct but placement is fragile |
| C-7 | `scripts/install.sh` passes BACKUP_KEY via `pass:` to openssl | OpenSSL `pass:` exposes key in `/proc` cmdline on Linux | Security issue in cmd_backup |
| C-8 | README calls AES-256-CBC "production backup encryption" | AES-256-CBC without MAC is unauthenticated; no HMAC-then-encrypt in backup script | Integrity requires HMAC or GCM (migration path not documented) |
| C-9 | `record-deployment` CI job uses `actions/github-script@v7` (mutable tag) | All other actions are pinned by SHA | Inconsistent action pinning |

---

## 5. Blockers Requiring Action

| # | Blocker | Phase | Priority |
|---|---|---|---|
| B-1 | Playwright CI job cancelled due to browser install timeout — no browser caching | Phase 2 | CRITICAL |
| B-2 | No Playwright browser cache — every run re-downloads ~300 MB | Phase 2 | CRITICAL |
| B-3 | arm64 not validated in CI | Phase 2 | HIGH |
| B-4 | No migration-from-previous-release test | Phase 2 | HIGH |
| B-5 | `actions/github-script@v7` not pinned by SHA | Phase 2/3 | MEDIUM |
| B-6 | No concurrency rules on CI workflow | Phase 2 | MEDIUM |
| B-7 | Backup key passed via `pass:` (process cmdline visible) | Phase 4 | MEDIUM |
| B-8 | No NTP/clock check in preflight | Phase 4 | LOW |
| B-9 | AES-CBC unauthenticated — no integrity MAC | Phase 6 | MEDIUM |
| B-10 | No machine-readable `docs/product-claims.json` | Phase 14 | MEDIUM |
| B-11 | No structured release manifest (JSON) | Phase 3 | MEDIUM |
| B-12 | No post-release install verification workflow | Phase 3 | MEDIUM |
| B-13 | `metadata.json` lists `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` (stale) | Phase 14 | LOW |
| B-14 | Missing monitoring alert: disk exhaustion, cert expiry, clock drift, update failure | Phase 7 | MEDIUM |
| B-15 | Alert destinations not validated at install (only warned) | Phase 7 | LOW |

---

## 6. Evidence Files Inspected

```
.github/workflows/ci.yml          — 682 lines
.github/workflows/release.yml     — 217 lines
.github/workflows/hardware-gate.yml
.github/workflows/codeql.yml
package.json
playwright.config.ts
vitest.config.ts
docker-compose.yml
Dockerfile
scripts/install.sh                — 670 lines
scripts/update.sh
scripts/backupAndRestore.sh
scripts/hardware-runner.ts
scripts/verify-product-claims.ts
scripts/release-verify.sh
docker/backup-entrypoint.sh       — 200+ lines
monitoring/alerts.yaml
monitoring/appliance-alerts.yml
monitoring/rfid-alerts.yml
src/config/productClaims.ts
docs/STATUS.md
docs/audits/EXTERNAL_VALIDATION_REGISTER.md
docs/FINAL_PRODUCTION_CERTIFICATION.md
docs/FINAL_CERTIFICATION_GAP_MATRIX.md
metadata.json
tests/e2e/offline-scenarios.spec.ts
tests/e2e/axe-matrix.spec.ts
```

---

## 7. Baseline Rating

| Domain | Engineering Status | External Status |
|---|---|---|
| CI / Build | 7/10 — Playwright timeout not fixed; no caching; no arm64 | N/A |
| Security | 8/10 — Good scanning; backup key cmdline issue | External VAPT pending |
| Installer | 8/10 — Good pre-flight; missing NTP check | arm64 unvalidated |
| Backup/DR | 7/10 — Good drill; AES-CBC unauthenticated | R2 live drill pending |
| Monitoring | 7/10 — Good rules; missing disk/cert/clock alerts | No external monitor |
| RFID | 8/10 — Contract simulation solid; clearly labelled | Physical pending |
| SMS | 7/10 — Queue verified; delivery pending | DLT pending |
| Accessibility | 7/10 — axe-core E2E exists; human UAT pending | Human UAT pending |
| Documentation Truth | 8/10 — EXTERNALLY_PENDING correctly used; some contradictions | — |
| Release Integrity | 7/10 — Cosign/SBOM good; no structured manifest; mutable tag default | — |

**Honest overall engineering score: 7.5 / 10**  
**Externally validated score: 4 / 10** (pending hardware, carrier, UAT, VAPT, legal)
