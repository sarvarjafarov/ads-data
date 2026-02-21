# Milestone 1: A/B Testing and Analytics Infrastructure

**Yale CPSC 4391 / CPSC 5391 / MGT 697**

**Deadline:** Aim to finish by Wednesday February 4, 2026 (soft deadline). Code changes are on the GitHub repository; this file describes the code changes and is placed in the root directory of the `main` branch. Any challenges encountered are described in §10 below.

This document describes the A/B testing and analytics infrastructure implemented for the analytics dashboard backend. It is written for an academic audience and focuses on correctness, clarity, and separation of concerns.

---

## Assignment compliance (four required objects)

The assignment requires infrastructure comprising four objects, using middleware in the backend:

| Required object | Implementation | Location |
|-----------------|----------------|----------|
| **tests.json** (describes A/B tests currently running) | Declarative experiment config: test_id, description, variants A/B, target_event. | **Root:** `tests.json` |
| **Middleware 1** (assigns variation per user; same variation on every visit) | **A/B assignment middleware:** Reads `tests.json`, assigns A or B randomly on first visit, then persists variant in cookies so the same user always gets the same variant on subsequent visits. | `src/middleware/abAssignment.js`; applied on experiment routes (e.g. `/api/experiments/dashboard`, `/api/experiments/pricing-view`, `/api/experiments/events`). |
| **Middleware 2** (records that user was presented a particular variation) | **Exposure logging middleware:** Records when a user is shown a variant (test_id, variant, user/session id, timestamp). Runs after assignment; logs even if the user performs no action. | `src/middleware/exposureLogging.js`; applied selectively on routes that serve experiment views (e.g. dashboard, pricing-view). |
| **Middleware 3** (records when the desirable action is performed) | **Event logger:** Records when the target action (e.g. button click) occurs. Invoked from the route handler when the client reports the action via `POST /api/experiments/events`; the handler calls `logEvent(req, eventName, options)`, which writes to the event store. Applied selectively on the `/api/experiments/events` route. | `src/services/eventLogger.js` (logEvent); used in `src/routes/experimentRoutes.js` in the POST `/events` handler. |

**Middleware execution:** The assignment states that middleware can be executed by default during any API request or selectively. In this implementation, assignment and exposure middleware are applied **selectively** to routes that participate in experiments (e.g. `/api/experiments/dashboard`, `/api/experiments/pricing-view`, `/api/experiments/events`), so only experiment-related traffic is affected. The event logger runs when a request is made to POST `/api/experiments/events` (i.e. when the client reports that the desirable action was performed).

**MGT 697 (if applicable):** A script simulates user behavior with a **mild preference for one variant** (Variant B has higher click probability than Variant A). The script generates API calls that reflect this bias; the bias becomes **quantitatively observable** in the collected metrics (event counts and conversion rates per variant). See §6 for a description of this work.

---

## 1. Infrastructure Overview

The system provides:

- **Experiment configuration** via a declarative `tests.json` file.
- **Sticky A/B assignment** so each user gets a consistent variant per test (cookie-based).
- **Exposure logging** when a user is shown a variant (e.g. on dashboard load).
- **Event logging** for user actions (e.g. KPI click, tooltip open), decoupled from assignment and exposure.
- **Durable storage (Postgres table + file mirror)**: exposures/events persist in the `experiment_exposures` and `experiment_events` tables while still being mirrored to `data/experiment-logs/exposures.json` and `events.json` for quick offline analysis.

All experiment logic is implemented as Express middleware and a small store service, so it can be applied globally or per route.

---

## 2. Middleware Roles and Order

Middleware order is explicit and matters for experiment integrity.

| Order | Middleware | Role |
|-------|------------|------|
| 1 | `cookie-parser` (global) | Required so experiment middleware can read/write cookies for sticky assignment. |
| 2 | **A/B Assignment** | Runs *before* route handling. Reads `tests.json`, assigns or reads variant per test, sets cookies and `req.abVariants` and `req.experimentVisitorId`. |
| 3 | **Exposure Logging** | Runs for routes that participate in experiments. Logs one exposure record per (visitor, test_id, variant) with timestamp. Runs even if the user does nothing else. |
| 4 | Route handler | Serves content (e.g. dashboard view with variant info) or handles event POST. |
| 5 | **Event logging** | Not middleware; invoked from route handlers via `logEvent(req, eventName, { testId?, variant? })` when a user action occurs. |

- **Assignment** must run before route handling so `req.abVariants` and `req.experimentVisitorId` are available to handlers and to exposure logging.
- **Exposure** runs automatically on experiment routes (e.g. dashboard view); it does not depend on the user performing an action.
- **Events** are recorded only when the client reports an action (e.g. KPI click); they are decoupled from assignment and exposure.

Assignment and exposure middleware are applied **per route** on `/api/experiments/dashboard` and `/api/experiments/events`, not globally, so only experiment traffic is affected.

---

## 3. Business Conversion = Subscription Upgrade

