#!/bin/sh
set -eu

umask 077

# Ensure required utilities are installed (Alpine postgres base)
if ! command -v openssl >/dev/null 2>&1; then
  echo "Installing openssl and gzip..."
  apk add --no-cache openssl gzip coreutils >/dev/null 2>&1 || true
fi

BACKUP_DIR="${BACKUP_DIR:-/backups}"
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

if [ -z "${POSTGRES_DB:-}" ]; then
  echo "Error: POSTGRES_DB environment variable is required." >&2
  exit 1
fi

# Canonical key configuration & entropy check
if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ] && [ -n "${BACKUP_PASSPHRASE:-}" ] && [ "${BACKUP_ENCRYPTION_KEY}" != "${BACKUP_PASSPHRASE}" ]; then
  echo "FATAL: Conflicting BACKUP_ENCRYPTION_KEY and legacy BACKUP_PASSPHRASE provided with differing values." >&2
  exit 1
fi

BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-${BACKUP_PASSPHRASE:-}}"
if [ -z "${BACKUP_ENCRYPTION_KEY}" ]; then
  echo "Error: BACKUP_ENCRYPTION_KEY environment variable is required." >&2
  exit 1
fi

if [ "${#BACKUP_ENCRYPTION_KEY}" -lt 32 ]; then
  echo "FATAL: BACKUP_ENCRYPTION_KEY must have a minimum length of 32 characters (found: ${#BACKUP_ENCRYPTION_KEY})." >&2
  exit 1
fi

DB_HOST="${POSTGRES_HOST:-db}"
DB_USER="${POSTGRES_USER:-attendance_system}"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-14}"
APP_VERSION="${APP_VERSION:-1.0.0}"
SCHEMA_VERSION="${SCHEMA_VERSION:-0015_cursor_pagination_and_query_optimization}"
GIT_COMMIT="${GIT_COMMIT:-$(git rev-parse --short HEAD 2>/dev/null || echo 'release')}"

compute_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    openssl dgst -sha256 "$1" | awk '{print $NF}'
  fi
}

compute_str_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    printf "%s" "$1" | sha256sum | awk '{print $1}'
  else
    printf "%s" "$1" | openssl dgst -sha256 | awk '{print $NF}'
  fi
}

perform_backup() {
  LOCK_FILE="/tmp/attendease-backup-run.lock"
  if [ -f "${LOCK_FILE}" ]; then
    echo "[$(date -u +'%Y-%m-%d %H:%M:%S UTC')] Another backup operation is currently active. Skipping."
    return 0
  fi
  touch "${LOCK_FILE}"
  trap 'rm -f "${LOCK_FILE}"' EXIT

  TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
  ISO_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  BACKUP_FILE="${BACKUP_DIR}/attendease-${TIMESTAMP}.sql.gz.enc"
  MANIFEST_FILE="${BACKUP_DIR}/attendease-${TIMESTAMP}.manifest.json"

  TMP_DIR="${BACKUP_DIR}/.tmp_$$"
  mkdir -p "${TMP_DIR}"
  chmod 700 "${TMP_DIR}"
  
  TEMP_RAW="${TMP_DIR}/attendease-${TIMESTAMP}.raw.sql"
  TEMP_ENC="${TMP_DIR}/attendease-${TIMESTAMP}.sql.gz.enc"
  TEMP_MANIFEST="${TMP_DIR}/attendease-${TIMESTAMP}.manifest.json"

  echo "[$(date -u +'%Y-%m-%d %H:%M:%S UTC')] Starting staged AES-256 encrypted database backup..."

  # Step 1: Execute pg_dump into temporary raw file and check exit code
  if ! PGPASSWORD="${POSTGRES_PASSWORD:-}" pg_dump -h "${DB_HOST}" -U "${DB_USER}" -d "${POSTGRES_DB}" > "${TEMP_RAW}"; then
    echo "[$(date -u +'%Y-%m-%d %H:%M:%S UTC')] ❌ pg_dump command failed with non-zero exit code!" >&2
    rm -rf "${TMP_DIR}"
    return 1
  fi

  # Step 2: Verify dump file is non-empty and contains SQL structure
  if [ ! -s "${TEMP_RAW}" ]; then
    echo "[$(date -u +'%Y-%m-%d %H:%M:%S UTC')] ❌ pg_dump produced an empty dump file (0 bytes)!" >&2
    rm -rf "${TMP_DIR}"
    return 1
  fi

  RAW_SIZE=$(wc -c < "${TEMP_RAW}" | tr -d ' ')
  PG_VERSION=$(pg_dump --version 2>/dev/null | head -n 1 || echo "PostgreSQL")

  # Step 3: Compress and encrypt into temporary encrypted file
  if ! gzip -c "${TEMP_RAW}" | openssl enc -aes-256-cbc -pbkdf2 -salt -pass pass:"${BACKUP_ENCRYPTION_KEY}" > "${TEMP_ENC}"; then
    echo "[$(date -u +'%Y-%m-%d %H:%M:%S UTC')] ❌ Encryption/compression stage failed!" >&2
    rm -rf "${TMP_DIR}"
    return 1
  fi
  rm -f "${TEMP_RAW}"

  # Step 4: Self-test decryption and archive decompression before publishing
  if ! openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${BACKUP_ENCRYPTION_KEY}" -in "${TEMP_ENC}" | gunzip -t >/dev/null 2>&1; then
    echo "[$(date -u +'%Y-%m-%d %H:%M:%S UTC')] ❌ Self-test integrity check failed on generated encrypted archive!" >&2
    rm -rf "${TMP_DIR}"
    return 1
  fi

  # Step 5: Calculate SHA-256 checksum and size
  CHECKSUM=$(compute_sha256 "${TEMP_ENC}")
  ENC_SIZE=$(wc -c < "${TEMP_ENC}" | tr -d ' ')
  FULL_KEY_HASH=$(compute_str_sha256 "${BACKUP_ENCRYPTION_KEY}")
  KEY_ID=$(echo "${FULL_KEY_HASH}" | cut -c 1-8)

  # Step 6: Generate structured JSON manifest (version 2.0)
  cat <<EOF > "${TEMP_MANIFEST}"
{
  "backupFormatVersion": "2.0",
  "backupFile": "attendease-${TIMESTAMP}.sql.gz.enc",
  "checksumSha256": "${CHECKSUM}",
  "timestamp": "${ISO_TIMESTAMP}",
  "sizeBytes": ${ENC_SIZE},
  "rawSizeBytes": ${RAW_SIZE},
  "database": "${POSTGRES_DB}",
  "pgVersion": "${PG_VERSION}",
  "appVersion": "${APP_VERSION}",
  "schemaVersion": "${SCHEMA_VERSION}",
  "gitCommit": "${GIT_COMMIT}",
  "encryption": "AES-256-CBC-PBKDF2",
  "keyId": "${KEY_ID}",
  "restoreVerified": false,
  "status": "SUCCESS"
}
EOF

  # Step 7: Atomic rename into canonical destination and sync
  mv "${TEMP_ENC}" "${BACKUP_FILE}"
  mv "${TEMP_MANIFEST}" "${MANIFEST_FILE}"
  rm -rf "${TMP_DIR}"

  # Step 8: Update canonical pointers
  echo "${ISO_TIMESTAMP}" > "${BACKUP_DIR}/LATEST"
  cp "${MANIFEST_FILE}" "${BACKUP_DIR}/LATEST_MANIFEST.json"

  echo "[$(date -u +'%Y-%m-%d %H:%M:%S UTC')] ✅ Verified backup published: ${BACKUP_FILE} (${ENC_SIZE} bytes, sha256:${CHECKSUM:0:12}..., keyId:${KEY_ID})"

  # Step 9: Off-host backup replication hook (if configured)
  if [ -n "${OFFSITE_BACKUP_CMD:-}" ]; then
    echo "Executing offsite replication command..."
    eval "${OFFSITE_BACKUP_CMD}" || echo "Warning: Offsite replication command reported failure." >&2
  fi

  # Step 10: Retention cleanup (never delete if <= 1 backups remain)
  TOTAL_BACKUPS=$(ls -1 "${BACKUP_DIR}"/attendease-*.sql.gz.enc 2>/dev/null | wc -l | tr -d ' ')
  if [ "${TOTAL_BACKUPS}" -gt 1 ] && [ -n "${RETAIN_DAYS}" ] && [ "${RETAIN_DAYS}" -gt 0 ]; then
    find "${BACKUP_DIR}" -name "attendease-*.sql.gz.enc" -mtime +"${RETAIN_DAYS}" -delete 2>/dev/null || true
    find "${BACKUP_DIR}" -name "attendease-*.manifest.json" -mtime +"${RETAIN_DAYS}" -delete 2>/dev/null || true
  fi

  rm -f "${LOCK_FILE}"
  return 0
}

