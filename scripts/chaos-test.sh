#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# chaos-test.sh — Chaos Engineering experiments for Dashly
# Milestone 4: Pod Kill + Network Latency using Chaos Mesh
#
# Prerequisites:
#   - Minikube running with Dashly deployed (./scripts/deploy-minikube.sh)
#   - helm installed
#   - kubectl configured for minikube context
#
# Usage:
#   ./scripts/chaos-test.sh install    # Install Chaos Mesh on Minikube
#   ./scripts/chaos-test.sh pod-kill   # Run pod-kill experiment
#   ./scripts/chaos-test.sh latency    # Run network-latency experiment
#   ./scripts/chaos-test.sh report     # Show experiment results summary
#   ./scripts/chaos-test.sh cleanup    # Remove chaos experiments
#   ./scripts/chaos-test.sh all        # Full run: install + experiments + report
# ──────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CHAOS_DIR="$PROJECT_DIR/k8s/chaos"
RESULTS_DIR="$PROJECT_DIR/chaos-results"

echo "=== Dashly Chaos Engineering ==="
echo "Project: $PROJECT_DIR"

# ── Helpers ─────────────────────────────────────────────

PORT_FWD_PID=""

# Start a kubectl port-forward in the background and return the local URL
start_port_forward() {
  # Kill any existing port-forward
  stop_port_forward

  local local_port=18080
  kubectl port-forward svc/api -n dashly ${local_port}:3000 &>/dev/null &
  PORT_FWD_PID=$!
  sleep 2

  # Verify it's working
  if kill -0 "$PORT_FWD_PID" 2>/dev/null; then
    echo "http://127.0.0.1:${local_port}"
  else
    PORT_FWD_PID=""
    echo ""
  fi
}

stop_port_forward() {
  if [ -n "$PORT_FWD_PID" ] && kill -0 "$PORT_FWD_PID" 2>/dev/null; then
    kill "$PORT_FWD_PID" 2>/dev/null || true
    wait "$PORT_FWD_PID" 2>/dev/null || true
    PORT_FWD_PID=""
  fi
}

# Cleanup port-forward on exit
trap stop_port_forward EXIT

timestamp() {
  date "+%Y-%m-%d %H:%M:%S"
}

ensure_results_dir() {
  mkdir -p "$RESULTS_DIR"
}

# Run health check from inside an API pod (avoids Docker driver network issues)
check_health_in_cluster() {
  local label="$1"
  local api_pod
  api_pod=$(kubectl get pod -n dashly -l app=api,version=stable -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
  if [ -z "$api_pod" ]; then
    echo "  ($label: no API pod available)"
    return
  fi
  # Use the K8s service DNS name so it works regardless of which pod handles it
  kubectl exec -n dashly "$api_pod" -- \
    sh -c 'wget -q -O - -T 5 http://api.dashly.svc.cluster.local:3000/api/health 2>/dev/null || wget -q -O - -T 5 http://127.0.0.1:3000/api/health 2>/dev/null || echo "{\"status\":\"unreachable\"}"' 2>/dev/null \
    || echo "  ($label: health check failed)"
}

# Measure gateway latency from inside an API pod (5 requests)
# Uses Node.js for precise timing since Alpine BusyBox date lacks nanosecond support
measure_gateway_latency() {
  local label="$1"
  local api_pod
  api_pod=$(kubectl get pod -n dashly -l app=api,version=stable -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

  if [ -z "$api_pod" ]; then
    echo "  (no API pod available for latency measurement)"
    return
  fi

  echo "  Measuring gateway latency from pod $api_pod ($label)..."
  kubectl exec -n dashly "$api_pod" -- \
    node -e '
const http = require("http");
async function measure(i) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.get("http://genai-gateway:4000/api/health", { timeout: 10000 }, (res) => {
      res.resume();
      res.on("end", () => { console.log("  request " + i + ": " + (Date.now() - start) + "ms"); resolve(); });
    });
    req.on("error", () => { console.log("  request " + i + ": " + (Date.now() - start) + "ms (error)"); resolve(); });
    req.on("timeout", () => { req.destroy(); });
  });
}
(async () => { for (let i = 1; i <= 5; i++) await measure(i); })();
' 2>/dev/null || echo "  (could not measure in-pod latency)"
}

