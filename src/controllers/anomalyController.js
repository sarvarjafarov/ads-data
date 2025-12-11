const { query } = require('../config/database');

// Get anomalies for a workspace
const getAnomalies = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const {
      status,
      severity,
      metric,
      startDate,
      endDate,
      limit = 50,
      offset = 0
    } = req.query;

    // Verify user has access to workspace
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

    // Build query with filters
    let queryStr = `
      SELECT a.*, aa.account_name, aa.platform, c.campaign_name
      FROM anomalies a
      JOIN ad_accounts aa ON aa.id = a.ad_account_id
      LEFT JOIN campaigns c ON c.id = a.campaign_id
      WHERE aa.workspace_id = $1
    `;
    const queryParams = [workspaceId];
    let paramCount = 1;

    if (status) {
      paramCount++;
      queryStr += ` AND a.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (severity) {
      paramCount++;
      queryStr += ` AND a.severity = $${paramCount}`;
      queryParams.push(severity);
    }

    if (metric) {
      paramCount++;
      queryStr += ` AND a.metric = $${paramCount}`;
      queryParams.push(metric);
    }

    if (startDate) {
      paramCount++;
      queryStr += ` AND a.detection_date >= $${paramCount}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      paramCount++;
      queryStr += ` AND a.detection_date <= $${paramCount}`;
      queryParams.push(endDate);
    }

    queryStr += ` ORDER BY a.detection_date DESC, a.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    queryParams.push(limit, offset);

    const result = await query(queryStr, queryParams);

    // Get total count
    let countQueryStr = `
      SELECT COUNT(*) as total
      FROM anomalies a
      JOIN ad_accounts aa ON aa.id = a.ad_account_id
      WHERE aa.workspace_id = $1
    `;
    const countParams = [workspaceId];
    let countParamIdx = 1;

    if (status) {
      countParamIdx++;
      countQueryStr += ` AND a.status = $${countParamIdx}`;
      countParams.push(status);
    }

    if (severity) {
      countParamIdx++;
      countQueryStr += ` AND a.severity = $${countParamIdx}`;
      countParams.push(severity);
    }

    const countResult = await query(countQueryStr, countParams);

    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('Get anomalies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch anomalies',
      error: error.message,
    });
  }
};

// Update anomaly status
const updateAnomalyStatus = async (req, res) => {
  try {
    const { anomalyId } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    // Verify anomaly exists and user has access
    const anomalyCheck = await query(
      `SELECT a.*, aa.workspace_id
       FROM anomalies a
       JOIN ad_accounts aa ON aa.id = a.ad_account_id
       WHERE a.id = $1`,
      [anomalyId]
    );

    if (anomalyCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Anomaly not found',
      });
    }

    const workspaceId = anomalyCheck.rows[0].workspace_id;

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

    // Update anomaly
    const updateResult = await query(
      `UPDATE anomalies
       SET status = $1,
           metadata = jsonb_set(
             COALESCE(metadata, '{}'::jsonb),
             '{status_history}',
             COALESCE(metadata->'status_history', '[]'::jsonb) || jsonb_build_object(
               'timestamp', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
               'user_id', $2::text,
               'status', $1,
               'notes', COALESCE($3, '')
             )::jsonb
           ),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, req.user.id, notes || '', anomalyId]
    );

    res.json({
      success: true,
      message: 'Anomaly status updated successfully',
      data: updateResult.rows[0],
    });
  } catch (error) {
    console.error('Update anomaly status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update anomaly status',
      error: error.message,
    });
  }
};

// Get user notifications
const getNotifications = async (req, res) => {
  try {
    const { unreadOnly = false, limit = 50, offset = 0 } = req.query;
    const userId = req.user.id;

    let queryStr = `
      SELECT n.*, w.name as workspace_name
      FROM notifications n
      JOIN workspaces w ON w.id = n.workspace_id
      WHERE n.user_id = $1
    `;
    const queryParams = [userId];

    if (unreadOnly === 'true') {
      queryStr += ` AND n.is_read = FALSE`;
    }

    queryStr += ` ORDER BY n.created_at DESC LIMIT $2 OFFSET $3`;
    queryParams.push(limit, offset);

    const result = await query(queryStr, queryParams);

    // Get unread count
    const countResult = await query(
      `SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
      unreadCount: parseInt(countResult.rows[0].unread_count),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message,
    });
  }
};

// Mark notification as read
const markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const updateResult = await query(
      `UPDATE notifications
       SET is_read = TRUE,
           read_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [notificationId, userId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: updateResult.rows[0],
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message,
    });
  }
};

// Mark all notifications as read
const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const updateResult = await query(
      `UPDATE notifications
       SET is_read = TRUE,
           read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND is_read = FALSE
       RETURNING id`,
      [userId]
    );

    res.json({
      success: true,
      message: `${updateResult.rows.length} notifications marked as read`,
      count: updateResult.rows.length,
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message,
    });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const deleteResult = await query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`,
      [notificationId, userId]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message,
    });
  }
};

// Get anomaly detection stats for workspace
const getAnomalyStats = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { days = 30 } = req.query;

    // Verify user has access
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

    // Get stats
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const statsResult = await query(
      `SELECT
         COUNT(*) as total_anomalies,
         COUNT(CASE WHEN status = 'new' THEN 1 END) as new_anomalies,
         COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_anomalies,
         COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_anomalies,
         COUNT(CASE WHEN metric = 'ctr' AND anomaly_type = 'drop' THEN 1 END) as ctr_drops,
         COUNT(CASE WHEN metric = 'cpc' AND anomaly_type = 'spike' THEN 1 END) as cpc_spikes,
         COUNT(CASE WHEN metric = 'conversions' AND anomaly_type = 'drop' THEN 1 END) as conversion_drops
       FROM anomalies a
       JOIN ad_accounts aa ON aa.id = a.ad_account_id
       WHERE aa.workspace_id = $1 AND a.detection_date >= $2`,
      [workspaceId, startDate.toISOString().split('T')[0]]
    );

    const stats = statsResult.rows[0];

    // Get trends by date
    const trendsResult = await query(
      `SELECT
         detection_date,
         COUNT(*) as count,
         COUNT(CASE WHEN severity IN ('critical', 'high') THEN 1 END) as high_severity_count
       FROM anomalies a
       JOIN ad_accounts aa ON aa.id = a.ad_account_id
       WHERE aa.workspace_id = $1 AND a.detection_date >= $2
       GROUP BY detection_date
       ORDER BY detection_date DESC`,
      [workspaceId, startDate.toISOString().split('T')[0]]
    );

    res.json({
      success: true,
      data: {
        summary: stats,
        trends: trendsResult.rows,
      },
    });
  } catch (error) {
    console.error('Get anomaly stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch anomaly stats',
      error: error.message,
    });
  }
};

module.exports = {
  getAnomalies,
  updateAnomalyStatus,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getAnomalyStats,
};
