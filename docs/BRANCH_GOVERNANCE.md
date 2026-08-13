# Branch Governance & Release Policy

**Repository**: `https://github.com/Kh3rwa1/offline-qr-school-attendance`  
**Target Branch**: `main`  

---

## 1. Branch Protection Rules

Production stability requires strict protection of the `main` branch. Direct pushes and unverified pull requests are prohibited.

### Required Rules
- **Require Pull Request Reviews**: Minimum 1 approving review from a CODEOWNER before merging.
- **Require Status Checks to Pass**:
  1. `Static Check & Unit Tests` (`npm run check`, `npm test`, `npm run build`)
  2. `Mandatory Pull-Request Load Smoke Gate` (`npm run test:load-smoke`)
  3. `Playwright Browser E2E` (`npm run test:e2e` on Chromium & Firefox)
  4. `Restricted PostgreSQL RLS & Redis Multi-Replica Integration` (`npm run test:postgres`, Vitest multi-replica)
  5. `Encrypted Backup & Restore Verification Drill` (`scripts/backupAndRestore.sh`)
  6. `Kubernetes Schema & Security Manifest Validation` (`npm run test:k8s-schemas`)
  7. `Production Docker Smoke Test` (`docker compose up` healthcheck)
  8. `Security & Vulnerability Check` (Gitleaks, Trivy FS & Container, License Policy, CycloneDX SBOM)
- **Linear History**: Require squash or rebase merging to prevent merge commits.
- **No Force Pushes**: `allow_force_pushes: false`.
- **No Direct Pushes**: All changes must arrive via pull requests.
- **Enforce Admins**: `enforce_admins: true` (no admin bypasses).

---

## 2. Automated Setup & Verification

Repository administrators can apply and verify branch protection using the following scripts:

### Application Script
```bash
GITHUB_TOKEN=<admin-token-with-repo-scope> ./scripts/setup-branch-protection.sh
```

### Verification Script
```bash
./scripts/verify-branch-protection.sh
```

> [!NOTE]
> If administrator token authentication is unavailable during automated execution, the verification script will report `STATUS: EXTERNALLY PENDING` without failing CI builds.

---

## 3. CODEOWNERS & Dependabot Coverage

- **CODEOWNERS**: Defined in `.github/CODEOWNERS` mapping core architecture, database, security, and Kubernetes manifests to assigned lead engineers.
- **Dependabot**: Defined in `.github/dependabot.yml` covering `npm`, `docker`, and `github-actions` updates on a weekly schedule.

---

## 4. Release & Rollback Protocol

1. **Tagging**: Releases are published by creating signed semver tags (`v1.0.0`, `v1.0.1`).
2. **Attestation & SBOM**: Releases automatically generate CycloneDX software bill of materials and SLSA provenance.
3. **Rollback Protocol**:
   - For application code: Trigger `kubectl rollout undo deployment/school-attendance-web` and `kubectl rollout undo deployment/school-attendance-worker`.
   - For database migrations: Execute point-in-time encrypted database restore drill via `./scripts/backupAndRestore.sh`.
