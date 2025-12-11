const { query } = require('../config/database');
const config = require('../config/config');
const { getPlatformService } = require('../services/platforms');

// Get metrics for a specific ad account
const getAccountMetrics = async (req, res) => {
  try {
    const { adAccountId } = req.params;
    const { metric, dateRange } = req.query;

    // Get ad account details
    const accountResult = await query(
      `SELECT aa.id, aa.account_id, aa.platform, aa.workspace_id, ot.access_token
       FROM ad_accounts aa
       JOIN oauth_tokens ot ON ot.workspace_id = aa.workspace_id AND ot.platform = aa.platform
       WHERE aa.id = $1`,
      [adAccountId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ad account not found or no access token available',
      });
    }

    const account = accountResult.rows[0];

    // Verify user has access to this workspace
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [account.workspace_id, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this ad account',
      });
    }

    // Calculate date range
    const { since, until } = getDateRange(dateRange || 'last_30_days');

    // Fetch metrics based on platform
    let metricsData;
    if (account.platform === 'meta') {
      metricsData = await fetchMetaAdsMetrics(
        account.account_id,
        account.access_token,
        metric || 'spend',
        since,
        until
      );
    } else if (account.platform === 'google') {
      const GoogleAdsService = getPlatformService('google');
      metricsData = await GoogleAdsService.fetchMetrics(
        account.account_id,
        account.access_token,
        metric || 'spend',
        since,
        until,
        config
      );
    } else if (account.platform === 'search_console') {
      const SearchConsoleService = getPlatformService('search_console');
      const siteUrl = decodeURIComponent(account.account_id);
      metricsData = await SearchConsoleService.fetchMetrics(
        siteUrl,
        account.access_token,
        metric || 'clicks',
        since,
        until,
        config
      );
    } else {
      // For other platforms, return placeholder data
      metricsData = {
        value: 0,
        label: metric || 'spend',
        message: `Platform ${account.platform} metrics coming soon`,
      };
    }

    res.json({
      success: true,
      data: metricsData,
    });
  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch metrics',
      error: error.message,
    });
  }
};

