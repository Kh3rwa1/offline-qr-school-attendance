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
#
# Portability note: this runs under BusyBox sh/date in postgres:16-alpine, which
# cannot parse ISO-8601 strings containing 'T' or 'Z'. Age is therefore derived
# from an explicit epoch field, falling back to the marker file's mtime - never
# from parsing a formatted date string.
# ============================================================================
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
STATUS_FILE="${BACKUP_DIR}/OFFSITE_STATUS"
MARKER_FILE="${BACKUP_DIR}/LATEST_OFFSITE"
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

if [ "${STATE}" = "FAILED" ] && [ ! -f "${MARKER_FILE}" ]; then
  echo "unhealthy: off-site replication is configured but has never succeeded"
  exit 1
fi

if [ ! -f "${MARKER_FILE}" ]; then
  echo "healthy: awaiting first off-site replication cycle"
  exit 0
fi

# Field 1 is a human-readable UTC timestamp, field 2 is epoch seconds. Only the
# epoch field is used for arithmetic.
MARKER_LINE="$(head -n 1 "${MARKER_FILE}" 2>/dev/null || true)"
LATEST_EPOCH="$(printf '%s' "${MARKER_LINE}" | awk '{print $2}')"

# Older markers, or a truncated write, may not carry the epoch field. The file's
# mtime is an equally good signal and is portable across BusyBox and coreutils.
case "${LATEST_EPOCH}" in
  '' | *[!0-9]*)
    LATEST_EPOCH="$(date -r "${MARKER_FILE}" +%s 2>/dev/null || true)"
    ;;
esac
case "${LATEST_EPOCH}" in
  '' | *[!0-9]*)
    LATEST_EPOCH="$(stat -c %Y "${MARKER_FILE}" 2>/dev/null || true)"
    ;;
esac

if [ -z "${LATEST_EPOCH}" ] || [ "${LATEST_EPOCH}" -le 0 ] 2>/dev/null; then
  echo "healthy: off-site timestamp unavailable, not failing closed"
  exit 0
fi

NOW_EPOCH="$(date +%s)"
if [ "${NOW_EPOCH}" -le "${LATEST_EPOCH}" ]; then
  echo "healthy: off-site backup timestamp is current"
  exit 0
fi

AGE_HOURS=$(( (NOW_EPOCH - LATEST_EPOCH) / 3600 ))

if [ "${AGE_HOURS}" -ge "${MAX_AGE_HOURS}" ]; then
  echo "unhealthy: newest off-site backup is ${AGE_HOURS}h old (limit ${MAX_AGE_HOURS}h)"
  exit 1
fi

echo "healthy: off-site backup is ${AGE_HOURS}h old (limit ${MAX_AGE_HOURS}h)"
exit 0
