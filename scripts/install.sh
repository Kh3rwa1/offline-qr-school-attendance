#!/usr/bin/env bash
# ==============================================================================
# AttendEase OS — Production QR Appliance Management & Installer
# Supported Platforms: Ubuntu 22.04/24.04 LTS (x86_64 & ARM64), Debian 12, macOS
# ==============================================================================
set -euo pipefail

umask 077

VERSION="1.3.0"
CONFIG_FILE=".env"
STATE_FILE=".attendease_state.json"
COMMAND="install"
UNATTENDED=0
DRY_RUN=0
PURGE=0
RESTORE_TARGET=""
VERIFY_ONLY=0
TARGET_IMAGE="${ATTENDEASE_IMAGE:-ghcr.io/kh3rwa1/offline-qr-school-attendance:latest}"

# Monitoring runs by default. An appliance nobody is watching fails silently.
MONITORING_OVERRIDE=""
MONITORING_ACTIVE=0
COMPOSE_PROFILE_FLAGS=()

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
    --image=*)
      TARGET_IMAGE="${1#*=}"
      shift
      ;;
    --image)
      TARGET_IMAGE="$2"
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
    --no-monitoring)
      MONITORING_OVERRIDE="false"
      shift
      ;;
    --monitoring)
      MONITORING_OVERRIDE="true"
      shift
      ;;
    --verify-only)
      VERIFY_ONLY=1
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
      echo "  backup       Execute immediate local authenticated encrypted backup"
      echo "  restore      Restore database from an encrypted signed backup archive"
      echo "  repair       Self-healing: restart services and verify health"
      echo "  update       Safe upgrade with automatic rollback on health failure"
      echo "  rollback     Revert to previous recorded container image version"
      echo "  uninstall    Stop and remove AttendEase OS appliance stack"
      echo ""
      echo "Options:"
      echo "  --config=<path>  Path to configuration env file (default: .env)"
      echo "  --image=<ref>    Target container image reference for update/install"
      echo "  --unattended, -y Non-interactive execution"
      echo "  --dry-run        Validate pre-flight requirements without starting containers"
      echo "  --purge          Purge all database volumes on uninstall"
      echo "  --no-monitoring  Do not start Prometheus and Alertmanager"
      echo "  --monitoring     Start monitoring even if disabled in the config file"
      echo "  --verify-only    Verify backup signature and checksum without restoring"
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

die() {
  echo "❌ Error: $*" >&2
  exit 1
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

# Reads a single KEY=value pair from the config file. Always exits 0 so that
# a missing key never aborts the script under 'set -e'.
read_config_value() {
  local key="$1"
  local file="${2:-${CONFIG_FILE}}"
  if [ ! -f "${file}" ]; then
    return 0
  fi
  grep "^${key}=" "${file}" 2>/dev/null | tail -n 1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true
}

# Decides whether the monitoring compose profile is active for this invocation.
# Explicit CLI flags win over the config file; the default is enabled.
resolve_compose_profiles() {
  COMPOSE_PROFILE_FLAGS=()
  local enabled="${MONITORING_OVERRIDE}"
  if [ -z "${enabled}" ]; then
    enabled="$(read_config_value ENABLE_MONITORING)"
  fi
  if [ -z "${enabled}" ]; then
    enabled="true"
  fi

  case "${enabled}" in
    true|TRUE|True|1|yes|YES|on|ON)
      MONITORING_ACTIVE=1
      COMPOSE_PROFILE_FLAGS=(--profile monitoring)
      ;;
    *)
      MONITORING_ACTIVE=0
      ;;
  esac
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

  # 7. Clock synchronization check (NTP).
  # RFID timestamp replay protection and backup timestamping require a
  # synchronized clock. Warn if drift exceeds ±60 s; continue regardless
  # because the chrony/systemd-timesyncd daemon may not be queryable in CI.
  if command -v timedatectl >/dev/null 2>&1; then
    NTP_SYNC=$(timedatectl show --property=NTPSynchronized --value 2>/dev/null || echo "")
    if [ "${NTP_SYNC}" = "yes" ]; then
      echo " • NTP Sync:         ✅ Clock is synchronized"
    else
      echo " • NTP Sync:         ⚠️ Clock synchronization status unknown or not synced"
      echo "                     Install chrony: sudo apt-get install -y chrony && sudo systemctl enable --now chrony"
    fi
  fi
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
  # Bash 3.2 (shipped with macOS) treats "${arr[@]}" on an empty array as an
  # unbound variable under 'set -u', so expand through the +alternate form.
  docker compose --env-file "${CONFIG_FILE}" ${COMPOSE_PROFILE_FLAGS[@]+"${COMPOSE_PROFILE_FLAGS[@]}"} "$@"
}