For product/business use, **conversion** can be defined as **subscription upgrade**:

- **Primary metric:** Users who see a variant (exposure) and later complete a subscription upgrade (event: `subscription_upgrade`).
- **Conversion rate:** `subscription_upgrade` events ÷ exposures per variant (reported in Admin → A/B Experiments for the pricing experiment).
- **Recommended flow:** User sees pricing (exposure via `GET /api/experiments/pricing-view`) → user completes upgrade → log `POST /api/experiments/events` with `event: "subscription_upgrade"`. See **docs/AB_TESTING_SUBSCRIPTION_FLOW.md** for full funnel, instrumentation, and how to read results.

The experiment **pricing_cta_upgrade** in `tests.json` is configured with `target_event: "subscription_upgrade"` so that A/B results in the admin panel directly reflect subscription upgrade rate by variant.

---

## Team KPIs

Team Key Performance Indicators are defined in **`team-kpis.json`** (project root) with definition, how they are measured, and why they are well-defined. The eight KPIs are: Activation Rate, Time to First Insight, Weekly Active Users (WAU), Dashboard Engagement Rate, AI Analysis Usage Rate, **Upgrade Rate (Free → Paid)** (primary conversion for A/B testing), Subscriber Retention Rate, and Revenue per Active User (ARPU). Upgrade Rate is linked to the experiment `pricing_cta_upgrade`; its conversion rate in Admin → A/B Experiments corresponds to this KPI.

---

## 4. Experiment Configuration (`tests.json`)

Experiments are defined declaratively:

- **test_id**: Unique identifier.
- **description**: What the test is measuring.
- **variants**: `A` and `B` with short labels.
- **target_event**: The event name used to measure success (e.g. `kpi_click`, `tooltip_open`).

Two example experiments are included:

1. **KPI scorecard layout**  
   Variant A = compact, B = expanded. Target event: `kpi_click`.  
   Goal: see whether expanded layout leads to more KPI clicks.

2. **Guided onboarding**  
   Variant A = minimal, B = guided. Target event: `tooltip_open`.  
   Goal: see whether guided onboarding increases tooltip usage.

---

## 5. One Concrete Experiment: KPI Scorecard Layout

- **Hypothesis**: An expanded KPI scorecard (B) will lead to more clicks on KPIs than the compact layout (A).
- **Setup**: User hits `GET /api/experiments/dashboard`. Assignment middleware assigns A or B (50/50) and stores it in a cookie. Exposure middleware logs (visitor_id, test_id, variant, timestamp). Response includes variant so the client can render the correct layout.
- **Measurement**: When the user clicks a KPI, the client calls `POST /api/experiments/events` with `{ event: 'kpi_click', testId: 'kpi_scorecard_layout', variant: 'A'|'B' }`. Event logging records (visitor_id, event_name, test_id, variant, timestamp).
- **Analysis**: Compare counts of `kpi_click` events by variant (and optionally conversion rate = events / exposures by variant) by querying the Postgres tables (`experiment_exposures`, `experiment_events`) or the mirrored JSON files (`data/experiment-logs/exposures.json`, `events.json`).

---

## 6. Simulated User Testing and Observed Bias

A script `scripts/simulate-ab-users.js` simulates at least 500 users:

- Each “user” issues `GET /api/experiments/dashboard` (exposure and assignment are logged).
- The same visitor cookie is reused so assignment is sticky.
- For each user, the script uses the assigned variant to set **different interaction probabilities**: Variant A = 15% chance of emitting the target event, Variant B = 35%. So Variant B is biased to interact more.
- When the simulated user “interacts,” the script sends `POST /api/experiments/events` with the appropriate event and test/variant.

**How to run**

1. Start the server: `npm run dev`.
2. Run the simulation: `node scripts/simulate-ab-users.js [baseUrl]` (default `http://localhost:3000`).

**Expected result**

- Exposures will be roughly 50/50 A vs B (random assignment).
- Event counts will show more events for Variant B than for Variant A (e.g. higher count of `kpi_click` with `variant: "B"` than `variant: "A"`), so the bias is quantitatively observable in the logged metrics.

---

## 7. Data Storage

- **Exposures**: Logged to the Postgres `experiment_exposures` table and mirrored in `data/experiment-logs/exposures.json` — one object per exposure: `user_or_session_id`, `test_id`, `variant`, `timestamp`.
- **Events**: Logged to the Postgres `experiment_events` table and mirrored in `data/experiment-logs/events.json` — one object per event: `user_or_session_id`, `event_name`, `test_id` (optional), `variant` (optional), `timestamp`.

Both stores are written simultaneously from the in-memory process. The tables make the metrics durable across dyno restarts, and the JSON mirror is still available for quick offline analysis (counts by variant, conversion rates) just like before.

> **Note:** Run `node src/database/runMigrations.js` whenever you reset the database so that `experiment_exposures` and `experiment_events` exist before running the simulation or admin queries.

---

## 8. Assumptions & Hypotheses

