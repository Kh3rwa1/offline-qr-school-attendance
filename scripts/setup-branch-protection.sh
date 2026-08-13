#!/usr/bin/env bash
set -Eeuo pipefail

REPO_OWNER="${REPO_OWNER:-Kh3rwa1}"
REPO_NAME="${REPO_NAME:-offline-qr-school-attendance}"
BRANCH="${BRANCH:-main}"

echo "=== Setting Up Production Branch Protection Rules for ${REPO_OWNER}/${REPO_NAME}:${BRANCH} ==="

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "NOTICE: GITHUB_TOKEN environment variable not set."
  echo "To execute branch protection rules via GitHub API, run:"
  echo "GITHUB_TOKEN=<your-token> ./scripts/setup-branch-protection.sh"
  exit 0
fi

curl -X PUT \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/branches/${BRANCH}/protection" \
  -d '{
    "required_status_checks": {
      "strict": true,
      "contexts": [
        "Static Check & Unit Tests",
        "Playwright Browser E2E",
        "Mandatory Pull-Request Load Smoke Gate",
        "Restricted PostgreSQL RLS & Redis Multi-Replica Integration",
        "Encrypted Backup & Restore Verification Drill",
        "Kubernetes Schema & Security Manifest Validation",
        "Production Docker Smoke Test",
        "Security & Vulnerability Check"
      ]
    },
    "enforce_admins": true,
    "required_pull_request_reviews": {
      "dismiss_stale_reviews": true,
      "require_code_owner_reviews": true,
      "required_approving_review_count": 1
    },
    "restrictions": null,
    "required_linear_history": true,
    "allow_force_pushes": false,
    "allow_deletions": false
  }'

echo "=== Branch Protection Rules Successfully Applied ==="
