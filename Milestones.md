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
- **Simple file-based storage** (`data/experiment-logs/exposures.json`, `events.json`) suitable for analysis; production scalability is not required.

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
- **Analysis**: Compare counts of `kpi_click` events by variant (and optionally conversion rate = events / exposures by variant) using `data/experiment-logs/events.json` and `exposures.json`.

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

- **Exposures**: `data/experiment-logs/exposures.json` — one object per exposure: `user_or_session_id`, `test_id`, `variant`, `timestamp`.
- **Events**: `data/experiment-logs/events.json` — one object per event: `user_or_session_id`, `event_name`, `test_id` (optional), `variant` (optional), `timestamp`.

Both are JSON arrays appended via the in-memory store and synced to disk. This format is suitable for analysis (e.g. counts by variant, conversion rates); it is not designed for production scale.

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