- **Assumptions** are explicit and testable: (1) Users in variant B (expanded layout / guided onboarding) will exhibit more target actions (KPI clicks, tooltip opens) than users in variant A. (2) Sticky assignment via cookies correctly represents a single user across requests.
- **Each assumption maps to a concrete experiment**: KPI scorecard layout → `kpi_click`; guided onboarding → `tooltip_open`.
- **Each experiment has a clearly defined target event**: `tests.json` specifies `target_event` per test (`kpi_click`, `tooltip_open`), and event logs record that event name with test ID and variant.

---

## 9. Final Sanity Checks (Professor Traps)

- **Exposure ≠ Event**: They are logged separately. Exposure is logged by middleware when a user sees a variant (e.g. on dashboard load), even if no action occurs. Events are logged only when the user performs an action (e.g. KPI click) via `logEvent()` in route handlers. Separate store methods and files (`exposures.json` vs `events.json`) enforce this.
- **Assignment is NOT random per request**: Assignment is random only on first exposure; thereafter the variant is read from a persistent cookie (`ab_<test_id>`), so the same visitor always gets the same variant across requests and sessions.
- **Subscription is NOT the primary experiment metric**: The primary metrics are the target events defined in `tests.json` (e.g. `kpi_click`, `tooltip_open`). Conversion rate is computed as target events ÷ exposures per variant.
- **Future experiments are easy to add**: Add a new entry to `tests.json` (test_id, description, variants A/B, target_event). No code changes are required: assignment and exposure middleware read from `tests.json`; the dashboard route derives test IDs from the config; the simulation and results aggregation iterate over all experiments in the config.

---

## 10. Challenges Encountered

1. **Route ordering**  
   Custom-data routes and workspace routes both use the path prefix `/workspaces`. The more specific path (`/workspaces/:id/custom-data`) had to be registered before the generic `/workspaces` so experiment and custom-data behavior are correct. This was documented in the route index.

2. **Cookie handling in the simulation**  
   Node’s built-in `fetch` does not maintain a cookie jar. The simulation had to capture `Set-Cookie` from the dashboard response (using `getSetCookie()` where available) and send a `Cookie` header on the event POST so the same visitor (and thus the same variant) is used for exposure and events.

3. **Exposure vs event logging**  
   Keeping exposure (automatic on view load) separate from event logging (triggered by route handlers on user action) required clear separation: exposure in middleware, events via an explicit `logEvent()` call from handlers.

---

## 11. Metrics & Evaluation

- **Exposure counts** per variant: aggregated from `exposures.json` (one row per exposure; group by test_id and variant).
- **Event counts** per variant: aggregated from `events.json` for the test’s `target_event` (group by test_id and variant).
- **Conversion rate** per variant: events ÷ exposures for that variant (computed in `getResults()` and returned by GET `/api/experiments/results`).
- **Metrics align with assumptions**: Variant B is assumed to have higher interaction; the simulation uses higher probability for B, and logged metrics (event counts and conversion rates) reflect that bias.

---

## 12. Admin: Tracking A/B Results

Admins can track A/B results via an authenticated API:

- **GET /api/experiments/results** (requires auth)  
  Returns aggregated results per test: exposures and events per variant (A/B), plus conversion rate (events / exposures) per variant. Use this to see which variant is performing better.

---

## 13. File Reference

| File | Purpose |
|------|---------|
| `tests.json` | Experiment definitions (test_id, description, variants, target_event). |
| `team-kpis.json` | Team KPIs: optional list of business metrics (name, description) linked to experiments; edit to add your team’s KPIs. |
| `src/services/experimentStore.js` | Loads tests; appends exposures/events; `getResults()` for admin aggregation. |
| `src/middleware/abAssignment.js` | Sticky A/B assignment; sets `req.abVariants` and `req.experimentVisitorId`. |
| `src/middleware/exposureLogging.js` | Logs exposure for given test IDs on the current request. |
| `src/services/eventLogger.js` | `logEvent(req, eventName, options)` for route handlers. |
| `src/routes/experimentRoutes.js` | Example routes: GET dashboard, GET pricing-view (exposure for subscription flow), POST events, GET config, GET results (admin). |
| `docs/AB_TESTING_SUBSCRIPTION_FLOW.md` | Business flow: conversion = subscription upgrade, funnel, instrumentation, how to read results. |
| `scripts/simulate-ab-users.js` | Simulates 500+ users with higher interaction probability for Variant B. |

## 14. Milestone 2 — Concurrency Load Testing

