const { query } = require('../config/database');

class Alert {
  static async create(data) {
    const { workspaceId, createdBy, name, description, adAccountId, metric, condition, threshold, comparisonPeriod, notificationChannels } = data;

    const result = await query(
      `INSERT INTO alerts (workspace_id, created_by, name, description, ad_account_id, metric, condition, threshold, comparison_period, notification_channels)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [workspaceId, createdBy, name, description, adAccountId, metric, condition, threshold, comparisonPeriod || 'previous_day', JSON.stringify(notificationChannels || ['email'])]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await query('SELECT * FROM alerts WHERE id = $1', [id]);
    return result.rows[0];
  }

  static async findByWorkspaceId(workspaceId) {
    const result = await query(
      `SELECT a.*, aa.account_name
       FROM alerts a
       LEFT JOIN ad_accounts aa ON aa.id = a.ad_account_id
       WHERE a.workspace_id = $1
       ORDER BY a.created_at DESC`,
      [workspaceId]
    );
    return result.rows;
  }

  static async findActive() {
    const result = await query(
      `SELECT a.*, aa.account_id, aa.platform, ot.access_token
       FROM alerts a
       LEFT JOIN ad_accounts aa ON aa.id = a.ad_account_id
       LEFT JOIN oauth_tokens ot ON ot.workspace_id = a.workspace_id AND ot.platform = aa.platform
       WHERE a.is_active = TRUE`
    );
    return result.rows;
  }

  static async update(id, data) {
    const { name, description, adAccountId, metric, condition, threshold, comparisonPeriod, notificationChannels, isActive } = data;
    const result = await query(
      `UPDATE alerts
       SET name = COALESCE($1, name), description = COALESCE($2, description),
           ad_account_id = COALESCE($3, ad_account_id), metric = COALESCE($4, metric),
           condition = COALESCE($5, condition), threshold = COALESCE($6, threshold),
           comparison_period = COALESCE($7, comparison_period),
           notification_channels = COALESCE($8, notification_channels),
           is_active = COALESCE($9, is_active), updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [name, description, adAccountId, metric, condition, threshold, comparisonPeriod, notificationChannels ? JSON.stringify(notificationChannels) : null, isActive, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    const result = await query('DELETE FROM alerts WHERE id = $1 RETURNING id', [id]);
    return result.rows[0];
  }

  static async updateLastTriggered(id) {
    await query('UPDATE alerts SET last_triggered_at = NOW() WHERE id = $1', [id]);
  }

  // Alert History
  static async createHistory(alertId, metricValue, thresholdValue, message) {
    const result = await query(
      `INSERT INTO alert_history (alert_id, metric_value, threshold_value, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [alertId, metricValue, thresholdValue, message]
    );
    return result.rows[0];
  }

  static async getHistory(alertId, limit = 50) {
    const result = await query(
      `SELECT * FROM alert_history WHERE alert_id = $1 ORDER BY triggered_at DESC LIMIT $2`,
      [alertId, limit]
    );
    return result.rows;
  }

  static async getRecentAlerts(workspaceId, limit = 20) {
    const result = await query(
      `SELECT ah.*, a.name as alert_name, a.metric
       FROM alert_history ah
       JOIN alerts a ON a.id = ah.alert_id
       WHERE a.workspace_id = $1
       ORDER BY ah.triggered_at DESC
       LIMIT $2`,
      [workspaceId, limit]
    );
    return result.rows;
  }

  static async acknowledgeAlert(historyId, userId) {
    const result = await query(
      `UPDATE alert_history
       SET acknowledged = TRUE, acknowledged_by = $1, acknowledged_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [userId, historyId]
    );
    return result.rows[0];
  }
}

module.exports = Alert;