# Force-remove a chaos resource, clearing finalizers if stuck
force_delete_chaos() {
  local kind="$1"  # podchaos or networkchaos
  local ns="dashly"
  # First attempt normal delete with timeout
  kubectl delete "$kind" --all -n "$ns" --ignore-not-found=true --timeout=15s 2>/dev/null || true
  # If any remain (stuck on finalizers), patch them out
  local remaining
  remaining=$(kubectl get "$kind" -n "$ns" -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || true)
  for name in $remaining; do
    kubectl patch "$kind" "$name" -n "$ns" -p '{"metadata":{"finalizers":null}}' --type=merge 2>/dev/null || true
  done
}

# ── Install ─────────────────────────────────────────────

install_chaos_mesh() {
  echo ""
  echo "--- Installing Chaos Mesh on Minikube ---"

  # Check helm is available
  if ! command -v helm &>/dev/null; then
    echo "ERROR: helm is not installed. Install it first:"
    echo "  brew install helm"
    exit 1
  fi

  # Detect Minikube container runtime
  echo "Detecting Minikube container runtime..."
  RUNTIME="containerd"
  SOCKET_PATH="/run/containerd/containerd.sock"

  if minikube ssh -- 'test -S /var/run/docker.sock' 2>/dev/null; then
    RUNTIME="docker"
    SOCKET_PATH="/var/run/docker.sock"
  fi
  echo "  Runtime: $RUNTIME"
  echo "  Socket:  $SOCKET_PATH"

  # Add Chaos Mesh Helm repo
  echo ""
  echo "Adding Chaos Mesh Helm repository..."
  helm repo add chaos-mesh https://charts.chaos-mesh.org 2>/dev/null || true
  helm repo update

  # Create namespace
  kubectl create ns chaos-mesh --dry-run=client -o yaml | kubectl apply -f -

  # Install Chaos Mesh
  echo ""
  echo "Installing Chaos Mesh (this may take a minute)..."
  helm upgrade --install chaos-mesh chaos-mesh/chaos-mesh \
    --namespace chaos-mesh \
    --set chaosDaemon.runtime="$RUNTIME" \
    --set chaosDaemon.socketPath="$SOCKET_PATH" \
    --set dashboard.create=false \
    --version 2.8.1 \
    --wait --timeout 120s

  # Wait for pods
  echo ""
  echo "Waiting for Chaos Mesh pods to be ready..."
  kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=chaos-mesh -n chaos-mesh --timeout=120s

  echo ""
  echo "Chaos Mesh installed successfully!"
  echo ""
  echo "Chaos Mesh pods:"
  kubectl get pods -n chaos-mesh
  echo ""
  echo "CRDs installed:"
  kubectl get crd | grep chaos-mesh || echo "  (CRDs may take a moment to register)"
}

# ── Experiment 1: Pod Kill ──────────────────────────────

