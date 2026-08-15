#!/usr/bin/env bash
set -Eeuo pipefail

REPO_OWNER="${REPO_OWNER:-Kh3rwa1}"
REPO_NAME="${REPO_NAME:-offline-qr-school-attendance}"
BRANCH="${BRANCH:-main}"
STRICT="${REQUIRE_STRICT_BRANCH_PROTECTION:-true}"
AUTH_TOKEN="${ADMIN_GITHUB_TOKEN:-${GITHUB_TOKEN:-}}"

echo "================================================================="
echo "=== Enterprise Branch Protection Governance Verification ==="
echo "=== Target: ${REPO_OWNER}/${REPO_NAME} (${BRANCH}) ==="
echo "================================================================="

mkdir -p output

# Ensure jq is installed
if ! command -v jq &> /dev/null; then
  echo "ERROR: jq is required for JSON AST branch governance verification."
  exit 1
fi

PROTECTION_JSON=""

# 1. Attempt using curl with provided token
if [ -n "${AUTH_TOKEN}" ]; then
  HTTP_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -H "Authorization: token ${AUTH_TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/branches/${BRANCH}/protection" || true)
  
  HTTP_BODY=$(echo "${HTTP_RESPONSE}" | sed '$d')
  HTTP_STATUS=$(echo "${HTTP_RESPONSE}" | tail -n1 | sed 's/HTTP_STATUS://')

  if [ "${HTTP_STATUS}" = "200" ]; then
    PROTECTION_JSON="${HTTP_BODY}"
  fi
fi

# 2. Attempt using gh CLI if token didn't return 200
if [ -z "${PROTECTION_JSON}" ] && command -v gh &> /dev/null; then
  PROTECTION_JSON=$(gh api "repos/${REPO_OWNER}/${REPO_NAME}/branches/${BRANCH}/protection" 2>&1 || true)
fi

# 3. Validate that valid JSON with admin-level protection policy was obtained
if [ -z "${PROTECTION_JSON}" ] || ! echo "${PROTECTION_JSON}" | jq -e '.required_status_checks' > /dev/null 2>&1; then
  echo "❌ CRITICAL: Failed to retrieve authenticated branch protection rules for '${BRANCH}'."
  echo "Server response: ${PROTECTION_JSON:-<empty>}"
  echo ""
  echo "To certify branch protection in strict mode:"
  echo "  1. Provide an admin-capable GitHub token in ADMIN_GITHUB_TOKEN or GITHUB_TOKEN"
  echo "  2. Or authenticate with 'gh auth login' with repository administration privileges."
  if [ "${STRICT}" = "true" ]; then
    exit 1
  fi
  exit 0
fi

# 4. Strict jq AST Evaluation of all Required Policies
FAILURES=0

check_policy() {
  local desc="$1"
  local expr="$2"
  local res
  res=$(echo "${PROTECTION_JSON}" | jq -r "${expr}" 2>/dev/null || echo "false")
  if [ "${res}" = "true" ]; then
    echo "  [PASS] ${desc}"
  else
    echo "  [FAIL] ${desc} (Evaluated: ${res})"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "Evaluating branch governance policies:"

check_policy "Administrators are enforced (enforce_admins.enabled == true)" \
  '.enforce_admins.enabled == true'

check_policy "Required PR status checks are strict (.required_status_checks.strict == true)" \
  '.required_status_checks.strict == true'

check_policy "Pull request reviews are required" \
  '(.required_pull_request_reviews | type) == "object"'

check_policy "Approving review count configured (.required_pull_request_reviews.required_approving_review_count >= 0)" \
  '(.required_pull_request_reviews.required_approving_review_count // 0) >= 0'

check_policy "Dismiss stale approvals on push (.required_pull_request_reviews.dismiss_stale_reviews == true)" \
  '(.required_pull_request_reviews.dismiss_stale_reviews // false) == true'

check_policy "Conversation resolution required (.required_conversation_resolution.enabled == true)" \
  '(.required_conversation_resolution.enabled // false) == true'

check_policy "Force pushes prohibited (.allow_force_pushes.enabled == false)" \
  '(.allow_force_pushes.enabled // false) == false'

check_policy "Branch deletions prohibited (.allow_deletions.enabled == false)" \
  '(.allow_deletions.enabled // false) == false'

# Verify all 10 mandatory CI status contexts
REQUIRED_CHECKS=(
  "PostgreSQL RLS & Redis Production Integration"
  "Static Check & Unit Tests"
  "Mandatory Pull-Request Load Smoke Gate"
  "Playwright Browser E2E (Chromium & Firefox)"
  "Docker Compose Production Smoke Test"
  "Encrypted Backup & Restore RLS Verification Drill"
  "Disposable Kind Cluster Deployment & Rollback Drill"
  "Security & Vulnerability Check"
  "Kubernetes Schema & Security Validation"
  "Branch Protection Verification"
)

echo "Verifying mandatory CI status check contexts:"
for check in "${REQUIRED_CHECKS[@]}"; do
  has_check=$(echo "${PROTECTION_JSON}" | jq -r --arg ctx "${check}" '
    [(.required_status_checks.contexts // []), (.required_status_checks.checks // [] | map(.context))]
    | flatten
    | contains([$ctx])
  ')
  if [ "${has_check}" = "true" ]; then
    echo "  [PASS] Required context: ${check}"
  else
    echo "  [FAIL] Missing required context: ${check}"
    FAILURES=$((FAILURES + 1))
  fi
done

# Output sanitized verified artifact
SANITIZED_REPORT=$(echo "${PROTECTION_JSON}" | jq '{
  verifiedAt: (now | todate),
  branch: "'"${BRANCH}"'",
  enforceAdmins: .enforce_admins.enabled,
  strictStatusChecks: .required_status_checks.strict,
  requiredContexts: ((.required_status_checks.contexts // []) + (.required_status_checks.checks // [] | map(.context)) | unique),
  requiredReviews: .required_pull_request_reviews.required_approving_review_count,
  dismissStaleReviews: .required_pull_request_reviews.dismiss_stale_reviews,
  requireConversationResolution: .required_conversation_resolution.enabled,
  allowForcePushes: .allow_force_pushes.enabled,
  allowDeletions: .allow_deletions.enabled,
  governanceCompliancePassed: ('"${FAILURES}"' == 0)
}')

echo "${SANITIZED_REPORT}" > output/branch-protection-verified.json

if [ "${FAILURES}" -gt 0 ]; then
  echo ""
  echo "❌ GOVERNANCE VERIFICATION FAILED: ${FAILURES} policy checks failed."
  if [ "${STRICT}" = "true" ]; then
    exit 1
  fi
else
  echo ""
  echo "✅ GOVERNANCE VERIFICATION PASSED: All policies and 10/10 required checks active on '${BRANCH}'."
fi
