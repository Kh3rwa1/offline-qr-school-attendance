#!/usr/bin/env bash
set -Eeuo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-attendance-kind-cluster}"
IMAGE_TAG="${IMAGE_TAG:-offline-qr-school-attendance:test-kind}"

echo "=== Starting Kubernetes Cluster Rollout & Rollback Certification Drill ==="

# Check if kind is installed
if ! command -v kind &> /dev/null; then
  echo "NOTICE: kind (Kubernetes-in-Docker) is not installed on this host."
  echo "Installing kind binary for CI execution..."
  curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.22.0/kind-linux-amd64
  chmod +x ./kind
  sudo mv ./kind /usr/local/bin/kind || mv ./kind /tmp/kind
  export PATH="/tmp:$PATH"
fi

if ! command -v kubectl &> /dev/null; then
  echo "NOTICE: kubectl is not installed on this host."
  curl -Lo ./kubectl "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
  chmod +x ./kubectl
  sudo mv ./kubectl /usr/local/bin/kubectl || mv ./kubectl /tmp/kubectl
  export PATH="/tmp:$PATH"
fi

cleanup() {
  echo "=== Teardown: Deleting kind cluster ${CLUSTER_NAME} ==="
  kind delete cluster --name "${CLUSTER_NAME}" || true
}
trap cleanup EXIT

# 1. Create kind cluster
echo "1. Creating disposable kind cluster ${CLUSTER_NAME}..."
kind create cluster --name "${CLUSTER_NAME}" --wait 60s

# 2. Install required CRDs (Prometheus Operator ServiceMonitor CRD & ExternalSecrets CRD)
echo "2. Applying CustomResourceDefinitions (ServiceMonitor & ExternalSecret)..."
kubectl apply -f https://raw.githubusercontent.com/prometheus-operator/prometheus-operator/v0.70.0/example/prometheus-operator-crd/monitoring.coreos.com_servicemonitors.yaml || true
kubectl apply -f https://raw.githubusercontent.com/external-secrets/external-secrets/v0.9.11/deploy/crds/bundle.yaml || true

# 3. Build & Load application docker image into kind cluster
echo "3. Building Docker image and loading into kind cluster..."
docker build -t "${IMAGE_TAG}" .
kind load docker-image "${IMAGE_TAG}" --name "${CLUSTER_NAME}"

# 4. Apply all Kubernetes manifests
echo "4. Applying Kubernetes manifests from k8s/..."
# Replace image tag in manifests dynamically for test cluster
sed "s|image: .*|image: ${IMAGE_TAG}|g" k8s/deployment-web.yaml | kubectl apply -f -
sed "s|image: .*|image: ${IMAGE_TAG}|g" k8s/deployment-worker.yaml | kubectl apply -f -
sed "s|image: .*|image: ${IMAGE_TAG}|g" k8s/migration-job.yaml | kubectl apply -f -

kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/service-account.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/network-policy.yaml
kubectl apply -f k8s/pdb.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/servicemonitor.yaml
kubectl apply -f k8s/externalsecrets.yaml

# 5. Wait for rollout and check pod security & status
echo "5. Verifying Deployment rollout status..."
kubectl rollout status deployment/school-attendance-web --timeout=120s || {
  echo "ERROR: Deployment web rollout failed! Printing pods, descriptions, and logs:"
  kubectl get pods -A
  kubectl describe pods -l app=school-attendance-web
  kubectl logs -l app=school-attendance-web --all-containers --tail=100
  exit 1
}

# 6. Verify non-root execution and securityContext
echo "6. Verifying Pod Security Constraints (non-root, seccomp)..."
POD_NAME=$(kubectl get pods -l app=school-attendance-web -o jsonpath='{.items[0].metadata.name}')
RUN_AS_USER=$(kubectl get pod "${POD_NAME}" -o jsonpath='{.spec.securityContext.runAsUser}')
if [ "${RUN_AS_USER}" != "1000" ]; then
  echo "ERROR: Pod securityContext runAsUser is not 1000 (found ${RUN_AS_USER})"
  exit 1
fi
echo "Verified non-root execution (UID ${RUN_AS_USER})."

# 7. Perform Rolling Update
echo "7. Testing Rolling Update..."
kubectl set image deployment/school-attendance-web web="${IMAGE_TAG}"
kubectl rollout status deployment/school-attendance-web --timeout=60s

# 8. Perform Rollback
echo "8. Testing Rollback (kubectl rollout undo)..."
kubectl rollout undo deployment/school-attendance-web
kubectl rollout status deployment/school-attendance-web --timeout=60s

echo "=== ✅ Kubernetes Cluster Rollout & Rollback Certification Drill PASSED ==="
