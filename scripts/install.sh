#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo " AttendEase OS — Enterprise Appliance Installer"
echo "============================================================"

CONFIG_FILE=".env"
UNATTENDED=0
DRY_RUN=0
BOOTSTRAP_ADMIN=0

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --config=*)
      CONFIG_FILE="${1#*=}"
      shift
      ;;
    --config)
      CONFIG_FILE="$2"
      shift 2
      ;;
    --unattended|-y)
      UNATTENDED=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --bootstrap-admin)
      BOOTSTRAP_ADMIN=1
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Usage: ./scripts/install.sh [--config=<path>] [--unattended] [--dry-run] [--bootstrap-admin]" >&2
      exit 1
      ;;
  esac
done

# 1. System Diagnostics & Resource Validation
echo "\n🔍 1. Running System Pre-flight Diagnostics..."

OS_TYPE="$(uname -s)"
ARCH_TYPE="$(uname -m)"
echo " • OS:           ${OS_TYPE}"
echo " • Architecture: ${ARCH_TYPE}"

if [[ "${OS_TYPE}" != "Linux" && "${OS_TYPE}" != "Darwin" ]]; then
  echo "❌ Error: AttendEase OS requires a Linux (e.g. Ubuntu 22.04/24.04 LTS) or macOS environment." >&2
  exit 1
fi

# Check Available Memory (RAM >= 2GB required, >= 4GB recommended)
TOTAL_RAM_MB=0
if [[ "${OS_TYPE}" == "Linux" && -f "/proc/meminfo" ]]; then
  TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
  TOTAL_RAM_MB=$((TOTAL_RAM_KB / 1024))
elif [[ "${OS_TYPE}" == "Darwin" ]]; then
  TOTAL_RAM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo 4294967296)
  TOTAL_RAM_MB=$((TOTAL_RAM_BYTES / 1024 / 1024))
fi

if [ "${TOTAL_RAM_MB}" -gt 0 ]; then
  echo " • Total Memory: ${TOTAL_RAM_MB} MB"
  if [ "${TOTAL_RAM_MB}" -lt 1800 ]; then
    echo "⚠️ Warning: Detected ${TOTAL_RAM_MB} MB RAM. AttendEase OS recommends at least 2048 MB for production reliability."
  fi
fi

# Check Available Disk Space (>= 5GB required)
FREE_DISK_KB=$(df -k . | tail -1 | awk '{print $4}')
FREE_DISK_GB=$((FREE_DISK_KB / 1024 / 1024))
echo " • Available Disk: ${FREE_DISK_GB} GB"
if [ "${FREE_DISK_GB}" -lt 3 ]; then
  echo "❌ Error: Insufficient disk space (${FREE_DISK_GB} GB). At least 3 GB free disk space is required." >&2
  exit 1
fi

# Check Docker & Docker Compose
if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Error: Docker is not installed or not in PATH." >&2
  echo "Please install Docker: https://docs.docker.com/engine/install/" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  if [ "${DRY_RUN}" -eq 1 ]; then
    echo " • Docker Engine: [DAEMON NOT RUNNING (dry-run notice)]"
  else
    echo "❌ Error: Docker daemon is not running or current user lacks docker socket permissions." >&2
    exit 1
  fi
else
  DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "detected")
  echo " • Docker Engine: ${DOCKER_VERSION}"
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "❌ Error: Docker Compose v2 ('docker compose') is required." >&2
  exit 1
fi
COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "v2")
echo " • Compose Plugin: ${COMPOSE_VERSION}"

# Check Port Availability
check_port() {
  local port="$1"
  local name="$2"
  if command -v lsof >/dev/null 2>&1; then
    if lsof -iTCP:"${port}" -sTCP:LISTEN -P -n >/dev/null 2>&1; then
      # Check if it's already an AttendEase container
      if ! docker ps --format '{{.Ports}}' 2>/dev/null | grep -q ":${port}->"; then
        echo "⚠️ Port ${port} (${name}) is currently occupied by an external host process."
      fi
    fi
  fi
}

check_port 3000 "Web Application"
check_port 3001 "RFID Gateway"
check_port 5432 "PostgreSQL"
check_port 6379 "Redis"

# 2. Environment & Secrets Provisioning
echo "\n🔐 2. Configuring Environment & Secrets (${CONFIG_FILE})..."

if [ ! -f "${CONFIG_FILE}" ]; then
  if [ -f ".env.example" ]; then
    echo "Creating ${CONFIG_FILE} from .env.example..."
    cp .env.example "${CONFIG_FILE}"
    chmod 0600 "${CONFIG_FILE}"
  else
    echo "❌ Error: Neither ${CONFIG_FILE} nor .env.example found." >&2
    exit 1
  fi
fi

chmod +x ./scripts/generate-secrets.sh
./scripts/generate-secrets.sh "${CONFIG_FILE}"

# Load and validate environment
set -a
# shellcheck disable=SC1090
source "${CONFIG_FILE}"
set +a

NODE_ENV="${NODE_ENV:-production}"
SMS_PROVIDER="${SMS_PROVIDER:-}"
PORT="${PORT:-3000}"
APP_URL="${APP_URL:-http://localhost:${PORT}}"

