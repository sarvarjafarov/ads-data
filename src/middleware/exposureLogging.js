/**
 * Exposure Logging Middleware
 *
 * Role: Logs when a user is exposed to a specific test variant.
 * Runs automatically for routes that participate in experiments (after assignment).
 *
 * Each exposure log includes: user_or_session_id, test_id, variant, timestamp.
 * This runs even if the user performs no action (exposure is logged on page/view load).
 *
 * @param {string[]} testIds - Which test IDs to log exposure for on this route (e.g. ['kpi_scorecard_layout', 'guided_onboarding'])
 */

const { addExposure } = require('../services/experimentStore');

function exposureLogging(testIds) {
  if (!Array.isArray(testIds) || testIds.length === 0) {
    return (req, res, next) => next();
  }

  return (req, res, next) => {
    const visitorId = req.experimentVisitorId;
    const variants = req.abVariants || {};

    if (!visitorId) {
      return next();
    }

    const timestamp = new Date().toISOString();

    testIds.forEach((testId) => {
      const variant = variants[testId];
      if (variant) {
        addExposure({
          user_or_session_id: visitorId,
          test_id: testId,
          variant,
          timestamp,
        });
      }
    });

    next();
  };
}

module.exports = exposureLogging;
