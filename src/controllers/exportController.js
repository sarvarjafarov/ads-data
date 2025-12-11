/**
 * Export Controller
 * Handles data export to CSV, Excel, PDF
 */

const { query } = require('../config/database');

/**
 * Export data to CSV
 */
const exportToCSV = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { entity_type, entity_id, columns, filters } = req.body;

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

    // Create export record
    const exportRecord = await query(
      `INSERT INTO export_history (
        workspace_id, user_id, export_type, entity_type, entity_id, filters, status
      ) VALUES ($1, $2, 'csv', $3, $4, $5, 'pending')
      RETURNING id`,
      [workspaceId, req.user.id, entity_type, entity_id || null, JSON.stringify(filters || {})]
    );

    // Fetch data based on entity type
    let data;
    let headers;

    switch (entity_type) {
      case 'campaign':
        // Fetch campaign data (this is a simplified example)
        data = await fetchCampaignData(workspaceId, filters);
        headers = columns || ['Campaign Name', 'Platform', 'Spend', 'Impressions', 'Clicks', 'Conversions'];
        break;

      case 'metrics':
        data = await fetchMetricsData(workspaceId, filters);
        headers = columns || ['Date', 'Metric', 'Value'];
        break;

      default:
        throw new Error('Unsupported entity type');
    }

    // Generate CSV
    const csv = generateCSV(data, headers);

    // Update export record as completed
    await query(
      `UPDATE export_history
       SET status = 'completed', completed_at = NOW(), file_size = $1
       WHERE id = $2`,
      [Buffer.byteLength(csv, 'utf8'), exportRecord.rows[0].id]
    );

    // Send CSV file
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="export-${Date.now()}.csv"`);
    res.send(csv);

  } catch (error) {
    console.error('Export to CSV error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export data',
      error: error.message,
    });
  }
};

/**
 * Get export history
 */
const getExportHistory = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { limit = 20 } = req.query;

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
      `SELECT eh.*, u.username
       FROM export_history eh
       LEFT JOIN users u ON u.id = eh.user_id
       WHERE eh.workspace_id = $1
       ORDER BY eh.created_at DESC
       LIMIT $2`,
      [workspaceId, limit]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get export history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch export history',
      error: error.message,
    });
  }
};

// Helper functions
async function fetchCampaignData(workspaceId, filters) {
  // This is a simplified example - you would expand this based on your actual data structure
  const result = await query(
    `SELECT
      campaign_name,
      platform,
      spend,
      impressions,
      clicks,
      conversions
     FROM campaign_metrics
     WHERE workspace_id = $1
     ORDER BY created_at DESC
     LIMIT 1000`,
    [workspaceId]
  );

  return result.rows;
}

async function fetchMetricsData(workspaceId, filters) {
  // Simplified metrics fetch
  const result = await query(
    `SELECT
      date,
      metric_name,
      value
     FROM metrics
     WHERE workspace_id = $1
     ORDER BY date DESC
     LIMIT 1000`,
    [workspaceId]
  );

  return result.rows;
}

function generateCSV(data, headers) {
  if (!data || data.length === 0) {
    return headers.join(',');
  }

  // Create CSV header
  const csvRows = [headers.join(',')];

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const key = header.toLowerCase().replace(/ /g, '_');
      const value = row[key];

      // Handle values that might contain commas or quotes
      if (value === null || value === undefined) {
        return '';
      }

      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    });

    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

module.exports = {
  exportToCSV,
  getExportHistory,
};
