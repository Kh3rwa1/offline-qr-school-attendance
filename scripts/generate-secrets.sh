#!/usr/bin/env bash
set -euo pipefail

# Ensure strict file creation permissions (0600)
umask 077

ENV_FILE="${1:-.env}"

if [ ! -f "${ENV_FILE}" ]; then
  if [ -f ".env.example" ]; then
    echo "Creating ${ENV_FILE} from .env.example..."
    cp .env.example "${ENV_FILE}"
    chmod 0600 "${ENV_FILE}"
  else
    echo "Error: Neither ${ENV_FILE} nor .env.example found." >&2
    exit 1
  fi
fi

generate_secret_32() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

is_placeholder_or_empty() {
  local val="$1"
  if [ -z "${val}" ]; then
    return 0
  fi
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
chmod 0600 "${TEMP_ENV}"

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

SEEN_SECRETS=""

for key in "${SECRET_KEYS[@]}"; do
  current_val="$(get_var "${key}")"
  if is_placeholder_or_empty "${current_val}"; then
    while true; do
      new_secret="$(generate_secret_32)"
      if [[ "${SEEN_SECRETS}" != *"${new_secret}"* ]]; then
        SEEN_SECRETS="${SEEN_SECRETS} ${new_secret}"
        break
      fi
    done
    set_var "${key}" "${new_secret}"
    echo "  Generated secure secret for: ${key}"
  else
    SEEN_SECRETS="${SEEN_SECRETS} ${current_val}"
  fi
done

# Synchronize Database Connection URLs with actual generated passwords
POSTGRES_DB="$(get_var 'POSTGRES_DB')"
if [ -z "${POSTGRES_DB}" ]; then
  POSTGRES_DB="school_attendance"
  set_var "POSTGRES_DB" "${POSTGRES_DB}"
fi

MIGRATION_USER="$(get_var 'MIGRATION_DB_USER')"
[ -z "${MIGRATION_USER}" ] && MIGRATION_USER="attendance_migration" && set_var "MIGRATION_DB_USER" "${MIGRATION_USER}"
MIGRATION_PASS="$(get_var 'MIGRATION_DB_PASSWORD')"

APP_USER="$(get_var 'APP_DB_USER')"
[ -z "${APP_USER}" ] && APP_USER="attendance_app" && set_var "APP_DB_USER" "${APP_USER}"
APP_PASS="$(get_var 'APP_DB_PASSWORD')"

SYSTEM_USER="$(get_var 'SYSTEM_DB_USER')"
[ -z "${SYSTEM_USER}" ] && SYSTEM_USER="attendance_system" && set_var "SYSTEM_DB_USER" "${SYSTEM_USER}"
SYSTEM_PASS="$(get_var 'SYSTEM_DB_PASSWORD')"

AUTH_USER="$(get_var 'AUTH_DB_USER')"
[ -z "${AUTH_USER}" ] && AUTH_USER="attendance_auth" && set_var "AUTH_DB_USER" "${AUTH_USER}"
AUTH_PASS="$(get_var 'AUTH_DB_PASSWORD')"

# Update or set application database URLs if empty or containing placeholders
sync_url() {
  local key="$1"
  local user="$2"
  local pass="$3"
  local host="$4"
  local db="$5"
  local curr="$(get_var "${key}")"
  if is_placeholder_or_empty "${curr}" || [[ "${curr}" == *replace-with* ]] || [[ "${curr}" == *ci_password* ]] || [ -z "${curr}" ]; then
    set_var "${key}" "postgres://${user}:${pass}@${host}:5432/${db}"
  fi
}

sync_url "DATABASE_URL" "${APP_USER}" "${APP_PASS}" "127.0.0.1" "${POSTGRES_DB}"
sync_url "SYSTEM_DATABASE_URL" "${SYSTEM_USER}" "${SYSTEM_PASS}" "127.0.0.1" "${POSTGRES_DB}"
sync_url "AUTH_DATABASE_URL" "${AUTH_USER}" "${AUTH_PASS}" "127.0.0.1" "${POSTGRES_DB}"
sync_url "PG_RLS_MIGRATION_DATABASE_URL" "${MIGRATION_USER}" "${MIGRATION_PASS}" "127.0.0.1" "${POSTGRES_DB}"
sync_url "PG_RLS_APPLICATION_DATABASE_URL" "${APP_USER}" "${APP_PASS}" "127.0.0.1" "${POSTGRES_DB}"
sync_url "PG_RLS_AUTH_DATABASE_URL" "${AUTH_USER}" "${AUTH_PASS}" "127.0.0.1" "${POSTGRES_DB}"
sync_url "PG_RLS_SYSTEM_DATABASE_URL" "${SYSTEM_USER}" "${SYSTEM_PASS}" "127.0.0.1" "${POSTGRES_DB}"

# Atomically replace target .env and enforce 0600 permissions
mv "${TEMP_ENV}" "${ENV_FILE}"
chmod 0600 "${ENV_FILE}"

echo "✅ All secrets audited, generated, and written to ${ENV_FILE} (permissions: 0600)."
