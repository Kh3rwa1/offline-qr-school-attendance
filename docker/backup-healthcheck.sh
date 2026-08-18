#!/bin/sh
# ============================================================================
# AttendEase OS - Backup Container Healthcheck
# ============================================================================
# Reports the backup daemon unhealthy when either:
#   1. no local encrypted snapshot has ever been produced, or
#   2. off-site replication is configured but has silently stopped working.
#
# Case 2 matters most: a school with no IT staff will never notice that last
# night's upload started failing. Surfacing it as an unhealthy container makes
# it visible in `docker ps`, in `./scripts/install.sh status`, and to any
# monitoring that watches container health.
# ============================================================================
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
STATUS_FILE="${BACKUP_DIR}/OFFSITE_STATUS"
MAX_AGE_HOURS="${OFFSITE_MAX_AGE_HOURS:-48}"

# 1. A local snapshot must exist. The daemon takes a first-boot snapshot, so
#    a missing pointer means backups are genuinely not running.
if [ ! -f "${BACKUP_DIR}/LATEST" ]; then
  echo "unhealthy: no local backup snapshot has been produced yet"
  exit 1
fi

# 2. If off-site replication has never reported in, there is nothing to judge.
if [ ! -f "${STATUS_FILE}" ]; then
  echo "healthy: local backups present, off-site status not yet reported"
  exit 0
fi

STATE="$(head -n 1 "${STATUS_FILE}" 2>/dev/null | awk '{print $1}' || true)"

if [ -z "${STATE}" ] || [ "${STATE}" = "DISABLED" ]; then
  echo "healthy: local backups present, off-site replication not configured"
  exit 0
fi

if [ "${STATE}" = "FAILED" ] && [ ! -f "${BACKUP_DIR}/LATEST_OFFSITE" ]; then
  echo "unhealthy: off-site replication is configured but has never succeeded"
  exit 1
fi

if [ ! -f "${BACKUP_DIR}/LATEST_OFFSITE" ]; then
  echo "healthy: awaiting first off-site replication cycle"
  exit 0
fi

LATEST_ISO="$(tr -d ' \n' < "${BACKUP_DIR}/LATEST_OFFSITE" 2>/dev/null || true)"
if [ -z "${LATEST_ISO}" ]; then
  echo "healthy: off-site marker present but unparsable, not failing closed"
  exit 0
fi

LATEST_EPOCH="$(date -d "${LATEST_ISO}" +%s 2>/dev/null || echo 0)"
if [ "${LATEST_EPOCH}" -le 0 ]; then
  echo "healthy: could not parse off-site timestamp '${LATEST_ISO}', not failing closed"
  exit 0
fi

NOW_EPOCH="$(date +%s)"
AGE_HOURS=$(( (NOW_EPOCH - LATEST_EPOCH) / 3600 ))

if [ "${AGE_HOURS}" -ge "${MAX_AGE_HOURS}" ]; then
  echo "unhealthy: newest off-site backup is ${AGE_HOURS}h old (limit ${MAX_AGE_HOURS}h)"
  exit 1
fi

echo "healthy: off-site backup is ${AGE_HOURS}h old (limit ${MAX_AGE_HOURS}h)"
exit 0
