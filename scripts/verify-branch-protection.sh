#!/usr/bin/env bash
set -Eeuo pipefail

REPO_OWNER="${REPO_OWNER:-Kh3rwa1}"
REPO_NAME="${REPO_NAME:-offline-qr-school-attendance}"
BRANCH="${BRANCH:-main}"
STRICT="${REQUIRE_STRICT_BRANCH_PROTECTION:-true}"

echo "=== Verifying Branch Protection Status for ${REPO_OWNER}/${REPO_NAME}:${BRANCH} ==="

if [ -z "${GITHUB_TOKEN:-}" ]; then
  if command -v gh &> /dev/null; then
    echo "Querying GitHub Branch Protection API via gh CLI..."
    RESPONSE=$(gh api "repos/${REPO_OWNER}/${REPO_NAME}/branches/${BRANCH}/protection" 2>&1 || true)
  else
    echo "STATUS: BLOCKED (GitHub Admin Token Required)"
    echo "ERROR: Neither GITHUB_TOKEN nor gh CLI authentication with admin repo permissions is available."
    if [ "${STRICT}" = "true" ]; then
      exit 1
    fi
    exit 0
  fi
else
  RESPONSE=$(curl -s -H "Authorization: token ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/branches/${BRANCH}/protection")
fi

if echo "${RESPONSE}" | grep -q "required_status_checks"; then
  echo "STATUS: VERIFIED ACTIVE (Branch protection is active on '${BRANCH}')."
  echo "${RESPONSE}"
  exit 0
elif echo "${RESPONSE}" | grep -q "Branch not protected"; then
  echo "STATUS: BLOCKED (Branch '${BRANCH}' protection is NOT enabled on remote GitHub repository)."
  echo "ERROR: GitHub API confirms main branch protection is disabled."
  if [ "${STRICT}" = "true" ]; then
    exit 1
  fi
  exit 0
else
  echo "STATUS: BLOCKED (GitHub Admin Token / Branch Protection Required)"
  echo "Response output:"
  echo "${RESPONSE}"
  if [ "${STRICT}" = "true" ]; then
    echo "ERROR: Branch protection API check returned forbidden/unauthorized response due to missing admin token."
    exit 1
  fi
  exit 0
fi
