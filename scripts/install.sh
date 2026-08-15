#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo " AttendEase OS — Automated Appliance Setup & Verification"
echo "============================================================"

# 1. Verify Prerequisites
if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Error: Docker is not installed. Please install Docker before running installer." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "❌ Error: Docker Compose v2 ('docker compose') is required." >&2
  exit 1
fi

# 2. Environment & Secrets Provisioning
if [ ! -f ".env" ]; then
  echo "📄 No .env found. Initializing from .env.example..."
  cp .env.example .env
fi

echo "🔐 Checking & generating cryptographically secure secrets..."
chmod +x ./scripts/generate-secrets.sh
./scripts/generate-secrets.sh .env

# Load environment for port detection
set -a
# shellcheck disable=SC1091
source .env
set +a

PORT="${PORT:-3000}"
APP_URL="${APP_URL:-http://localhost:${PORT}}"

# 3. Build & Launch Compose Stack
echo "🚀 Building and starting AttendEase OS container appliances..."
docker compose up -d --build

# 4. Wait for Health and Readiness
echo "⏳ Waiting for AttendEase OS web server and database to report ready..."
MAX_ATTEMPTS=45
ATTEMPT=0
HEALTHY=0

while [ ${ATTEMPT} -lt ${MAX_ATTEMPTS} ]; do
  ATTEMPT=$((ATTEMPT + 1))
  
  # Check /readyz
  if curl -sf "http://127.0.0.1:${PORT}/readyz" >/dev/null 2>&1; then
    HEALTHY=1
    break
  fi
  sleep 2
done

if [ ${HEALTHY} -ne 1 ]; then
  echo "❌ Error: AttendEase OS failed to report ready within 90 seconds." >&2
  echo "Inspecting container logs:" >&2
  docker compose logs --tail=30
  exit 1
fi

echo ""
echo "============================================================"
echo " ✅ AttendEase OS Appliance Ready for 90-Day Unattended Operation"
echo "============================================================"
echo " • Platform URL:        ${APP_URL}"
echo " • Nightly Backups:     ./backups (Encrypted AES-256 PBKDF2)"
echo " • SMS Queue Worker:    Autonomous daemon running (continuous drain)"
echo " • Outbox Sync:         Auto-syncs offline rolls on reconnect"
echo ""
echo " ⚠️  IMPORTANT FIRST-BOOT SECURITY NOTICE:"
echo " 1. Navigate to ${APP_URL}/login and sign in."
echo " 2. If using default administrative credentials, update your password immediately."
echo " 3. Back up your BACKUP_ENCRYPTION_KEY stored in .env to a secure offline vault."
echo "============================================================"
