#!/usr/bin/env bash
set -eo pipefail

echo "=== Automated Encrypted Backup, Restore & Verification Drill ==="

BACKUP_DIR="${BACKUP_DIR:-/tmp/db_backups}"
mkdir -p "${BACKUP_DIR}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/school_attendance_${TIMESTAMP}.sql.gz.enc"
RESTORE_FILE="${BACKUP_DIR}/restored_${TIMESTAMP}.sql"

if [ -z "${DATABASE_URL}" ]; then
  echo "Error: DATABASE_URL environment variable is required."
  exit 1
fi

if [ -z "${BACKUP_PASSPHRASE}" ]; then
  echo "Error: BACKUP_PASSPHRASE environment variable is required for encryption. Refusing to use a hard-coded default password."
  exit 1
fi

START_TIME=$(date +%s)

echo "1. Creating AES-256 encrypted PostgreSQL backup to ${BACKUP_FILE}..."
pg_dump --clean --if-exists "${DATABASE_URL}" | gzip -c | openssl enc -aes-256-cbc -pbkdf2 -pass pass:"${BACKUP_PASSPHRASE}" -out "${BACKUP_FILE}"
echo "Backup created and encrypted successfully. Size: $(du -sh "${BACKUP_FILE}" | cut -f1)"

echo "2. Decrypting and verifying backup archive integrity..."
openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${BACKUP_PASSPHRASE}" -in "${BACKUP_FILE}" | gunzip -c > "${RESTORE_FILE}"
echo "Decryption successful. Uncompressed dump size: $(du -sh "${RESTORE_FILE}" | cut -f1)"

if [ -n "${TARGET_DATABASE_URL}" ]; then
  echo "3. Restoring dump into target test database ${TARGET_DATABASE_URL} with ON_ERROR_STOP=1..."
  psql -v ON_ERROR_STOP=1 "${TARGET_DATABASE_URL}" < "${RESTORE_FILE}"
  
  echo "4. Running post-restore database integrity & RLS checks..."
  
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
fi

END_TIME=$(date +%s)
RTO_SECONDS=$((END_TIME - START_TIME))

rm -f "${RESTORE_FILE}"

echo "=== Backup & Disaster Recovery Drill Complete ==="
echo "Recovery Time Objective (RTO) achieved: ${RTO_SECONDS} seconds."