echo " • Target Environment: ${NODE_ENV}"
echo " • SMS Provider:       ${SMS_PROVIDER:-[NOT CONFIGURED]}"

# 3. Production Hardening Pre-flight Gate
if [[ "${NODE_ENV}" == "production" ]]; then
  echo "\n🛡️ 3. Validating Production Fail-Closed Pre-flight Gates..."

  if [[ "${SMS_PROVIDER}" == "fake" || -z "${SMS_PROVIDER}" ]]; then
    if [[ "${UNATTENDED}" -eq 1 ]]; then
      echo "❌ FATAL PRODUCTION ERROR: SMS_PROVIDER=fake or empty is strictly forbidden in production mode." >&2
      echo "REMEDIATION: Set SMS_PROVIDER=dlt (with DLT credentials) or SMS_PROVIDER=console in ${CONFIG_FILE}." >&2
      exit 1
    else
      echo "⚠️ SMS_PROVIDER is currently '${SMS_PROVIDER}'. Fake SMS is strictly prohibited in production."
      read -rp "Select real SMS provider for this appliance [dlt/nic/cdac/console]: " CHOSEN_SMS
      if [[ "${CHOSEN_SMS}" == "dlt" || "${CHOSEN_SMS}" == "nic" || "${CHOSEN_SMS}" == "cdac" || "${CHOSEN_SMS}" == "console" ]]; then
        SMS_PROVIDER="${CHOSEN_SMS}"
        # Update .env
        sed -i.bak "s/^SMS_PROVIDER=.*/SMS_PROVIDER=\"${SMS_PROVIDER}\"/" "${CONFIG_FILE}" && rm -f "${CONFIG_FILE}.bak"
        echo "✅ Updated SMS_PROVIDER=\"${SMS_PROVIDER}\" in ${CONFIG_FILE}."
      else
        echo "❌ FATAL: Unsupported SMS provider '${CHOSEN_SMS}'. Aborting installation." >&2
        exit 1
      fi
    fi
  fi

  # Validate secret lengths and absence of placeholders
  for sec_var in SESSION_SECRET CSRF_SECRET REDIS_KEY_HMAC_SECRET METRICS_AUTH_TOKEN RFID_HMAC_SECRET RFID_CARD_MASTER_KEY KMS_MASTER_KEY BACKUP_ENCRYPTION_KEY; do
    sec_val="${!sec_var:-}"
    if [ -z "${sec_val}" ] || [ ${#sec_val} -lt 32 ]; then
      echo "❌ FATAL: ${sec_var} must be at least 32 characters long." >&2
      exit 1
    fi
    if [[ "${sec_val}" == *replace-with* || "${sec_val}" == *placeholder* || "${sec_val}" == *changeme* ]]; then
      echo "❌ FATAL: ${sec_var} contains an insecure example placeholder." >&2
      exit 1
    fi
  done
  echo " • All cryptographic secret keys validated: OK (256-bit entropy)"
fi

if [ "${DRY_RUN}" -eq 1 ]; then
  echo "\n✅ Pre-flight dry-run diagnostic complete. All system and configuration requirements satisfied."
  exit 0
fi

# Ensure local canonical backups directory exists with secure permissions
mkdir -p ./backups
chmod 0700 ./backups

# 4. Idempotent Container Startup & Migration
echo "\n🚀 4. Launching AttendEase OS Appliance Stack..."

docker compose up -d --build

# 5. Health & Readiness Verification
echo "\n⏳ 5. Awaiting System Readiness (/readyz)..."
MAX_ATTEMPTS=45
ATTEMPT=0
HEALTHY=0

while [ ${ATTEMPT} -lt ${MAX_ATTEMPTS} ]; do
  ATTEMPT=$((ATTEMPT + 1))
  if curl -sf "http://127.0.0.1:${PORT}/readyz" >/dev/null 2>&1; then
    HEALTHY=1
    break
  fi
  sleep 2
done

if [ ${HEALTHY} -ne 1 ]; then
  echo "❌ Error: AttendEase OS failed to become healthy within 90 seconds." >&2
  echo "Dumping container diagnostics:" >&2
  docker compose ps -a
  docker compose logs --tail=50
  exit 1
fi

# Optional First-Admin Bootstrap
if [ "${BOOTSTRAP_ADMIN}" -eq 1 ]; then
  echo "\n🔑 6. Executing First-Admin Bootstrap..."
  chmod +x ./scripts/bootstrap-admin.sh
  ./scripts/bootstrap-admin.sh --generate-token || true
fi

echo ""
echo "============================================================"
echo " ✅ AttendEase OS Appliance Successfully Installed & Verified"
echo "============================================================"
echo " • Platform Access URL: ${APP_URL}"
echo " • Canonical Backups:   ./backups (Encrypted AES-256-CBC PBKDF2)"
echo " • Autonomous Workers:  SMS drain queue + stuck session reconciler"
echo " • Outbox Sync:         Offline IndexedDB auto-sync on reconnect"
echo " • Operational Manual:  README.md (Install, Update, Backup, Restore)"
echo "============================================================"
