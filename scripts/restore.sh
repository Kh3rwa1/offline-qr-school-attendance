#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"

if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: CONFIRM=yes ./scripts/restore.sh <PATH_TO_BACKUP_FILE.sql.gz.enc>" >&2
  echo "Example: CONFIRM=yes ./scripts/restore.sh ./backups/attendease-20260815-183000.sql.gz.enc" >&2
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file '${BACKUP_FILE}' not found." >&2
  exit 1
fi

if [ "${CONFIRM:-no}" != "yes" ]; then
  echo "❌ RESTORE ABORTED: Database restoration will overwrite existing data." >&2
  echo "To confirm, run with CONFIRM=yes:" >&2
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

compute_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    openssl dgst -sha256 "$1" | awk '{print $NF}'
  fi
}

# 1. Verify Manifest and Checksum (if manifest exists)
MANIFEST_FILE="${BACKUP_FILE%.sql.gz.enc}.manifest.json"
if [ -f "${MANIFEST_FILE}" ]; then
  echo "📋 Validating SHA-256 integrity from ${MANIFEST_FILE}..."
  EXPECTED_CHECKSUM=$(node -e "try { const m = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log(m.checksumSha256 || ''); } catch { process.exit(0); }" "${MANIFEST_FILE}")
  ACTUAL_CHECKSUM=$(compute_sha256 "${BACKUP_FILE}")
  if [ -n "${EXPECTED_CHECKSUM}" ] && [ "${EXPECTED_CHECKSUM}" != "${ACTUAL_CHECKSUM}" ]; then
    echo "❌ INTEGRITY CHECK FAILED: Backup checksum mismatch!" >&2
    echo "  Expected: ${EXPECTED_CHECKSUM}" >&2
    echo "  Actual:   ${ACTUAL_CHECKSUM}" >&2
    exit 1
  fi
  echo "✅ Checksum verified: ${ACTUAL_CHECKSUM:0:16}..."
fi

POSTGRES_DB="${POSTGRES_DB:-school_attendance}"
MIGRATION_DB_USER="${MIGRATION_DB_USER:-attendance_migration}"
MIGRATION_DB_PASSWORD="${MIGRATION_DB_PASSWORD:-}"

echo "=== AttendEase OS Database Disaster Recovery ==="
echo "Restoring from: ${BACKUP_FILE}"
echo "Target Database: ${POSTGRES_DB}"

# Check if docker compose is running
if command -v docker >/dev/null 2>&1 && docker compose ps --services 2>/dev/null | grep -q "db"; then
  echo "Streaming decrypted backup into docker-compose database service (with ON_ERROR_STOP=1)..."
  openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${BACKUP_ENCRYPTION_KEY}" -in "${BACKUP_FILE}" \
    | gunzip -c \
    | docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "${MIGRATION_DB_USER}" -d "${POSTGRES_DB}"
elif [ -n "${DATABASE_URL:-}" ]; then
  echo "Streaming decrypted backup using local psql connection (with ON_ERROR_STOP=1)..."
  openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${BACKUP_ENCRYPTION_KEY}" -in "${BACKUP_FILE}" \
    | gunzip -c \
    | psql -v ON_ERROR_STOP=1 "${DATABASE_URL}"
else
  echo "Error: Neither docker compose 'db' service nor DATABASE_URL is available for restoration." >&2
  exit 1
fi

echo "✅ Database restored successfully from ${BACKUP_FILE}."
