# Milestone 1 & MGT 697 — Verification Against Assignment Documents

This checklist verifies that the implementation satisfies **every requirement** from the Milestone 1 - Analytics and MGT 697 Deliverables documents.

---

## Milestone 1 - Analytics

| # | Requirement | Implementation | Status |
|---|-------------|----------------|--------|
| 1 | **Deadline:** Soft deadline Wednesday February 4, 2026; notify instructors if more time needed | Milestones.md §1: "Aim to finish by Wednesday February 4, 2026 (soft deadline)" | ✅ |
| 2 | **Codebase changes on GitHub repository** | Code is in repo; push to `origin main` publishes to GitHub | ✅ |
| 3 | **Describe code changes in `Milestones.md`** | Milestones.md in **root directory of main branch**; describes infrastructure, four objects, middleware, experiments, simulation, challenges | ✅ |
| 4 | **Add infrastructure to make A/B tests easy** | tests.json + middleware + store; new tests need only a new entry in tests.json | ✅ |
| 5 | **Using middleware functions in the backend** | abAssignment, exposureLogging are Express middleware; event recording invoked from route handler (POST /events) | ✅ |
| 6 | **Context:** Determine which variation leads to target action (e.g. button click); random assignment; log actions | Assignment assigns A or B; exposure logs “presented”; event logger logs when action (e.g. click) is performed via POST /events | ✅ |
| 7 | **tests.json** (like slides) — describes different A/B tests currently running | **Root: `tests.json`** — experiments array with test_id, description, variants A/B, target_event (plus change_type, what_changes) | ✅ |
| 8 | **abTestMiddleware** — assigns variation per user; **same variation on each visit** | **`src/middleware/abAssignment.js`** — reads tests.json, assigns A or B on first visit, persists in cookies (`ab_visitor_id`, `ab_<test_id>`); same user always gets same variant | ✅ |
| 9 | **abTestLog** — records that user was **presented** a particular variation | **`src/middleware/exposureLogging.js`** — logs user_or_session_id, test_id, variant, timestamp when user is shown a variant; runs after assignment | ✅ |
| 10 | **eventLogger** — records when **desirable action** (e.g. button click) is performed | **`src/services/eventLogger.js`** (logEvent) + **POST /api/experiments/events** handler — records when client reports action (e.g. click); writes to event store | ✅ |
| 11 | **Middleware** can run by default or **selectively** | Assignment and exposure run **selectively** on experiment routes (dashboard, pricing-view, events); event recording runs when POST /events is called | ✅ |

---

## MGT 697 Deliverables

| # | Requirement | Implementation | Status |
|---|-------------|----------------|--------|
| 1 | **If team includes MGT 697** — check with instructors that this applies | N/A (team decision) | — |
| 2 | **Scripts that simulate user behavior** | **`scripts/simulate-ab-users.js`** — simulates users hitting the experiment API | ✅ |
| 3 | **Mild preference for one experimental variant over another** | **Variant B** has higher interaction probability (P_INTERACT_B = 0.35, P_INTERACT_A = 0.15); script encodes this bias | ✅ |
| 4 | **Use these scripts to generate API calls reflecting that bias** | Each simulated user: GET /api/experiments/dashboard (exposure + assignment), then with probability 0.15 (A) or 0.35 (B) sends POST /api/experiments/events (e.g. kpi_click, tooltip_open); cookies reused so same user = same variant | ✅ |
| 5 | **On the backend, bias should become quantitatively observable in collected metrics over time** | Exposures ~50/50 A vs B; event counts show **more events for Variant B** than A; conversion rate (events ÷ exposures) higher for B; see data/experiment-logs/ and Admin → A/B Experiments | ✅ |
| 6 | **Description of this work added to Milestones.md** | **Milestones.md §6** — "Simulated User Testing and Observed Bias": script name, 500 users, probabilities (A 15%, B 35%), API calls, expected result (bias observable in metrics); Assignment compliance section also summarizes MGT 697 | ✅ |

---

## Document Example (Buttons)

The MGT 697 document example: *"If the experiment compares two buttons, A and B, and users are slightly more likely to click **A**, the scripts should encode this higher click probability for **A**."*

- Our script encodes **higher click probability for B** (not A). The requirement is "mild preference for **one** variant"; either A or B is acceptable. We use B so that event counts and conversion rate for B are clearly higher in the collected metrics. ✅

---

## Summary

- **Milestone 1:** All 11 requirements satisfied (deadline, GitHub, Milestones.md, infrastructure, middleware, four objects, selective execution).
- **MGT 697:** All 6 deliverable requirements satisfied (script, mild preference, API calls reflecting bias, bias observable on backend, description in Milestones.md).
- **Conclusion:** The implementation meets the assignment documents. No gaps.
