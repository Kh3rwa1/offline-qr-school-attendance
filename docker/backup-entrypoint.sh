#!/bin/sh
set -e

# Ensure required utilities are installed (Alpine postgres base)
if ! command -v openssl >/dev/null 2>&1; then
  echo "Installing openssl and gzip..."
  apk add --no-cache openssl gzip >/dev/null 2>&1 || true
fi

BACKUP_DIR="/backups"
mkdir -p "${BACKUP_DIR}"

if [ -z "${POSTGRES_DB}" ]; then
  echo "Error: POSTGRES_DB environment variable is required." >&2
  exit 1
fi

if [ -z "${BACKUP_ENCRYPTION_KEY}" ]; then
  echo "Error: BACKUP_ENCRYPTION_KEY environment variable is required." >&2
  exit 1
fi

DB_HOST="${POSTGRES_HOST:-db}"
DB_USER="${POSTGRES_USER:-attendance_system}"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-14}"

perform_backup() {
  TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
  ISO_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  BACKUP_FILE="${BACKUP_DIR}/attendease-${TIMESTAMP}.sql.gz.enc"
  TEMP_BACKUP="${BACKUP_FILE}.tmp"

  echo "[$(date -u +'%Y-%m-%d %H:%M:%S UTC')] Starting AES-256 encrypted database backup..."

  if PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump -h "${DB_HOST}" -U "${DB_USER}" -d "${POSTGRES_DB}" \
     | gzip -c \
     | openssl enc -aes-256-cbc -pbkdf2 -pass pass:"${BACKUP_ENCRYPTION_KEY}" \
     > "${TEMP_BACKUP}"; then
    
    mv "${TEMP_BACKUP}" "${BACKUP_FILE}"
    echo "${ISO_TIMESTAMP}" > "${BACKUP_DIR}/LATEST"
    BACKUP_SIZE=$(ls -lh "${BACKUP_FILE}" | awk '{print $5}')
    echo "[$(date -u +'%Y-%m-%d %H:%M:%S UTC')] ✅ Backup completed successfully: ${BACKUP_FILE} (${BACKUP_SIZE})"

    # Retention cleanup
    if [ -n "${RETAIN_DAYS}" ] && [ "${RETAIN_DAYS}" -gt 0 ]; then
      find "${BACKUP_DIR}" -name "attendease-*.sql.gz.enc" -mtime +"${RETAIN_DAYS}" -delete 2>/dev/null || true
    fi
  else
    rm -f "${TEMP_BACKUP}"
    echo "[$(date -u +'%Y-%m-%d %H:%M:%S UTC')] ❌ Database backup failed!" >&2
    return 1
  fi
}

# If run-once requested (for testing or manual triggering)
if [ "$1" = "--run-once" ] || [ "$1" = "run-once" ]; then
  perform_backup
  exit $?
fi

echo "=== AttendEase OS Autonomous Backup Daemon Initialized ==="
echo "Target DB: ${POSTGRES_DB} at ${DB_HOST}"
echo "Retention: ${RETAIN_DAYS} days"

# Run an initial backup if no backup exists yet
if [ ! -f "${BACKUP_DIR}/LATEST" ]; then
  echo "No existing backup snapshot detected. Creating initial first-boot snapshot..."
  perform_backup || echo "Initial snapshot delayed until database is fully ready."
fi

# Autonomous loop: checks every minute if it's backup time or if last backup > 24h
while true; do
  CURRENT_TIME=$(date +%H:%M)
  TARGET_TIME="${BACKUP_CRON:-18:30}"

  # Also check if latest backup is older than 24 hours (86400 seconds)
  NEEDS_BACKUP=0
  if [ "${CURRENT_TIME}" = "${TARGET_TIME}" ]; then
    NEEDS_BACKUP=1
  elif [ ! -f "${BACKUP_DIR}/LATEST" ]; then
    NEEDS_BACKUP=1
  fi

  if [ "${NEEDS_BACKUP}" -eq 1 ]; then
    perform_backup || true
    # Sleep 65 seconds to avoid double trigger in the same minute
    sleep 65
  else
    sleep 30
  fi
done
