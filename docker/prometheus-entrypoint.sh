#!/bin/sh
# ============================================================================
# AttendEase OS - Prometheus Bootstrap
# ============================================================================
# Prometheus does not expand environment variables inside its config file, and
# /metrics on this appliance requires a bearer token. So we render the config at
# container start, injecting METRICS_AUTH_TOKEN and including only the scrape
# jobs and rule files that are actually relevant to this deployment.
#
# Skipping the RFID job when FEATURE_RFID is not enabled matters: a permanently
# down scrape target would keep ApplianceRfidGatewayDown firing forever, and
# alerts that always fire are alerts everybody learns to ignore.
# ============================================================================
set -eu

CONFIG_FILE="/tmp/prometheus.yml"
RULES_DIR="${RULES_DIR:-/etc/prometheus/rules}"
TOKEN="${METRICS_AUTH_TOKEN:-}"
RETENTION="${PROMETHEUS_RETENTION:-15d}"
DEPLOYMENT_ID="${DEPLOYMENT_ID:-attendease-appliance}"
SCRAPE_INTERVAL="${PROMETHEUS_SCRAPE_INTERVAL:-30s}"

if [ -z "${TOKEN}" ]; then
  echo "[prometheus] WARNING: METRICS_AUTH_TOKEN is empty; /metrics scrapes will be rejected by the app." >&2
fi

cat > "${CONFIG_FILE}" <<EOF
# Generated at container start by docker/prometheus-entrypoint.sh - do not edit.
global:
  scrape_interval: ${SCRAPE_INTERVAL}
  evaluation_interval: ${SCRAPE_INTERVAL}
  external_labels:
    deployment: '${DEPLOYMENT_ID}'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
EOF

for RULE_FILE in alerts.yaml appliance-alerts.yml; do
  if [ -f "${RULES_DIR}/${RULE_FILE}" ]; then
    echo "  - ${RULES_DIR}/${RULE_FILE}" >> "${CONFIG_FILE}"
    echo "[prometheus] loaded rules: ${RULE_FILE}"
  fi
done

if [ "${FEATURE_RFID:-false}" = "true" ] && [ -f "${RULES_DIR}/rfid-alerts.yml" ]; then
  echo "  - ${RULES_DIR}/rfid-alerts.yml" >> "${CONFIG_FILE}"
  echo "[prometheus] loaded rules: rfid-alerts.yml"
fi

cat >> "${CONFIG_FILE}" <<EOF

scrape_configs:
  - job_name: 'attendease-app'
    metrics_path: /metrics
    scheme: http
    authorization:
      type: Bearer
      credentials: '${TOKEN}'
    static_configs:
      - targets: ['app:3000']

  - job_name: 'prometheus'
    static_configs:
      - targets: ['127.0.0.1:9090']
EOF

if [ "${FEATURE_RFID:-false}" = "true" ]; then
  cat >> "${CONFIG_FILE}" <<EOF

  - job_name: 'attendease-rfid-gateway'
    metrics_path: /metrics
    scheme: http
    authorization:
      type: Bearer
      credentials: '${TOKEN}'
    static_configs:
      - targets: ['rfid-gateway:3001']
EOF
  echo "[prometheus] RFID gateway scrape job enabled"
else
  echo "[prometheus] RFID disabled; skipping gateway scrape job to avoid false alarms"
fi

echo "[prometheus] starting with ${RETENTION} retention"

exec /bin/prometheus \
  --config.file="${CONFIG_FILE}" \
  --storage.tsdb.path=/prometheus \
  --storage.tsdb.retention.time="${RETENTION}" \
  --web.console.libraries=/usr/share/prometheus/console_libraries \
  --web.console.templates=/usr/share/prometheus/consoles \
  --web.enable-lifecycle
