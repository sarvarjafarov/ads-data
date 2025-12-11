/**
 * Report Controller
 * Handles scheduled report endpoints
 */

const { query } = require('../config/database');
const reportScheduler = require('../services/reportScheduler');

/**
 * Get all scheduled reports for a workspace
 */
const getScheduledReports = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Verify workspace access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const result = await query(
      `SELECT id, workspace_id, user_id, name, description, report_type, frequency,
              day_of_week, day_of_month, time_of_day, timezone, ad_account_ids,
              platforms, metrics, date_range, recipients, email_format,
              include_charts, include_recommendations, is_active, last_sent_at,
              next_scheduled_at, created_at, updated_at
       FROM scheduled_reports
       WHERE workspace_id = $1
       ORDER BY created_at DESC`,
      [workspaceId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get scheduled reports error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scheduled reports',
      error: error.message,
    });
  }
};

/**
 * Get a single scheduled report
 */
const getScheduledReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const result = await query(
      `SELECT sr.*, w.id as workspace_id
       FROM scheduled_reports sr
       JOIN workspaces w ON w.id = sr.workspace_id
       WHERE sr.id = $1`,
      [reportId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled report not found',
      });
    }

    const report = result.rows[0];

    // Verify workspace access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [report.workspace_id, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Get scheduled report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scheduled report',
      error: error.message,
    });
  }
};

/**
 * Create a new scheduled report
 */
const createScheduledReport = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const {
      name,
      description,
      report_type,
      frequency,
      day_of_week,
      day_of_month,
      time_of_day,
      timezone,
      ad_account_ids,
      platforms,
      metrics,
      date_range,
      recipients,
      email_format,
      include_charts,
      include_recommendations,
    } = req.body;

    // Verify workspace access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Validate required fields
    if (!name || !report_type || !frequency || !recipients || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, report_type, frequency, recipients',
      });
    }

    const result = await query(
      `INSERT INTO scheduled_reports (
        workspace_id, user_id, name, description, report_type, frequency,
        day_of_week, day_of_month, time_of_day, timezone, ad_account_ids,
        platforms, metrics, date_range, recipients, email_format,
        include_charts, include_recommendations
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        workspaceId,
        req.user.id,
        name,
        description,
        report_type,
        frequency,
        day_of_week,
        day_of_month,
        time_of_day || '09:00:00',
        timezone || 'UTC',
        ad_account_ids || [],
        platforms || [],
        metrics || ['impressions', 'clicks', 'spend', 'conversions'],
        date_range || 'last_7_days',
        recipients,
        email_format || 'html',
        include_charts !== undefined ? include_charts : true,
        include_recommendations !== undefined ? include_recommendations : false,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create scheduled report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create scheduled report',
      error: error.message,
    });
  }
};

/**
 * Update a scheduled report
 */
const updateScheduledReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const updates = req.body;

    // Get report and verify access
    const reportResult = await query(
      `SELECT sr.*, w.id as workspace_id
       FROM scheduled_reports sr
       JOIN workspaces w ON w.id = sr.workspace_id
       WHERE sr.id = $1`,
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled report not found',
      });
    }

    const report = reportResult.rows[0];

    // Verify workspace access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [report.workspace_id, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Build update query dynamically
    const allowedFields = [
      'name', 'description', 'report_type', 'frequency', 'day_of_week',
      'day_of_month', 'time_of_day', 'timezone', 'ad_account_ids',
      'platforms', 'metrics', 'date_range', 'recipients', 'email_format',
      'include_charts', 'include_recommendations', 'is_active',
    ];

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    values.push(reportId);

    const result = await query(
      `UPDATE scheduled_reports
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update scheduled report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update scheduled report',
      error: error.message,
    });
  }
};

/**
 * Delete a scheduled report
 */
const deleteScheduledReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    // Get report and verify access
    const reportResult = await query(
      `SELECT sr.*, w.id as workspace_id
       FROM scheduled_reports sr
       JOIN workspaces w ON w.id = sr.workspace_id
       WHERE sr.id = $1`,
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled report not found',
      });
    }

    const report = reportResult.rows[0];

    // Verify workspace access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [report.workspace_id, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    await query('DELETE FROM scheduled_reports WHERE id = $1', [reportId]);

    res.json({
      success: true,
      message: 'Scheduled report deleted successfully',
    });
  } catch (error) {
    console.error('Delete scheduled report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete scheduled report',
      error: error.message,
    });
  }
};

/**
 * Trigger a report manually (for testing)
 */
const triggerReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    // Get report and verify access
    const reportResult = await query(
      `SELECT sr.*, w.id as workspace_id
       FROM scheduled_reports sr
       JOIN workspaces w ON w.id = sr.workspace_id
       WHERE sr.id = $1`,
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled report not found',
      });
    }

    const report = reportResult.rows[0];

    // Verify workspace access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [report.workspace_id, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    await reportScheduler.triggerReport(reportId);

    res.json({
      success: true,
      message: 'Report triggered successfully',
    });
  } catch (error) {
    console.error('Trigger report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger report',
      error: error.message,
    });
  }
};

/**
 * Get execution history for a report
 */
const getExecutionHistory = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { limit = 10 } = req.query;

    // Get report and verify access
    const reportResult = await query(
      `SELECT sr.*, w.id as workspace_id
       FROM scheduled_reports sr
       JOIN workspaces w ON w.id = sr.workspace_id
       WHERE sr.id = $1`,
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled report not found',
      });
    }

    const report = reportResult.rows[0];

    // Verify workspace access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [report.workspace_id, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const history = await reportScheduler.getExecutionHistory(reportId, parseInt(limit));

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Get execution history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch execution history',
      error: error.message,
    });
  }
};

module.exports = {
  getScheduledReports,
  getScheduledReport,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  triggerReport,
  getExecutionHistory,
};
