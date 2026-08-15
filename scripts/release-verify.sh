#!/usr/bin/env bash
set -euo pipefail

echo "============================================================"
echo " AttendEase OS — Release Verification & Checksum Engine"
echo "============================================================"

OUTPUT_DIR="output"
mkdir -p "${OUTPUT_DIR}"

GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "final-sha")
echo " • Git Commit SHA: ${GIT_COMMIT}"

echo " • 1. Generating CycloneDX 1.4 SBOM..."
npx tsx scripts/generate-sbom.ts

echo " • 2. Computing SHA-256 Checksums for Release Artifacts..."
compute_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    openssl dgst -sha256 "$1" | awk '{print $NF}'
  fi
}

CHECKSUMS_FILE="${OUTPUT_DIR}/checksums.txt"
rm -f "${CHECKSUMS_FILE}"

# Include core release files
FILES_TO_CHECKSUM=(
  "package.json"
  "package-lock.json"
  "docker-compose.yml"
  "docker/app.Dockerfile"
  "docker/backup-entrypoint.sh"
  "scripts/install.sh"
  "scripts/update.sh"
  "scripts/restore.sh"
  "scripts/verify-restore.sh"
  "sbom.json"
)

for file in "${FILES_TO_CHECKSUM[@]}"; do
  if [ -f "${file}" ]; then
    CS=$(compute_sha256 "${file}")
    echo "${CS}  ${file}" >> "${CHECKSUMS_FILE}"
    echo "   - ${file}: ${CS:0:16}..."
  fi
done

echo "============================================================"
echo " ✅ Release verification artifacts compiled to ${OUTPUT_DIR}"
echo "============================================================"