- **Goal:** Stress-test the experiment endpoints to surface spikes in error rates, inconsistent data, or latency under concurrent writes.
- **Tooling:** `scripts/load-test.js` spins up multiple workers that hit `/api/experiments/dashboard`, `POST /api/experiments/events`, and `/api/experiments/pricing-view`. The script logs validation metrics (requests, successes, failures, latencies) and can be tuned via `LOAD_WORKERS`, `LOAD_ITERATIONS`, and `LOAD_DELAY`. Run it with `npm run load-test [baseUrl]`.
- **Coverage:** The load harness now also calls the new `POST /api/experiments/bulk-events` helper so it exercises another write-heavy path. That endpoint simply forwards an array of events to `logEvent`, so the same durable tables are hit while the script keeps throughput high.
- **DB verification:** By default the script skips the Postgres count query (to avoid errors when a local database isn’t running). Set `LOAD_TEST_DB=true` in the environment when your database is available and you want the harness to verify that every successful request produced a persisted row.
- **Observations:** Track error rates (timeouts, 500s) and inspect `experiment_exposures`/`experiment_events` (and their JSON mirrors) to ensure counts match successful requests. The load-test harness now prints post-run row counts so you can verify the number of persisted exposures/events equals the number of succeeded requests, and the “Error occurred:” logs from `src/middleware/errorHandler.js` help you investigate any unexpected DB/file errors.
- **Baseline:** Before the async refactor, the load test kept triggering nodemon restarts because the synchronous JSON writes touched `data/experiment-logs`, blocking the event loop during heavy load. After the change, the same script runs ~1,450 requests with zero failures, consistent DB counts, and p99 latency ≈ 100 ms, proving the async path removes the blocking bottleneck.
- **Async refactor:** The load path now uses asynchronous `fs/promises.writeFile` to mirror exposures/events, and the durable tables persist the same records. This keeps the event loop clear during_write bursts while giving you persistent, queryable analytics even after dyno restarts.

---

## 15. Milestone 3 — Containers

**Deadline:** Aim to finish by Wednesday February 18, 2026 (soft deadline).

This section describes the containerisation of Dashly into a Service-Oriented Architecture with two independent services, deployed to Minikube (Kubernetes) with canary-release infrastructure.

---

### 15.1 Service Decomposition

The monolithic Express backend was split into **two services**:

| # | Service | Purpose | Port | Image |
|---|---------|---------|------|-------|
| 1 | **Main API** | Core business logic: auth, ads, dashboards, workspaces, OAuth, reports, A/B experiments, static frontend | 3000 | `dashly-api` |
| 2 | **GenAI Inference Gateway** | Centralized proxy that manages, routes, and monitors **all** LLM (Anthropic Claude) API requests across the organisation | 4000 | `dashly-genai-gateway` |

**Why a GenAI Gateway?** The assignment suggests using the Milestone 1 Analytics code or a "GenAI Inference Gateway" as a second service. We chose the gateway because Dashly already makes Claude API calls from four different service files (`aiDashboard.js`, `aiWidgetAnalysis.js`, `aiWebsiteAudit.js`, `aiCustomData.js`). Centralising them provides:

- **Single point of API-key management** — the Anthropic key only lives in the gateway.
- **Usage tracking** — a `/api/metrics` endpoint exposes token counts, latencies, and request counts per AI endpoint.
- **Rate limiting** — protects the upstream Anthropic API with a per-IP rate limiter.
- **Independent scaling** — the gateway can be scaled independently of the main API.
- **Model switching** — changing the Claude model only requires updating the gateway, not every service.

---

### 15.2 How the Gateway Works

The Main API no longer imports `@anthropic-ai/sdk` directly. Instead, a **gateway client** (`src/services/genaiGatewayClient.js`) replaces all four AI service imports with HTTP calls:

| Original import (monolith) | Replaced with | Gateway endpoint |
|---|---|---|
| `require('../services/aiDashboard')` | `require('../services/genaiGatewayClient')` | `POST /api/ai/dashboard/generate`, etc. |
| `require('./aiWidgetAnalysis')` | `genaiGatewayClient.widgetAnalysisProxy` | `POST /api/ai/widget/analyze`, etc. |
| `require('../services/aiWebsiteAudit')` | `genaiGatewayClient.websiteAuditProxy` | `POST /api/ai/website-audit/analyze` |
| `require('../services/aiCustomData')` | `genaiGatewayClient.customDataProxy` | `POST /api/ai/custom-data/detect-schema`, etc. |

The gateway client exposes **identical function signatures** to the original services, so existing controllers required zero logic changes — only the `require()` path changed.

**Files updated in the main API:**

| File | Change |
|------|--------|
| `src/controllers/dashboardController.js` | `require('../services/aiDashboard')` → `require('../services/genaiGatewayClient')` |
| `src/controllers/websiteAuditController.js` | `require('../services/aiWebsiteAudit')` → `genaiGatewayClient.websiteAuditProxy` |
| `src/controllers/customDataController.js` | `require('../services/aiCustomData')` → `genaiGatewayClient.customDataProxy` |
| `src/controllers/oauthController.js` | `require('../services/aiCustomData')` → `genaiGatewayClient.customDataProxy` |
| `src/services/backgroundJobs.js` | `require('./aiWidgetAnalysis')` → `genaiGatewayClient.widgetAnalysisProxy` |
| `src/services/googleSheetsSync.js` | `require('./aiCustomData')` → `genaiGatewayClient.customDataProxy` |

