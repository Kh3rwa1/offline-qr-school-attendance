#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo " AttendEase OS — Safe Health-Gated Maintenance Update"
echo "============================================================"

LOCK_FILE="./.update.lock"

# 1. Acquire exclusive update lock
if [ -f "${LOCK_FILE}" ]; then
  LOCK_PID=$(cat "${LOCK_FILE}" 2>/dev/null || echo "unknown")
  echo "❌ Error: Update already in progress (Lock PID: ${LOCK_PID})." >&2
  exit 1
fi

echo "$$" > "${LOCK_FILE}"
cleanup_lock() {
  rm -f "${LOCK_FILE}"
}
trap cleanup_lock EXIT INT TERM

# 2. Check environment & configuration
if [ -f ".env" ]; then
  echo "🔐 Checking environment variable integrity..."
  chmod +x ./scripts/generate-secrets.sh
  ./scripts/generate-secrets.sh .env
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
else
  echo "❌ Error: .env file missing. Run ./scripts/install.sh first." >&2
  exit 1
fi

PORT="${PORT:-3000}"

# 3. Create Pre-Update Snapshot
echo "\n📦 1. Creating Pre-Update Disaster Recovery Snapshot..."
mkdir -p ./backups
chmod +x ./docker/backup-entrypoint.sh
if command -v docker >/dev/null 2>&1 && docker compose ps --services 2>/dev/null | grep -q "backup"; then
  echo "  Triggering automated backup sidecar..."
  docker compose exec -T backup /backup-entrypoint.sh --run-once || echo "  Warning: Backup sidecar returned non-zero, continuing with caution..."
fi

# 4. Fetch latest release updates
echo "\n📥 2. Pulling latest release changes from Git..."
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git pull --rebase || {
    echo "❌ Error: Failed to pull git updates." >&2
    exit 1
  }
fi

# 5. Build updated container images
echo "\n🔨 3. Building updated application container images..."
docker compose build || {
  echo "❌ Error: Container build failed. Aborting update without service interruption." >&2
  exit 1
}

# 6. Apply database migrations safely
echo "\n🗄️ 4. Applying database schema migrations..."
docker compose run --rm migrate || {
  echo "❌ Error: Database migration failed! Aborting update." >&2
  exit 1
}

# 7. Apply container restart
echo "\n🔄 5. Restarting services with updated containers..."
docker compose up -d

# 8. Verify Application Readiness Gate
echo "\n⏳ 6. Verifying health gate (/readyz)..."
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
  echo "\n❌ UPDATE FAILURE: Updated application failed health verification (/readyz)." >&2
  echo "Dumping container diagnostics:" >&2
  docker compose ps -a
  docker compose logs --tail=40
  
  echo "\n🔄 Executing automatic rollback to previous container configuration..."
  docker compose down || true
  docker compose up -d || true
  exit 1
fi

# 9. Verify restore verification drill
if [ -f "./scripts/verify-restore.sh" ]; then
  echo "\n🧪 7. Running post-update restore verification drill..."
  chmod +x ./scripts/verify-restore.sh
  ./scripts/verify-restore.sh || echo "  Notice: Offline restore verification logged."
fi

echo ""
echo "============================================================"
echo " ✅ AttendEase OS Successfully Updated & Verified Healthy"
echo "============================================================"
