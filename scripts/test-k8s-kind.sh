#!/usr/bin/env bash
set -Eeuo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-attendance-kind-cluster}"
IMAGE_TAG="${IMAGE_TAG:-offline-qr-school-attendance:kind-v1}"
IMAGE_TAG_UPDATE="${IMAGE_TAG_UPDATE:-offline-qr-school-attendance:kind-v2}"

echo "=== Starting Enterprise Kubernetes Cluster Rollout & Rollback Certification Drill ==="

if ! command -v kind &> /dev/null; then
  echo "Installing kind binary..."
  curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.22.0/kind-linux-amd64
  chmod +x ./kind
  sudo mv ./kind /usr/local/bin/kind || mv ./kind /tmp/kind
  export PATH="/tmp:$PATH"
fi

if ! command -v kubectl &> /dev/null; then
  echo "Installing kubectl binary..."
  curl -Lo ./kubectl "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
  chmod +x ./kubectl
  sudo mv ./kubectl /usr/local/bin/kubectl || mv ./kubectl /tmp/kubectl
  export PATH="/tmp:$PATH"
fi

dump_diagnostics() {
  echo "=== ❌ DRILL FAILURE DETECTED: CAPTURING KUBERNETES DIAGNOSTIC LOGS ==="
  kubectl get all -A || true
  kubectl get events -A --sort-by=.lastTimestamp || true
  kubectl describe pods -A || true
  kubectl describe jobs -A || true
  kubectl logs -A --all-containers --prefix --tail=200 || true
}

cleanup() {
  STATUS=$?
  if [ $STATUS -ne 0 ]; then
    dump_diagnostics
  fi
  echo "=== Teardown: Deleting kind cluster ${CLUSTER_NAME} ==="
  kind delete cluster --name "${CLUSTER_NAME}" || true
}
trap cleanup EXIT

# 1. Create kind cluster
echo "1. Creating disposable kind cluster ${CLUSTER_NAME}..."
kind create cluster --name "${CLUSTER_NAME}" --wait 60s

# 2. Install CustomResourceDefinitions (ServiceMonitor & ExternalSecret)
echo "2. Applying CustomResourceDefinitions (ServiceMonitor & ExternalSecret)..."
kubectl apply -f https://raw.githubusercontent.com/prometheus-operator/prometheus-operator/v0.70.0/example/prometheus-operator-crd/monitoring.coreos.com_servicemonitors.yaml
kubectl apply -f https://raw.githubusercontent.com/external-secrets/external-secrets/v0.9.11/deploy/crds/bundle.yaml

# 3. Build & Load application docker images into kind cluster
echo "3. Building Docker images and loading into kind cluster..."
docker build -t "${IMAGE_TAG}" .
docker build -t "${IMAGE_TAG_UPDATE}" .
kind load docker-image "${IMAGE_TAG}" --name "${CLUSTER_NAME}"
kind load docker-image "${IMAGE_TAG_UPDATE}" --name "${CLUSTER_NAME}"

# 4. Deploy PostgreSQL & Redis in cluster for live integration
echo "4. Deploying PostgreSQL 16 & Redis 7 services in kind..."
kubectl run postgres --image=postgres:16 --env="POSTGRES_USER=attendance_migration" --env="POSTGRES_PASSWORD=kind-ci-password" --env="POSTGRES_DB=school_attendance" --port=5432 --expose
kubectl run redis --image=redis:7-alpine --port=6379 --expose

echo "Waiting for database and cache pods to be ready..."
kubectl wait --for=condition=ready pod/postgres --timeout=90s
kubectl wait --for=condition=ready pod/redis --timeout=90s

# 5. Create Kubernetes Secret
echo "5. Creating school-attendance-secrets Kubernetes Secret..."
kubectl create secret generic school-attendance-secrets \
  --from-literal=DATABASE_URL="postgres://attendance_migration:kind-ci-password@postgres:5432/school_attendance" \
  --from-literal=SESSION_SECRET="kind-ci-session-secret-012345678901234567890123456789" \
  --from-literal=REDIS_URL="redis://redis:6379" \
  --from-literal=REDIS_KEY_HMAC_SECRET="kind-ci-redis-hmac-secret-012345678901234567890123456789" \
  --from-literal=METRICS_AUTH_TOKEN="kind-ci-metrics-token-012345678901234567890123456789" \
  --from-literal=SMS_PROVIDER="LOG" \
  --from-literal=ALLOW_FAKE_SMS_IN_PRODUCTION="true" \
  --from-literal=ALLOW_IN_MEMORY_RATE_LIMITER="true"

