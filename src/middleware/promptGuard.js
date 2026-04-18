/**
 * Prompt Injection Guard Middleware (Milestone 7)
 *
 * Usage:
 *   router.post('/endpoint',
 *     promptGuard({ fields: [{ path: 'body.prompt' }], profile: 'strict' }),
 *     handler
 *   );
 */

const { guardInput, PROFILES } = require('../services/promptInjectionGuard');
const PromptGuardLog = require('../models/PromptGuardLog');

function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function promptGuard({ fields, profile = 'strict' } = {}) {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error('promptGuard: `fields` array is required');
  }
  if (!PROFILES[profile]) {
    throw new Error(`promptGuard: unknown profile "${profile}"`);
  }

  return async function promptGuardMiddleware(req, res, next) {
    // Debug/demo toggle: set BYPASS_PROMPT_GUARD=1 to disable the guard for baseline red-team runs
    if (process.env.BYPASS_PROMPT_GUARD === '1') {
      req.promptGuard = { results: [], verdict: 'bypassed' };
      return next();
    }
    const endpoint = `${req.method} ${req.baseUrl || ''}${req.route?.path || req.path || ''}`;
    const ip = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.headers?.['user-agent'] || null;
    const userId = req.user?.id || null;

    const results = [];

    for (const fieldSpec of fields) {
      const fieldPath = fieldSpec.path;
      const fieldProfile = fieldSpec.profile || profile;
      const value = getPath(req, fieldPath);

      if (value == null || (typeof value === 'string' && !value.trim())) {
        continue;
      }

      const stringValue = String(value);
      const guardResult = await guardInput(stringValue, fieldProfile);
      results.push({ fieldPath, ...guardResult });

      // Log every check (blocked AND allowed-after-ambiguous) for audit
      const shouldLog = !guardResult.allowed || guardResult.layer === 2;
      let detectionId = null;

      if (shouldLog) {
        try {
          const logRow = await PromptGuardLog.record({
            userId,
            endpoint,
            fieldPath,
            input: stringValue,
            verdict: guardResult.allowed ? 'allowed_ambiguous' : 'blocked',
            layer: guardResult.layer,
            ruleMatched: guardResult.rule,
            llmReason: guardResult.reason,
            latencyMs: guardResult.latencyMs,
            ip,
            userAgent,
          });
          detectionId = logRow?.detection_id;
        } catch (err) {
          // Log write failed — non-fatal, proceed
          console.error('[promptGuard] Failed to write audit log:', err.message);
        }
      }

      if (!guardResult.allowed && PROFILES[fieldProfile].rejectOnBlock) {
        return res.status(400).json({
          success: false,
          message: 'Request blocked by prompt-injection guard',
          code: 'PROMPT_INJECTION_DETECTED',
          detectionId,
          field: fieldPath,
        });
      }
    }

    req.promptGuard = { results, verdict: 'allowed' };
    next();
  };
}

module.exports = promptGuard;
