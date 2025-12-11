/**
 * Custom Alert Controller
 * Handles custom alert rules with complex conditions
 */

const { query } = require('../config/database');

/**
 * Get all custom alert rules for a workspace
 */
const getCustomAlerts = async (req, res) => {
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
      `SELECT car.*, u.username as created_by_name
       FROM custom_alert_rules car
       LEFT JOIN users u ON u.id = car.created_by
       WHERE car.workspace_id = $1
       ORDER BY car.created_at DESC`,
      [workspaceId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get custom alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch custom alerts',
      error: error.message,
    });
  }
};

/**
 * Get a single custom alert rule
 */
const getCustomAlert = async (req, res) => {
  try {
    const { alertId } = req.params;

    const result = await query(
      `SELECT car.*, u.username as created_by_name
       FROM custom_alert_rules car
       LEFT JOIN users u ON u.id = car.created_by
       WHERE car.id = $1`,
      [alertId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Custom alert not found',
      });
    }

    const alert = result.rows[0];

    // Verify workspace access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [alert.workspace_id, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: alert,
    });
  } catch (error) {
    console.error('Get custom alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch custom alert',
      error: error.message,
    });
  }
};

/**
 * Create a new custom alert rule
 */
const createCustomAlert = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const {
      name,
      description,
      conditions,
      alert_channels,
      frequency,
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
    if (!name || !conditions || conditions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, conditions',
      });
    }

    const result = await query(
      `INSERT INTO custom_alert_rules (
        workspace_id, name, description, conditions, alert_channels,
        frequency, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        workspaceId,
        name,
        description,
        JSON.stringify(conditions),
        JSON.stringify(alert_channels || [{ type: 'in-app', config: {} }]),
        frequency || 'immediate',
        req.user.id,
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create custom alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create custom alert',
      error: error.message,
    });
  }
};

/**
 * Update a custom alert rule
 */
const updateCustomAlert = async (req, res) => {
  try {
    const { alertId } = req.params;
    const updates = req.body;

    // Get alert and verify access
    const alertResult = await query(
      `SELECT * FROM custom_alert_rules WHERE id = $1`,
      [alertId]
    );

    if (alertResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Custom alert not found',
      });
    }

    const alert = alertResult.rows[0];

    // Verify workspace access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [alert.workspace_id, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Build update query
    const allowedFields = [
      'name',
      'description',
      'conditions',
      'alert_channels',
      'frequency',
      'is_active',
    ];

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        if (['conditions', 'alert_channels'].includes(key)) {
          updateFields.push(`${key} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          updateFields.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    values.push(alertId);

    const result = await query(
      `UPDATE custom_alert_rules
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
    console.error('Update custom alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update custom alert',
      error: error.message,
    });
  }
};

/**
 * Delete a custom alert rule
 */
const deleteCustomAlert = async (req, res) => {
  try {
    const { alertId } = req.params;

    // Get alert and verify access
    const alertResult = await query(
      `SELECT * FROM custom_alert_rules WHERE id = $1`,
      [alertId]
    );

    if (alertResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Custom alert not found',
      });
    }

    const alert = alertResult.rows[0];

    // Verify workspace access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [alert.workspace_id, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    await query('DELETE FROM custom_alert_rules WHERE id = $1', [alertId]);

    res.json({
      success: true,
      message: 'Custom alert deleted successfully',
    });
  } catch (error) {
    console.error('Delete custom alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete custom alert',
      error: error.message,
    });
  }
};

module.exports = {
  getCustomAlerts,
  getCustomAlert,
  createCustomAlert,
  updateCustomAlert,
  deleteCustomAlert,
};