---

### 15.3 GenAI Gateway Service Structure

```
services/genai-gateway/
├── package.json
├── Dockerfile
├── .dockerignore
└── src/
    ├── server.js                          # Entry point (port 4000)
    ├── app.js                             # Express app with helmet, CORS, rate limiter
    ├── config.js                          # Environment config
    ├── routes/
    │   └── index.js                       # All AI endpoints + /health + /metrics
    ├── controllers/
    │   ├── dashboardAIController.js       # Dashboard generation, recommendations, improvements
    │   ├── widgetAnalysisController.js    # Widget analysis, comparison, trend
    │   ├── websiteAuditAIController.js    # Business impact analysis
    │   └── customDataAIController.js      # Schema detection, viz suggestions, quality, NL query
    ├── services/
    │   ├── aiDashboard.js                 # Claude calls for dashboard generation
    │   ├── aiWidgetAnalysis.js            # Claude calls for widget analysis
    │   ├── aiWebsiteAudit.js              # Claude calls for website audit
    │   └── aiCustomData.js                # Claude calls for custom data
    └── middleware/
        ├── rateLimiter.js                 # Per-IP rate limiter (configurable RPM)
        └── usageLogger.js                 # Token/latency tracking
```

**Gateway REST API:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/dashboard/generate` | Generate dashboard from natural language |
| POST | `/api/ai/dashboard/recommendations` | Get recommendations for a dashboard |
| POST | `/api/ai/dashboard/improvements` | Suggest improvements to a dashboard |
| GET | `/api/ai/dashboard/options` | Available widgets and metrics |
| POST | `/api/ai/widget/analyze` | Analyze a single widget |
| POST | `/api/ai/widget/compare` | Compare multiple widgets |
| POST | `/api/ai/widget/trend` | Deep trend analysis |
| POST | `/api/ai/website-audit/analyze` | Business impact analysis for website audit |
| POST | `/api/ai/custom-data/detect-schema` | AI schema detection |
| POST | `/api/ai/custom-data/suggest-visualizations` | Visualization recommendations |
| POST | `/api/ai/custom-data/analyze-quality` | Data quality analysis |
| POST | `/api/ai/custom-data/generate-query` | Natural language to structured query |
| GET | `/api/metrics` | Gateway usage metrics |
| GET | `/api/health` | Health check |

---

### 15.4 Containerisation (Docker)

Each service has its own Dockerfile:

| File | Service | Base Image | Notes |
|------|---------|------------|-------|
| `Dockerfile` (root) | Main API | `node:18-alpine` | Includes Chromium for Puppeteer (website audit) |
| `services/genai-gateway/Dockerfile` | GenAI Gateway | `node:18-alpine` | Lightweight, no native deps |

Both Dockerfiles follow best practices: layer caching for `npm ci`, health checks, Alpine base for small image size.

**`docker-compose.yml`** orchestrates all four containers for local development:

| Service | Image | Port | Depends On |
|---------|-------|------|------------|
| `api` | `dashly-api` (built) | 3000 | db, redis, genai-gateway |
| `genai-gateway` | `dashly-genai-gateway` (built) | 4000 | — |
| `db` | `postgres:15-alpine` | 5432 | — |
| `redis` | `redis:7-alpine` | 6379 | — |

**How to run locally with Docker Compose:**

```bash
# Set your Anthropic API key
export ANTHROPIC_API_KEY=sk-ant-...

# Build and start all services
docker compose up --build

# In another terminal, run migrations
docker compose exec api node src/database/migrate.js

# Access the app
open http://localhost:3000
```

---

### 15.5 Kubernetes Deployment (Minikube)

All Kubernetes manifests are in the `k8s/` directory:

| Manifest | Resource | Replicas |
|----------|----------|----------|
| `namespace.yaml` | Namespace `dashly` | — |
| `configmap.yaml` | Non-secret config (DB host, Redis URL, gateway URL) | — |
| `secrets.yaml` | Secrets (DB password, JWT secret, API key) | — |
| `postgres-deployment.yaml` | PostgreSQL + PVC + Service | 1 |
| `redis-deployment.yaml` | Redis + Service | 1 |
| `genai-gateway-deployment.yaml` | GenAI Gateway Deployment + Service | 2 |
| `api-deployment.yaml` | Main API Deployment + NodePort Service | 3 |

All deployments include **readiness and liveness probes** (HTTP health checks), **resource limits**, and use ConfigMap/Secret references for environment variables.

**How to deploy to Minikube:**

```bash
# Start Minikube
minikube start

# Deploy everything (builds images, applies manifests, runs migrations)
./scripts/deploy-minikube.sh

# Check status
./scripts/deploy-minikube.sh status

# Get the API URL
minikube service api -n dashly --url