run_pod_kill() {
  echo ""
  echo "--- Experiment 1: Pod/Service Kill Test ---"
  echo "Goal: Verify Kubernetes auto-restarts crashed pods"
  echo ""

  ensure_results_dir

  # ── Baseline ──
  echo "=== BASELINE ==="
  echo "$(timestamp) - Capturing baseline state..." | tee "$RESULTS_DIR/pod-kill-log.txt"

  echo "" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "API pods before kill:" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  kubectl get pods -n dashly -l app=api -o wide | tee -a "$RESULTS_DIR/pod-kill-log.txt"

  echo "" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "GenAI Gateway pods before kill:" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  kubectl get pods -n dashly -l app=genai-gateway -o wide | tee -a "$RESULTS_DIR/pod-kill-log.txt"

  echo "" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "Health check before kill:" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  check_health_in_cluster "before-kill" | tee -a "$RESULTS_DIR/pod-kill-log.txt"

  # ── Kill API Pod ──
  echo "" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "======================================" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "=== EXPERIMENT 1a: Kill API Pod ===" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "======================================" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "$(timestamp) - Applying PodChaos for API..." | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  kubectl apply -f "$CHAOS_DIR/pod-kill-api.yaml"

  echo "Monitoring pod recovery (polling every 3s for 60s)..." | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  for i in $(seq 1 20); do
    sleep 3
    echo "" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
    echo "$(timestamp) - Check $i/20:" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
    kubectl get pods -n dashly -l app=api --no-headers | tee -a "$RESULTS_DIR/pod-kill-log.txt"

    # Check if all pods are back to Running
    RUNNING=$(kubectl get pods -n dashly -l app=api --no-headers 2>/dev/null | grep -c "Running" || true)
    TOTAL=$(kubectl get pods -n dashly -l app=api --no-headers 2>/dev/null | wc -l | tr -d ' ')
    if [ "$RUNNING" -eq "$TOTAL" ] && [ "$TOTAL" -ge 3 ] && [ "$i" -gt 3 ]; then
      echo "$(timestamp) - All $TOTAL API pods are Running again!" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
      break
    fi
  done

  # Post-kill health check
  echo "" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "Health check after API pod kill:" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  check_health_in_cluster "after-api-kill" | tee -a "$RESULTS_DIR/pod-kill-log.txt"

  # Clean up API chaos
  force_delete_chaos podchaos

  # Wait for full recovery before next experiment
  echo "" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "Waiting for API pods to fully recover..." | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  kubectl wait --for=condition=ready pod -l app=api -n dashly --timeout=120s 2>/dev/null || true

  # ── Kill GenAI Gateway Pod ──
  echo "" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "==================================================" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "=== EXPERIMENT 1b: Kill GenAI Gateway Pod ===" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "==================================================" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "$(timestamp) - Applying PodChaos for GenAI Gateway..." | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  kubectl apply -f "$CHAOS_DIR/pod-kill-genai.yaml"

  echo "Monitoring pod recovery (polling every 3s for 60s)..." | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  for i in $(seq 1 20); do
    sleep 3
    echo "" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
    echo "$(timestamp) - Check $i/20:" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
    kubectl get pods -n dashly -l app=genai-gateway --no-headers | tee -a "$RESULTS_DIR/pod-kill-log.txt"

    RUNNING=$(kubectl get pods -n dashly -l app=genai-gateway --no-headers 2>/dev/null | grep -c "Running" || true)
    TOTAL=$(kubectl get pods -n dashly -l app=genai-gateway --no-headers 2>/dev/null | wc -l | tr -d ' ')
    if [ "$RUNNING" -eq "$TOTAL" ] && [ "$TOTAL" -ge 2 ] && [ "$i" -gt 3 ]; then
      echo "$(timestamp) - All $TOTAL GenAI Gateway pods are Running again!" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
      break
    fi
  done

  # Post-kill health check
  echo "" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "Health check after GenAI Gateway pod kill:" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  check_health_in_cluster "after-genai-kill" | tee -a "$RESULTS_DIR/pod-kill-log.txt"

  # Clean up
  force_delete_chaos podchaos

  # ── Final State ──
  echo "" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "=== FINAL STATE ===" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "API pods:" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  kubectl get pods -n dashly -l app=api -o wide | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "GenAI Gateway pods:" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  kubectl get pods -n dashly -l app=genai-gateway -o wide | tee -a "$RESULTS_DIR/pod-kill-log.txt"

  echo "" | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "$(timestamp) - Experiment 1 complete." | tee -a "$RESULTS_DIR/pod-kill-log.txt"
  echo "Results saved to: $RESULTS_DIR/pod-kill-log.txt"
}

# ── Experiment 2: Network Latency ──────────────────────

