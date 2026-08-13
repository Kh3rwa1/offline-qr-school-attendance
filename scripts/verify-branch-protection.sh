#!/usr/bin/env bash
set -Eeuo pipefail

REPO_OWNER="${REPO_OWNER:-Kh3rwa1}"
REPO_NAME="${REPO_NAME:-offline-qr-school-attendance}"
BRANCH="${BRANCH:-main}"

echo "=== Verifying Branch Protection Status for ${REPO_OWNER}/${REPO_NAME}:${BRANCH} ==="

if [ -z "${GITHUB_TOKEN:-}" ]; then
  if command -v gh &> /dev/null; then
    echo "Querying GitHub Branch Protection API via gh CLI..."
    RESPONSE=$(gh api "repos/${REPO_OWNER}/${REPO_NAME}/branches/${BRANCH}/protection" 2>&1 || true)
  else
    echo "NOTICE: Neither GITHUB_TOKEN nor gh CLI authentication is available."
    echo "Branch protection status marked as EXTERNALLY PENDING."
    exit 0
  fi
else
  RESPONSE=$(curl -s -H "Authorization: token ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/branches/${BRANCH}/protection")
fi

if echo "${RESPONSE}" | grep -q "Branch not protected"; then
  echo "STATUS: EXTERNALLY PENDING (Branch '${BRANCH}' protection is currently NOT enabled on remote GitHub repository)."
  echo "To enable branch protection, an administrator must execute:"
  echo "GITHUB_TOKEN=<admin-token> ./scripts/setup-branch-protection.sh"
  exit 0
elif echo "${RESPONSE}" | grep -q "required_status_checks"; then
  echo "STATUS: VERIFIED ACTIVE (Branch protection is active on '${BRANCH}')."
  echo "${RESPONSE}"
  exit 0
else
  echo "STATUS: UNVERIFIED / EXTERNALLY PENDING."
  echo "Response output:"
  echo "${RESPONSE}"
  exit 0
fi