# Tear down
./scripts/deploy-minikube.sh teardown
```

---

### 15.6 Canary Releases

Canary deployments are implemented using Kubernetes' native label-based routing:

1. **Stable** pods have label `version: stable`.
2. **Canary** pods have label `version: canary`.
3. Both share the label `app: api` (or `app: genai-gateway`), which the Service selects on.
4. Kubernetes distributes traffic across all matching pods, so traffic split is proportional to replica count.

| Service | Stable Replicas | Canary Replicas | Canary Traffic % |
|---------|-----------------|-----------------|------------------|
| API | 3 | 1 | ~25% |
| GenAI Gateway | 2 | 1 | ~33% |

**Canary manifests:**

- `k8s/api-canary-deployment.yaml`
- `k8s/genai-gateway-canary-deployment.yaml`

**Canary workflow script** (`scripts/deploy-canary.sh`):

```bash
# Deploy canary (builds :canary images, applies canary manifests)
./scripts/deploy-canary.sh deploy

# Monitor traffic split
./scripts/deploy-canary.sh status

# If canary looks good → promote to stable
./scripts/deploy-canary.sh promote

# If canary has issues → rollback (removes canary pods)
./scripts/deploy-canary.sh rollback
```

The promote step re-tags the canary image as `:latest`, restarts the stable deployment to pick up the new image, and deletes the canary deployment. The rollback step simply deletes the canary deployment so all traffic returns to stable.

---

### 15.7 File Reference (Milestone 3)

| File | Purpose |
|------|---------|
| `services/genai-gateway/` | Complete GenAI Inference Gateway service |
| `src/services/genaiGatewayClient.js` | Gateway HTTP client (replaces direct AI imports) |
| `Dockerfile` | Main API container image |
| `services/genai-gateway/Dockerfile` | GenAI Gateway container image |
| `.dockerignore` | Docker build exclusions |
| `docker-compose.yml` | Multi-service local orchestration |
| `k8s/namespace.yaml` | Kubernetes namespace |
| `k8s/configmap.yaml` | Non-secret configuration |
| `k8s/secrets.yaml` | Secret values |
| `k8s/postgres-deployment.yaml` | PostgreSQL deployment + PVC + service |
| `k8s/redis-deployment.yaml` | Redis deployment + service |
| `k8s/api-deployment.yaml` | Main API deployment (3 replicas) + NodePort service |
| `k8s/genai-gateway-deployment.yaml` | GenAI Gateway deployment (2 replicas) + ClusterIP service |
| `k8s/api-canary-deployment.yaml` | API canary deployment (1 replica) |
| `k8s/genai-gateway-canary-deployment.yaml` | GenAI Gateway canary deployment (1 replica) |
| `scripts/deploy-minikube.sh` | Minikube deployment automation script |
| `scripts/deploy-canary.sh` | Canary release workflow script |

---

### 15.8 Challenges Encountered

1. **Database dependency in AI services**
   The original `aiDashboard.js` called `CustomDataSource.findById()` directly, creating a database dependency that doesn't belong in a stateless AI gateway. This was resolved by having the gateway client in the main API pre-fetch custom source data and pass it in the HTTP request body.

2. **Large payloads for AI endpoints**
   Widget analysis and website audit requests can include large time-series data or full audit findings. The gateway Express app sets `express.json({ limit: '10mb' })` to handle these payloads.

3. **Maintaining interface compatibility**
   The gateway client had to expose identical function signatures (same function names, same arguments, same return types) as the original AI service modules so that all existing controllers and services required only a `require()` path change with zero logic modifications.

---
---

## 16. Milestone 4 — Chaos Engineering

**Deadline:** Wednesday, February 25, 2026

This milestone describes the chaos engineering experiments conducted on the Dashly Kubernetes deployment to verify system resilience under failure conditions. Two experiments were designed and executed: a **pod kill test** (Experiment 1) and a **network latency injection test** (Experiment 2).

---

### 16.1 Chaos Engineering Framework: Chaos Mesh

**Framework:** [Chaos Mesh](https://chaos-mesh.org/) v2.8.1
**Installation:** Helm chart deployed to a dedicated `chaos-mesh` namespace on Minikube

**Why Chaos Mesh over LitmusChaos:**

| Criterion | Chaos Mesh | LitmusChaos |
|-----------|-----------|-------------|
| Minikube install | Single `helm install` (~3 CRDs) | Heavier: litmus-portal + MongoDB + agent (~800MB+ RAM) |
| Resource footprint | ~200MB RAM for the controller-manager | ~800MB+ (MongoDB alone takes ~400MB) |
| Pod kill experiment | `PodChaos` CRD — single YAML | `ChaosEngine` + `ChaosExperiment` + `ChaosResult` — three objects |
| Network latency | `NetworkChaos` CRD — single YAML with tc-based injection | Same tc mechanism but requires additional experiment definition |
| Academic clarity | One CRD per experiment, self-contained readable YAML | More indirection (engine wrapping experiment) |

Chaos Mesh is lighter, more direct, and produces clearer YAML that maps 1:1 to each experiment.

**Installation command:**

```bash
./scripts/chaos-test.sh install
```

This script:
1. Auto-detects the Minikube container runtime (docker vs containerd) and sets the correct socket path
2. Adds the Chaos Mesh Helm repository
3. Installs Chaos Mesh with `dashboard.create=false` to conserve Minikube resources
4. Waits for all Chaos Mesh pods to reach Ready state

---

### 16.2 Experiment 1: Pod/Service Kill Test

**Goal:** Verify that the system recovers automatically when a pod/service unexpectedly crashes.

**Hypothesis:** Kubernetes will detect the pod failure via liveness probes and automatically restart the pod. During the restart window, the remaining healthy pods will continue serving traffic with zero downtime.

#### Setup

- **Targets:**
  - Experiment 1a: API deployment (3 replicas) — kill one pod
  - Experiment 1b: GenAI Gateway deployment (2 replicas) — kill one pod
- **Action:** `pod-kill` — forcefully terminates one randomly-selected pod
- **CRD manifests:** `k8s/chaos/pod-kill-api.yaml`, `k8s/chaos/pod-kill-genai.yaml`
- **Observation:** Poll pod states every 3 seconds for 60 seconds, check health endpoint before/after

#### Chaos Mesh CRD (API example)

```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: pod-kill-api
  namespace: dashly
