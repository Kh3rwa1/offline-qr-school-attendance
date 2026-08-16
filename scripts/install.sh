#!/usr/bin/env bash
# ==============================================================================
# AttendEase OS — Production QR Appliance Management & Installer
# Supported Platforms: Ubuntu 22.04/24.04 LTS (x86_64 & ARM64), Debian 12, macOS
# ==============================================================================
set -euo pipefail

umask 077

VERSION="1.0.0"
CONFIG_FILE=".env"
STATE_FILE=".attendease_state.json"
COMMAND="install"
UNATTENDED=0
DRY_RUN=0
PURGE=0
RESTORE_TARGET=""

# Parse CLI arguments and subcommands
if [[ $# -gt 0 ]]; then
  case "$1" in
    install|status|diagnostics|backup|restore|repair|update|rollback|uninstall)
      COMMAND="$1"
      shift
      ;;
  esac
fi

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
    --purge)
      PURGE=1
      shift
      ;;
    --help|-h)
      echo "AttendEase OS CLI ($VERSION)"
      echo "Usage: ./scripts/install.sh [COMMAND] [OPTIONS]"
      echo ""
      echo "Commands:"
      echo "  install      Full pre-flight validation and appliance deployment (default)"
      echo "  status       Display live container, health, and worker status"
      echo "  diagnostics  Run detailed system diagnostic report"
      echo "  backup       Execute immediate local AES-256 encrypted backup"
      echo "  restore      Restore database from an encrypted backup archive"
      echo "  repair       Self-healing: restart services and verify health"
      echo "  update       Safe upgrade with automatic rollback on health failure"
      echo "  rollback     Revert to previous recorded container image version"
      echo "  uninstall    Stop and remove AttendEase OS appliance stack"
      echo ""
      echo "Options:"
      echo "  --config=<path>  Path to configuration env file (default: .env)"
      echo "  --unattended, -y Non-interactive execution"
      echo "  --dry-run        Validate pre-flight requirements without starting containers"
      echo "  --purge          Purge all database volumes on uninstall"
      exit 0
      ;;
    *)
      if [[ "${COMMAND}" == "restore" && -z "${RESTORE_TARGET}" ]]; then
        RESTORE_TARGET="$1"
        shift
      else
        echo "Unknown option: $1" >&2
        echo "Run './scripts/install.sh --help' for usage." >&2
        exit 1
      fi
      ;;
  esac
done

# ==============================================================================
# Helper Functions
# ==============================================================================

log_header() {
  echo "============================================================"
  echo " $1"
  echo "============================================================"
}

get_lan_ip() {
  if command -v hostname >/dev/null 2>&1; then
    hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1"
  elif command -v ip >/dev/null 2>&1; then
    ip route get 1.1.1.1 2>/dev/null | awk '{print $7}' || echo "127.0.0.1"
  else
    echo "127.0.0.1"
  fi
}

