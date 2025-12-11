const { query } = require('../config/database');
const { getPlatformService } = require('../services/platforms');
const config = require('../config/config');

// Helper function to calculate date ranges
const getDateRange = (dateRangeType) => {
  const today = new Date();
  const until = today.toISOString().split('T')[0];
  let since;

  switch (dateRangeType) {
    case 'today':
      since = until;
      break;
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      since = yesterday.toISOString().split('T')[0];
      break;
    case 'last_7_days':
      const week = new Date(today);
      week.setDate(week.getDate() - 7);
      since = week.toISOString().split('T')[0];
      break;
    case 'last_30_days':
      const month = new Date(today);
      month.setDate(month.getDate() - 30);
      since = month.toISOString().split('T')[0];
      break;
    case 'this_month':
      since = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      break;
    case 'last_month':
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      since = lastMonth.toISOString().split('T')[0];
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      return { since, until: lastMonthEnd.toISOString().split('T')[0] };
    default:
      // Default to last 30 days
      const defaultDate = new Date(today);
      defaultDate.setDate(defaultDate.getDate() - 30);
      since = defaultDate.toISOString().split('T')[0];
  }

  return { since, until };
};

// Helper to fetch Meta Ads metrics
async function fetchMetaAdsMetrics(accountId, accessToken, metric, since, until) {
  const axios = require('axios');

  const metricFields = {
    spend: 'spend',
    impressions: 'impressions',
    clicks: 'clicks',
    conversions: 'conversions',
    ctr: 'ctr',
    cpc: 'cpc',
    cpm: 'cpm',
  };

  const field = metricFields[metric] || 'spend';

  try {
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/act_${accountId}/insights`,
      {
        params: {
          access_token: accessToken,
          fields: field,
          time_range: JSON.stringify({ since, until }),
          time_increment: 1,
          level: 'account',
        },
      }
    );

    const data = response.data.data || [];
    let totalValue = 0;
    const timeSeries = [];

    for (const item of data) {
      const value = parseFloat(item[field] || 0);
      totalValue += value;
      if (item.date_start) {
        timeSeries.push({
          date: item.date_start,
          value,
        });
      }
    }

    return {
      value: totalValue,
      label: metric,
      timeSeries,
      dateRange: { since, until },
    };
  } catch (error) {
    console.error('Meta Ads metrics fetch error:', error.response?.data || error.message);
    return {
      value: 0,
      label: metric,
      error: error.message,
    };
  }
}

// Get budget configuration for an ad account
const getBudgetConfig = async (req, res) => {
  try {
    const { adAccountId } = req.params;

    // Get ad account with budget info
    const accountResult = await query(
      `SELECT aa.id, aa.account_id, aa.account_name, aa.platform, aa.workspace_id, aa.currency,
              aa.monthly_budget, aa.budget_start_date, aa.budget_alert_thresholds, aa.budget_alert_enabled
       FROM ad_accounts aa
       WHERE aa.id = $1`,
      [adAccountId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ad account not found',
      });
    }

    const account = accountResult.rows[0];

    // Verify user has access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [account.workspace_id, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    res.json({
      success: true,
      data: {
        accountId: account.id,
        accountName: account.account_name,
        platform: account.platform,
        currency: account.currency,
        monthlyBudget: account.monthly_budget,
        budgetStartDate: account.budget_start_date,
        alertThresholds: account.budget_alert_thresholds || [80, 90, 100],
        alertEnabled: account.budget_alert_enabled,
      },
    });
  } catch (error) {
    console.error('Get budget config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget configuration',
      error: error.message,
    });
  }
};

// Update budget configuration
const updateBudgetConfig = async (req, res) => {
  try {
    const { adAccountId } = req.params;
    const { monthlyBudget, budgetStartDate, alertThresholds, alertEnabled } = req.body;

    // Get account and verify access
    const accountResult = await query(
      `SELECT aa.workspace_id FROM ad_accounts aa WHERE aa.id = $1`,
      [adAccountId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ad account not found',
      });
    }

    const account = accountResult.rows[0];

    // Verify user has access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [account.workspace_id, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Update budget configuration
    const updateResult = await query(
      `UPDATE ad_accounts
       SET monthly_budget = $1,
           budget_start_date = $2,
           budget_alert_thresholds = $3,
           budget_alert_enabled = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, monthly_budget, budget_start_date, budget_alert_thresholds, budget_alert_enabled`,
      [
        monthlyBudget || null,
        budgetStartDate || null,
        alertThresholds ? JSON.stringify(alertThresholds) : JSON.stringify([80, 90, 100]),
        alertEnabled !== undefined ? alertEnabled : true,
        adAccountId,
      ]
    );

    res.json({
      success: true,
      message: 'Budget configuration updated successfully',
      data: updateResult.rows[0],
    });
  } catch (error) {
    console.error('Update budget config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update budget configuration',
      error: error.message,
    });
  }
};

// Get budget pacing data (current spend, projected spend, alerts)
const getBudgetPacing = async (req, res) => {
  try {
    const { adAccountId } = req.params;

    // Get account with budget info and OAuth token
    const accountResult = await query(
      `SELECT aa.id, aa.account_id, aa.account_name, aa.platform, aa.workspace_id, aa.currency,
              aa.monthly_budget, aa.budget_start_date, aa.budget_alert_thresholds, aa.budget_alert_enabled,
              ot.access_token
       FROM ad_accounts aa
       LEFT JOIN oauth_tokens ot ON ot.workspace_id = aa.workspace_id AND ot.platform = aa.platform
       WHERE aa.id = $1`,
      [adAccountId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ad account not found',
      });
    }

    const account = accountResult.rows[0];

    // Verify user has access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [account.workspace_id, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Calculate current month date range
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const since = firstDayOfMonth.toISOString().split('T')[0];
    const until = today.toISOString().split('T')[0];

    // Fetch current spend for the month
    let currentSpend = 0;
    let dailySpendData = [];

    if (account.access_token) {
      try {
        if (account.platform === 'meta') {
          const metricsData = await fetchMetaAdsMetrics(
            account.account_id,
            account.access_token,
            'spend',
            since,
            until
          );
          currentSpend = metricsData.value || 0;
          dailySpendData = metricsData.timeSeries || [];
        } else if (account.platform === 'google') {
          const GoogleAdsService = getPlatformService('google');
          const metricsData = await GoogleAdsService.fetchMetrics(
            account.account_id,
            account.access_token,
            'spend',
            since,
            until,
            config
          );
          currentSpend = metricsData.value || 0;
          dailySpendData = metricsData.timeSeries || [];
        }
      } catch (error) {
        console.error('Error fetching spend data:', error);
      }
    }

    // Calculate budget pacing metrics
    const monthlyBudget = parseFloat(account.monthly_budget) || 0;
    const spendPercentage = monthlyBudget > 0 ? (currentSpend / monthlyBudget) * 100 : 0;

    // Calculate days in month and days passed
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const daysPassed = today.getDate();
    const daysRemaining = daysInMonth - daysPassed;
    const monthProgress = (daysPassed / daysInMonth) * 100;

    // Calculate projected spend (simple linear projection)
    const avgDailySpend = daysPassed > 0 ? currentSpend / daysPassed : 0;
    const projectedMonthlySpend = avgDailySpend * daysInMonth;

    // Determine alert status
    const thresholds = account.budget_alert_thresholds || [80, 90, 100];
    let alertStatus = 'on_track';
    let alertLevel = null;

    for (const threshold of thresholds.sort((a, b) => b - a)) {
      if (spendPercentage >= threshold) {
        alertStatus = threshold >= 100 ? 'exceeded' : threshold >= 90 ? 'critical' : 'warning';
        alertLevel = threshold;
        break;
      }
    }

    // Check if spending is ahead of schedule
    if (spendPercentage > monthProgress && alertStatus === 'on_track') {
      alertStatus = 'ahead_of_pace';
    }

    // Check recent alerts
    const recentAlertsResult = await query(
      `SELECT * FROM budget_alerts
       WHERE ad_account_id = $1
       AND alert_date >= $2
       ORDER BY alert_date DESC, created_at DESC
       LIMIT 5`,
      [adAccountId, since]
    );

    res.json({
      success: true,
      data: {
        accountId: account.id,
        accountName: account.account_name,
        platform: account.platform,
        currency: account.currency,
        budget: {
          monthly: monthlyBudget,
          startDate: account.budget_start_date,
        },
        spending: {
          current: currentSpend,
          percentage: spendPercentage,
          projected: projectedMonthlySpend,
          avgDaily: avgDailySpend,
          dailyData: dailySpendData,
        },
        period: {
          since,
          until,
          daysInMonth,
          daysPassed,
          daysRemaining,
          monthProgress,
        },
        alert: {
          status: alertStatus,
          level: alertLevel,
          thresholds: thresholds,
          enabled: account.budget_alert_enabled,
          recent: recentAlertsResult.rows,
        },
      },
    });
  } catch (error) {
    console.error('Get budget pacing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget pacing data',
      error: error.message,
    });
  }
};

// Get budget alerts history
const getBudgetAlerts = async (req, res) => {
  try {
    const { adAccountId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Get account and verify access
    const accountResult = await query(
      `SELECT aa.workspace_id FROM ad_accounts aa WHERE aa.id = $1`,
      [adAccountId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ad account not found',
      });
    }

    const account = accountResult.rows[0];

    // Verify user has access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [account.workspace_id, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Get alerts
    const alertsResult = await query(
      `SELECT ba.*, u.username as acknowledged_by_username
       FROM budget_alerts ba
       LEFT JOIN users u ON u.id = ba.acknowledged_by
       WHERE ba.ad_account_id = $1
       ORDER BY ba.alert_date DESC, ba.created_at DESC
       LIMIT $2 OFFSET $3`,
      [adAccountId, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM budget_alerts WHERE ad_account_id = $1`,
      [adAccountId]
    );

    res.json({
      success: true,
      data: alertsResult.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error('Get budget alerts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch budget alerts',
      error: error.message,
    });
  }
};

// Acknowledge a budget alert
const acknowledgeBudgetAlert = async (req, res) => {
  try {
    const { alertId } = req.params;

    // Update alert
    const updateResult = await query(
      `UPDATE budget_alerts
       SET acknowledged = true,
           acknowledged_by = $1,
           acknowledged_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [req.user.id, alertId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found',
      });
    }

    res.json({
      success: true,
      message: 'Alert acknowledged successfully',
      data: updateResult.rows[0],
    });
  } catch (error) {
    console.error('Acknowledge alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge alert',
      error: error.message,
    });
  }
};

module.exports = {
  getBudgetConfig,
  updateBudgetConfig,
  getBudgetPacing,
  getBudgetAlerts,
  acknowledgeBudgetAlert,
};
