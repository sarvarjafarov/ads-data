/**
 * Example experiment API routes.
 *
 * Demonstrates end-to-end execution:
 * - Serving a dashboard view with experiment variants (assignment + exposure)
 * - Logging exposure automatically when the dashboard is loaded
 * - Logging user interaction events (e.g. KPI click) via POST
 */

const express = require('express');
const abAssignment = require('../middleware/abAssignment');
const exposureLogging = require('../middleware/exposureLogging');
const authenticate = require('../middleware/auth');
const { logEvent } = require('../services/eventLogger');
const { getTestsConfig, getResults } = require('../services/experimentStore');

const router = express.Router();

// Test IDs are derived from tests.json so new experiments can be added without code changes
function getDashboardTestIds() {
  const config = getTestsConfig();
  return (config.experiments || []).map((e) => e.test_id);
}

/**
 * GET /api/experiments/dashboard
 *
 * Serves dashboard view with experiment variants.
 * Middleware order: 1) Assignment (sticky variant per user), 2) Exposure (log exposure for this view).
 * Response includes variant info so the client can render the correct layout/onboarding.
 */
router.get(
  '/dashboard',
  abAssignment,
  exposureLogging(getDashboardTestIds()),
  (req, res) => {
    const config = getTestsConfig();
    const variants = req.abVariants || {};

    const variantDescriptions = {};
    (config.experiments || []).forEach((exp) => {
      const v = variants[exp.test_id] || 'A';
      variantDescriptions[exp.test_id] = {
        variant: v,
        description: exp.variants[v] || exp.variants.A,
      };
    });

    res.json({
      success: true,
      variants: req.abVariants,
      variantDescriptions,
      message: 'Dashboard view with experiment variants; exposure has been logged.',
    });
  }
);

/**
 * POST /api/experiments/events
 *
 * Logs a user interaction event (e.g. KPI click, tooltip open).
 * Decoupled from assignment/exposure; triggered by client when action occurs.
 * Body: { event: string, testId?: string, variant?: string }
 */
router.post(
  '/events',
  abAssignment,
  (req, res) => {
    const { event, testId, variant } = req.body || {};

    if (!event || typeof event !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid "event" in body',
      });
    }

    logEvent(req, event, { testId, variant });

    res.json({
      success: true,
      message: 'Event logged',
      event,
      testId: testId || null,
      variant: variant || (testId ? req.abVariants?.[testId] : null) || null,
    });
  }
);

/**
 * GET /api/experiments/pricing-view
 *
 * For subscription-upgrade A/B flow: call when user lands on /pricing.
 * Assigns variant (if not already), logs exposure for pricing_cta_upgrade, returns variant
 * so the frontend can show different CTA (e.g. A = "Start Free Trial", B = "Get full access").
 * Conversion = subscription_upgrade (log via POST /api/experiments/events when user upgrades).
 */
const PRICING_EXPERIMENT_ID = 'pricing_cta_upgrade';
router.get(
  '/pricing-view',
  abAssignment,
  exposureLogging([PRICING_EXPERIMENT_ID]),
  (req, res) => {
    const variant = req.abVariants?.[PRICING_EXPERIMENT_ID] || 'A';
    const config = getTestsConfig();
    const exp = (config.experiments || []).find((e) => e.test_id === PRICING_EXPERIMENT_ID);
    const description = exp?.variants?.[variant] || (variant === 'A' ? 'standard_cta' : 'value_cta');

    res.json({
      success: true,
      testId: PRICING_EXPERIMENT_ID,
      variant,
      description,
      message: 'Exposure logged for pricing view; log subscription_upgrade when user completes upgrade.',
    });
  }
);

/**
 * GET /api/experiments/config
 *
 * Returns active experiments (for clients or simulation).
 */
router.get('/config', (req, res) => {
  const config = getTestsConfig();
  res.json({ success: true, ...config });
});

/**
 * GET /api/experiments/results
 *
 * Admin-only: aggregated A/B results (exposures, events, conversion rate per variant).
 * Requires authentication so only admins / logged-in users can track results.
 */
router.get('/results', authenticate, (req, res) => {
  const data = getResults();
  res.json({ success: true, ...data });
});

module.exports = router;
