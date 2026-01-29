/**
 * A/B Assignment Middleware
 *
 * Role: Assigns each user/session to a variant per experiment with sticky assignment.
 * Must run before route handling so req.abVariants is available to handlers and exposure logging.
 *
 * - Reads tests from tests.json.
 * - Uses a persistent cookie (or session ID) so the same visitor gets the same variant.
 * - Sets req.abVariants = { test_id: variant, ... } and req.experimentVisitorId for logging.
 */

const { getTestsConfig } = require('../services/experimentStore');

const VISITOR_COOKIE_NAME = 'ab_visitor_id';
const VARIANT_COOKIE_PREFIX = 'ab_';
const COOKIE_MAX_AGE_DAYS = 30;

/**
 * Generate a simple session/visitor ID (for sticky assignment when no cookie yet).
 */
function generateVisitorId() {
  return `v_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Pick A or B with equal probability (50/50).
 */
function randomVariant() {
  return Math.random() < 0.5 ? 'A' : 'B';
}

/**
 * A/B assignment middleware. Assigns variants per test and attaches to req.
 * Expects cookie-parser to have run (so req.cookies is set).
 */
function abAssignment(req, res, next) {
  const config = getTestsConfig();
  const experiments = config.experiments || [];

  // Sticky visitor ID: use existing cookie or set new one
  let visitorId = req.cookies && req.cookies[VISITOR_COOKIE_NAME];
  if (!visitorId) {
    visitorId = generateVisitorId();
    res.cookie(VISITOR_COOKIE_NAME, visitorId, {
      maxAge: COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
    });
  }

  req.experimentVisitorId = visitorId;
  req.abVariants = {};

  experiments.forEach((test) => {
    const testId = test.test_id;
    const cookieName = `${VARIANT_COOKIE_PREFIX}${testId}`;
    let variant = req.cookies && req.cookies[cookieName];

    if (!variant || (variant !== 'A' && variant !== 'B')) {
      variant = randomVariant();
      res.cookie(cookieName, variant, {
        maxAge: COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax',
      });
    }

    req.abVariants[testId] = variant;
  });

  next();
}

module.exports = abAssignment;
