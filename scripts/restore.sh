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

POSTGRES_DB="${POSTGRES_DB:-school_attendance}"
MIGRATION_DB_USER="${MIGRATION_DB_USER:-attendance_migration}"
MIGRATION_DB_PASSWORD="${MIGRATION_DB_PASSWORD:-}"

echo "=== AttendEase OS Database Disaster Recovery ==="
echo "Restoring from: ${BACKUP_FILE}"
echo "Target Database: ${POSTGRES_DB}"

# Check if docker compose is running
if command -v docker >/dev/null 2>&1 && docker compose ps --services 2>/dev/null | grep -q "db"; then
  echo "Streaming decrypted backup into docker-compose database service..."
  openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${BACKUP_ENCRYPTION_KEY}" -in "${BACKUP_FILE}" \
    | gunzip -c \
    | docker compose exec -T db psql -U "${MIGRATION_DB_USER}" -d "${POSTGRES_DB}"
elif [ -n "${DATABASE_URL:-}" ]; then
  echo "Streaming decrypted backup using local psql connection..."
  openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${BACKUP_ENCRYPTION_KEY}" -in "${BACKUP_FILE}" \
    | gunzip -c \
    | psql "${DATABASE_URL}"
else
  echo "Error: Neither docker compose 'db' service nor DATABASE_URL is available for restoration." >&2
  exit 1
fi

echo "✅ Database restored successfully from ${BACKUP_FILE}."
