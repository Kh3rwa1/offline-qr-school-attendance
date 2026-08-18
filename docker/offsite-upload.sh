#!/bin/sh
# ============================================================================
# AttendEase OS - Off-site Encrypted Backup Replication (S3-compatible)
# ============================================================================
# Replicates an already AES-256-encrypted backup archive to an off-site object
# store, so a stolen, flooded, burnt or failed appliance disk never means the
# school loses its attendance records.
#
# Compatible with Cloudflare R2, Amazon S3, Backblaze B2, Wasabi and MinIO via
# AWS Signature Version 4 with path-style addressing. Deliberately depends on
# nothing but curl + openssl so the postgres:16-alpine backup container stays
# small and works over slow rural links (no 100MB aws-cli download per restart).
#
# Invoked automatically by docker/backup-entrypoint.sh (Step 9) through the
# existing OFFSITE_BACKUP_CMD hook. Can also be run by hand:
#   sh docker/offsite-upload.sh ./backups/attendease-20260818-183000.sql.gz.enc
#
# Exit codes:
#   0  uploaded and verified, OR off-site replication is not configured
#   1  configured, but the upload could not be completed and verified
# ============================================================================
set -eu
umask 077

LOCAL_FILE="${1:-}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
STATUS_FILE="${BACKUP_DIR}/OFFSITE_STATUS"
NOW_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
NOW_EPOCH="$(date -u +%s)"
EMPTY_SHA256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

log() { echo "[offsite] $*"; }

write_status() {
  _state="$1"
  shift
  printf '%s %s %s\n' "${_state}" "${NOW_ISO}" "$*" > "${STATUS_FILE}" 2>/dev/null || true
}

fail() {
  log "FAILED: $*"
  write_status "FAILED" "$*"
  exit 1
}

# ---------------------------------------------------------------------------
# Configuration resolution (R2_* names match .env.example; S3_* also accepted)
# ---------------------------------------------------------------------------
ACCESS_KEY="${R2_ACCESS_KEY_ID:-${S3_ACCESS_KEY_ID:-}}"
SECRET_KEY="${R2_SECRET_ACCESS_KEY:-${S3_SECRET_ACCESS_KEY:-}}"
BUCKET="${R2_BUCKET:-${S3_BUCKET:-}}"
ENDPOINT="${R2_ENDPOINT:-${S3_ENDPOINT:-}}"
REGION="${OFFSITE_BACKUP_REGION:-auto}"
PREFIX="${OFFSITE_BACKUP_PREFIX:-attendease}"
MAX_ATTEMPTS="${OFFSITE_BACKUP_MAX_ATTEMPTS:-3}"
SCHEME="${OFFSITE_BACKUP_SCHEME:-https}"
R2_HOST_SUFFIX="${R2_HOST_SUFFIX:-r2.cloudflarestorage.com}"

# Cloudflare R2 endpoints are derivable from the account id alone. Assembled from
# parts rather than written as one literal so the value cannot be mangled.
if [ -z "${ENDPOINT}" ] && [ -n "${R2_ACCOUNT_ID:-}" ]; then
  ENDPOINT="$(printf '%s://%s.%s' "${SCHEME}" "${R2_ACCOUNT_ID}" "${R2_HOST_SUFFIX}")"
fi

# Not configured is a supported, silent state: local backups still run. We
# return 0 so backup-entrypoint.sh does not log a misleading failure warning.
if [ -z "${ACCESS_KEY}" ] || [ -z "${SECRET_KEY}" ] || [ -z "${BUCKET}" ] || [ -z "${ENDPOINT}" ]; then
  write_status "DISABLED" "off-site replication not configured"
  exit 0
fi

if [ -z "${LOCAL_FILE}" ] || [ ! -f "${LOCAL_FILE}" ]; then
  fail "local archive not found: ${LOCAL_FILE:-<none>}"
fi

# curl is not guaranteed in the postgres alpine base image.
if ! command -v curl >/dev/null 2>&1; then
  log "installing curl..."
  apk add --no-cache curl >/dev/null 2>&1 || true
fi
command -v curl >/dev/null 2>&1 || fail "curl is unavailable and could not be installed"
command -v openssl >/dev/null 2>&1 || fail "openssl is unavailable"

HOST="$(printf '%s' "${ENDPOINT}" | sed -e 's#^[a-zA-Z][a-zA-Z0-9+.-]*://##' -e 's#/.*$##')"
[ -n "${HOST}" ] || fail "could not derive host from endpoint '${ENDPOINT}'"

sha256_file() { openssl dgst -sha256 "$1" | awk '{print $NF}'; }

