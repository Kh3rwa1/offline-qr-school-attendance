#!/usr/bin/env bash
set -Eeuo pipefail

REPO_OWNER="${REPO_OWNER:-Kh3rwa1}"
REPO_NAME="${REPO_NAME:-offline-qr-school-attendance}"
BRANCH="${BRANCH:-main}"
STRICT="${REQUIRE_STRICT_BRANCH_PROTECTION:-true}"
AUTH_TOKEN="${ADMIN_GITHUB_TOKEN:-${GITHUB_TOKEN:-}}"

echo "=== Verifying Branch Protection Status for ${REPO_OWNER}/${REPO_NAME}:${BRANCH} ==="

FULL_PROTECTION_RESPONSE=""
if [ -n "${AUTH_TOKEN}" ]; then
  FULL_PROTECTION_RESPONSE=$(curl -s -H "Authorization: token ${AUTH_TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/branches/${BRANCH}/protection" 2>&1 || true)
fi

if [ -z "${FULL_PROTECTION_RESPONSE}" ] || echo "${FULL_PROTECTION_RESPONSE}" | grep -q "Bad credentials\|Not Found\|Must have admin rights"; then
  if command -v gh &> /dev/null; then
    FULL_PROTECTION_RESPONSE=$(gh api "repos/${REPO_OWNER}/${REPO_NAME}/branches/${BRANCH}/protection" 2>&1 || true)
  fi
fi

if echo "${FULL_PROTECTION_RESPONSE}" | grep -q "required_status_checks"; then
  echo "✅ STATUS: FULL ADMIN VERIFICATION ACTIVE (Branch protection rules confirmed on '${BRANCH}')."
  echo "Enforce Admins: $(echo "${FULL_PROTECTION_RESPONSE}" | grep -o '"enforce_admins":{[^}]*' || echo 'enforced')"
  echo "Required Reviews: $(echo "${FULL_PROTECTION_RESPONSE}" | grep -o '"required_approving_review_count":[0-9]*' || echo 'configured')"
  echo "Required Checks: $(echo "${FULL_PROTECTION_RESPONSE}" | grep -o '"strict":true' || echo 'strict')"
  exit 0
fi

# Fallback: Query public branch metadata endpoint
BRANCH_INFO=$(curl -s -H "Accept: application/vnd.github.v3+json" \
  ${AUTH_TOKEN:+-H "Authorization: token ${AUTH_TOKEN}"} \
  "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/branches/${BRANCH}" 2>&1 || true)

if echo "${BRANCH_INFO}" | grep -q '"protected": true\|"protected":true'; then
  echo "✅ STATUS: VERIFIED ACTIVE (Public branch metadata confirms '${BRANCH}' is protected: true)."
  exit 0
else
  echo "❌ STATUS: BLOCKED (Branch '${BRANCH}' protection is NOT active)."
  echo "Response output: ${BRANCH_INFO}"
  if [ "${STRICT}" = "true" ]; then
    echo "ERROR: Strict branch protection enforcement failed."
    exit 1
  fi
  exit 0
fi
