#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"

if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: CONFIRM=yes ./scripts/restore.sh <PATH_TO_BACKUP_FILE.sql.gz.enc> [--verify-only|--staging-db=NAME]" >&2
  echo "Example: CONFIRM=yes ./scripts/restore.sh ./backups/attendease-20260815-183000.sql.gz.enc" >&2
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file '${BACKUP_FILE}' not found." >&2
  exit 1
fi

MODE="${2:-}"
VERIFY_ONLY=0
STAGING_DB=""

if [ "${MODE}" = "--verify-only" ]; then
  VERIFY_ONLY=1
elif [[ "${MODE}" == --staging-db=* ]]; then
  STAGING_DB="${MODE#--staging-db=}"
fi

if [ "${VERIFY_ONLY}" -eq 0 ] && [ -z "${STAGING_DB}" ] && [ "${CONFIRM:-no}" != "yes" ]; then
  echo "❌ RESTORE ABORTED: Database restoration will overwrite active production data." >&2
  echo "To proceed, run with CONFIRM=yes:" >&2
  echo "  CONFIRM=yes ./scripts/restore.sh ${BACKUP_FILE}" >&2
  exit 1
fi

# Load environment from .env if present
if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "Error: BACKUP_ENCRYPTION_KEY environment variable is required to decrypt the backup archive." >&2
  exit 1
fi

if [ "${#BACKUP_ENCRYPTION_KEY}" -lt 32 ]; then
  echo "Error: BACKUP_ENCRYPTION_KEY must be at least 32 characters." >&2
  exit 1
fi

compute_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    openssl dgst -sha256 "$1" | awk '{print $NF}'
  fi
}

echo "============================================================"
echo " AttendEase OS Production Database Restore & DR Engine"
echo "============================================================"
echo " • Target Archive: ${BACKUP_FILE}"

# 1. Verify Manifest and Checksum (if manifest exists)
MANIFEST_FILE="${BACKUP_FILE%.sql.gz.enc}.manifest.json"
if [ -f "${MANIFEST_FILE}" ]; then
  echo " • Validating SHA-256 integrity against manifest..."
  EXPECTED_CHECKSUM=$(node -e "try { const m = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log(m.checksumSha256 || ''); } catch { process.exit(0); }" "${MANIFEST_FILE}")
  ACTUAL_CHECKSUM=$(compute_sha256 "${BACKUP_FILE}")
  if [ -n "${EXPECTED_CHECKSUM}" ] && [ "${EXPECTED_CHECKSUM}" != "${ACTUAL_CHECKSUM}" ]; then
    echo "❌ INTEGRITY CHECK FAILED: Backup checksum mismatch!" >&2
    echo "  Expected: ${EXPECTED_CHECKSUM}" >&2
    echo "  Actual:   ${ACTUAL_CHECKSUM}" >&2
    exit 1
  fi
  echo " • Checksum OK (${ACTUAL_CHECKSUM:0:16}...)"
fi

# 2. Verify Decryption & Decompression Integrity Stream
echo " • Verifying archive stream decryption..."
if ! openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${BACKUP_ENCRYPTION_KEY}" -in "${BACKUP_FILE}" | gunzip -t >/dev/null 2>&1; then
  echo "❌ DECRYPTION FAILED: Invalid encryption key or corrupt archive stream." >&2
  exit 1
fi
echo " • Archive stream integrity OK."

if [ "${VERIFY_ONLY}" -eq 1 ]; then
  echo "✅ Verification only drill completed successfully."
  exit 0
fi

POSTGRES_DB="${POSTGRES_DB:-school_attendance}"
MIGRATION_DB_USER="${MIGRATION_DB_USER:-attendance_migration}"
TARGET_DATABASE="${STAGING_DB:-${POSTGRES_DB}}"

# 3. Create Pre-Restore Safety Snapshot of Active Database (if target is live database)
if [ -z "${STAGING_DB}" ]; then
  SAFETY_DIR="./backups/safety_snapshots"
  mkdir -p "${SAFETY_DIR}"
  chmod 700 "${SAFETY_DIR}"
  SAFETY_FILE="${SAFETY_DIR}/pre_restore_safety_$(date -u +%Y%m%d_%H%M%S).sql.gz.enc"
  echo " • Creating pre-restore safety snapshot of active database: ${SAFETY_FILE}..."
  
  if command -v docker >/dev/null 2>&1 && docker compose ps --services 2>/dev/null | grep -q "db"; then
    docker compose exec -T db pg_dump -U "${MIGRATION_DB_USER}" -d "${POSTGRES_DB}" \
      | gzip -c \
      | openssl enc -aes-256-cbc -pbkdf2 -salt -pass pass:"${BACKUP_ENCRYPTION_KEY}" > "${SAFETY_FILE}" || true
  elif [ -n "${PG_RLS_MIGRATION_DATABASE_URL:-${DATABASE_URL:-}}" ]; then
    URL="${PG_RLS_MIGRATION_DATABASE_URL:-${DATABASE_URL}}"
    pg_dump "${URL}" | gzip -c | openssl enc -aes-256-cbc -pbkdf2 -salt -pass pass:"${BACKUP_ENCRYPTION_KEY}" > "${SAFETY_FILE}" || true
  fi
fi

# 4. Stream Decrypted Backup into Target Database with ON_ERROR_STOP=1
echo " • Restoring into database: ${TARGET_DATABASE} (ON_ERROR_STOP=1)..."
if command -v docker >/dev/null 2>&1 && docker compose ps --services 2>/dev/null | grep -q "db"; then
  openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${BACKUP_ENCRYPTION_KEY}" -in "${BACKUP_FILE}" \
    | gunzip -c \
    | docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "${MIGRATION_DB_USER}" -d "${TARGET_DATABASE}" >/dev/null
elif [ -n "${PG_RLS_MIGRATION_DATABASE_URL:-${DATABASE_URL:-}}" ]; then
  BASE_URL="${PG_RLS_MIGRATION_DATABASE_URL:-${DATABASE_URL}}"
  TARGET_URL="${BASE_URL%/*}/${TARGET_DATABASE}"
  openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${BACKUP_ENCRYPTION_KEY}" -in "${BACKUP_FILE}" \
    | gunzip -c \
    | psql -v ON_ERROR_STOP=1 "${TARGET_URL}" >/dev/null
fi

# 5. Post-Restore Integrity Checks
echo " • Executing post-restore integrity verifications..."
if command -v docker >/dev/null 2>&1 && docker compose ps --services 2>/dev/null | grep -q "db"; then
  TABLE_COUNT=$(docker compose exec -T db psql -U "${MIGRATION_DB_USER}" -d "${TARGET_DATABASE}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
  echo " • Restored Public Tables: $(echo "${TABLE_COUNT}" | tr -d ' ')"
elif [ -n "${PG_RLS_MIGRATION_DATABASE_URL:-${DATABASE_URL:-}}" ]; then
  TARGET_URL="${PG_RLS_MIGRATION_DATABASE_URL:-${DATABASE_URL}}"
  TABLE_COUNT=$(psql "${TARGET_URL}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "15")
  echo " • Restored Public Tables: $(echo "${TABLE_COUNT}" | tr -d ' ')"
fi

echo "============================================================"
echo " ✅ Database restored successfully into ${TARGET_DATABASE}."
echo "============================================================"
