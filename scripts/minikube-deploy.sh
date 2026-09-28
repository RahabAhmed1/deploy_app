#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Local minikube deploy script for PharmaFlow Pro
# Usage: bash scripts/minikube-deploy.sh <your-dockerhub-username>
# ─────────────────────────────────────────────────────────────

set -e

DOCKERHUB_USERNAME=${1:-"your-dockerhub-username"}
TAG="local"

echo "==> Using Docker Hub username: $DOCKERHUB_USERNAME"

# ── 1. Point Docker CLI at minikube's Docker daemon ──────────
echo "==> Switching to minikube Docker environment..."
eval $(minikube docker-env)

# ── 2. Build images inside minikube (no push needed locally) ──
echo "==> Building backend image..."
docker build -t "$DOCKERHUB_USERNAME/pharmaflow-backend:$TAG" ./backend

echo "==> Building frontend image..."
docker build -t "$DOCKERHUB_USERNAME/pharmaflow-frontend:$TAG" ./frontend

# ── 3. Patch manifests with username & tag ───────────────────
echo "==> Patching k8s manifests..."
sed "s|DOCKERHUB_USERNAME|$DOCKERHUB_USERNAME|g; s|:latest|:$TAG|g" k8s/backend.yaml  > /tmp/backend-patched.yaml
sed "s|DOCKERHUB_USERNAME|$DOCKERHUB_USERNAME|g; s|:latest|:$TAG|g" k8s/frontend.yaml > /tmp/frontend-patched.yaml

# Use imagePullPolicy: Never so minikube uses local images
sed -i "s|imagePullPolicy: Always|imagePullPolicy: Never|g" /tmp/backend-patched.yaml /tmp/frontend-patched.yaml

# ── 4. Apply everything ───────────────────────────────────────
echo "==> Applying Kubernetes manifests..."
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/uploads-pvc.yaml
kubectl apply -f k8s/mongodb.yaml
kubectl apply -f /tmp/backend-patched.yaml
kubectl apply -f /tmp/frontend-patched.yaml

# ── 5. Wait for pods ──────────────────────────────────────────
echo "==> Waiting for deployments to be ready..."
kubectl rollout status deployment/mongodb  -n pharmaflow --timeout=120s
kubectl rollout status deployment/backend  -n pharmaflow --timeout=120s
kubectl rollout status deployment/frontend -n pharmaflow --timeout=120s

# ── 6. Print access URL ───────────────────────────────────────
echo ""
echo "==> All pods running:"
kubectl get pods -n pharmaflow

echo ""
echo "==> Open the app:"
minikube service frontend-service -n pharmaflow --url