// Get metrics for multiple metrics at once (for dashboard widgets)
const getWidgetMetrics = async (req, res) => {
  try {
    const { widgetId } = req.params;

    // Get widget configuration
    const widgetResult = await query(
      `SELECT dw.*, d.workspace_id
       FROM dashboard_widgets dw
       JOIN dashboards d ON d.id = dw.dashboard_id
       WHERE dw.id = $1`,
      [widgetId]
    );

    if (widgetResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Widget not found',
      });
    }

    const widget = widgetResult.rows[0];
    const dataSource = widget.data_source || {};

    if (!dataSource.adAccountId) {
      return res.json({
        success: true,
        data: { value: 0, label: 'No data source configured' },
      });
    }

    // Get ad account with access token
    const accountResult = await query(
      `SELECT aa.id, aa.account_id, aa.platform, aa.workspace_id, ot.access_token
       FROM ad_accounts aa
       JOIN oauth_tokens ot ON ot.workspace_id = aa.workspace_id AND ot.platform = aa.platform
       WHERE aa.id = $1`,
      [dataSource.adAccountId]
    );

    if (accountResult.rows.length === 0) {
      return res.json({
        success: true,
        data: { value: 0, label: 'Ad account not found' },
      });
    }

    const account = accountResult.rows[0];

    // Calculate date range
    const { since, until } = getDateRange(dataSource.dateRange || 'last_30_days');

    // Fetch metrics based on platform
    let metricsData;
    if (account.platform === 'meta') {
      metricsData = await fetchMetaAdsMetrics(
        account.account_id,
        account.access_token,
        dataSource.metric || 'spend',
        since,
        until
      );
    } else if (account.platform === 'google') {
      const GoogleAdsService = getPlatformService('google');
      metricsData = await GoogleAdsService.fetchMetrics(
        account.account_id,
        account.access_token,
        dataSource.metric || 'spend',
        since,
        until,
        config
      );
    } else if (account.platform === 'search_console') {
      const SearchConsoleService = getPlatformService('search_console');
      const siteUrl = decodeURIComponent(account.account_id);

      // Determine which Search Console endpoint to call based on widget title
      const widgetTitle = widget.title?.toLowerCase() || '';

      try {
        if (widgetTitle.includes('keyword') || widgetTitle.includes('quer')) {
          // Top Keywords/Queries
          const queries = await SearchConsoleService.getTopQueries(
            siteUrl,
            account.access_token,
            { startDate: since, endDate: until, rowLimit: 10 }
          );
          metricsData = {
            type: 'table',
            columns: ['Query', 'Clicks', 'Impressions', 'CTR (%)', 'Position'],
            data: queries.map(q => ({
              query: q.keys[0],
              clicks: q.clicks,
              impressions: q.impressions,
              ctr: (q.ctr * 100).toFixed(2),
              position: q.position.toFixed(1)
            }))
          };
        } else if (widgetTitle.includes('page')) {
          // Top Pages
          const pages = await SearchConsoleService.getPagePerformance(
            siteUrl,
            account.access_token,
            { startDate: since, endDate: until, rowLimit: 10 }
          );
          metricsData = {
            type: 'table',
            columns: ['Page', 'Clicks', 'Impressions', 'CTR (%)', 'Position'],
            data: pages.map(p => ({
              page: p.keys[0],
              clicks: p.clicks,
              impressions: p.impressions,
              ctr: (p.ctr * 100).toFixed(2),
              position: p.position.toFixed(1)
            }))
          };
        } else if (widgetTitle.includes('device')) {
          // Device Breakdown
          const devices = await SearchConsoleService.getDeviceBreakdown(
            siteUrl,
            account.access_token,
            { startDate: since, endDate: until }
          );
          metricsData = {
            type: 'table',
            columns: ['Device', 'Clicks', 'Impressions', 'CTR (%)', 'Position'],
            data: devices.map(d => ({
              device: d.keys[0].charAt(0).toUpperCase() + d.keys[0].slice(1),
              clicks: d.clicks,
              impressions: d.impressions,
              ctr: (d.ctr * 100).toFixed(2),
              position: d.position.toFixed(1)
            }))
          };
        } else if (widgetTitle.includes('country') || widgetTitle.includes('countr')) {
          // Country Breakdown
          const countries = await SearchConsoleService.getCountryBreakdown(
            siteUrl,
            account.access_token,
            { startDate: since, endDate: until, rowLimit: 10 }
          );
          metricsData = {
            type: 'table',
            columns: ['Country', 'Clicks', 'Impressions', 'CTR (%)', 'Position'],
            data: countries.map(c => ({
              country: c.keys[0],
              clicks: c.clicks,
              impressions: c.impressions,
              ctr: (c.ctr * 100).toFixed(2),
              position: c.position.toFixed(1)
            }))
          };
        } else {
          // Default: fetch regular metrics
          metricsData = await SearchConsoleService.fetchMetrics(
            siteUrl,
            account.access_token,
            dataSource.metric || 'clicks',
            since,
            until,
            config
          );
        }
      } catch (searchConsoleError) {
        console.error('Search Console API error:', searchConsoleError);

        // Return demo data when API fails (e.g., expired token)
        if (widgetTitle.includes('keyword') || widgetTitle.includes('quer')) {
          metricsData = {
            type: 'table',
            columns: ['Query', 'Clicks', 'Impressions', 'CTR (%)', 'Position'],
            data: [
              { query: 'online marketing', clicks: 1247, impressions: 24580, ctr: '5.07', position: '3.2' },
              { query: 'digital advertising', clicks: 982, impressions: 19340, ctr: '5.08', position: '2.8' },
              { query: 'social media marketing', clicks: 856, impressions: 18920, ctr: '4.52', position: '4.1' },
              { query: 'content marketing', clicks: 742, impressions: 16450, ctr: '4.51', position: '3.9' },
              { query: 'email marketing', clicks: 685, impressions: 14230, ctr: '4.81', position: '3.5' }
            ],
            _demoData: true
          };
        } else if (widgetTitle.includes('page')) {
          metricsData = {
            type: 'table',
            columns: ['Page', 'Clicks', 'Impressions', 'CTR (%)', 'Position'],
            data: [
              { page: '/blog/marketing-guide', clicks: 2340, impressions: 45210, ctr: '5.17', position: '2.4' },
              { page: '/services/consulting', clicks: 1892, impressions: 38540, ctr: '4.91', position: '3.1' },
              { page: '/resources/templates', clicks: 1567, impressions: 32190, ctr: '4.87', position: '3.8' },
              { page: '/about', clicks: 1234, impressions: 28730, ctr: '4.29', position: '4.2' },
              { page: '/contact', clicks: 987, impressions: 21450, ctr: '4.60', position: '3.6' }
            ],
            _demoData: true
          };
        } else if (widgetTitle.includes('device')) {
          metricsData = {
            type: 'table',
            columns: ['Device', 'Clicks', 'Impressions', 'CTR (%)', 'Position'],
            data: [
              { device: 'Mobile', clicks: 4821, impressions: 98340, ctr: '4.90', position: '3.2' },
              { device: 'Desktop', clicks: 3156, impressions: 67820, ctr: '4.65', position: '2.9' },
              { device: 'Tablet', clicks: 1043, impressions: 23890, ctr: '4.37', position: '3.5' }
            ],
            _demoData: true
          };
        } else if (widgetTitle.includes('country') || widgetTitle.includes('countr')) {
          metricsData = {
            type: 'table',
            columns: ['Country', 'Clicks', 'Impressions', 'CTR (%)', 'Position'],
            data: [
              { country: 'USA', clicks: 3245, impressions: 68920, ctr: '4.71', position: '2.8' },
              { country: 'GBR', clicks: 1892, impressions: 39540, ctr: '4.78', position: '3.1' },
              { country: 'CAN', clicks: 1234, impressions: 26780, ctr: '4.61', position: '3.4' },
              { country: 'AUS', clicks: 987, impressions: 21340, ctr: '4.62', position: '3.2' },
              { country: 'DEU', clicks: 762, impressions: 17450, ctr: '4.37', position: '3.7' }
            ],
            _demoData: true
          };
        } else {
          metricsData = { value: 0, label: 'clicks', _demoData: true };
        }
      }
    } else {
      // For other platforms, return placeholder data
      metricsData = {
        value: 0,
        label: dataSource.metric || 'spend',
        message: `Platform ${account.platform} metrics coming soon`,
      };
    }

    res.json({
      success: true,
      data: metricsData,
    });
  } catch (error) {
    console.error('Get widget metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch widget metrics',
      error: error.message,
    });
  }
};