# ---------------------------------------------------------------------------
# AWS Signature Version 4
# ---------------------------------------------------------------------------
sign_request() {
  # sign_request <METHOD> <CANONICAL_URI> <PAYLOAD_SHA256>
  _method="$1"
  _uri="$2"
  _phash="$3"

  _amzdate="$(date -u +%Y%m%dT%H%M%SZ)"
  _datestamp="$(printf '%s' "${_amzdate}" | cut -c1-8)"
  _scope="${_datestamp}/${REGION}/s3/aws4_request"

  _creq="$(printf '%s\n%s\n\nhost:%s\nx-amz-content-sha256:%s\nx-amz-date:%s\n\nhost;x-amz-content-sha256;x-amz-date\n%s' \
    "${_method}" "${_uri}" "${HOST}" "${_phash}" "${_amzdate}" "${_phash}")"
  _creq_hash="$(printf '%s' "${_creq}" | openssl dgst -sha256 | awk '{print $NF}')"

  _sts="$(printf 'AWS4-HMAC-SHA256\n%s\n%s\n%s' "${_amzdate}" "${_scope}" "${_creq_hash}")"

  # Derive the signing key. First round keys off a literal string, the rest
  # chain on binary output and therefore must use hexkey.
  _k="$(printf '%s' "${_datestamp}"    | openssl dgst -sha256 -mac HMAC -macopt "key:AWS4${SECRET_KEY}" | awk '{print $NF}')"
  _k="$(printf '%s' "${REGION}"        | openssl dgst -sha256 -mac HMAC -macopt "hexkey:${_k}" | awk '{print $NF}')"
  _k="$(printf '%s' 's3'               | openssl dgst -sha256 -mac HMAC -macopt "hexkey:${_k}" | awk '{print $NF}')"
  _k="$(printf '%s' 'aws4_request'     | openssl dgst -sha256 -mac HMAC -macopt "hexkey:${_k}" | awk '{print $NF}')"
  _sig="$(printf '%s' "${_sts}"        | openssl dgst -sha256 -mac HMAC -macopt "hexkey:${_k}" | awk '{print $NF}')"

  SIG_AMZDATE="${_amzdate}"
  SIG_PAYLOAD="${_phash}"
  SIG_AUTH="AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${_scope}, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=${_sig}"
}

put_object() {
  # put_object <LOCAL_PATH> <CANONICAL_URI>
  _path="$1"
  _uri="$2"
  _hash="$(sha256_file "${_path}")"
  sign_request 'PUT' "${_uri}" "${_hash}"

  curl -sS --show-error \
    --connect-timeout 20 \
    --max-time "${OFFSITE_BACKUP_TIMEOUT:-1800}" \
    --upload-file "${_path}" \
    -H "Expect:" \
    -H "x-amz-date: ${SIG_AMZDATE}" \
    -H "x-amz-content-sha256: ${SIG_PAYLOAD}" \
    -H "Authorization: ${SIG_AUTH}" \
    -o /tmp/offsite-put-body.txt \
    -w '%{http_code}' \
    "${ENDPOINT}${_uri}"
}

head_object_length() {
  # head_object_length <CANONICAL_URI> -> echoes remote Content-Length or empty
  _uri="$1"
  sign_request 'HEAD' "${_uri}" "${EMPTY_SHA256}"

  curl -sS --head \
    --connect-timeout 20 \
    --max-time 120 \
    -H "x-amz-date: ${SIG_AMZDATE}" \
    -H "x-amz-content-sha256: ${SIG_PAYLOAD}" \
    -H "Authorization: ${SIG_AUTH}" \
    "${ENDPOINT}${_uri}" 2>/dev/null \
    | tr -d '\r' \
    | awk 'tolower($1) == "content-length:" { print $2 }' \
    | tail -n 1
}

# ---------------------------------------------------------------------------
# Build the remote key: <prefix>/<YYYY>/<MM>/<filename>
# Date-partitioned so bucket lifecycle rules and manual audits stay simple.
# ---------------------------------------------------------------------------
BASENAME="$(basename "${LOCAL_FILE}")"

# Signature correctness depends on the URI needing no percent-encoding.
if ! printf '%s' "${BASENAME}" | grep -Eq '^[A-Za-z0-9._-]+$'; then
  fail "archive name '${BASENAME}' contains characters that require URI encoding"
fi
if ! printf '%s' "${PREFIX}" | grep -Eq '^[A-Za-z0-9._/-]*$'; then
  fail "OFFSITE_BACKUP_PREFIX '${PREFIX}' contains unsupported characters"
fi
if ! printf '%s' "${BUCKET}" | grep -Eq '^[A-Za-z0-9._-]+$'; then
  fail "bucket name '${BUCKET}' contains unsupported characters"
fi

