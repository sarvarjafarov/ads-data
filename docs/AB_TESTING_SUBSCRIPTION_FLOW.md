# A/B Testing Flow for Subscription Upgrade (Business Conversion)

**Primary business metric: conversion = subscription upgrade.**

This document describes how to run A/B tests so that **conversion rate** in the system maps directly to **users upgrading their subscription**, and how to instrument the flow end-to-end.

---

## 1. Business goal

- **Metric:** Subscription upgrade rate (users who see a variant and later complete an upgrade).
- **Conversion:** One user = one exposure (saw pricing/variant) → one conversion if they complete a subscription upgrade.
- **Conversion rate per variant:** `subscription_upgrade` events ÷ exposures for that variant (A or B).

---

## 2. Funnel (recommended)

```
User lands on /pricing
    → Exposure logged (GET /api/experiments/pricing-view)
    → User sees variant A or B (e.g. different CTA copy)
    → [Optional] User clicks "Upgrade" / CTA → log upgrade_click (optional)
    → User completes upgrade (payment / plan change)
    → Log subscription_upgrade (POST /api/experiments/events)
```

- **Exposure:** When the user sees the pricing page with a variant (logged once per visit via `pricing-view`).
- **Conversion event:** `subscription_upgrade` — fire **only when the user actually completes** the upgrade (e.g. after successful payment or plan change in your app).

---

## 3. Experiment: pricing CTA (tests.json)

- **test_id:** `pricing_cta_upgrade`
- **description:** Tests which pricing CTA leads to more subscription upgrades.
- **variants:**
  - **A (standard_cta):** e.g. "Start Free Trial"
  - **B (value_cta):** e.g. "Get full access" or "Unlock Pro features"
- **target_event:** `subscription_upgrade`

Adding this experiment to `tests.json` makes it appear in assignment, exposure, and in **Admin → A/B Experiments** results. Conversion rate in the admin panel = subscription upgrades ÷ exposures per variant.

---

## 4. Instrumentation (what to implement)

### 4.1 When user sees the pricing page

- **Option A (recommended):** On load of `/pricing`, the frontend calls:
  - `GET /api/experiments/pricing-view` (with credentials so cookies are sent).
- **Effect:** Server assigns variant (if not already), logs **exposure** for `pricing_cta_upgrade`, and returns `{ variant, description }`.
- **Frontend:** Use `variant` / `description` to show the correct CTA (e.g. A = "Start Free Trial", B = "Get full access").

### 4.2 When user completes subscription upgrade

- After the user successfully upgrades (e.g. payment confirmed, plan updated in your backend), the frontend or backend should call:
  - `POST /api/experiments/events`
  - Body: `{ "event": "subscription_upgrade", "testId": "pricing_cta_upgrade", "variant": "A" }` (or `"B"` — use the same variant the user saw on pricing; if you have it in session or from a prior `pricing-view` response, send it; otherwise the server can infer from cookies via assignment).
- **Important:** Send this only **once per actual upgrade** (e.g. from the success page or from your backend after completing the upgrade).

### 4.3 Optional: funnel step (upgrade click)

- When the user clicks the main upgrade CTA (e.g. "Start Free Trial" or "Get full access"), you can log:
  - `POST /api/experiments/events` with `event: "upgrade_click"`, `testId: "pricing_cta_upgrade"`.
- This is optional; the **primary conversion** for the business remains `subscription_upgrade`.

---

## 5. How to read results (admin)

- In **Admin → A/B Experiments**, the row for **pricing_cta_upgrade** shows:
  - **Exposures:** Users who hit the pricing view (and thus saw variant A or B).
  - **Events:** Count of `subscription_upgrade` events per variant.
  - **Conversion rate:** Events ÷ Exposures per variant (this is **subscription upgrade rate** for that variant).

So you can compare:
- Variant A (standard_cta): e.g. 5% conversion = 5% of users who saw A upgraded.
- Variant B (value_cta): e.g. 8% conversion = 8% of users who saw B upgraded.

---

## 6. Flow summary (checklist)

| Step | Who | Action |
|------|-----|--------|
| 1 | Frontend (pricing page) | On load: `GET /api/experiments/pricing-view` → exposure logged, variant returned. |
| 2 | Frontend (pricing page) | Render CTA per variant (e.g. A = "Start Free Trial", B = "Get full access"). |
| 3 | Backend/Frontend (after upgrade) | On upgrade success: `POST /api/experiments/events` with `event: "subscription_upgrade"`, `testId: "pricing_cta_upgrade"`. |
| 4 | Admin | View **Admin → A/B Experiments**; conversion rate = subscription upgrade rate per variant. |

---

## 7. Why this makes sense (business analyst view)

- **One primary metric:** Subscription upgrade — no ambiguity; conversion = business outcome.
- **Clear funnel:** See pricing (exposure) → optional click → complete upgrade (conversion).
- **Sticky assignment:** Same user always sees the same variant (cookie), so we measure true effect of the CTA, not noise.
- **Scalable:** Add more experiments (e.g. pricing layout, plan order) by adding entries to `tests.json` and new exposure routes or reusing `pricing-view` with more test IDs if needed.