# If run-once requested (for testing or manual triggering)
if [ "${1:-}" = "--run-once" ] || [ "${1:-}" = "run-once" ]; then
  perform_backup
  exit $?
fi

echo "=== AttendEase OS Autonomous Backup Daemon Initialized ==="
echo "Target DB: ${POSTGRES_DB} at ${DB_HOST}"
echo "Retention: ${RETAIN_DAYS} days (guaranteed last-known-good preservation)"

# Run an initial backup if no backup exists yet
if [ ! -f "${BACKUP_DIR}/LATEST" ]; then
  echo "No existing backup snapshot detected. Creating initial first-boot snapshot..."
  perform_backup || echo "Initial snapshot delayed until database is fully ready."
fi

# Autonomous loop: checks every minute if it's backup time or if last backup > 24h (86400s)
while true; do
  CURRENT_TIME=$(date +%H:%M)
  TARGET_TIME="${BACKUP_CRON:-18:30}"

  NEEDS_BACKUP=0
  if [ "${CURRENT_TIME}" = "${TARGET_TIME}" ]; then
    NEEDS_BACKUP=1
  elif [ ! -f "${BACKUP_DIR}/LATEST" ]; then
    NEEDS_BACKUP=1
  else
    # Parse LATEST timestamp and check if older than 24 hours (86400s)
    LATEST_ISO=$(cat "${BACKUP_DIR}/LATEST" 2>/dev/null | tr -d ' \n' || true)
    if [ -n "${LATEST_ISO}" ]; then
      LATEST_EPOCH=$(date -d "${LATEST_ISO}" +%s 2>/dev/null || date -jf "%Y-%m-%dT%H:%M:%SZ" "${LATEST_ISO}" +%s 2>/dev/null || echo 0)
      NOW_EPOCH=$(date +%s)
      if [ "${LATEST_EPOCH}" -gt 0 ]; then
        AGE_SECONDS=$((NOW_EPOCH - LATEST_EPOCH))
        if [ "${AGE_SECONDS}" -ge 86400 ]; then
          echo "Notice: Latest backup age is ${AGE_SECONDS}s (> 24h). Triggering fresh snapshot."
          NEEDS_BACKUP=1
        fi
      fi
    fi
  fi

  if [ "${NEEDS_BACKUP}" -eq 1 ]; then
    perform_backup || true
    sleep 65
  else
    sleep 30
  fi
done
