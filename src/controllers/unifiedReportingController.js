/**
 * Unified Reporting Controller
 * Provides cross-platform analytics and reporting
 */

const { query } = require('../config/database');

/**
 * Get unified campaign metrics across all platforms
 */
const getUnifiedCampaigns = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { startDate, endDate, platform, groupBy = 'day' } = req.query;

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

    let whereClause = 'WHERE workspace_id = $1';
    const params = [workspaceId];
    let paramIndex = 2;

    if (startDate) {
      whereClause += ` AND date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (platform) {
      whereClause += ` AND platform = $${paramIndex}`;
      params.push(platform);
      paramIndex++;
    }

    const result = await query(
      `SELECT
        platform,
        date,
        campaign_name,
        SUM(spend) as total_spend,
        SUM(impressions) as total_impressions,
        SUM(clicks) as total_clicks,
        SUM(conversions) as total_conversions,
        SUM(revenue) as total_revenue,
        AVG(ctr) as avg_ctr,
        AVG(cpc) as avg_cpc,
        AVG(cpm) as avg_cpm,
        AVG(roas) as avg_roas
      FROM unified_campaigns
      ${whereClause}
      GROUP BY platform, date, campaign_name
      ORDER BY date DESC, platform`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get unified campaigns error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unified campaigns',
      error: error.message,
    });
  }
};

/**
 * Get platform performance comparison
 */
const getPlatformComparison = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { startDate, endDate } = req.query;

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

    let whereClause = 'WHERE workspace_id = $1';
    const params = [workspaceId];

    if (startDate && endDate) {
      whereClause += ' AND date BETWEEN $2 AND $3';
      params.push(startDate, endDate);
    }

    const result = await query(
      `SELECT
        platform,
        COUNT(DISTINCT platform_campaign_id) as campaign_count,
        SUM(spend) as total_spend,
        SUM(impressions) as total_impressions,
        SUM(clicks) as total_clicks,
        SUM(conversions) as total_conversions,
        SUM(revenue) as total_revenue,
        AVG(ctr) as avg_ctr,
        AVG(cpc) as avg_cpc,
        AVG(cpm) as avg_cpm,
        CASE
          WHEN SUM(spend) > 0 THEN SUM(revenue) / SUM(spend)
          ELSE 0
        END as roas
      FROM unified_campaigns
      ${whereClause}
      GROUP BY platform
      ORDER BY total_spend DESC`,
      params
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get platform comparison error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch platform comparison',
      error: error.message,
    });
  }
};

/**
 * Get cross-platform trends
 */
const getCrossPlatformTrends = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { startDate, endDate, metric = 'spend' } = req.query;

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

    const validMetrics = [
      'spend',
      'impressions',
      'clicks',
      'conversions',
      'revenue',
      'ctr',
      'cpc',
      'cpm',
      'roas',
    ];

    if (!validMetrics.includes(metric)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid metric',
      });
    }

    let whereClause = 'WHERE workspace_id = $1';
    const params = [workspaceId];

    if (startDate && endDate) {
      whereClause += ' AND date BETWEEN $2 AND $3';
      params.push(startDate, endDate);
    }

    const aggregation =
      metric === 'ctr' ||
      metric === 'cpc' ||
      metric === 'cpm' ||
      metric === 'roas'
        ? 'AVG'
        : 'SUM';

    const result = await query(
      `SELECT
        date,
        platform,
        ${aggregation}(${metric}) as value
      FROM unified_campaigns
      ${whereClause}
      GROUP BY date, platform
      ORDER BY date, platform`,
      params
    );

    res.json({
      success: true,
      metric,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get cross-platform trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cross-platform trends',
      error: error.message,
    });
  }
};

/**
 * Get unified dashboard summary
 */
const getUnifiedSummary = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { startDate, endDate } = req.query;

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

    let whereClause = 'WHERE workspace_id = $1';
    const params = [workspaceId];

    if (startDate && endDate) {
      whereClause += ' AND date BETWEEN $2 AND $3';
      params.push(startDate, endDate);
    }

    const summaryResult = await query(
      `SELECT
        COUNT(DISTINCT platform) as platform_count,
        COUNT(DISTINCT platform_campaign_id) as total_campaigns,
        SUM(spend) as total_spend,
        SUM(impressions) as total_impressions,
        SUM(clicks) as total_clicks,
        SUM(conversions) as total_conversions,
        SUM(revenue) as total_revenue,
        CASE
          WHEN SUM(impressions) > 0 THEN (SUM(clicks)::numeric / SUM(impressions)::numeric) * 100
          ELSE 0
        END as overall_ctr,
        CASE
          WHEN SUM(clicks) > 0 THEN SUM(spend) / SUM(clicks)
          ELSE 0
        END as overall_cpc,
        CASE
          WHEN SUM(spend) > 0 THEN SUM(revenue) / SUM(spend)
          ELSE 0
        END as overall_roas
      FROM unified_campaigns
      ${whereClause}`,
      params
    );

    const platformBreakdown = await query(
      `SELECT
        platform,
        COUNT(DISTINCT platform_campaign_id) as campaign_count,
        SUM(spend) as spend,
        SUM(conversions) as conversions
      FROM unified_campaigns
      ${whereClause}
      GROUP BY platform`,
      params
    );

    res.json({
      success: true,
      summary: summaryResult.rows[0],
      platforms: platformBreakdown.rows,
    });
  } catch (error) {
    console.error('Get unified summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unified summary',
      error: error.message,
    });
  }
};

module.exports = {
  getUnifiedCampaigns,
  getPlatformComparison,
  getCrossPlatformTrends,
  getUnifiedSummary,
};