# Prints the off-site replication state recorded by the backup container.
report_offsite_state() {
  local status_file="./backups/OFFSITE_STATUS"
  local state=""
  if [ -f "${status_file}" ]; then
    state=$(awk 'NR==1{print $1}' "${status_file}" 2>/dev/null || true)
  fi

  case "${state}" in
    SUCCESS)
      echo " • Off-site Copy:       🟢 Replicated to remote storage"
      ;;
    FAILED)
      echo " • Off-site Copy:       🔴 LAST UPLOAD FAILED — backups exist only on this machine"
      echo "                        Details: docker compose exec backup cat /backups/OFFSITE_STATUS"
      ;;
    *)
      echo " • Off-site Copy:       ⚪ Not configured — disk failure or theft would lose all data"
      ;;
  esac
}

# ==============================================================================
# Subcommand Handlers
# ==============================================================================

cmd_install() {
  log_header "AttendEase OS — QR Pilot Production Installer"
  check_preflight
  ensure_secrets
  provision_backup_keys >/dev/null || true
  resolve_compose_profiles

  if [ "${MONITORING_ACTIVE}" -eq 1 ] && [ "${TOTAL_RAM_MB:-0}" -gt 0 ] && [ "${TOTAL_RAM_MB}" -lt 2048 ]; then
    echo "⚠️ Notice: Monitoring adds roughly 180 MB of RAM on a ${TOTAL_RAM_MB} MB machine."
    echo "           Disable it with ENABLE_MONITORING=\"false\" or the --no-monitoring flag."
  fi

  echo "\n⚙️ Validating Compose Configuration (QR-only scope)..."
  dcompose config --quiet

  if [ "${DRY_RUN}" -eq 1 ]; then
    echo "\n✅ Pre-flight dry-run diagnostic complete. All system prerequisites and security validations passed."
    exit 0
  fi

  echo "\n🚀 Building Production Container Images..."
  dcompose build

  if [ "${MONITORING_ACTIVE}" -eq 1 ]; then
    echo "\n🚀 Launching Production Container Services (with monitoring)..."
  else
    echo "\n🚀 Launching Production Container Services..."
  fi
  dcompose up -d

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
    dcompose ps -a >&2
    dcompose logs --tail=100 >&2
    exit 1
  fi

  # Record installed state
  INSTALLED_IMAGE="${TARGET_IMAGE:-ghcr.io/kh3rwa1/offline-qr-school-attendance:v1.3.0}"
  cat <<EOF > "${STATE_FILE}"
{
  "version": "${VERSION}",
  "current_image": "${INSTALLED_IMAGE}",
  "previous_image": null,
  "installed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
  chmod 0600 "${STATE_FILE}"

  SERVER_DOMAIN=$(grep '^SERVER_DOMAIN=' "${CONFIG_FILE}" 2>/dev/null | cut -d'=' -f2- | tr -d '"' || echo "")
  LAN_IP=$(get_lan_ip)

  # Composed with printf so that no stray characters can ever reach the banner.
  # This address is what a school types into a browser; it must be exact.
  ACCESS_URL="$(printf '%s://%s' 'http' "${LAN_IP}")"
  ACCESS_SCHEME="http"
  if [ -n "${SERVER_DOMAIN}" ] && [ "${SERVER_DOMAIN}" != "localhost" ] && [ "${SERVER_DOMAIN}" != "127.0.0.1" ]; then
    ACCESS_URL="$(printf '%s://%s' 'https' "${SERVER_DOMAIN}")"
    ACCESS_SCHEME="https"
  fi

  echo "\n============================================================"
  echo " ✅ AttendEase OS Successfully Installed & Healthy"
  echo "============================================================"
  echo " • Appliance URL:       ${ACCESS_URL}"
  echo " • First-Run Wizard:    ${ACCESS_URL}/setup"
  echo " • Local Port (Direct): http://127.0.0.1:3000"
  echo " • Encrypted Backups:   ./backups (age + Ed25519 signed)"
  echo " • Management CLI:      ./bin/attendease [status|backup|update]"
  if [ "${MONITORING_ACTIVE}" -eq 1 ]; then
    echo " • Monitoring:          http://127.0.0.1:9090 (Prometheus)"
    echo " • Alert Console:       http://127.0.0.1:9093 (Alertmanager)"
  fi
  if [ "${ACCESS_SCHEME}" = "http" ]; then
    echo " • Note: Automatic HTTPS is active for public DNS domain names."
    echo "         LAN IP access uses plaintext HTTP on port 80."
  fi
  echo "============================================================"

  if [ "${MONITORING_ACTIVE}" -eq 1 ]; then
    BANNER_ALERT_TO="$(read_config_value ALERT_EMAIL_TO)"
    BANNER_ALERT_HOOK="$(read_config_value ALERT_WEBHOOK_URL)"
    if [ -z "${BANNER_ALERT_TO}" ] && [ -z "${BANNER_ALERT_HOOK}" ]; then
      echo ""
      echo "⚠️ Problems are being detected but NOT delivered to anyone."
      echo "   Set ALERT_EMAIL_TO or ALERT_WEBHOOK_URL in ${CONFIG_FILE},"
      echo "   then run: ./bin/attendease repair"
    fi
  fi

  if [ -z "$(read_config_value R2_BUCKET)" ]; then
    echo ""
    echo "⚠️ Backups are stored only on this machine. A disk failure, theft or"
    echo "   fire would lose every attendance record. Configure off-site copies:"
    echo "   docs/OFFSITE_BACKUP_AND_ALERTS.md"
  fi
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

  LATEST_BACKUP=$(find ./backups \( -name "*.dump.age" -o -name "*.sql.gz.enc" \) 2>/dev/null | sort -r | head -n 1 || true)
  if [ -n "${LATEST_BACKUP}" ]; then
    echo " • Latest Local Backup: 🟢 $(basename "${LATEST_BACKUP}")"
  else
    echo " • Latest Local Backup: 🟡 No backups created yet"
  fi

  report_offsite_state

  if [ "${MONITORING_ACTIVE}" -eq 1 ]; then
    if curl -sf "http://127.0.0.1:9090/-/healthy" >/dev/null 2>&1; then
      echo " • Monitoring:          🟢 Prometheus is watching this appliance"
    else
      echo " • Monitoring:          🔴 Prometheus is not responding"
    fi

    if curl -sf "http://127.0.0.1:9093/-/healthy" >/dev/null 2>&1; then
      echo " • Alert Delivery:      🟢 Alertmanager is ready"
    else
      echo " • Alert Delivery:      🔴 Alertmanager is not responding"
    fi

    STATUS_ALERT_TO="$(read_config_value ALERT_EMAIL_TO)"
    STATUS_ALERT_HOOK="$(read_config_value ALERT_WEBHOOK_URL)"
    if [ -z "${STATUS_ALERT_TO}" ] && [ -z "${STATUS_ALERT_HOOK}" ]; then
      echo " • Alert Destination:   🟡 Nobody is notified — set ALERT_EMAIL_TO or ALERT_WEBHOOK_URL"
    else
      echo " • Alert Destination:   🟢 Configured"
    fi
  else
    echo " • Monitoring:          ⚪ Disabled — nothing is watching this appliance"
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
  echo "--- Durability ---"
  report_offsite_state
  echo ""
  echo "--- Recent Container Logs ---"
  dcompose logs --tail=30
}

provision_backup_keys() {
  local dir="${BACKUP_KEYS_DIR:-/etc/attendease/backup-keys}"
  if ! mkdir -p "$dir" 2>/dev/null; then
    dir="./backups/keys"
    mkdir -p "$dir"
  fi
  chmod 700 "$dir" 2>/dev/null || true

  if ! command -v age >/dev/null 2>&1 || ! command -v age-keygen >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
      if command -v sudo >/dev/null 2>&1; then
        sudo apt-get update -qq && sudo apt-get install -y age jq >/dev/null 2>&1 || true
      else
        apt-get update -qq && apt-get install -y age jq >/dev/null 2>&1 || true
      fi
    fi
  fi

  if [ ! -f "$dir/backup-signing.ed25519" ]; then
    ssh-keygen -t ed25519 -N "" -C "attendease-backup@$(hostname)" -f "$dir/backup-signing.ed25519" >/dev/null 2>&1
    chmod 600 "$dir/backup-signing.ed25519" 2>/dev/null || true
    chmod 644 "$dir/backup-signing.ed25519.pub" 2>/dev/null || true
  fi
  # Encrypt to the school's provisioned public key (stored off-appliance),
  # or generate a local age keypair for single-box setups
  if [ ! -f "$dir/backup.agekey" ]; then
    age-keygen -o "$dir/backup.agekey" >/dev/null 2>&1
    chmod 600 "$dir/backup.agekey" 2>/dev/null || true
    age-keygen -y "$dir/backup.agekey" > "$dir/backup.agekey.pub" 2>/dev/null
  fi
  # Authorized signers file for restore verification
  echo "attendease-backup@$(hostname) $(cat "$dir/backup-signing.ed25519.pub")" \
    > "$dir/allowed_signers"
  chmod 644 "$dir/allowed_signers" 2>/dev/null || true
  echo "$dir"
}

cmd_backup() {
  log_header "AttendEase OS — Creating Encrypted Signed Backup Snapshot"
  mkdir -p ./backups
  chmod 0700 ./backups

  local keys_dir
  keys_dir=$(provision_backup_keys)
  local ts
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  local outdir="${BACKUP_DIR:-./backups}"
  mkdir -p "$outdir"
  local base="$outdir/backup-$ts"
  local recipient
  recipient=$(cat "$keys_dir/backup.agekey.pub")
  local signing_key="$keys_dir/backup-signing.ed25519"
  local manifest="$base.manifest.json"

  # 1. Dump plain sql into a pipe, compress, encrypt with authenticated cipher
  # Manifest written alongside, signed separately
  dcompose exec -T db pg_dump -U attendance_migration -d school_attendance \
    --format=custom --compress=9 \
    | age -r "$recipient" -o "$base.dump.age"

  # 2. Checksums and metadata
  local size
  size=$(stat -c%s "$base.dump.age" 2>/dev/null || stat -f%z "$base.dump.age")
  local sha
  sha=$(sha256sum "$base.dump.age" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "$base.dump.age" | cut -d' ' -f1)
  local app_ver="${ATTENDEASE_VERSION:-$VERSION}"

  cat > "$manifest" <<EOF
{
  "formatVersion": 2,
  "timestamp": "$ts",
  "hostname": "$(hostname)",
  "appVersion": "$app_ver",
  "cipher": "age-x25519-chacha20poly1305",
  "sha256": "$sha",
  "bytes": $size
}
EOF

  # 3. Sign the manifest with Ed25519
  ssh-keygen -Y sign -f "$signing_key" -n "attendease-backup" "$manifest"
  # Produces $manifest.sig
  echo "✅ Backup complete: $base.dump.age"
  echo " • Manifest:  $manifest"
  echo " • Signature: $manifest.sig"
  echo " • SHA-256:   $sha"
}

cmd_restore() {
  log_header "AttendEase OS — Database Recovery from Backup"
  local file="${RESTORE_TARGET:-${1:-}}"
  if [ -z "${file}" ]; then
    die "Specify backup file path. Example: ./scripts/install.sh restore ./backups/backup-20261005T120000Z.dump.age"
  fi

  if [ ! -f "${file}" ]; then
    die "Backup file '${file}' not found."
  fi

  # Support legacy AES-256-CBC .sql.gz.enc backups
  if [[ "${file}" == *.sql.gz.enc ]]; then
    echo "⚠️ Warning: Restoring legacy unauthenticated AES-CBC backup."
    BACKUP_KEY=$(grep '^BACKUP_ENCRYPTION_KEY=' "${CONFIG_FILE}" 2>/dev/null | cut -d'=' -f2- | tr -d '"' || true)
    if [ -z "${BACKUP_KEY}" ]; then
      die "Missing mandatory BACKUP_ENCRYPTION_KEY in ${CONFIG_FILE}."
    fi
    if [ "${VERIFY_ONLY}" -eq 1 ]; then
      echo "✅ Legacy file verified present."
      return 0
    fi
    echo "⚠️ Restoring database will overwrite current state."
    if [ "${UNATTENDED:-0}" -ne 1 ]; then
      read -rp "Are you sure you want to proceed? [y/N]: " CONFIRM
      if [[ "${CONFIRM}" != "y" && "${CONFIRM}" != "Y" ]]; then
        echo "Restore aborted."
        exit 0
      fi
    fi
    echo " • Decrypting legacy backup..."
    PASSPHRASE_FILE=$(mktemp)
    chmod 0600 "${PASSPHRASE_FILE}"
    printf '%s' "${BACKUP_KEY}" > "${PASSPHRASE_FILE}"
    openssl enc -d -aes-256-cbc -pbkdf2 -pass file:"${PASSPHRASE_FILE}" -in "${file}" | \
      gunzip -c | \
      dcompose exec -T db psql -U attendance_migration -d school_attendance
    rm -f "${PASSPHRASE_FILE}"
    echo "✅ Legacy database restore successfully completed."
    return 0
  fi

  local manifest="${file%.dump.age}.manifest.json"
  local sig="$manifest.sig"
  local keys_dir="${BACKUP_KEYS_DIR:-/etc/attendease/backup-keys}"
  if [ ! -d "$keys_dir" ] && [ -d "./backups/keys" ]; then
    keys_dir="./backups/keys"
  fi
  local signers="$keys_dir/allowed_signers"
  local key="$keys_dir/backup.agekey"

  [[ -f "$file" && -f "$manifest" && -f "$sig" ]] || die "Incomplete backup set"

  # 1. Verify signature on manifest FIRST
  local hostname_signer
  hostname_signer=$(jq -r '.hostname // empty' "$manifest" 2>/dev/null || hostname)
  if ! ssh-keygen -Y verify -f "$signers" -I "attendease-backup@$hostname_signer" \
    -n "attendease-backup" -s "$sig" < "$manifest" 2>/dev/null; then
    if ! ssh-keygen -Y verify -f "$signers" -I "attendease-backup@$(hostname)" \
      -n "attendease-backup" -s "$sig" < "$manifest" 2>/dev/null; then
      die "BACKUP SIGNATURE VERIFICATION FAILED — possible tampering"
    fi
  fi
  echo " • Signature verification passed (Ed25519)"

  # 2. Check hash matches manifest
  local actual_sha
  actual_sha=$(sha256sum "$file" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "$file" | cut -d' ' -f1)
  local expected_sha
  expected_sha=$(jq -r .sha256 "$manifest")
  [[ "$actual_sha" == "$expected_sha" ]] \
    || die "BACKUP CHECKSUM MISMATCH: manifest claims $expected_sha, got $actual_sha"
  echo " • Checksum verification passed (${actual_sha:0:16}...)"

  if [ "${VERIFY_ONLY}" -eq 1 ]; then
    echo "✅ Backup verification passed successfully: signature and checksum valid."
    return 0
  fi

  echo "⚠️ Restoring database will overwrite current state."
  if [ "${UNATTENDED:-0}" -ne 1 ]; then
    read -rp "Are you sure you want to proceed? [y/N]: " CONFIRM
    if [[ "${CONFIRM}" != "y" && "${CONFIRM}" != "Y" ]]; then
      echo "Restore aborted."
      exit 0
    fi
  fi

  # 3. Decrypt and restore in a single transaction
  echo " • Decrypting with age and restoring in a single transaction..."
  age -d -i "$key" "$file" \
    | dcompose exec -T db pg_restore -U attendance_migration -d school_attendance \
        --clean --if-exists --single-transaction \
    || die "Restore failed"

  echo "Restore completed successfully from $file"
}

cmd_repair() {
  log_header "AttendEase OS — Self-Healing Repair Routine"
  echo " • Starting and reconciling container stack..."
  dcompose up -d
  sleep 5
  cmd_status
}

cmd_update() {
  log_header "AttendEase OS — Safe Application Upgrade"
  
  echo "1. Creating pre-update snapshot backup..."
  cmd_backup
  PRE_UPDATE_BACKUP=$(find ./backups \( -name "*.dump.age" -o -name "*.sql.gz.enc" \) 2>/dev/null | sort -r | head -n 1 || true)

  CURRENT_IMAGE_REF="ghcr.io/kh3rwa1/offline-qr-school-attendance:v1.3.0"
  if [ -f "${STATE_FILE}" ]; then
    CURRENT_IMAGE_REF=$(grep '"current_image"' "${STATE_FILE}" 2>/dev/null | cut -d':' -f2- | tr -d '", ' || echo "ghcr.io/kh3rwa1/offline-qr-school-attendance:v1.3.0")
  fi

  echo "\n2. Pulling target release container image (${TARGET_IMAGE})..."
  ATTENDEASE_IMAGE="${TARGET_IMAGE}" dcompose pull app || docker pull "${TARGET_IMAGE}" || true

  echo "\n3. Recreating application services with updated image..."
  ATTENDEASE_IMAGE="${TARGET_IMAGE}" dcompose up -d --no-deps --force-recreate app caddy

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
    cat <<EOF > "${STATE_FILE}"
{
  "version": "${VERSION}",
  "current_image": "${TARGET_IMAGE}",
  "previous_image": "${CURRENT_IMAGE_REF}",
  "installed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "last_backup": "${PRE_UPDATE_BACKUP}"
}
EOF
    chmod 0600 "${STATE_FILE}"
    echo "✅ Upgrade successful: All health probes green."
  else
    echo "❌ Upgrade failed health checks! Recreating container stack with previous image (${CURRENT_IMAGE_REF})..." >&2
    ATTENDEASE_IMAGE="${CURRENT_IMAGE_REF}" dcompose up -d --no-deps --force-recreate app caddy
    echo "⚠️ Note: If database schema migrations were applied, run: ./scripts/install.sh restore ${PRE_UPDATE_BACKUP}" >&2
    exit 1
  fi
}

cmd_rollback() {
  log_header "AttendEase OS — Appliance Rollback"
  if [ -f "${STATE_FILE}" ]; then
    PREV_IMAGE=$(grep '"previous_image"' "${STATE_FILE}" 2>/dev/null | cut -d':' -f2- | tr -d '", ' || true)
    LAST_BACKUP=$(grep '"last_backup"' "${STATE_FILE}" 2>/dev/null | cut -d':' -f2- | tr -d '", ' || true)
    if [ -n "${PREV_IMAGE}" ] && [ "${PREV_IMAGE}" != "null" ]; then
      echo " • Recreating application containers using recorded previous image (${PREV_IMAGE})..."
      ATTENDEASE_IMAGE="${PREV_IMAGE}" dcompose up -d --no-deps --force-recreate app caddy
      if [ -n "${LAST_BACKUP}" ] && [ -f "${LAST_BACKUP}" ]; then
        echo " • Previous pre-update backup available at: ${LAST_BACKUP}"
      fi
      echo " • Testing readiness probes after rollback..."
      sleep 3
      if curl -sf "http://127.0.0.1:3000/readyz" >/dev/null 2>&1; then
        echo "✅ Rollback applied successfully. Application is healthy."
      else
        echo "⚠️ Warning: Rollback completed, but /readyz probe has not yet passed."
      fi
      return 0
    fi
  fi

  echo " • Restarting existing container stack..."
  dcompose restart
  echo "✅ Restart applied."
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

# Resolve which compose profiles apply before dispatching any subcommand.
# cmd_install re-resolves after ensure_secrets, once the config file exists.
resolve_compose_profiles

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