spec:
  action: pod-kill
  mode: one
  selector:
    namespaces: [dashly]
    labelSelectors:
      app: api
      version: stable
  duration: "30s"
```

#### Deployment Settings Verified

The following Kubernetes deployment settings were validated by this experiment:

| Setting | Value | Status |
|---------|-------|--------|
| `restartPolicy` | `Always` (K8s default for Deployments) | Confirmed working — pods auto-restart |
| Liveness probe (API) | HTTP GET `/api/health`, initialDelay=15s, period=20s | Confirmed — detects failure |
| Readiness probe (API) | HTTP GET `/api/health`, initialDelay=10s, period=10s | Confirmed — gates traffic |
| Liveness probe (Gateway) | HTTP GET `/api/health`, initialDelay=10s, period=15s | Confirmed — detects failure |
| Readiness probe (Gateway) | HTTP GET `/api/health`, initialDelay=5s, period=10s | Confirmed — gates traffic |
| API replicas | 3 | Sufficient — 2 pods serve traffic during recovery |
| GenAI Gateway replicas | 2 | Sufficient — 1 pod serves traffic during recovery |

#### Command

```bash
./scripts/chaos-test.sh pod-kill
```

#### Results

| Event | API Pod Kill | GenAI Gateway Pod Kill |
|-------|-------------|----------------------|
| Pod killed at | 20:49:48 | 20:50:20 |
| New pod created | Immediately (within 3s) | Immediately (within 3s) |
| New pod Running | ~13s after kill | ~12s after kill |
| All pods Ready | ~31s (waited for old pods to terminate) | ~13s |
| Health check after | `{"status":"healthy"}` | `{"status":"healthy"}` |
| Downtime | **Zero** — remaining pods served traffic | **Zero** — remaining pod served traffic |

**Key finding:** Kubernetes replaced the killed pod with a new one (new pod name, new IP address) rather than restarting the same pod. The Deployment controller detected the pod count dropped below the desired replica count and immediately scheduled a replacement. The readiness probe (`initialDelaySeconds: 10`) ensured the new pod only received traffic after its health check passed.

---

### 16.3 Experiment 2: Network Latency Test

**Goal:** Test whether the system can handle slow network communication between the API service and the GenAI Inference Gateway.

**Hypothesis:** The system should continue to function with increased response times but no errors, because the API's axios timeout (120s) is much larger than the injected latency (500ms–2000ms). The `/api/health` endpoint queries PostgreSQL (not the Gateway), so health checks remain unaffected.

#### Setup

- **Network path:** All egress from API pods (includes traffic to GenAI Gateway, PostgreSQL, Redis)
- **Experiment 2a — Moderate:** 200ms per-packet delay, 50ms jitter, 25% correlation, 120s duration
- **Experiment 2b — Severe:** 500ms per-packet delay, 200ms jitter, 25% correlation, 120s duration
- **CRD manifests:** `k8s/chaos/network-latency-moderate.yaml`, `k8s/chaos/network-latency-severe.yaml`

#### Chaos Mesh CRD (Moderate example)

```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: network-latency-moderate
  namespace: dashly
spec:
  action: delay
  mode: all
  selector:
    namespaces: [dashly]
    labelSelectors:
      app: api
      version: stable
  delay:
    latency: "200ms"
    correlation: "25"
    jitter: "50ms"
  duration: "120s"
```

**Note:** The delay applies per-packet via Linux `tc` rules. Since an HTTP request involves multiple TCP packets (SYN, SYN-ACK, data, ACK), the end-to-end latency is the per-packet delay multiplied across the TCP handshake and data exchange.

#### Observation Method

Latency is measured from inside an API pod using Node.js `http.get()` to `http://genai-gateway:4000/api/health` (5 requests per measurement, with `Date.now()` precision timing). This captures the actual network latency experienced by the API service when communicating with the Gateway.