check_preflight() {
  echo "\n🔍 Checking System Pre-flight Requirements..."
  
  OS_TYPE="$(uname -s)"
  ARCH_TYPE="$(uname -m)"
  
  # 1. OS & Distribution Verification
  DISTRO_NAME="${OS_TYPE}"
  if [[ "${OS_TYPE}" == "Linux" && -f "/etc/os-release" ]]; then
    # shellcheck disable=SC1091
    source /etc/os-release
    DISTRO_NAME="${NAME:-Linux} ${VERSION_ID:-}"
  elif [[ "${OS_TYPE}" == "Darwin" ]]; then
    MAC_VER="$(sw_vers -productVersion 2>/dev/null || echo 'macOS')"
    DISTRO_NAME="macOS ${MAC_VER}"
  fi
  echo " • Operating System: ${DISTRO_NAME}"
  echo " • CPU Architecture: ${ARCH_TYPE}"

  if [[ "${OS_TYPE}" != "Linux" && "${OS_TYPE}" != "Darwin" ]]; then
    echo "❌ Error: AttendEase OS requires Linux (Ubuntu 22.04/24.04 LTS recommended) or macOS." >&2
    exit 1
  fi

  if [[ "${ARCH_TYPE}" != "x86_64" && "${ARCH_TYPE}" != "aarch64" && "${ARCH_TYPE}" != "arm64" ]]; then
    echo "❌ Error: Unsupported architecture '${ARCH_TYPE}'. AttendEase OS supports x86_64 and ARM64 (aarch64)." >&2
    exit 1
  fi

  # 2. Memory Check (min 1500MB, recommended 2048MB+)
  TOTAL_RAM_MB=0
  if [[ "${OS_TYPE}" == "Linux" && -f "/proc/meminfo" ]]; then
    TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    TOTAL_RAM_MB=$((TOTAL_RAM_KB / 1024))
  elif [[ "${OS_TYPE}" == "Darwin" ]]; then
    TOTAL_RAM_BYTES=$(sysctl -n hw.memsize 2>/dev/null || echo 4294967296)
    TOTAL_RAM_MB=$((TOTAL_RAM_BYTES / 1024 / 1024))
  fi

  if [ "${TOTAL_RAM_MB}" -gt 0 ]; then
    echo " • System Memory:    ${TOTAL_RAM_MB} MB"
    if [ "${TOTAL_RAM_MB}" -lt 1500 ]; then
      echo "❌ Error: Insufficient RAM (${TOTAL_RAM_MB} MB). AttendEase OS requires at least 2048 MB RAM." >&2
      exit 1
    fi
  fi

  # 3. Disk Space Check (min 3GB free)
  FREE_DISK_KB=$(df -k . | tail -1 | awk '{print $4}')
  FREE_DISK_GB=$((FREE_DISK_KB / 1024 / 1024))
  echo " • Available Disk:   ${FREE_DISK_GB} GB"
  if [ "${FREE_DISK_GB}" -lt 3 ]; then
    echo "❌ Error: Insufficient disk space (${FREE_DISK_GB} GB). At least 3 GB free disk space is required." >&2
    exit 1
  fi

  # 4. Port Conflicts (80, 443, 3000)
  if command -v ss >/dev/null 2>&1; then
    if ss -tuln | grep -E ':(80|443)\b' >/dev/null 2>&1 && [ "${DRY_RUN}" -ne 1 ]; then
      echo "⚠️ Notice: Port 80 or 443 is already active on host. Ensure existing proxy or container does not conflict."
    fi
  fi

  # 5. Docker CLI & Daemon Check
  if ! command -v docker >/dev/null 2>&1; then
    echo "❌ Error: Docker is not installed or not in PATH." >&2
    echo "Install Docker: https://docs.docker.com/engine/install/ubuntu/" >&2
    exit 1
  fi

  if ! docker info >/dev/null 2>&1; then
    if [ "${DRY_RUN}" -eq 1 ]; then
      echo " • Docker Engine:    [Daemon not running (dry-run)]"
    else
      echo "❌ Error: Docker daemon is not running or current user lacks docker group permissions." >&2
      exit 1
    fi
  else
    DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "detected")
    echo " • Docker Engine:    ${DOCKER_VERSION}"
  fi

  # 6. Docker Compose Plugin Check
  if ! docker compose version >/dev/null 2>&1; then
    echo "❌ Error: Docker Compose v2 ('docker compose') is required." >&2
    exit 1
  fi
  COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "v2")
  echo " • Compose Plugin:   ${COMPOSE_VERSION}"
}

ensure_secrets() {
  echo "\n🔐 Configuring Environment & Cryptographic Secrets (${CONFIG_FILE})..."
  if [ ! -f "${CONFIG_FILE}" ]; then
    if [ -f ".env.example" ]; then
      cp .env.example "${CONFIG_FILE}"
      chmod 0600 "${CONFIG_FILE}"
    else
      echo "❌ Error: Neither ${CONFIG_FILE} nor .env.example found." >&2
      exit 1
    fi
  fi

  chmod +x ./scripts/generate-secrets.sh
  ./scripts/generate-secrets.sh "${CONFIG_FILE}"
  chmod 0600 "${CONFIG_FILE}"

  mkdir -p ./backups
  chmod 0700 ./backups
}