run_latency() {
  echo ""
  echo "--- Experiment 2: Network Latency Test ---"
  echo "Goal: Test slow responses between API and GenAI Gateway"
  echo ""

  ensure_results_dir

  # Start port-forward for load tests
  echo "Starting port-forward for load tests..."
  local API_URL
  API_URL=$(start_port_forward)
  if [ -z "$API_URL" ]; then
    echo "WARNING: Could not start port-forward. Load tests will be skipped."
  else
    echo "  API available at: $API_URL"
  fi

  # ── Baseline ──
  echo "=== BASELINE ===" | tee "$RESULTS_DIR/latency-log.txt"
  echo "$(timestamp) - Capturing baseline latency..." | tee -a "$RESULTS_DIR/latency-log.txt"

  echo "" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "Gateway latency from API pod (baseline):" | tee -a "$RESULTS_DIR/latency-log.txt"
  measure_gateway_latency "baseline" | tee -a "$RESULTS_DIR/latency-log.txt"

  echo "" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "API health check (baseline):" | tee -a "$RESULTS_DIR/latency-log.txt"
  check_health_in_cluster "baseline" | tee -a "$RESULTS_DIR/latency-log.txt"

  # Run baseline load test via port-forward
  if [ -n "$API_URL" ]; then
    echo "" | tee -a "$RESULTS_DIR/latency-log.txt"
    echo "Load test (baseline):" | tee -a "$RESULTS_DIR/latency-log.txt"
    LOAD_WORKERS=10 LOAD_ITERATIONS=5 LOAD_DELAY=50 node "$PROJECT_DIR/scripts/load-test.js" "$API_URL" 2>&1 | tee -a "$RESULTS_DIR/latency-log.txt" || echo "  (load test could not run)"
  fi

  # ── Moderate Latency (200ms/pkt) ──
  echo "" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "==========================================================" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "=== EXPERIMENT 2a: Moderate Latency (200ms/pkt + 50ms jitter) ===" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "==========================================================" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "$(timestamp) - Applying NetworkChaos (moderate)..." | tee -a "$RESULTS_DIR/latency-log.txt"
  kubectl apply -f "$CHAOS_DIR/network-latency-moderate.yaml"

  echo "Waiting 10s for tc rules to take effect..." | tee -a "$RESULTS_DIR/latency-log.txt"
  sleep 10

  echo "" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "Gateway latency from API pod (200ms/pkt chaos):" | tee -a "$RESULTS_DIR/latency-log.txt"
  measure_gateway_latency "moderate-200ms" | tee -a "$RESULTS_DIR/latency-log.txt"

  echo "" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "API health check (moderate chaos):" | tee -a "$RESULTS_DIR/latency-log.txt"
  check_health_in_cluster "moderate-chaos" | tee -a "$RESULTS_DIR/latency-log.txt"

  if [ -n "$API_URL" ]; then
    echo "" | tee -a "$RESULTS_DIR/latency-log.txt"
    echo "Load test (moderate chaos):" | tee -a "$RESULTS_DIR/latency-log.txt"
    LOAD_WORKERS=10 LOAD_ITERATIONS=5 LOAD_DELAY=50 node "$PROJECT_DIR/scripts/load-test.js" "$API_URL" 2>&1 | tee -a "$RESULTS_DIR/latency-log.txt" || echo "  (load test could not run)"
  fi

  # Clean up moderate
  echo "" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "Removing moderate chaos..." | tee -a "$RESULTS_DIR/latency-log.txt"
  force_delete_chaos networkchaos
  sleep 5

  # ── Severe Latency (500ms/pkt) ──
  echo "" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "=============================================================" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "=== EXPERIMENT 2b: Severe Latency (500ms/pkt + 200ms jitter) ===" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "=============================================================" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "$(timestamp) - Applying NetworkChaos (severe)..." | tee -a "$RESULTS_DIR/latency-log.txt"
  kubectl apply -f "$CHAOS_DIR/network-latency-severe.yaml"

  echo "Waiting 10s for tc rules to take effect..." | tee -a "$RESULTS_DIR/latency-log.txt"
  sleep 10

  echo "" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "Gateway latency from API pod (500ms/pkt chaos):" | tee -a "$RESULTS_DIR/latency-log.txt"
  measure_gateway_latency "severe-500ms" | tee -a "$RESULTS_DIR/latency-log.txt"

  echo "" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "API health check (severe chaos):" | tee -a "$RESULTS_DIR/latency-log.txt"
  check_health_in_cluster "severe-chaos" | tee -a "$RESULTS_DIR/latency-log.txt"

  if [ -n "$API_URL" ]; then
    echo "" | tee -a "$RESULTS_DIR/latency-log.txt"
    echo "Load test (severe chaos):" | tee -a "$RESULTS_DIR/latency-log.txt"
    LOAD_WORKERS=10 LOAD_ITERATIONS=5 LOAD_DELAY=50 node "$PROJECT_DIR/scripts/load-test.js" "$API_URL" 2>&1 | tee -a "$RESULTS_DIR/latency-log.txt" || echo "  (load test could not run)"
  fi

  # Clean up severe
  echo "" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "Removing severe chaos..." | tee -a "$RESULTS_DIR/latency-log.txt"
  force_delete_chaos networkchaos

  # ── Post-Chaos Baseline ──
  echo "" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "=== POST-CHAOS RECOVERY ===" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "Waiting 10s for network to normalize..." | tee -a "$RESULTS_DIR/latency-log.txt"
  sleep 10

  echo "" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "Gateway latency from API pod (post-chaos):" | tee -a "$RESULTS_DIR/latency-log.txt"
  measure_gateway_latency "post-chaos" | tee -a "$RESULTS_DIR/latency-log.txt"

  echo "" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "API health check (post-chaos):" | tee -a "$RESULTS_DIR/latency-log.txt"
  check_health_in_cluster "post-chaos" | tee -a "$RESULTS_DIR/latency-log.txt"

  # Stop port-forward
  stop_port_forward

  echo "" | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "$(timestamp) - Experiment 2 complete." | tee -a "$RESULTS_DIR/latency-log.txt"
  echo "Results saved to: $RESULTS_DIR/latency-log.txt"
}