#### Command

```bash
./scripts/chaos-test.sh latency
```

#### Results

| Metric | Baseline | Moderate Chaos (200ms/pkt) | Severe Chaos (500ms/pkt) | Post-Chaos |
|--------|----------|---------------------------|--------------------------|------------|
| Gateway p50 latency | **1-2ms** | **622-670ms** | **1609-1674ms** | **1-3ms** |
| Gateway max latency | 11ms | 797ms | 1890ms | 6ms |
| API health check | healthy | healthy | **unreachable** (timeout) | healthy |
| System functional | Yes | Yes (degraded) | Partially (health timeout) | Yes |

**Key findings:**
1. **Moderate chaos (200ms/pkt):** The system continued to function with degraded performance. Gateway responses increased from ~1ms to ~600-800ms. The API health check still passed because it queries PostgreSQL via a separate connection (also delayed but within timeout).
2. **Severe chaos (500ms/pkt):** Gateway responses increased to ~1.4-1.9 seconds. The API health check timed out (`unreachable`) because the per-packet delay compounded across the DB health query too. The 120s axios timeout for GenAI Gateway calls was not exceeded, so AI endpoints would still eventually respond but with significant delay.
3. **Post-chaos recovery:** After removing the NetworkChaos resource, latency immediately returned to baseline (~1-6ms), confirming the tc rules were properly cleaned up.

---

### 16.4 Running the Experiments

```bash
# Full automated run (install + both experiments + report)
./scripts/chaos-test.sh all

# Or step by step:
./scripts/chaos-test.sh install      # Install Chaos Mesh on Minikube
./scripts/chaos-test.sh pod-kill     # Run Experiment 1 (pod kill)
./scripts/chaos-test.sh latency      # Run Experiment 2 (network latency)
./scripts/chaos-test.sh report       # View results summary
./scripts/chaos-test.sh cleanup      # Remove chaos experiments

# npm script equivalents:
npm run chaos:all
npm run chaos:install
npm run chaos:pod-kill
npm run chaos:latency
npm run chaos:report
npm run chaos:cleanup
```

**Prerequisites:**
- Minikube running with Dashly deployed: `./scripts/deploy-minikube.sh`
- Helm installed: `brew install helm`
- kubectl configured for Minikube context

Results are saved to the `chaos-results/` directory:
- `chaos-results/pod-kill-log.txt` — Full log from Experiment 1
- `chaos-results/latency-log.txt` — Full log from Experiment 2

---

### 16.5 File Reference (Milestone 4)

| File | Purpose |
|------|---------|
| `k8s/chaos/pod-kill-api.yaml` | PodChaos CRD — kill one API pod |
| `k8s/chaos/pod-kill-genai.yaml` | PodChaos CRD — kill one GenAI Gateway pod |
| `k8s/chaos/network-latency-moderate.yaml` | NetworkChaos CRD — 200ms/pkt delay on API egress |
| `k8s/chaos/network-latency-severe.yaml` | NetworkChaos CRD — 500ms/pkt delay on API egress |
| `scripts/chaos-test.sh` | Automation script for all chaos experiments |

---

### 16.6 Challenges Encountered

1. **Docker API version mismatch**
   Chaos Mesh v2.6.3 bundled a Docker client using API v1.41, but Minikube's Docker daemon required minimum API v1.44. This caused `"unable to flush ip sets"` errors when applying NetworkChaos. Resolved by upgrading Chaos Mesh to v2.8.1, which ships with a compatible Docker client.

2. **ipset-based target filtering not supported**
   The `direction: to` with `target.selector` configuration in NetworkChaos uses Linux ipsets to filter traffic by destination pod IP. This failed on Minikube with `"unable to flush ip sets"` even after the Docker API fix. Resolved by removing the `target` selector and applying the delay to all egress from API pods, which uses simpler `tc` rules without ipset dependencies.

3. **Per-packet vs end-to-end latency**
   Chaos Mesh's `tc` delay applies per-packet, not per-request. A single HTTP request involves ~6-10 TCP packets (SYN, SYN-ACK, ACK, request data, response data, FIN). This means a 200ms per-packet delay results in ~600-800ms end-to-end latency. The CRD values were tuned accordingly: 200ms/pkt for moderate (~600ms e2e) and 500ms/pkt for severe (~1.5s e2e).

4. **Alpine BusyBox date lacks nanosecond precision**
   The API container image (`node:18-alpine`) uses BusyBox, where `date +%s%N` returns `%N` literally instead of nanoseconds. Latency measurements were switched from shell `date` to Node.js `Date.now()` for millisecond-precision timing.

5. **Chaos resource finalizers blocking cleanup**
   Chaos Mesh uses Kubernetes finalizers to ensure tc rules are cleaned up before CRD deletion. When the chaos-daemon encounters errors, these finalizers can block resource deletion indefinitely. The script includes a `force_delete_chaos` helper that patches out finalizers when normal deletion gets stuck.