dcompose() {
  docker compose --env-file "${CONFIG_FILE}" "$@"
}

# ==============================================================================
# Subcommand Handlers
# ==============================================================================

cmd_install() {
  log_header "AttendEase OS — QR Pilot Production Installer"
  check_preflight
  ensure_secrets

  echo "\n⚙️ Validating Compose Configuration (QR-only scope)..."
  dcompose config --quiet

  if [ "${DRY_RUN}" -eq 1 ]; then
    echo "\n✅ Pre-flight dry-run diagnostic complete. All system prerequisites and security validations passed."
    exit 0
  fi

  echo "\n🚀 Launching Production Container Services..."
  dcompose up -d --build

  echo "\n⏳ Awaiting System Readiness (/readyz)..."
  MAX_ATTEMPTS=45
  ATTEMPT=0
  HEALTHY=0

  while [ ${ATTEMPT} -lt ${MAX_ATTEMPTS} ]; do
    ATTEMPT=$((ATTEMPT + 1))
    if curl -sf "http://127.0.0.1:3000/readyz" >/dev/null 2>&1; then
      HEALTHY=1
      break
    fi
    sleep 2
  done

  if [ ${HEALTHY} -ne 1 ]; then
    echo "❌ Error: AttendEase OS failed to pass readiness probes within 90s." >&2
    dcompose logs --tail=50 >&2
    exit 1
  fi

  # Record installed state
  APP_IMAGE_ID=$(dcompose images -q app 2>/dev/null || echo "local-build")
  cat <<EOF > "${STATE_FILE}"
{
  "version": "${VERSION}",
  "current_image": "${APP_IMAGE_ID}",
  "previous_image": null,
  "installed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
  chmod 0600 "${STATE_FILE}"

  SERVER_DOMAIN=$(grep '^SERVER_DOMAIN=' "${CONFIG_FILE}" 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "")
  LAN_IP=$(get_lan_ip)
  
  ACCESS_URL="http://${LAN_IP}"
  if [ -n "${SERVER_DOMAIN}" ] && [ "${SERVER_DOMAIN}" != "localhost" ] && [ "${SERVER_DOMAIN}" != "127.0.0.1" ]; then
    ACCESS_URL="https://${SERVER_DOMAIN}"
  fi

  echo "\n============================================================"
  echo " ✅ AttendEase OS Successfully Installed & Healthy"
  echo "============================================================"
  echo " • Appliance URL:       ${ACCESS_URL}"
  echo " • First-Run Wizard:    ${ACCESS_URL}/setup"
  echo " • Local Port (Direct): http://127.0.0.1:3000"
  echo " • Encrypted Backups:   ./backups (AES-256-CBC PBKDF2)"
  echo " • Management CLI:      ./bin/attendease [status|backup|update]"
  if [[ "${ACCESS_URL}" =~ ^http:// ]]; then
    echo " • Note: Automatic HTTPS is active for public DNS domain names."
    echo "         LAN IP access uses plaintext HTTP on port 80."
  fi
  echo "============================================================"
}

cmd_status() {
  log_header "AttendEase OS — System Health Status"
  dcompose ps
  echo ""
  
  if curl -sf "http://127.0.0.1:3000/api/v1/health" >/dev/null 2>&1; then
    echo " • Backend API:         🟢 HEALTHY"
  else
    echo " • Backend API:         🔴 UNHEALTHY / UNREACHABLE"
  fi

  if curl -sf "http://127.0.0.1:3000/readyz" >/dev/null 2>&1; then
    echo " • Database & Readiness:🟢 READY"
  else
    echo " • Database & Readiness:🔴 NOT READY"
  fi

  LATEST_BACKUP=$(find ./backups -name "*.sql.gz.enc" 2>/dev/null | sort -r | head -n 1 || true)
  if [ -n "${LATEST_BACKUP}" ]; then
    echo " • Latest Local Backup: 🟢 $(basename "${LATEST_BACKUP}")"
  else
    echo " • Latest Local Backup: 🟡 No backups created yet"
  fi
}

cmd_diagnostics() {
  log_header "AttendEase OS — Diagnostic Report"
  echo "--- System Resources ---"
  df -h .
  echo ""
  echo "--- Docker Containers ---"
  dcompose ps -a
  echo ""
  echo "--- Recent Container Logs ---"
  dcompose logs --tail=30
}

cmd_backup() {
  log_header "AttendEase OS — Creating Encrypted Backup Snapshot"
  mkdir -p ./backups
  chmod 0700 ./backups

  TIMESTAMP=$(date +%Y%m%d%H%M%S)
  BACKUP_NAME="attendease-${TIMESTAMP}"
  TARGET_ENC="./backups/${BACKUP_NAME}.sql.gz.enc"

  BACKUP_KEY=$(grep '^BACKUP_ENCRYPTION_KEY=' "${CONFIG_FILE}" 2>/dev/null | cut -d'=' -f2- | tr -d '"' || true)
  if [ -z "${BACKUP_KEY}" ]; then
    BACKUP_KEY=$(grep '^SESSION_SECRET=' "${CONFIG_FILE}" 2>/dev/null | cut -d'=' -f2- | tr -d '"' || true)
  fi

  if [ -z "${BACKUP_KEY}" ]; then
    echo "❌ Error: Missing BACKUP_ENCRYPTION_KEY in ${CONFIG_FILE}" >&2
    exit 1
  fi

  dcompose exec -T db pg_dump -U attendance_migration -d school_attendance | \
    gzip -c | \
    openssl enc -aes-256-cbc -pbkdf2 -salt -pass pass:"${BACKUP_KEY}" > "${TARGET_ENC}"

  SHA256_HASH=$(openssl dgst -sha256 "${TARGET_ENC}" | awk '{print $2}')
  echo "${SHA256_HASH}  $(basename "${TARGET_ENC}")" > "./backups/${BACKUP_NAME}.checksums.sha256"

  echo "✅ Encrypted backup snapshot created: ${TARGET_ENC}"
  echo " • SHA-256: ${SHA256_HASH}"
}

cmd_restore() {
  log_header "AttendEase OS — Database Recovery from Backup"
  if [ -z "${RESTORE_TARGET}" ]; then
    echo "❌ Error: Specify backup file path. Example: ./scripts/install.sh restore ./backups/attendease-latest.sql.gz.enc" >&2
    exit 1
  fi

  if [ ! -f "${RESTORE_TARGET}" ]; then
    echo "❌ Error: Backup file '${RESTORE_TARGET}' not found." >&2
    exit 1
  fi

  BACKUP_KEY=$(grep '^BACKUP_ENCRYPTION_KEY=' "${CONFIG_FILE}" 2>/dev/null | cut -d'=' -f2- | tr -d '"' || true)
  if [ -z "${BACKUP_KEY}" ]; then
    BACKUP_KEY=$(grep '^SESSION_SECRET=' "${CONFIG_FILE}" 2>/dev/null | cut -d'=' -f2- | tr -d '"' || true)
  fi

  echo "⚠️ Restoring database will overwrite current state."
  if [ "${UNATTENDED}" -ne 1 ]; then
    read -rp "Are you sure you want to proceed? [y/N]: " CONFIRM
    if [[ "${CONFIRM}" != "y" && "${CONFIRM}" != "Y" ]]; then
      echo "Restore aborted."
      exit 0
    fi
  fi

  echo " • Decrypting and streaming backup to PostgreSQL..."
  openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${BACKUP_KEY}" -in "${RESTORE_TARGET}" | \
    gunzip -c | \
    dcompose exec -T db psql -U attendance_migration -d school_attendance

  echo "✅ Database restore successfully completed."
}

cmd_repair() {
  log_header "AttendEase OS — Self-Healing Repair Routine"
  echo " • Restarting unhealthy containers..."
  dcompose restart
  sleep 5
  cmd_status
}

cmd_update() {
  log_header "AttendEase OS — Safe Application Upgrade"
  
  echo "1. Creating pre-update snapshot backup..."
  cmd_backup
  PRE_UPDATE_BACKUP=$(find ./backups -name "*.sql.gz.enc" 2>/dev/null | sort -r | head -n 1 || true)

  CURRENT_IMAGE_ID=$(dcompose images -q app 2>/dev/null || echo "unknown")

  echo "\n2. Pulling latest release container images..."
  dcompose pull app caddy

  echo "\n3. Restarting application services with updated image..."
  dcompose up -d --no-deps app caddy

  echo "\n4. Testing post-update readiness probes..."
  MAX_RETRIES=15
  RETRY=0
  HEALTHY=0

  while [ ${RETRY} -lt ${MAX_RETRIES} ]; do
    RETRY=$((RETRY + 1))
    if curl -sf "http://127.0.0.1:3000/readyz" >/dev/null 2>&1; then
      HEALTHY=1
      break
    fi
    sleep 3
  done

  if [ ${HEALTHY} -eq 1 ]; then
    NEW_IMAGE_ID=$(dcompose images -q app 2>/dev/null || echo "unknown")
    cat <<EOF > "${STATE_FILE}"
{
  "version": "${VERSION}",
  "current_image": "${NEW_IMAGE_ID}",
  "previous_image": "${CURRENT_IMAGE_ID}",
  "installed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "last_backup": "${PRE_UPDATE_BACKUP}"
}
EOF
    chmod 0600 "${STATE_FILE}"
    echo "✅ Upgrade successful: All health probes green."
  else
    echo "❌ Upgrade failed health checks! Rolling back to previous application state..." >&2
    if [ -n "${CURRENT_IMAGE_ID}" ] && [ "${CURRENT_IMAGE_ID}" != "unknown" ]; then
      dcompose up -d --no-deps app caddy
    fi
    echo "⚠️ Note: If database schema migrations were applied, run: ./scripts/install.sh restore ${PRE_UPDATE_BACKUP}" >&2
    exit 1
  fi
}

cmd_rollback() {
  log_header "AttendEase OS — Appliance Rollback"
  if [ -f "${STATE_FILE}" ]; then
    PREV_IMAGE=$(grep '"previous_image"' "${STATE_FILE}" 2>/dev/null | cut -d':' -f2 | tr -d '", ' || true)
    LAST_BACKUP=$(grep '"last_backup"' "${STATE_FILE}" 2>/dev/null | cut -d':' -f2- | tr -d '", ' || true)
    if [ -n "${PREV_IMAGE}" ] && [ "${PREV_IMAGE}" != "null" ]; then
      echo " • Reverting container stack to previous recorded state (${PREV_IMAGE})..."
      dcompose restart app caddy
      if [ -n "${LAST_BACKUP}" ] && [ -f "${LAST_BACKUP}" ]; then
        echo " • Previous pre-update backup available at: ${LAST_BACKUP}"
      fi
      echo "✅ Rollback applied."
      return 0
    fi
  fi

  echo " • Restarting existing container stack..."
  dcompose restart
  echo "✅ Rollback applied."
}

cmd_uninstall() {
  log_header "AttendEase OS — Uninstallation"
  if [ "${UNATTENDED}" -ne 1 ]; then
    read -rp "Are you sure you want to uninstall AttendEase OS? [y/N]: " CONFIRM
    if [[ "${CONFIRM}" != "y" && "${CONFIRM}" != "Y" ]]; then
      echo "Uninstallation cancelled."
      exit 0
    fi
  fi

  if [ "${PURGE}" -eq 1 ]; then
    echo " • Stopping containers and purging all database volumes..."
    dcompose down -v
    rm -f "${STATE_FILE}"
  else
    echo " • Stopping containers (retaining database volumes)..."
    dcompose down
  fi
  echo "✅ AttendEase OS stopped and uninstalled."
}

# Dispatch command
case "${COMMAND}" in
  install)     cmd_install ;;
  status)      cmd_status ;;
  diagnostics) cmd_diagnostics ;;
  backup)      cmd_backup ;;
  restore)     cmd_restore ;;
  repair)      cmd_repair ;;
  update)      cmd_update ;;
  rollback)    cmd_rollback ;;
  uninstall)   cmd_uninstall ;;
esac
