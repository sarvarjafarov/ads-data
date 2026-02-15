#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# deploy-canary.sh — Canary release workflow for Dashly
#
# Usage:
#   ./scripts/deploy-canary.sh deploy    # Build canary images and deploy
#   ./scripts/deploy-canary.sh status    # Show canary vs stable pods
#   ./scripts/deploy-canary.sh promote   # Promote canary to stable
#   ./scripts/deploy-canary.sh rollback  # Remove canary pods
# ──────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Dashly Canary Release ==="

deploy_canary() {
  echo ""
  echo "--- Building canary images ---"

  eval $(minikube docker-env)

  echo "[1/2] Building dashly-api:canary..."
  docker build -t dashly-api:canary -f "$PROJECT_DIR/Dockerfile" "$PROJECT_DIR"

  echo "[2/2] Building dashly-genai-gateway:canary..."
  docker build -t dashly-genai-gateway:canary -f "$PROJECT_DIR/services/genai-gateway/Dockerfile" "$PROJECT_DIR/services/genai-gateway"

  echo ""
  echo "--- Deploying canary pods ---"
  kubectl apply -f "$PROJECT_DIR/k8s/api-canary-deployment.yaml"
  kubectl apply -f "$PROJECT_DIR/k8s/genai-gateway-canary-deployment.yaml"

  echo "Waiting for canary pods..."
  kubectl wait --for=condition=ready pod -l version=canary,app=api -n dashly --timeout=120s
  kubectl wait --for=condition=ready pod -l version=canary,app=genai-gateway -n dashly --timeout=90s

  show_status
  echo ""
  echo "Canary deployed! Traffic is now split between stable and canary."
  echo "  API:     3 stable + 1 canary = ~25% canary traffic"
  echo "  Gateway: 2 stable + 1 canary = ~33% canary traffic"
  echo ""
  echo "Monitor with: ./scripts/deploy-canary.sh status"
  echo "Promote with: ./scripts/deploy-canary.sh promote"
  echo "Rollback with: ./scripts/deploy-canary.sh rollback"
}

show_status() {
  echo ""
  echo "--- Canary vs Stable Pods ---"
  echo ""
  echo "API pods:"
  kubectl get pods -n dashly -l app=api -L version --no-headers 2>/dev/null | \
    awk '{printf "  %-40s %-10s %-10s\n", $1, $3, $6}'
  echo ""
  echo "GenAI Gateway pods:"
  kubectl get pods -n dashly -l app=genai-gateway -L version --no-headers 2>/dev/null | \
    awk '{printf "  %-40s %-10s %-10s\n", $1, $3, $6}'
  echo ""

  # Count pods
  STABLE_API=$(kubectl get pods -n dashly -l app=api,version=stable --no-headers 2>/dev/null | wc -l | tr -d ' ')
  CANARY_API=$(kubectl get pods -n dashly -l app=api,version=canary --no-headers 2>/dev/null | wc -l | tr -d ' ')
  STABLE_GW=$(kubectl get pods -n dashly -l app=genai-gateway,version=stable --no-headers 2>/dev/null | wc -l | tr -d ' ')
  CANARY_GW=$(kubectl get pods -n dashly -l app=genai-gateway,version=canary --no-headers 2>/dev/null | wc -l | tr -d ' ')

  echo "Traffic split:"
  TOTAL_API=$((STABLE_API + CANARY_API))
  TOTAL_GW=$((STABLE_GW + CANARY_GW))
  if [ "$TOTAL_API" -gt 0 ]; then
    echo "  API:     ${STABLE_API} stable / ${CANARY_API} canary (canary gets ~$((CANARY_API * 100 / TOTAL_API))% of traffic)"
  fi
  if [ "$TOTAL_GW" -gt 0 ]; then
    echo "  Gateway: ${STABLE_GW} stable / ${CANARY_GW} canary (canary gets ~$((CANARY_GW * 100 / TOTAL_GW))% of traffic)"
  fi
}

promote_canary() {
  echo ""
  echo "--- Promoting canary to stable ---"

  eval $(minikube docker-env)

  # Re-tag canary images as latest (stable)
  docker tag dashly-api:canary dashly-api:latest
  docker tag dashly-genai-gateway:canary dashly-genai-gateway:latest

  # Restart stable deployments to pick up the new image
  kubectl rollout restart deployment/api -n dashly
  kubectl rollout restart deployment/genai-gateway -n dashly

  # Wait for rollout
  kubectl rollout status deployment/api -n dashly --timeout=120s
  kubectl rollout status deployment/genai-gateway -n dashly --timeout=90s

  # Remove canary deployments
  kubectl delete -f "$PROJECT_DIR/k8s/api-canary-deployment.yaml" --ignore-not-found=true
  kubectl delete -f "$PROJECT_DIR/k8s/genai-gateway-canary-deployment.yaml" --ignore-not-found=true

  echo ""
  echo "Canary promoted to stable. All traffic now goes to the new version."
  show_status
}

rollback_canary() {
  echo ""
  echo "--- Rolling back canary ---"

  kubectl delete -f "$PROJECT_DIR/k8s/api-canary-deployment.yaml" --ignore-not-found=true
  kubectl delete -f "$PROJECT_DIR/k8s/genai-gateway-canary-deployment.yaml" --ignore-not-found=true

  echo "Canary pods removed. All traffic goes to stable."
  show_status
}

case "${1:-status}" in
  deploy)
    deploy_canary
    ;;
  status)
    show_status
    ;;
  promote)
    promote_canary
    ;;
  rollback)
    rollback_canary
    ;;
  *)
    echo "Usage: $0 {deploy|status|promote|rollback}"
    exit 1
    ;;
esac
