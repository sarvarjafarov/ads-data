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
const { logEvent } = require('../services/eventLogger');
const { getTestsConfig } = require('../services/experimentStore');

const router = express.Router();

// Test IDs that apply to the dashboard view (used for exposure logging)
const DASHBOARD_TEST_IDS = ['kpi_scorecard_layout', 'guided_onboarding'];

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
  exposureLogging(DASHBOARD_TEST_IDS),
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
 * GET /api/experiments/config
 *
 * Returns active experiments (for clients or simulation).
 */
router.get('/config', (req, res) => {
  const config = getTestsConfig();
  res.json({ success: true, ...config });
});

module.exports = router;
