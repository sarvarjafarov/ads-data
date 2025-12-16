const { query } = require('../config/database');

class Dashboard {
  static async create(data) {
    const { name, workspaceId, createdBy, description, layout, filters, dateRange } = data;

    const result = await query(
      `INSERT INTO dashboards (name, workspace_id, created_by, description, layout, filters, date_range)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, workspace_id, description, layout, filters, date_range, created_at, updated_at`,
      [
        name,
        workspaceId,
        createdBy,
        description || null,
        JSON.stringify(layout || []),
        JSON.stringify(filters || {}),
        JSON.stringify(dateRange || { type: 'last_30_days' })
      ]
    );

    return result.rows[0];
  }

  static async findById(id) {
    const result = await query(
      `SELECT id, name, workspace_id, description, layout, filters, date_range, created_at, updated_at
       FROM dashboards
       WHERE id = $1`,
      [id]
    );

    return result.rows[0];
  }

  static async findByWorkspaceId(workspaceId) {
    const result = await query(
      `SELECT id, name, workspace_id, description, layout, filters, date_range, created_at, updated_at
       FROM dashboards
       WHERE workspace_id = $1
       ORDER BY created_at DESC`,
      [workspaceId]
    );

    return result.rows;
  }

  static async update(id, data) {
    const { name, description, layout, filters, dateRange } = data;

    const result = await query(
      `UPDATE dashboards
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           layout = COALESCE($3, layout),
           filters = COALESCE($4, filters),
           date_range = COALESCE($5, date_range),
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, name, workspace_id, description, layout, filters, date_range, created_at, updated_at`,
      [
        name,
        description,
        layout ? JSON.stringify(layout) : null,
        filters ? JSON.stringify(filters) : null,
        dateRange ? JSON.stringify(dateRange) : null,
        id
      ]
    );

    return result.rows[0];
  }

  static async delete(id) {
    // Delete associated widgets first
    await query('DELETE FROM dashboard_widgets WHERE dashboard_id = $1', [id]);

    const result = await query(
      'DELETE FROM dashboards WHERE id = $1 RETURNING id',
      [id]
    );

    return result.rows[0];
  }

  static async getWithWidgets(id) {
    // Get dashboard
    const dashboard = await this.findById(id);
    if (!dashboard) return null;

    // Get widgets
    const widgetsResult = await query(
      `SELECT id, dashboard_id, widget_type, title, description, position, data_source, chart_config, filters, created_at, updated_at
       FROM dashboard_widgets
       WHERE dashboard_id = $1
       ORDER BY created_at`,
      [id]
    );

    dashboard.widgets = widgetsResult.rows;
    return dashboard;
  }

  static async addWidget(dashboardId, widgetData) {
    const { widgetType, title, description, position, dataSource, chartConfig, filters } = widgetData;

    const result = await query(
      `INSERT INTO dashboard_widgets (dashboard_id, widget_type, title, description, position, data_source, chart_config, filters)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, dashboard_id, widget_type, title, description, position, data_source, chart_config, filters, created_at, updated_at`,
      [
        dashboardId,
        widgetType,
        title,
        description || null,
        JSON.stringify(position || { x: 0, y: 0, w: 4, h: 4 }),
        JSON.stringify(dataSource || {}),
        JSON.stringify(chartConfig || {}),
        JSON.stringify(filters || {})
      ]
    );

    return result.rows[0];
  }

