# What Each A/B Test Changes on Your Website

This table shows **what kind of change** each experiment makes: button only, one component, whole page, or flow across screens.

| Experiment | Type of change | What actually changes | Whole page? |
|------------|----------------|------------------------|-------------|
| **kpi_scorecard_layout** | **Layout** | Only the **KPI scorecard component** (the grid of metric cards). Variant A = compact (4 small cards in a row). Variant B = expanded (2 larger cards per row with more emphasis). Rest of the dashboard is the same. | No — one component |
| **guided_onboarding** | **Onboarding flow** | The **onboarding experience** for new users: A = minimal (no step indicator, no tooltips). B = guided (e.g. “Step 1 of 3”, tooltip hints). Can affect one or more screens during first use. | Can span multiple screens, but it’s the flow, not “whole site” |
| **pricing_cta_upgrade** | **Button (CTA)** | Only the **main CTA button text** on the pricing page. A = standard (e.g. “Start Free Trial”). B = value-focused (e.g. “Get full access”). Layout, copy, and rest of the page stay the same. | No — button/copy only |

---

## Summary

- **Button:** 1 experiment — pricing CTA (text of one button).
- **Layout:** 1 experiment — KPI scorecard (size/layout of the metric cards).
- **Flow:** 1 experiment — onboarding (minimal vs guided with steps/tooltips).

**None of the tests change the whole page or whole site**; each changes a specific element or flow so you can isolate the effect.

---

## Where this lives in the app

- **tests.json** (root): each experiment has optional `change_type` and `what_changes`; **GET /api/experiments/config** returns them.
- **/experiment-demo**: shows your assigned variant and mockups for the dashboard/onboarding tests; pricing test is CTA copy on `/pricing`.
