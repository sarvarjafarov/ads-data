const crypto = require('crypto');
const { query } = require('../config/database');

function sha256(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

class PromptGuardLog {
  static async record({
    userId,
    endpoint,
    fieldPath,
    input,
    verdict,
    layer,
    ruleMatched,
    llmReason,
    latencyMs,
    ip,
    userAgent
  }) {
    const inputHash = sha256(input);
    const inputPreview = input.slice(0, 200);
    const inputLength = input.length;

    const result = await query(
      `INSERT INTO prompt_guard_log
         (user_id, endpoint, field_path, input_hash, input_preview, input_length,
          verdict, layer, rule_matched, llm_reason, latency_ms, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING detection_id, created_at`,
      [
        userId || null,
        endpoint,
        fieldPath,
        inputHash,
        inputPreview,
        inputLength,
        verdict,
        layer || null,
        ruleMatched || null,
        llmReason || null,
        latencyMs || null,
        ip || null,
        userAgent || null
      ]
    );

    return result.rows[0];
  }

  static async getRecent({ limit = 50, verdict = null } = {}) {
    if (verdict) {
      const result = await query(
        `SELECT * FROM prompt_guard_log WHERE verdict = $1 ORDER BY created_at DESC LIMIT $2`,
        [verdict, limit]
      );
      return result.rows;
    }
    const result = await query(
      `SELECT * FROM prompt_guard_log ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  static async getStats({ since } = {}) {
    const sinceClause = since ? 'WHERE created_at >= $1' : '';
    const params = since ? [since] : [];
    const result = await query(
      `SELECT verdict, COUNT(*)::int AS count
       FROM prompt_guard_log ${sinceClause}
       GROUP BY verdict`,
      params
    );
    return result.rows;
  }
}

module.exports = PromptGuardLog;
