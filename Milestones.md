# Milestone 1: A/B Testing and Analytics Infrastructure

**Yale CPSC 4391 / CPSC 5391 / MGT 697**

This document describes the A/B testing and analytics infrastructure implemented for the analytics dashboard backend. It is written for an academic audience and focuses on correctness, clarity, and separation of concerns.

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

## 3. Experiment Configuration (`tests.json`)

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

## 4. One Concrete Experiment: KPI Scorecard Layout

- **Hypothesis**: An expanded KPI scorecard (B) will lead to more clicks on KPIs than the compact layout (A).
- **Setup**: User hits `GET /api/experiments/dashboard`. Assignment middleware assigns A or B (50/50) and stores it in a cookie. Exposure middleware logs (visitor_id, test_id, variant, timestamp). Response includes variant so the client can render the correct layout.
- **Measurement**: When the user clicks a KPI, the client calls `POST /api/experiments/events` with `{ event: 'kpi_click', testId: 'kpi_scorecard_layout', variant: 'A'|'B' }`. Event logging records (visitor_id, event_name, test_id, variant, timestamp).
- **Analysis**: Compare counts of `kpi_click` events by variant (and optionally conversion rate = events / exposures by variant) using `data/experiment-logs/events.json` and `exposures.json`.

---

## 5. Simulated User Testing and Observed Bias

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

## 6. Data Storage

- **Exposures**: `data/experiment-logs/exposures.json` — one object per exposure: `user_or_session_id`, `test_id`, `variant`, `timestamp`.
- **Events**: `data/experiment-logs/events.json` — one object per event: `user_or_session_id`, `event_name`, `test_id` (optional), `variant` (optional), `timestamp`.

Both are JSON arrays appended via the in-memory store and synced to disk. This format is suitable for analysis (e.g. counts by variant, conversion rates); it is not designed for production scale.

---

## 7. Challenges Encountered

1. **Route ordering**  
   Custom-data routes and workspace routes both use the path prefix `/workspaces`. The more specific path (`/workspaces/:id/custom-data`) had to be registered before the generic `/workspaces` so experiment and custom-data behavior are correct. This was documented in the route index.

2. **Cookie handling in the simulation**  
   Node’s built-in `fetch` does not maintain a cookie jar. The simulation had to capture `Set-Cookie` from the dashboard response (using `getSetCookie()` where available) and send a `Cookie` header on the event POST so the same visitor (and thus the same variant) is used for exposure and events.

3. **Exposure vs event logging**  
   Keeping exposure (automatic on view load) separate from event logging (triggered by route handlers on user action) required clear separation: exposure in middleware, events via an explicit `logEvent()` call from handlers.

---

## 8. Admin: Tracking A/B Results

Admins can track A/B results via an authenticated API:

- **GET /api/experiments/results** (requires auth)  
  Returns aggregated results per test: exposures and events per variant (A/B), plus conversion rate (events / exposures) per variant. Use this to see which variant is performing better.

---

## 9. File Reference

| File | Purpose |
|------|---------|
| `tests.json` | Experiment definitions (test_id, description, variants, target_event). |
| `src/services/experimentStore.js` | Loads tests; appends exposures/events; `getResults()` for admin aggregation. |
| `src/middleware/abAssignment.js` | Sticky A/B assignment; sets `req.abVariants` and `req.experimentVisitorId`. |
| `src/middleware/exposureLogging.js` | Logs exposure for given test IDs on the current request. |
| `src/services/eventLogger.js` | `logEvent(req, eventName, options)` for route handlers. |
| `src/routes/experimentRoutes.js` | Example routes: GET dashboard, POST events, GET config, GET results (admin). |
| `scripts/simulate-ab-users.js` | Simulates 500+ users with higher interaction probability for Variant B. |