  static async updateWidget(widgetId, widgetData) {
    const { widgetType, title, description, position, dataSource, chartConfig, filters } = widgetData;

    const result = await query(
      `UPDATE dashboard_widgets
       SET widget_type = COALESCE($1, widget_type),
           title = COALESCE($2, title),
           description = COALESCE($3, description),
           position = COALESCE($4, position),
           data_source = COALESCE($5, data_source),
           chart_config = COALESCE($6, chart_config),
           filters = COALESCE($7, filters),
           updated_at = NOW()
       WHERE id = $8
       RETURNING id, dashboard_id, widget_type, title, description, position, data_source, chart_config, filters, created_at, updated_at`,
      [
        widgetType,
        title,
        description,
        position ? JSON.stringify(position) : null,
        dataSource ? JSON.stringify(dataSource) : null,
        chartConfig ? JSON.stringify(chartConfig) : null,
        filters ? JSON.stringify(filters) : null,
        widgetId
      ]
    );

    return result.rows[0];
  }

  static async deleteWidget(widgetId) {
    const result = await query(
      'DELETE FROM dashboard_widgets WHERE id = $1 RETURNING id',
      [widgetId]
    );

    return result.rows[0];
  }

  static async getWidget(widgetId) {
    const result = await query(
      `SELECT id, dashboard_id, widget_type, title, description, position, data_source, chart_config, filters, created_at, updated_at
       FROM dashboard_widgets
       WHERE id = $1`,
      [widgetId]
    );

    return result.rows[0];
  }

  // Share management methods
  static async createShareLink(dashboardId, createdBy, options = {}) {
    const crypto = require('crypto');
    const shareToken = crypto.randomBytes(32).toString('hex');

    const { expiresAt, password, allowExport = true } = options;
    let passwordHash = null;

    if (password) {
      const bcrypt = require('bcryptjs');
      passwordHash = await bcrypt.hash(password, 10);
    }

    const result = await query(
      `INSERT INTO dashboard_shares (dashboard_id, share_token, created_by, expires_at, password_hash, allow_export)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, dashboard_id, share_token, expires_at, is_active, allow_export, view_count, created_at`,
      [dashboardId, shareToken, createdBy, expiresAt || null, passwordHash, allowExport]
    );

    return result.rows[0];
  }

  static async getShareLinks(dashboardId) {
    const result = await query(
      `SELECT id, dashboard_id, share_token, expires_at, is_active, allow_export, view_count, last_viewed_at, created_at
       FROM dashboard_shares
       WHERE dashboard_id = $1
       ORDER BY created_at DESC`,
      [dashboardId]
    );

    return result.rows;
  }

  static async getByShareToken(shareToken) {
    // Get share link details
    const shareResult = await query(
      `SELECT ds.*, d.name as dashboard_name, d.workspace_id
       FROM dashboard_shares ds
       JOIN dashboards d ON d.id = ds.dashboard_id
       WHERE ds.share_token = $1 AND ds.is_active = TRUE`,
      [shareToken]
    );

    if (shareResult.rows.length === 0) return null;

    const share = shareResult.rows[0];

    // Check if expired
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return null;
    }

    // Get dashboard with widgets
    const dashboard = await this.getWithWidgets(share.dashboard_id);

    // Update view count
    await query(
      `UPDATE dashboard_shares
       SET view_count = view_count + 1, last_viewed_at = NOW()
       WHERE id = $1`,
      [share.id]
    );

    return {
      share,
      dashboard,
    };
  }

  static async validateSharePassword(shareToken, password) {
    const result = await query(
      `SELECT password_hash FROM dashboard_shares WHERE share_token = $1`,
      [shareToken]
    );

    if (result.rows.length === 0 || !result.rows[0].password_hash) {
      return true; // No password required
    }

    const bcrypt = require('bcryptjs');
    return bcrypt.compare(password, result.rows[0].password_hash);
  }

  static async deleteShareLink(shareId) {
    const result = await query(
      'DELETE FROM dashboard_shares WHERE id = $1 RETURNING id',
      [shareId]
    );

    return result.rows[0];
  }

  static async toggleShareLink(shareId, isActive) {
    const result = await query(
      `UPDATE dashboard_shares SET is_active = $1 WHERE id = $2 RETURNING *`,
      [isActive, shareId]
    );

    return result.rows[0];
  }
}

module.exports = Dashboard;
