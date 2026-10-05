#!/usr/bin/env bash
# ==============================================================================
# AttendEase OS — Backup Tamper Proof Verification Test (Step 1.5)
# Asserts that corrupted or tampered backups abort BEFORE any decryption occurs.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DIR="$(mktemp -d -t attendease-backup-tamper-XXXXXX)"

cleanup() {
  rm -rf "${TEST_DIR}"
}
trap cleanup EXIT

echo "==> Setting up test backup keys and environment..."
export BACKUP_KEYS_DIR="${TEST_DIR}/keys"
mkdir -p "${BACKUP_KEYS_DIR}" "${TEST_DIR}/backups"
chmod 700 "${BACKUP_KEYS_DIR}" "${TEST_DIR}/backups"

# Provision test Ed25519 and age keys
ssh-keygen -t ed25519 -N "" -C "attendease-backup@$(hostname)" -f "${BACKUP_KEYS_DIR}/backup-signing.ed25519" >/dev/null 2>&1
chmod 600 "${BACKUP_KEYS_DIR}/backup-signing.ed25519"
chmod 644 "${BACKUP_KEYS_DIR}/backup-signing.ed25519.pub"

age-keygen -o "${BACKUP_KEYS_DIR}/backup.agekey" >/dev/null 2>&1
chmod 600 "${BACKUP_KEYS_DIR}/backup.agekey"
age-keygen -y "${BACKUP_KEYS_DIR}/backup.agekey" > "${BACKUP_KEYS_DIR}/backup.agekey.pub"

echo "attendease-backup@$(hostname) $(cat "${BACKUP_KEYS_DIR}/backup-signing.ed25519.pub")" \
  > "${BACKUP_KEYS_DIR}/allowed_signers"
chmod 644 "${BACKUP_KEYS_DIR}/allowed_signers"

RECIPIENT=$(cat "${BACKUP_KEYS_DIR}/backup.agekey.pub")
SIGNING_KEY="${BACKUP_KEYS_DIR}/backup-signing.ed25519"

# 1. Create a valid mock backup archive
BASE="${TEST_DIR}/backups/backup-20261005T120000Z"
DUMP_FILE="${BASE}.dump.age"
MANIFEST_FILE="${BASE}.manifest.json"
SIG_FILE="${MANIFEST_FILE}.sig"

echo "MOCK POSTGRESQL DATABASE BACKUP DUMP FOR AUTHENTICATED RESTORE TEST" | age -r "${RECIPIENT}" -o "${DUMP_FILE}"

SIZE=$(stat -c%s "${DUMP_FILE}" 2>/dev/null || stat -f%z "${DUMP_FILE}")
SHA=$(sha256sum "${DUMP_FILE}" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "${DUMP_FILE}" | cut -d' ' -f1)

cat > "${MANIFEST_FILE}" <<EOF
{
  "formatVersion": 2,
  "timestamp": "20261005T120000Z",
  "hostname": "$(hostname)",
  "appVersion": "1.3.0",
  "cipher": "age-x25519-chacha20poly1305",
  "sha256": "${SHA}",
  "bytes": ${SIZE}
}
EOF

ssh-keygen -Y sign -f "${SIGNING_KEY}" -n "attendease-backup" "${MANIFEST_FILE}" >/dev/null 2>&1

echo "==> 1. Verifying valid untampered backup set passes verification..."
"${SCRIPT_DIR}/scripts/install.sh" restore "${DUMP_FILE}" --verify-only
echo "✅ Valid backup successfully verified."

echo "==> 2. Tampering 1 bit in ciphertext (.dump.age)..."
TAMPERED_DUMP="${TEST_DIR}/backups/backup-tampered-cipher"
cp "${DUMP_FILE}" "${TAMPERED_DUMP}.dump.age"
cp "${MANIFEST_FILE}" "${TAMPERED_DUMP}.manifest.json"
cp "${SIG_FILE}" "${TAMPERED_DUMP}.manifest.json.sig"

# Flip 1 byte in the ciphertext
python3 -c "
with open('${TAMPERED_DUMP}.dump.age', 'r+b') as f:
    f.seek(50)
    b = f.read(1)
    f.seek(50)
    f.write(bytes([b[0] ^ 0x01]))
"

set +e
OUTPUT=$("${SCRIPT_DIR}/scripts/install.sh" restore "${TAMPERED_DUMP}.dump.age" --verify-only 2>&1)
EXIT_CODE=$?
set -e

if [ ${EXIT_CODE} -eq 0 ]; then
  echo "❌ FAIL: Restore succeeded on tampered ciphertext!" >&2
  exit 1
fi

if ! echo "${OUTPUT}" | grep -q "BACKUP CHECKSUM MISMATCH"; then
  echo "❌ FAIL: Expected BACKUP CHECKSUM MISMATCH, got: ${OUTPUT}" >&2
  exit 1
fi
echo "✅ Tampered ciphertext aborted BEFORE decryption: BACKUP CHECKSUM MISMATCH detected."

echo "==> 3. Tampering manifest to match tampered ciphertext..."
NEW_SHA=$(sha256sum "${TAMPERED_DUMP}.dump.age" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "${TAMPERED_DUMP}.dump.age" | cut -d' ' -f1)
sed -i.bak "s/${SHA}/${NEW_SHA}/" "${TAMPERED_DUMP}.manifest.json"

set +e
OUTPUT=$("${SCRIPT_DIR}/scripts/install.sh" restore "${TAMPERED_DUMP}.dump.age" --verify-only 2>&1)
EXIT_CODE=$?
set -e

if [ ${EXIT_CODE} -eq 0 ]; then
  echo "❌ FAIL: Restore succeeded on forged manifest!" >&2
  exit 1
fi

if ! echo "${OUTPUT}" | grep -q "BACKUP SIGNATURE VERIFICATION FAILED"; then
  echo "❌ FAIL: Expected BACKUP SIGNATURE VERIFICATION FAILED, got: ${OUTPUT}" >&2
  exit 1
fi
echo "✅ Forged manifest aborted BEFORE decryption: BACKUP SIGNATURE VERIFICATION FAILED."

echo "==> 4. Incomplete backup set (missing signature)..."
rm -f "${TAMPERED_DUMP}.manifest.json.sig"
set +e
OUTPUT=$("${SCRIPT_DIR}/scripts/install.sh" restore "${TAMPERED_DUMP}.dump.age" --verify-only 2>&1)
EXIT_CODE=$?
set -e

if [ ${EXIT_CODE} -eq 0 ]; then
  echo "❌ FAIL: Restore succeeded on incomplete backup set!" >&2
  exit 1
fi

if ! echo "${OUTPUT}" | grep -q "Incomplete backup set"; then
  echo "❌ FAIL: Expected Incomplete backup set, got: ${OUTPUT}" >&2
  exit 1
fi
echo "✅ Missing signature aborted: Incomplete backup set detected."

echo "==> ALL TAMPER PROOF TESTS PASSED! 🛡️"
