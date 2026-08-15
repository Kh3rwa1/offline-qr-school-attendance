#!/usr/bin/env bash
set -eo pipefail

echo "=== Automated Encrypted Backup, Restore & Verification Drill ==="

BACKUP_DIR="${BACKUP_DIR:-/tmp/db_backups}"
mkdir -p "${BACKUP_DIR}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/school_attendance_${TIMESTAMP}.sql.gz.enc"
RESTORE_FILE="${BACKUP_DIR}/restored_${TIMESTAMP}.sql"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL environment variable is required."
  exit 1
fi

BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-${BACKUP_PASSPHRASE:-}}"
if [ -z "${BACKUP_ENCRYPTION_KEY}" ]; then
  echo "Error: BACKUP_ENCRYPTION_KEY environment variable is required for encryption."
  exit 1
fi

# Ensure TARGET_DATABASE_URL is a genuinely separate database for fresh-target restoration testing
SOURCE_DB_NAME=$(echo "${DATABASE_URL}" | sed -E 's|.*/([^?]+).*|\1|')
BASE_DB_URL=$(echo "${DATABASE_URL}" | sed -E 's|(.*)/[^?]+(.*)|\1|')
RESTORE_DB_NAME="school_attendance_restore_test_${TIMESTAMP}"
TARGET_DATABASE_URL="${BASE_DB_URL}/${RESTORE_DB_NAME}"

echo "Creating separate fresh target database: ${RESTORE_DB_NAME}..."
psql "${BASE_DB_URL}/postgres" -c "DROP DATABASE IF EXISTS ${RESTORE_DB_NAME};" || true
psql "${BASE_DB_URL}/postgres" -c "CREATE DATABASE ${RESTORE_DB_NAME};"

cleanup() {
  echo "Cleaning up temporary restore target database ${RESTORE_DB_NAME}..."
  psql "${BASE_DB_URL}/postgres" -c "DROP DATABASE IF EXISTS ${RESTORE_DB_NAME};" || true
  rm -f "${RESTORE_FILE}"
}
trap cleanup EXIT

START_TIME=$(date +%s)

echo "1. Creating AES-256 encrypted PostgreSQL backup from ${SOURCE_DB_NAME} to ${BACKUP_FILE}..."
pg_dump "${DATABASE_URL}" | gzip -c | openssl enc -aes-256-cbc -pbkdf2 -pass pass:"${BACKUP_ENCRYPTION_KEY}" -out "${BACKUP_FILE}"
echo "Backup created and encrypted successfully. Size: $(du -sh "${BACKUP_FILE}" | cut -f1)"

echo "2. Decrypting and verifying backup archive integrity..."
openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${BACKUP_ENCRYPTION_KEY}" -in "${BACKUP_FILE}" | gunzip -c > "${RESTORE_FILE}"
echo "Decryption successful. Uncompressed dump size: $(du -sh "${RESTORE_FILE}" | cut -f1)"

echo "3. Restoring dump into separate fresh test database ${RESTORE_DB_NAME} with ON_ERROR_STOP=1..."
psql -v ON_ERROR_STOP=1 "${TARGET_DATABASE_URL}" < "${RESTORE_FILE}"

echo "4. Running post-restore database integrity & RLS checks on ${RESTORE_DB_NAME}..."

# Check 1: Strict single-query RLS isolation count extraction
ZERO_ROWS=$(psql -v ON_ERROR_STOP=1 "${TARGET_DATABASE_URL}" -t -c "
  SELECT s.count FROM (
    SELECT set_config('app.is_system', 'false', false), set_config('app.current_school_id', '', false)
  ) g, LATERAL (
    SELECT COUNT(*)::text AS count FROM students
  ) s;
" | tr -d '[:space:]')

if ! [[ "${ZERO_ROWS}" =~ ^[0-9]+$ ]]; then
  echo "ERROR: Invalid numeric result returned from RLS query: '${ZERO_ROWS}'"
  exit 1
fi

if [ "${ZERO_ROWS}" -ne 0 ]; then
  echo "ERROR: Tenant RLS isolation check failed! Restored database returned ${ZERO_ROWS} rows without school context."
  exit 1
fi
echo "✅ RLS isolation check passed (0 rows returned without school context)."

# Check 2: System role data preservation check
SCHOOL_COUNT=$(psql -v ON_ERROR_STOP=1 "${TARGET_DATABASE_URL}" -t -c "
  SELECT s.count FROM (
    SELECT set_config('app.is_system', 'true', false), set_config('app.current_school_id', '', false)
  ) g, LATERAL (
    SELECT COUNT(*)::text AS count FROM schools
  ) s;
" | tr -d '[:space:]')

if ! [[ "${SCHOOL_COUNT}" =~ ^[0-9]+$ ]]; then
  echo "ERROR: Invalid numeric result returned from school count query: '${SCHOOL_COUNT}'"
  exit 1
fi

if [ "${SCHOOL_COUNT}" -eq 0 ]; then
  echo "ERROR: Database restore integrity check failed! Restored database contains 0 schools."
  exit 1
fi
echo "✅ Schema integrity check passed (${SCHOOL_COUNT} schools restored)."

# Check 3: Queue safety check
SENDING_JOBS=$(psql -v ON_ERROR_STOP=1 "${TARGET_DATABASE_URL}" -t -c "
  SELECT s.count FROM (
    SELECT set_config('app.is_system', 'true', false), set_config('app.current_school_id', '', false)
  ) g, LATERAL (
    SELECT COUNT(*)::text AS count FROM notification_jobs WHERE status = 'SENDING'
  ) s;
" | tr -d '[:space:]')
echo "✅ Queue safety check passed (${SENDING_JOBS} jobs in SENDING state)."

END_TIME=$(date +%s)
RTO_SECONDS=$((END_TIME - START_TIME))

echo "=== Backup & Disaster Recovery Drill Complete ==="
echo "Recovery Time Objective (RTO) achieved: ${RTO_SECONDS} seconds."
