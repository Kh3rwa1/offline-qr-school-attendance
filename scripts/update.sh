#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo " AttendEase OS — Zero-Downtime Safe Rolling Update"
echo "============================================================"

# 1. Fetch latest changes
echo "📥 Pulling latest release from Git..."
git pull --rebase

# 2. Check for any newly introduced configuration variables
if [ -f ".env" ]; then
  echo "🔐 Checking environment variable integrity..."
  chmod +x ./scripts/generate-secrets.sh
  ./scripts/generate-secrets.sh .env
fi

# Load environment
set -a
# shellcheck disable=SC1091
source .env
set +a

PORT="${PORT:-3000}"

# 3. Build updated images
echo "🔨 Building updated application container images..."
docker compose build

# 4. Run database migrations safely
echo "🗄️ Executing database migrations..."
docker compose run --rm migrate

# 5. Perform rolling restart
echo "🔄 Applying zero-data-loss container restart..."
docker compose up -d

# 6. Wait for Readiness
echo "⏳ Waiting for updated application to report healthy (/readyz)..."
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
  echo "❌ Error: Updated containers failed to become healthy." >&2
  docker compose logs --tail=30
  exit 1
fi

echo "============================================================"
echo " ✅ AttendEase OS Successfully Updated & Verified Healthy"
echo "============================================================"
