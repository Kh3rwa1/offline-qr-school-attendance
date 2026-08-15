#!/usr/bin/env bash
set -euo pipefail

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if command -v docker >/dev/null 2>&1 && docker compose ps --services 2>/dev/null | grep -q "app"; then
  docker compose exec app npx tsx scripts/bootstrap-admin.ts "$@"
else
  npx tsx scripts/bootstrap-admin.ts "$@"
fi