YEAR="$(date -u +%Y)"
MONTH="$(date -u +%m)"
if [ -n "${PREFIX}" ]; then
  REMOTE_KEY="${PREFIX}/${YEAR}/${MONTH}/${BASENAME}"
else
  REMOTE_KEY="${YEAR}/${MONTH}/${BASENAME}"
fi
CANONICAL_URI="/${BUCKET}/${REMOTE_KEY}"

LOCAL_SIZE="$(wc -c < "${LOCAL_FILE}" | tr -d ' ')"
LOCAL_SHA="$(sha256_file "${LOCAL_FILE}")"

log "replicating ${BASENAME} (${LOCAL_SIZE} bytes) to ${HOST}/${BUCKET}/${REMOTE_KEY}"

# ---------------------------------------------------------------------------
# Upload with bounded retries, then verify the object really landed
# ---------------------------------------------------------------------------
ATTEMPT=0
UPLOADED=0
LAST_ERROR=""

while [ "${ATTEMPT}" -lt "${MAX_ATTEMPTS}" ]; do
  ATTEMPT=$((ATTEMPT + 1))

  set +e
  HTTP_CODE="$(put_object "${LOCAL_FILE}" "${CANONICAL_URI}")"
  CURL_RC=$?
  set -e

  if [ "${CURL_RC}" -eq 0 ] && [ "${HTTP_CODE}" = "200" ]; then
    UPLOADED=1
    break
  fi

  LAST_ERROR="attempt ${ATTEMPT}: curl_rc=${CURL_RC} http_status=${HTTP_CODE:-none}"
  log "${LAST_ERROR}"
  if [ -s /tmp/offsite-put-body.txt ]; then
    log "response: $(head -c 400 /tmp/offsite-put-body.txt | tr -d '\n')"
  fi

  if [ "${ATTEMPT}" -lt "${MAX_ATTEMPTS}" ]; then
    BACKOFF=$((ATTEMPT * 15))
    log "retrying in ${BACKOFF}s..."
    sleep "${BACKOFF}"
  fi
done

rm -f /tmp/offsite-put-body.txt

[ "${UPLOADED}" -eq 1 ] || fail "upload did not succeed after ${MAX_ATTEMPTS} attempts (${LAST_ERROR})"

REMOTE_SIZE="$(head_object_length "${CANONICAL_URI}" || true)"
if [ -z "${REMOTE_SIZE}" ]; then
  fail "remote verification failed: object not found after upload"
fi
if [ "${REMOTE_SIZE}" != "${LOCAL_SIZE}" ]; then
  fail "remote size mismatch: expected ${LOCAL_SIZE} bytes, found ${REMOTE_SIZE}"
fi

log "verified ${REMOTE_SIZE} bytes off-site (sha256:$(printf '%s' "${LOCAL_SHA}" | cut -c1-12)...)"

# ---------------------------------------------------------------------------
# Replicate the sibling manifest too (best effort, never fatal)
# ---------------------------------------------------------------------------
MANIFEST_LOCAL="$(printf '%s' "${LOCAL_FILE}" | sed 's/\.sql\.gz\.enc$/.manifest.json/')"
if [ "${MANIFEST_LOCAL}" != "${LOCAL_FILE}" ] && [ -f "${MANIFEST_LOCAL}" ]; then
  MANIFEST_BASENAME="$(basename "${MANIFEST_LOCAL}")"
  if printf '%s' "${MANIFEST_BASENAME}" | grep -Eq '^[A-Za-z0-9._-]+$'; then
    MANIFEST_URI="$(printf '%s' "${CANONICAL_URI}" | sed "s|/${BASENAME}$|/${MANIFEST_BASENAME}|")"
    set +e
    MANIFEST_CODE="$(put_object "${MANIFEST_LOCAL}" "${MANIFEST_URI}")"
    MANIFEST_RC=$?
    set -e
    rm -f /tmp/offsite-put-body.txt
    if [ "${MANIFEST_RC}" -eq 0 ] && [ "${MANIFEST_CODE}" = "200" ]; then
      log "manifest replicated: ${MANIFEST_BASENAME}"
    else
      log "warning: manifest replication failed (archive itself is safely off-site)"
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Publish success markers consumed by docker/backup-healthcheck.sh
#
# Field 1 is human-readable, field 2 is epoch seconds. BusyBox date cannot parse
# ISO-8601 strings with 'T'/'Z', so the healthcheck must never have to.
# ---------------------------------------------------------------------------
printf '%s %s\n' "${NOW_ISO}" "${NOW_EPOCH}" > "${BACKUP_DIR}/LATEST_OFFSITE" 2>/dev/null || true
write_status "SUCCESS" "${BUCKET}/${REMOTE_KEY} ${REMOTE_SIZE}bytes sha256:${LOCAL_SHA}"

log "off-site replication complete"
exit 0
