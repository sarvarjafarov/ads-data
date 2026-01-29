/**
 * Event Logger (for use from route handlers)
 *
 * Role: Records desirable user actions (e.g. KPI click, tooltip open).
 * Decoupled from assignment and exposure logic; triggered explicitly by route handlers.
 *
 * Each event log includes: user_or_session_id, event_name, test_id? (if applicable),
 * variant? (if applicable), timestamp.
 */

const { addEvent } = require('./experimentStore');

/**
 * Log a user action event. Call this from route handlers when an action occurs.
 *
 * @param {Object} req - Express request (must have experimentVisitorId and optionally abVariants)
 * @param {string} eventName - Name of the event (e.g. 'kpi_click', 'tooltip_open')
 * @param {Object} options - Optional: testId, variant (if event is tied to a specific experiment)
 */
function logEvent(req, eventName, options = {}) {
  const visitorId = req.experimentVisitorId || req.cookies?.ab_visitor_id || `anon_${Date.now()}`;
  const variants = req.abVariants || {};

  const record = {
    user_or_session_id: visitorId,
    event_name: eventName,
    timestamp: new Date().toISOString(),
  };

  if (options.testId) {
    record.test_id = options.testId;
    record.variant = options.variant ?? variants[options.testId] ?? null;
  }

  addEvent(record);
}

module.exports = { logEvent };