// Helper function to calculate date ranges
function getDateRange(rangeType) {
  const now = new Date();
  let since, until;

  until = now.toISOString().split('T')[0];

  switch (rangeType) {
    case 'last_7_days':
      since = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
      break;
    case 'last_30_days':
      since = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];
      break;
    case 'last_90_days':
      since = new Date(now.setDate(now.getDate() - 90)).toISOString().split('T')[0];
      break;
    case 'this_month':
      since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      until = new Date().toISOString().split('T')[0];
      break;
    case 'last_month':
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      since = lastMonth.toISOString().split('T')[0];
      until = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      break;
    default:
      since = new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];
  }

  return { since, until };
}

// Fetch metrics from Meta Ads API with time-series data
async function fetchMetaAdsMetrics(accountId, accessToken, metric, since, until) {
  const baseUrl = 'https://graph.facebook.com/v18.0';

  // Map metric names to Meta API fields
  const metricFieldMap = {
    spend: 'spend',
    impressions: 'impressions',
    clicks: 'clicks',
    ctr: 'ctr',
    cpc: 'cpc',
    cpm: 'cpm',
    reach: 'reach',
    frequency: 'frequency',
    conversions: 'actions',
    cost_per_conversion: 'cost_per_action_type',
  };

  const field = metricFieldMap[metric] || 'spend';

  try {
    // Fetch aggregate data
    const aggregateUrl = `${baseUrl}/act_${accountId}/insights?fields=${field}&time_range={"since":"${since}","until":"${until}"}&access_token=${accessToken}`;
    const aggregateResponse = await fetch(aggregateUrl);
    const aggregateData = await aggregateResponse.json();

    // Fetch time-series data (daily breakdown)
    const timeSeriesUrl = `${baseUrl}/act_${accountId}/insights?fields=${field}&time_range={"since":"${since}","until":"${until}"}&time_increment=1&access_token=${accessToken}`;
    const timeSeriesResponse = await fetch(timeSeriesUrl);
    const timeSeriesData = await timeSeriesResponse.json();

    // Calculate previous period for comparison
    const daysDiff = Math.ceil((new Date(until) - new Date(since)) / (1000 * 60 * 60 * 24));
    const prevUntil = new Date(since);
    prevUntil.setDate(prevUntil.getDate() - 1);
    const prevSince = new Date(prevUntil);
    prevSince.setDate(prevSince.getDate() - daysDiff);

    const prevUrl = `${baseUrl}/act_${accountId}/insights?fields=${field}&time_range={"since":"${prevSince.toISOString().split('T')[0]}","until":"${prevUntil.toISOString().split('T')[0]}"}&access_token=${accessToken}`;
    const prevResponse = await fetch(prevUrl);
    const prevData = await prevResponse.json();

    if (aggregateData.error) {
      console.error('Meta API error:', aggregateData.error);
      return {
        value: 0,
        label: metric,
        error: aggregateData.error.message,
      };
    }

    // Parse aggregate value
    let value = 0;
    let currency = 'USD';

    if (aggregateData.data && aggregateData.data.length > 0) {
      const insights = aggregateData.data[0];
      value = insights[field];
      currency = insights.account_currency || 'USD';

      // Handle special cases
      if (metric === 'conversions' && insights.actions) {
        value = insights.actions.reduce((sum, action) => sum + parseFloat(action.value || 0), 0);
      } else if (metric === 'cost_per_conversion' && insights.cost_per_action_type) {
        const actions = insights.cost_per_action_type;
        value = actions.length > 0
          ? actions.reduce((sum, a) => sum + parseFloat(a.value || 0), 0) / actions.length
          : 0;
      }
    }

    // Parse previous period value
    let previousValue = 0;
    if (prevData.data && prevData.data.length > 0) {
      const prevInsights = prevData.data[0];
      previousValue = prevInsights[field];

      if (metric === 'conversions' && prevInsights.actions) {
        previousValue = prevInsights.actions.reduce((sum, action) => sum + parseFloat(action.value || 0), 0);
      } else if (metric === 'cost_per_conversion' && prevInsights.cost_per_action_type) {
        const actions = prevInsights.cost_per_action_type;
        previousValue = actions.length > 0
          ? actions.reduce((sum, a) => sum + parseFloat(a.value || 0), 0) / actions.length
          : 0;
      }
    }

    // Parse time-series data
    const timeSeries = [];
    if (timeSeriesData.data && timeSeriesData.data.length > 0) {
      for (const day of timeSeriesData.data) {
        let dayValue = day[field];

        if (metric === 'conversions' && day.actions) {
          dayValue = day.actions.reduce((sum, action) => sum + parseFloat(action.value || 0), 0);
        } else if (metric === 'cost_per_conversion' && day.cost_per_action_type) {
          const actions = day.cost_per_action_type;
          dayValue = actions.length > 0
            ? actions.reduce((sum, a) => sum + parseFloat(a.value || 0), 0) / actions.length
            : 0;
        }

        timeSeries.push({
          date: day.date_start,
          value: parseFloat(dayValue) || 0,
        });
      }
    }

    // Calculate change percentage
    const changePercent = previousValue > 0
      ? ((parseFloat(value) - parseFloat(previousValue)) / parseFloat(previousValue) * 100).toFixed(1)
      : 0;

    return {
      value: parseFloat(value) || 0,
      previousValue: parseFloat(previousValue) || 0,
      changePercent: parseFloat(changePercent),
      label: metric,
      dateRange: { since, until },
      previousDateRange: {
        since: prevSince.toISOString().split('T')[0],
        until: prevUntil.toISOString().split('T')[0]
      },
      currency,
      timeSeries,
    };
  } catch (error) {
    console.error('Error fetching Meta metrics:', error);
    return {
      value: 0,
      label: metric,
      error: error.message,
    };
  }
}

module.exports = {
  getAccountMetrics,
  getWidgetMetrics,
};