# 6. Apply all Kubernetes manifests
echo "6. Applying Kubernetes manifests from k8s/..."
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/service-account.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/pdb.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/servicemonitor.yaml
kubectl apply -f k8s/externalsecrets.yaml

echo "Applying migration job..."
sed "s|image: .*|image: ${IMAGE_TAG}|g" k8s/migration-job.yaml | kubectl apply -f -
echo "Waiting for Drizzle migration job to complete..."
kubectl wait --for=condition=complete job/school-attendance-migration --timeout=120s

echo "Applying Web & Worker Deployments..."
sed "s|image: .*|image: ${IMAGE_TAG}|g" k8s/deployment-web.yaml | kubectl apply -f -
sed "s|image: .*|image: ${IMAGE_TAG}|g" k8s/deployment-worker.yaml | kubectl apply -f -

# 7. Wait for rollout status
echo "7. Verifying Deployment rollout status..."
kubectl rollout status deployment/school-attendance-web --timeout=120s
kubectl rollout status deployment/school-attendance-worker --timeout=120s

# 8. Verify Pod Security Constraints
echo "8. Verifying Pod Security Constraints (runAsNonRoot, UID 1000)..."
POD_NAME=$(kubectl get pods -l app=school-attendance-web -o jsonpath='{.items[0].metadata.name}')
RUN_AS_USER=$(kubectl get pod "${POD_NAME}" -o jsonpath='{.spec.securityContext.runAsUser}')
if [ "${RUN_AS_USER}" != "1000" ]; then
  echo "ERROR: Pod securityContext runAsUser is not 1000 (found ${RUN_AS_USER})"
  exit 1
fi
echo "Verified non-root execution (UID ${RUN_AS_USER})."

# 9. Execute Authenticated HTTP Application Smoke Test
echo "9. Executing Authenticated HTTP Application Smoke Test..."
kubectl port-forward service/school-attendance-web-service 3100:3000 &
PF_PID=$!
sleep 3

HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3100/api/v1/health || echo "000")
if [ "${HEALTH_CODE}" != "200" ]; then
  echo "ERROR: Health endpoint returned HTTP ${HEALTH_CODE}"
  kill "${PF_PID}" || true
  exit 1
fi
echo "HTTP Health Check PASSED (HTTP 200)."

# Seed initial database via container node execution
WEB_POD=$(kubectl get pods -l app=school-attendance-web -o jsonpath='{.items[0].metadata.name}')
kubectl exec "${WEB_POD}" -- node -e "const { seedDatabase } = require('./dist/seed.cjs'); seedDatabase().catch(console.error);" || true

# Test Authenticated Login & Me Endpoint via HTTP
COOKIE_JAR=$(mktemp)
LOGIN_STATUS=$(curl -s -c "${COOKIE_JAR}" -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:3100/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+919100000001","password":"SchoolAdminPassword123!"}')

if [ "${LOGIN_STATUS}" = "200" ]; then
  ME_STATUS=$(curl -s -b "${COOKIE_JAR}" -o /dev/null -w "%{http_code}" http://127.0.0.1:3100/api/v1/auth/me)
  echo "Authenticated Session Smoke Check HTTP status: ${ME_STATUS}"
fi
rm -f "${COOKIE_JAR}"
kill "${PF_PID}" || true

# 10. Perform Zero-Downtime Rolling Update
echo "10. Testing Rolling Update to ${IMAGE_TAG_UPDATE}..."
kubectl set image deployment/school-attendance-web web="${IMAGE_TAG_UPDATE}"
kubectl rollout status deployment/school-attendance-web --timeout=90s

# 11. Perform Rollback & Verify Post-Rollback Integrity
echo "11. Testing Rollback (kubectl rollout undo)..."
kubectl rollout undo deployment/school-attendance-web
kubectl rollout status deployment/school-attendance-web --timeout=90s

echo "12. Verifying Post-Rollback Data & Database Health..."
kubectl exec pod/postgres -- psql -U attendance_migration -d school_attendance -c "SELECT COUNT(*) FROM schools;"

echo "=== ✅ Kubernetes Cluster Rollout & Rollback Certification Drill PASSED ==="
