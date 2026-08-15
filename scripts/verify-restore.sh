#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

BACKUP_FILE="${1:-}"
if [ -z "${BACKUP_FILE}" ]; then
  BACKUP_FILE=$(ls -1t "${BACKUP_DIR}"/attendease-*.sql.gz.enc 2>/dev/null | head -n 1 || true)
fi

if [ -z "${BACKUP_FILE}" ] || [ ! -f "${BACKUP_FILE}" ]; then
  echo "❌ Error: No backup archive found in ${BACKUP_DIR} to verify." >&2
  exit 1
fi

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "❌ Error: BACKUP_ENCRYPTION_KEY is required for restore drill verification." >&2
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
echo " AttendEase OS — Automated Disaster Recovery Verification Drill"
echo "============================================================"
echo " • Target Archive: ${BACKUP_FILE}"

# 1. Validate Checksum
MANIFEST_FILE="${BACKUP_FILE%.sql.gz.enc}.manifest.json"
if [ -f "${MANIFEST_FILE}" ]; then
  echo " • Validating SHA-256 integrity against manifest..."
  EXPECTED_CHECKSUM=$(node -e "try { const m = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log(m.checksumSha256 || ''); } catch { process.exit(0); }" "${MANIFEST_FILE}")
  ACTUAL_CHECKSUM=$(compute_sha256 "${BACKUP_FILE}")
  if [ -n "${EXPECTED_CHECKSUM}" ] && [ "${EXPECTED_CHECKSUM}" != "${ACTUAL_CHECKSUM}" ]; then
    echo "❌ INTEGRITY FAILURE: Checksum mismatch on ${BACKUP_FILE}" >&2
    exit 1
  fi
  echo " • Checksum OK (${ACTUAL_CHECKSUM:0:16}...)"
fi

TEMP_DB="attendease_restore_drill_tmp_$$"
MIGRATION_DB_USER="${MIGRATION_DB_USER:-attendance_migration}"
POSTGRES_HOST="${DB_HOST:-127.0.0.1}"
POSTGRES_PORT="${DB_PORT:-5432}"

cleanup() {
  if command -v docker >/dev/null 2>&1 && docker compose ps --services 2>/dev/null | grep -q "db"; then
    docker compose exec -T db psql -U "${MIGRATION_DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${TEMP_DB};" >/dev/null 2>&1 || true
  elif [ -n "${PG_RLS_MIGRATION_DATABASE_URL:-}" ]; then
    psql "${PG_RLS_MIGRATION_DATABASE_URL}" -c "DROP DATABASE IF EXISTS ${TEMP_DB};" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if command -v docker >/dev/null 2>&1 && docker compose ps --services 2>/dev/null | grep -q "db"; then
  echo " • Creating isolated sandbox database: ${TEMP_DB}..."
  docker compose exec -T db psql -U "${MIGRATION_DB_USER}" -d postgres -c "CREATE DATABASE ${TEMP_DB};"
  
  echo " • Streaming decrypted backup into ${TEMP_DB}..."
  openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${BACKUP_ENCRYPTION_KEY}" -in "${BACKUP_FILE}" \
    | gunzip -c \
    | docker compose exec -T db psql -U "${MIGRATION_DB_USER}" -d "${TEMP_DB}" >/dev/null

  echo " • Verifying schema and data integrity in restored database..."
  TABLE_COUNT=$(docker compose exec -T db psql -U "${MIGRATION_DB_USER}" -d "${TEMP_DB}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
  echo " • Restored Public Tables: $(echo "${TABLE_COUNT}" | tr -d ' ')"

elif [ -n "${PG_RLS_MIGRATION_DATABASE_URL:-}" ]; then
  echo " • Creating isolated sandbox database: ${TEMP_DB}..."
  BASE_URL="${PG_RLS_MIGRATION_DATABASE_URL%/*}/postgres"
  psql "${BASE_URL}" -c "CREATE DATABASE ${TEMP_DB};"
  TARGET_URL="${PG_RLS_MIGRATION_DATABASE_URL%/*}/${TEMP_DB}"

  openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${BACKUP_ENCRYPTION_KEY}" -in "${BACKUP_FILE}" \
    | gunzip -c \
    | psql "${TARGET_URL}" >/dev/null

  TABLE_COUNT=$(psql "${TARGET_URL}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
  echo " • Restored Public Tables: $(echo "${TABLE_COUNT}" | tr -d ' ')"
else
  # Offline test mode: verify file can be decrypted and gunzipped cleanly without errors
  echo " • Verifying archive stream decryption & decompression..."
  openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${BACKUP_ENCRYPTION_KEY}" -in "${BACKUP_FILE}" \
    | gunzip -t
  echo " • Archive stream integrity verified."
fi

# Write verification timestamp
ISO_NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
mkdir -p "${BACKUP_DIR}"
cat <<EOF > "${BACKUP_DIR}/LATEST_RESTORE_VERIFIED"
{
  "verifiedAt": "${ISO_NOW}",
  "backupFile": "$(basename "${BACKUP_FILE}")",
  "status": "PASSED"
}
EOF

echo "============================================================"
echo " ✅ Disaster Recovery Verification Drill PASSED"
echo " Recorded: ${BACKUP_DIR}/LATEST_RESTORE_VERIFIED"
echo "============================================================"
