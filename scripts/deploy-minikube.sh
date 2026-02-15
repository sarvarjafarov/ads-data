#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# deploy-minikube.sh — Deploy Dashly to Minikube
#
# Prerequisites:
#   - minikube installed and running: minikube start
#   - kubectl configured for minikube context
#
# Usage:
#   ./scripts/deploy-minikube.sh          # Full deploy
#   ./scripts/deploy-minikube.sh build    # Build images only
#   ./scripts/deploy-minikube.sh apply    # Apply manifests only
#   ./scripts/deploy-minikube.sh status   # Show status
#   ./scripts/deploy-minikube.sh teardown # Delete everything
# ──────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Dashly Minikube Deployment ==="
echo "Project: $PROJECT_DIR"

# ── Functions ─────────────────────────────────────────────

build_images() {
  echo ""
  echo "--- Building Docker images inside Minikube ---"

  # Point Docker to Minikube's Docker daemon
  eval $(minikube docker-env)

  echo "[1/2] Building dashly-api..."
  docker build -t dashly-api:latest -f "$PROJECT_DIR/Dockerfile" "$PROJECT_DIR"

  echo "[2/2] Building dashly-genai-gateway..."
  docker build -t dashly-genai-gateway:latest -f "$PROJECT_DIR/services/genai-gateway/Dockerfile" "$PROJECT_DIR/services/genai-gateway"

  echo ""
  echo "Images built successfully:"
  docker images | grep dashly
}

apply_manifests() {
  echo ""
  echo "--- Applying Kubernetes manifests ---"

  kubectl apply -f "$PROJECT_DIR/k8s/namespace.yaml"
  kubectl apply -f "$PROJECT_DIR/k8s/configmap.yaml"
  kubectl apply -f "$PROJECT_DIR/k8s/secrets.yaml"
  kubectl apply -f "$PROJECT_DIR/k8s/postgres-deployment.yaml"
  kubectl apply -f "$PROJECT_DIR/k8s/redis-deployment.yaml"

  echo "Waiting for PostgreSQL to be ready..."
  kubectl wait --for=condition=ready pod -l app=postgres -n dashly --timeout=60s

  echo "Waiting for Redis to be ready..."
  kubectl wait --for=condition=ready pod -l app=redis -n dashly --timeout=60s

  kubectl apply -f "$PROJECT_DIR/k8s/genai-gateway-deployment.yaml"

  echo "Waiting for GenAI Gateway to be ready..."
  kubectl wait --for=condition=ready pod -l app=genai-gateway -n dashly --timeout=90s

  kubectl apply -f "$PROJECT_DIR/k8s/api-deployment.yaml"

  echo "Waiting for API to be ready..."
  kubectl wait --for=condition=ready pod -l app=api -n dashly --timeout=120s

  echo ""
  echo "--- Running database migrations ---"
  API_POD=$(kubectl get pod -n dashly -l app=api -o jsonpath='{.items[0].metadata.name}')
  kubectl exec -n dashly "$API_POD" -- node src/database/migrate.js || echo "Migration may have already run."
}

show_status() {
  echo ""
  echo "--- Cluster Status ---"
  echo ""
  echo "Pods:"
  kubectl get pods -n dashly -o wide
  echo ""
  echo "Services:"
  kubectl get svc -n dashly
  echo ""
  echo "Deployments:"
  kubectl get deployments -n dashly
  echo ""

  # Get the API URL
  API_URL=$(minikube service api -n dashly --url 2>/dev/null || echo "")
  if [ -n "$API_URL" ]; then
    echo "API URL: $API_URL"
    echo "Health:  $API_URL/api/health"
  else
    echo "Run 'minikube service api -n dashly --url' to get the API URL."
  fi
}

teardown() {
  echo ""
  echo "--- Tearing down Dashly from Minikube ---"
  kubectl delete namespace dashly --ignore-not-found=true
  echo "Namespace 'dashly' deleted."
}

# ── Main ──────────────────────────────────────────────────

case "${1:-deploy}" in
  build)
    build_images
    ;;
  apply)
    apply_manifests
    show_status
    ;;
  status)
    show_status
    ;;
  teardown)
    teardown
    ;;
  deploy|*)
    build_images
    apply_manifests
    show_status
    echo ""
    echo "=== Deployment complete ==="
    ;;
esac
