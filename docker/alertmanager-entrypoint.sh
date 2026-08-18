#!/bin/sh
# ============================================================================
# AttendEase OS - Alertmanager Bootstrap
# ============================================================================
# Alertmanager refuses to start on an invalid config, and an email receiver with
# an empty recipient is invalid. A school that has not yet supplied SMTP details
# must still get a running stack rather than a crash loop, so the config is
# rendered here and receivers are included only when they are fully configured.
#
# Configure at least one of:
#   ALERT_EMAIL_TO + SMTP_HOST     -> email notifications
#   ALERT_WEBHOOK_URL              -> webhook (Slack-compatible endpoints, etc.)
#   WATCHDOG_WEBHOOK_URL           -> dead-man's switch heartbeat
# ============================================================================
set -eu

CONFIG_FILE="/tmp/alertmanager.yml"

ALERT_EMAIL_TO="${ALERT_EMAIL_TO:-}"
ALERT_EMAIL_FROM="${ALERT_EMAIL_FROM:-attendease@localhost}"
SMTP_HOST="${SMTP_HOST:-}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_USERNAME="${SMTP_USERNAME:-}"
SMTP_PASSWORD="${SMTP_PASSWORD:-}"
SMTP_REQUIRE_TLS="${SMTP_REQUIRE_TLS:-true}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
WATCHDOG_WEBHOOK_URL="${WATCHDOG_WEBHOOK_URL:-}"
REPEAT_INTERVAL="${ALERT_REPEAT_INTERVAL:-6h}"
CRITICAL_REPEAT_INTERVAL="${ALERT_CRITICAL_REPEAT_INTERVAL:-1h}"

EMAIL_ENABLED=0
if [ -n "${ALERT_EMAIL_TO}" ] && [ -n "${SMTP_HOST}" ]; then
  EMAIL_ENABLED=1
fi

WEBHOOK_ENABLED=0
if [ -n "${ALERT_WEBHOOK_URL}" ]; then
  WEBHOOK_ENABLED=1
fi

# ---------------------------------------------------------------------------
# global
# ---------------------------------------------------------------------------
{
  echo "# Generated at container start by docker/alertmanager-entrypoint.sh - do not edit."
  echo "global:"
  echo "  resolve_timeout: 5m"
} > "${CONFIG_FILE}"

if [ "${EMAIL_ENABLED}" -eq 1 ]; then
  {
    echo "  smtp_smarthost: '${SMTP_HOST}:${SMTP_PORT}'"
    echo "  smtp_from: '${ALERT_EMAIL_FROM}'"
    echo "  smtp_require_tls: ${SMTP_REQUIRE_TLS}"
  } >> "${CONFIG_FILE}"
  if [ -n "${SMTP_USERNAME}" ]; then
    {
      echo "  smtp_auth_username: '${SMTP_USERNAME}'"
      echo "  smtp_auth_password: '${SMTP_PASSWORD}'"
    } >> "${CONFIG_FILE}"
  fi
fi

# ---------------------------------------------------------------------------
# route
# ---------------------------------------------------------------------------
cat >> "${CONFIG_FILE}" <<EOF

route:
  receiver: 'primary'
  group_by: ['alertname']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: ${REPEAT_INTERVAL}
  routes:
    - matchers:
        - alertname="AlertingPipelineWatchdog"
      receiver: 'watchdog'
      group_wait: 0s
      group_interval: 1m
      repeat_interval: 1m
    - matchers:
        - severity="critical"
      receiver: 'primary'
      repeat_interval: ${CRITICAL_REPEAT_INTERVAL}

receivers:
  - name: 'primary'
EOF

if [ "${EMAIL_ENABLED}" -eq 0 ] && [ "${WEBHOOK_ENABLED}" -eq 0 ]; then
  echo "[alertmanager] WARNING: no delivery channel configured." >&2
  echo "[alertmanager] Alerts will be visible in the Alertmanager UI on port 9093 but NOBODY WILL BE NOTIFIED." >&2
  echo "[alertmanager] Set ALERT_EMAIL_TO + SMTP_HOST, or ALERT_WEBHOOK_URL, in your .env file." >&2
fi

if [ "${EMAIL_ENABLED}" -eq 1 ]; then
  cat >> "${CONFIG_FILE}" <<EOF
    email_configs:
      - to: '${ALERT_EMAIL_TO}'
        send_resolved: true
        headers:
          Subject: '[AttendEase {{ .Status | toUpper }}] {{ .CommonLabels.alertname }}'
EOF
  echo "[alertmanager] email delivery enabled -> ${ALERT_EMAIL_TO} via ${SMTP_HOST}:${SMTP_PORT}"
fi

if [ "${WEBHOOK_ENABLED}" -eq 1 ]; then
  cat >> "${CONFIG_FILE}" <<EOF
    webhook_configs:
      - url: '${ALERT_WEBHOOK_URL}'
        send_resolved: true
EOF
  echo "[alertmanager] webhook delivery enabled"
fi

# ---------------------------------------------------------------------------
# watchdog receiver (dead-man's switch)
# ---------------------------------------------------------------------------
printf '  - name: %s\n' "'watchdog'" >> "${CONFIG_FILE}"

if [ -n "${WATCHDOG_WEBHOOK_URL}" ]; then
  cat >> "${CONFIG_FILE}" <<EOF
    webhook_configs:
      - url: '${WATCHDOG_WEBHOOK_URL}'
        send_resolved: false
EOF
  echo "[alertmanager] dead-man's switch heartbeat enabled"
else
  echo "[alertmanager] no WATCHDOG_WEBHOOK_URL set; heartbeat is discarded locally"
fi

echo "[alertmanager] starting"

exec /bin/alertmanager \
  --config.file="${CONFIG_FILE}" \
  --storage.path=/alertmanager \
  --cluster.listen-address=
