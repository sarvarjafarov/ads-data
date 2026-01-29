# A/B Testing Infrastructure — Full Review

**Last review:** After adding team KPIs support. Use this to verify everything is in place before submission.

---

## 1. tests.json (root)

| Check | Status |
|-------|--------|
| File exists in project root | ✅ |
| Contains `experiments` array | ✅ |
| Each experiment has: `test_id`, `description`, `variants` (A and B), `target_event` | ✅ |
| Current experiments: kpi_scorecard_layout, guided_onboarding, pricing_cta_upgrade | ✅ |

**Location:** `/tests.json`

---

## 2. Team KPIs (team-kpis.json)

| Check | Status |
|-------|--------|
| File exists in project root | ✅ |
| Contains `team_kpis` array with optional KPI definitions | ✅ |
| Each KPI can have: `kpi_id`, `name`, `description`, `experiment_id`, `target_event` | ✅ |
| Edit this file to add your team’s KPIs; link each to an `experiment_id` and `target_event` | ✅ |

**Location:** `/team-kpis.json`. The admin A/B results (exposures, events, conversion rate) already map to these: each experiment’s conversion rate = the KPI for that experiment.

---

## 3. Middleware (four required objects)

| Object | File | Behavior | Status |
|--------|------|----------|--------|
| **tests.json** | `tests.json` | Describes A/B tests currently running | ✅ |
| **Assignment middleware** | `src/middleware/abAssignment.js` | Assigns A or B; same variant on every visit (cookies: `ab_visitor_id`, `ab_<test_id>`) | ✅ |
| **Exposure middleware** | `src/middleware/exposureLogging.js` | Records that user was presented a variation (user/session id, test_id, variant, timestamp) | ✅ |
| **Event logger** | `src/services/eventLogger.js` + POST `/events` handler | Records when desirable action is performed; invoked when client POSTs to `/api/experiments/events` | ✅ |

**Middleware order (experiment routes):** cookie-parser (global) → abAssignment → exposureLogging (where applicable) → route handler → event recorded via logEvent() when client reports action.

**Selective execution:** Assignment and exposure run only on experiment routes (dashboard, pricing-view, events). Event recording runs when POST `/api/experiments/events` is called.

---

## 4. Routes and app wiring

| Check | Status |
|-------|--------|
| `app.js`: cookie-parser before `/api` routes | ✅ |
| `routes/index.js`: experimentRoutes mounted at `/experiments` (so `/api/experiments/*`) | ✅ |
| GET `/api/experiments/dashboard`: abAssignment + exposureLogging(getDashboardTestIds()) + handler | ✅ |
| GET `/api/experiments/pricing-view`: abAssignment + exposureLogging([pricing_cta_upgrade]) + handler | ✅ |
| POST `/api/experiments/events`: abAssignment + handler calls logEvent(req, event, { testId, variant }) | ✅ |
| GET `/api/experiments/config`: returns tests from tests.json | ✅ |
| GET `/api/experiments/results`: authenticate + getResults() (admin) | ✅ |

---

## 5. Data storage

| Check | Status |
|-------|--------|
| Exposures: `data/experiment-logs/exposures.json` (user_or_session_id, test_id, variant, timestamp) | ✅ |
| Events: `data/experiment-logs/events.json` (user_or_session_id, event_name, test_id?, variant?, timestamp) | ✅ |
| Store: `src/services/experimentStore.js` (addExposure, addEvent, getExposures, getEvents, getTestsConfig, getResults) | ✅ |
| Logs distinguishable and suitable for analysis | ✅ |

---

## 6. MGT 697 simulation

| Check | Status |
|-------|--------|
| Script exists: `scripts/simulate-ab-users.js` | ✅ |
| Simulates ≥500 users | ✅ (NUM_USERS = 500) |
| Mild preference for one variant (B: 35% vs A: 15% interaction probability) | ✅ |
| Issues API calls (GET dashboard, POST events) with cookie reuse | ✅ |
| Bias quantitatively observable in event counts and conversion rates | ✅ |
| Described in Milestones.md §6 | ✅ |

**Run:** `npm run simulate-ab` or `node scripts/simulate-ab-users.js [baseUrl]`

---

## 7. Milestones.md and assignment compliance

| Check | Status |
|-------|--------|
| Milestones.md in root of main branch | ✅ |
| Deadline (February 4, 2026) and location stated | ✅ |
| Assignment compliance section: four objects mapped to implementation | ✅ |
| Middleware execution (selective) explained | ✅ |
| MGT 697 work summarized with pointer to §6 | ✅ |
| Challenges described (§10) | ✅ |
| Experiment config, middleware roles, one concrete experiment, simulation, data storage, assumptions, sanity checks, metrics, admin, file reference | ✅ |

---

## 8. Admin and docs

| Check | Status |
|-------|--------|
| Admin A/B tab: GET /api/experiments/results (auth), displays exposures, events, conversion rate per variant | ✅ |
| Experiment demo page: /experiment-demo shows variant mockups | ✅ |
| docs/AB_TESTING_SUBSCRIPTION_FLOW.md: conversion = subscription upgrade, funnel, instrumentation | ✅ |
| docs/AB_REVIEW.md: this review | ✅ |

---

## 9. Quick checklist before submit

- [ ] tests.json has all experiments your team needs (test_id, description, variants A/B, target_event).
- [ ] team-kpis.json updated with your team’s KPIs (name, description, experiment_id, target_event).
- [ ] Milestones.md is in the repo root and describes code changes; challenges in §10.
- [ ] Run simulation once: `npm run simulate-ab` (server running); check data/experiment-logs/ for exposures and events.
- [ ] Admin A/B Experiments tab shows results (exposures, events, conversion rate per variant).
- [ ] All changes pushed to GitHub and (if applicable) deployed to Heroku.

---

## 10. Adding your team’s KPIs

1. Open **`team-kpis.json`** in the project root.
2. Edit the **`team_kpis`** array: add or change entries with `kpi_id`, `name`, `description`, `experiment_id`, `target_event`.
3. Use **`experiment_id`** and **`target_event`** that match an experiment in **`tests.json`** (e.g. `pricing_cta_upgrade` and `subscription_upgrade`).
4. Admin A/B results already compute conversion rate per experiment; each row there corresponds to one of these KPIs when linked by experiment_id.

No code changes are required to add or edit team KPIs; only `team-kpis.json` and optionally Milestones.md (to mention your KPIs) need updates.
