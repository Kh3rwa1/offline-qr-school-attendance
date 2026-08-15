#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env}"

if [ ! -f "${ENV_FILE}" ]; then
  if [ -f ".env.example" ]; then
    echo "Creating ${ENV_FILE} from .env.example..."
    cp .env.example "${ENV_FILE}"
  else
    echo "Error: Neither ${ENV_FILE} nor .env.example found." >&2
    exit 1
  fi
fi

generate_secret_32() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    # Fallback to /dev/urandom
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

is_placeholder_or_empty() {
  local val="$1"
  if [ -z "${val}" ]; then
    return 0
  fi
  # Remove quotes if present
  val="${val%\"}"
  val="${val#\"}"
  val="${val%\'}"
  val="${val#\'}"

  if [ -z "${val}" ] || \
     [[ "${val}" == replace-with-* ]] || \
     [[ "${val}" == *placeholder* ]] || \
     [[ "${val}" == *changeme* ]] || \
     [[ "${val}" == *your-secret-here* ]] || \
     [[ "${val}" == *example* ]]; then
    return 0
  fi
  return 1
}

echo "Auditing and generating cryptographically secure secrets in ${ENV_FILE}..."

TEMP_ENV="${ENV_FILE}.tmp.$$"
cp "${ENV_FILE}" "${TEMP_ENV}"

# List of standalone secret keys to generate
SECRET_KEYS=(
  "SESSION_SECRET"
  "CSRF_SECRET"
  "REDIS_KEY_HMAC_SECRET"
  "METRICS_AUTH_TOKEN"
  "RFID_HMAC_SECRET"
  "RFID_CARD_MASTER_KEY"
  "KMS_MASTER_KEY"
  "BACKUP_ENCRYPTION_KEY"
  "MIGRATION_DB_PASSWORD"
  "APP_DB_PASSWORD"
  "SYSTEM_DB_PASSWORD"
  "AUTH_DB_PASSWORD"
)

# Helper to read a var from TEMP_ENV
get_var() {
  local key="$1"
  grep -E "^${key}=" "${TEMP_ENV}" | head -n 1 | cut -d'=' -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" || true
}

# Helper to set or update a var in TEMP_ENV
set_var() {
  local key="$1"
  local val="$2"
  if grep -q -E "^${key}=" "${TEMP_ENV}"; then
    node -e "
      const fs = require('fs');
      const content = fs.readFileSync(process.argv[1], 'utf8');
      const lines = content.split('\n');
      const key = process.argv[2];
      const val = process.argv[3];
      const updated = lines.map(line => line.startsWith(key + '=') ? key + '=\"' + val + '\"' : line);
      fs.writeFileSync(process.argv[1], updated.join('\n'));
    " "${TEMP_ENV}" "${key}" "${val}"
  else
    echo "${key}=\"${val}\"" >> "${TEMP_ENV}"
  fi
}

for key in "${SECRET_KEYS[@]}"; do
  current_val="$(get_var "${key}")"
  if is_placeholder_or_empty "${current_val}"; then
    new_secret="$(generate_secret_32)"
    set_var "${key}" "${new_secret}"
    echo "  Generated new secret for: ${key}"
  fi
done

# Synchronize DB URLs with passwords
MIG_PASS="$(get_var "MIGRATION_DB_PASSWORD")"
APP_PASS="$(get_var "APP_DB_PASSWORD")"
SYS_PASS="$(get_var "SYSTEM_DB_PASSWORD")"
AUTH_PASS="$(get_var "AUTH_DB_PASSWORD")"
POSTGRES_DB="$(get_var "POSTGRES_DB")"
[ -z "${POSTGRES_DB}" ] && POSTGRES_DB="school_attendance"

# Update DATABASE_URL if placeholder
DB_URL="$(get_var "DATABASE_URL")"
if is_placeholder_or_empty "${DB_URL}" || [[ "${DB_URL}" == *replace-with-* ]]; then
  set_var "DATABASE_URL" "postgres://attendance_app:${APP_PASS}@localhost:5432/${POSTGRES_DB}"
  echo "  Synchronized DATABASE_URL"
fi

# Update SYSTEM_DATABASE_URL if placeholder
SYS_DB_URL="$(get_var "SYSTEM_DATABASE_URL")"
if is_placeholder_or_empty "${SYS_DB_URL}" || [[ "${SYS_DB_URL}" == *replace-with-* ]]; then
  set_var "SYSTEM_DATABASE_URL" "postgres://attendance_system:${SYS_PASS}@localhost:5432/${POSTGRES_DB}"
  echo "  Synchronized SYSTEM_DATABASE_URL"
fi

# Update AUTH_DATABASE_URL if placeholder
AUTH_DB_URL="$(get_var "AUTH_DATABASE_URL")"
if is_placeholder_or_empty "${AUTH_DB_URL}" || [[ "${AUTH_DB_URL}" == *replace-with-* ]]; then
  set_var "AUTH_DATABASE_URL" "postgres://attendance_auth:${AUTH_PASS}@localhost:5432/${POSTGRES_DB}"
  echo "  Synchronized AUTH_DATABASE_URL"
fi

# Ensure BACKUP_CRON and BACKUP_RETAIN_DAYS exist
if [ -z "$(get_var "BACKUP_CRON")" ]; then
  set_var "BACKUP_CRON" "18:30"
fi
if [ -z "$(get_var "BACKUP_RETAIN_DAYS")" ]; then
  set_var "BACKUP_RETAIN_DAYS" "14"
fi

mv "${TEMP_ENV}" "${ENV_FILE}"
chmod 600 "${ENV_FILE}"
echo "✅ Secrets audit and generation complete. Secured ${ENV_FILE} (mode 0600)."