# ── Report ──────────────────────────────────────────────

show_report() {
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║          Chaos Engineering — Results Summary             ║"
  echo "╚══════════════════════════════════════════════════════════╝"

  if [ -f "$RESULTS_DIR/pod-kill-log.txt" ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  EXPERIMENT 1: Pod Kill Test"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  Full log: $RESULTS_DIR/pod-kill-log.txt"
    echo ""
    echo "  Key observations:"
    # Extract recovery lines
    grep -E "(All.*pods are Running|FINAL STATE|Health check after|BASELINE|EXPERIMENT 1)" "$RESULTS_DIR/pod-kill-log.txt" 2>/dev/null | while IFS= read -r line; do
      echo "    $line"
    done
  else
    echo ""
    echo "  Experiment 1 (Pod Kill): NOT YET RUN"
    echo "  Run with: ./scripts/chaos-test.sh pod-kill"
  fi

  if [ -f "$RESULTS_DIR/latency-log.txt" ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  EXPERIMENT 2: Network Latency Test"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  Full log: $RESULTS_DIR/latency-log.txt"
    echo ""
    echo "  Key observations:"
    grep -E "(request [0-9]:|BASELINE|EXPERIMENT 2|POST-CHAOS|HTTP [0-9])" "$RESULTS_DIR/latency-log.txt" 2>/dev/null | while IFS= read -r line; do
      echo "    $line"
    done
  else
    echo ""
    echo "  Experiment 2 (Network Latency): NOT YET RUN"
    echo "  Run with: ./scripts/chaos-test.sh latency"
  fi

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  # Show current cluster state
  echo "Current cluster state:"
  echo ""
  echo "Pods:"
  kubectl get pods -n dashly -o wide 2>/dev/null || echo "  (could not reach cluster)"
  echo ""
  echo "Chaos resources:"
  kubectl get podchaos,networkchaos -n dashly 2>/dev/null || echo "  (none or Chaos Mesh not installed)"
}

# ── Cleanup ─────────────────────────────────────────────

run_cleanup() {
  echo ""
  echo "--- Cleaning up chaos experiments ---"

  echo "Removing all chaos experiments from dashly namespace..."
  force_delete_chaos podchaos
  force_delete_chaos networkchaos

  echo ""
  echo "Active chaos resources:"
  kubectl get podchaos,networkchaos -n dashly 2>/dev/null || echo "  (none)"

  echo ""
  echo "Chaos Mesh pods (still installed):"
  kubectl get pods -n chaos-mesh 2>/dev/null || echo "  (not installed)"

  echo ""
  echo "To fully uninstall Chaos Mesh:"
  echo "  helm uninstall chaos-mesh -n chaos-mesh"
  echo "  kubectl delete ns chaos-mesh"
}

# ── Full Run ────────────────────────────────────────────

run_all() {
  install_chaos_mesh
  echo ""
  echo "========================================="
  echo "Starting chaos experiments..."
  echo "========================================="
  run_pod_kill
  echo ""
  run_latency
  echo ""
  show_report
}

# ── Main ──────────────────────────────────────────────

case "${1:-}" in
  install)
    install_chaos_mesh
    ;;
  pod-kill)
    run_pod_kill
    ;;
  latency)
    run_latency
    ;;
  report)
    show_report
    ;;
  cleanup)
    run_cleanup
    ;;
  all)
    run_all
    ;;
  *)
    echo "Usage: $0 {install|pod-kill|latency|report|cleanup|all}"
    exit 1
    ;;
esac
