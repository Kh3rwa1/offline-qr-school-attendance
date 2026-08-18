#!/usr/bin/env bash
set -uo pipefail

LOG_FILE="${RUNNER_TEMP:-/tmp}/attendease-vitest-output.log"

set +e
npx vitest run 2>&1 | tee "${LOG_FILE}"
STATUS=${PIPESTATUS[0]}
set -e

if [ "${STATUS}" -ne 0 ] && [ -n "${GITHUB_ACTIONS:-}" ]; then
  SUMMARY="$(tail -n 160 "${LOG_FILE}")"
  SUMMARY="${SUMMARY//'%'/'%25'}"
  SUMMARY="${SUMMARY//$'\r'/'%0D'}"
  SUMMARY="${SUMMARY//$'\n'/'%0A'}"
  echo "::error title=Vitest unit or integration failure::${SUMMARY}"
fi

exit "${STATUS}"
