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

    // Determine widget title to check if it needs breakdown data
    const widgetTitle = widget.title?.toLowerCase() || '';
    const widgetType = widget.widget_type || 'kpi_card';

    // Fetch metrics based on platform
    let metricsData;
    if (account.platform === 'meta') {
      // Check if this is a pie chart that needs breakdown data
      if (widgetType === 'pie_chart' || widgetType === 'table' || widgetTitle.includes('breakdown') || widgetTitle.includes('device') || widgetTitle.includes('country') || widgetTitle.includes('geographic') || widgetTitle.includes('campaign') || widgetTitle.includes('ad set') || widgetTitle.includes('adset') || widgetTitle.includes('ads') || widgetTitle.includes('creative')) {
        // Return breakdown data for specific widget types
        if (widgetTitle.includes('device')) {
          metricsData = await fetchMetaAdsDeviceBreakdown(
            account.account_id,
            account.access_token,
            dataSource.metric || 'clicks',
            since,
            until
          );
        } else if (widgetTitle.includes('country') || widgetTitle.includes('geographic')) {
          metricsData = await fetchMetaAdsCountryBreakdown(
            account.account_id,
            account.access_token,
            dataSource.metric || 'clicks',
            since,
            until
          );
        } else if (widgetTitle.includes('campaign')) {
          metricsData = await fetchMetaAdsCampaignBreakdown(
            account.account_id,
            account.access_token,
            dataSource.metric || 'spend',
            since,
            until
          );
        } else if (widgetTitle.includes('ad set') || widgetTitle.includes('adset')) {
          metricsData = await fetchMetaAdsAdSetBreakdown(
            account.account_id,
            account.access_token,
            dataSource.metric || 'spend',
            since,
            until
          );
        } else if (widgetTitle.includes('ad ') || widgetTitle.includes('ads performance') || widgetTitle.includes('ads breakdown')) {
          metricsData = await fetchMetaAdsAdsBreakdown(
            account.account_id,
            account.access_token,
            dataSource.metric || 'spend',
            since,
            until
          );
        } else if (widgetTitle.includes('creative')) {
          metricsData = await fetchMetaAdsCreativeComparison(
            account.account_id,
            account.access_token,
            dataSource.metric || 'spend',
            since,
            until
          );
        } else {
          // Default breakdown for generic pie charts
          metricsData = await fetchMetaAdsDeviceBreakdown(
            account.account_id,
            account.access_token,
            dataSource.metric || 'clicks',
            since,
            until
          );
        }
      } else {
        // Regular time-series metrics
        metricsData = await fetchMetaAdsMetrics(
          account.account_id,
          account.access_token,
          dataSource.metric || 'spend',
          since,
          until
        );
      }
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
    roas: 'purchase_roas', // Meta's built-in ROAS for website purchases
  };

  const field = metricFieldMap[metric] || 'spend';

  // For ROAS, we need to fetch both action_values and spend to calculate it
  const isROAS = metric === 'roas';
  const fieldsToFetch = isROAS ? 'spend,action_values,actions,purchase_roas' : field;

  try {
    // Fetch aggregate data
    const aggregateUrl = `${baseUrl}/act_${accountId}/insights?fields=${fieldsToFetch}&time_range={"since":"${since}","until":"${until}"}&access_token=${accessToken}`;
    const aggregateResponse = await fetch(aggregateUrl);
    const aggregateData = await aggregateResponse.json();

    // Fetch time-series data (daily breakdown)
    const timeSeriesUrl = `${baseUrl}/act_${accountId}/insights?fields=${fieldsToFetch}&time_range={"since":"${since}","until":"${until}"}&time_increment=1&access_token=${accessToken}`;
    const timeSeriesResponse = await fetch(timeSeriesUrl);
    const timeSeriesData = await timeSeriesResponse.json();

    // Calculate previous period for comparison
    const daysDiff = Math.ceil((new Date(until) - new Date(since)) / (1000 * 60 * 60 * 24));
    const prevUntil = new Date(since);
    prevUntil.setDate(prevUntil.getDate() - 1);
    const prevSince = new Date(prevUntil);
    prevSince.setDate(prevSince.getDate() - daysDiff);

    const prevUrl = `${baseUrl}/act_${accountId}/insights?fields=${fieldsToFetch}&time_range={"since":"${prevSince.toISOString().split('T')[0]}","until":"${prevUntil.toISOString().split('T')[0]}"}&access_token=${accessToken}`;
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
      currency = insights.account_currency || 'USD';

      // Handle special cases
      if (metric === 'roas') {
        // Try Meta's built-in purchase_roas first
        let hasConversionTracking = false;
        if (insights.purchase_roas && insights.purchase_roas.length > 0) {
          value = parseFloat(insights.purchase_roas[0].value || 0);
          hasConversionTracking = true;
        } else {
          // Fallback: Calculate manually as (purchase value) / spend
          let purchaseValue = 0;
          if (insights.action_values) {
            const purchases = insights.action_values.filter(av =>
              av.action_type === 'omni_purchase' ||
              av.action_type === 'purchase' ||
              av.action_type === 'offsite_conversion.fb_pixel_purchase'
            );
            purchaseValue = purchases.reduce((sum, p) => sum + parseFloat(p.value || 0), 0);
            if (purchaseValue > 0) hasConversionTracking = true;
          }
          const spend = parseFloat(insights.spend || 0);
          value = spend > 0 ? purchaseValue / spend : 0;
        }

        // Store warning if no conversion tracking detected
        if (!hasConversionTracking || value === 0) {
          currency = 'SETUP_REQUIRED';
        }
      } else if (metric === 'conversions' && insights.actions) {
        value = insights.actions.reduce((sum, action) => sum + parseFloat(action.value || 0), 0);
      } else if (metric === 'cost_per_conversion' && insights.cost_per_action_type) {
        const actions = insights.cost_per_action_type;
        value = actions.length > 0
          ? actions.reduce((sum, a) => sum + parseFloat(a.value || 0), 0) / actions.length
          : 0;
      } else {
        value = insights[field];
      }
    }

    // Parse previous period value
    let previousValue = 0;
    if (prevData.data && prevData.data.length > 0) {
      const prevInsights = prevData.data[0];

      if (metric === 'roas') {
        // Try Meta's built-in purchase_roas first
        if (prevInsights.purchase_roas && prevInsights.purchase_roas.length > 0) {
          previousValue = parseFloat(prevInsights.purchase_roas[0].value || 0);
        } else {
          // Fallback: Calculate manually as (purchase value) / spend
          let purchaseValue = 0;
          if (prevInsights.action_values) {
            const purchases = prevInsights.action_values.filter(av =>
              av.action_type === 'omni_purchase' ||
              av.action_type === 'purchase' ||
              av.action_type === 'offsite_conversion.fb_pixel_purchase'
            );
            purchaseValue = purchases.reduce((sum, p) => sum + parseFloat(p.value || 0), 0);
          }
          const spend = parseFloat(prevInsights.spend || 0);
          previousValue = spend > 0 ? purchaseValue / spend : 0;
        }
      } else if (metric === 'conversions' && prevInsights.actions) {
        previousValue = prevInsights.actions.reduce((sum, action) => sum + parseFloat(action.value || 0), 0);
      } else if (metric === 'cost_per_conversion' && prevInsights.cost_per_action_type) {
        const actions = prevInsights.cost_per_action_type;
        previousValue = actions.length > 0
          ? actions.reduce((sum, a) => sum + parseFloat(a.value || 0), 0) / actions.length
          : 0;
      } else {
        previousValue = prevInsights[field];
      }
    }

    // Parse time-series data
    const timeSeries = [];
    if (timeSeriesData.data && timeSeriesData.data.length > 0) {
      for (const day of timeSeriesData.data) {
        let dayValue;

        if (metric === 'roas') {
          // Try Meta's built-in purchase_roas first
          if (day.purchase_roas && day.purchase_roas.length > 0) {
            dayValue = parseFloat(day.purchase_roas[0].value || 0);
          } else {
            // Fallback: Calculate manually as (purchase value) / spend
            let purchaseValue = 0;
            if (day.action_values) {
              const purchases = day.action_values.filter(av =>
                av.action_type === 'omni_purchase' ||
                av.action_type === 'purchase' ||
                av.action_type === 'offsite_conversion.fb_pixel_purchase'
              );
              purchaseValue = purchases.reduce((sum, p) => sum + parseFloat(p.value || 0), 0);
            }
            const daySpend = parseFloat(day.spend || 0);
            dayValue = daySpend > 0 ? purchaseValue / daySpend : 0;
          }
        } else if (metric === 'conversions' && day.actions) {
          dayValue = day.actions.reduce((sum, action) => sum + parseFloat(action.value || 0), 0);
        } else if (metric === 'cost_per_conversion' && day.cost_per_action_type) {
          const actions = day.cost_per_action_type;
          dayValue = actions.length > 0
            ? actions.reduce((sum, a) => sum + parseFloat(a.value || 0), 0) / actions.length
            : 0;
        } else {
          dayValue = day[field];
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

// Fetch device breakdown from Meta Ads API
async function fetchMetaAdsDeviceBreakdown(accountId, accessToken, metric, since, until) {
  const baseUrl = 'https://graph.facebook.com/v18.0';

  const metricFieldMap = {
    spend: 'spend',
    impressions: 'impressions',
    clicks: 'clicks',
    reach: 'reach',
    conversions: 'actions'
  };

  const field = metricFieldMap[metric] || 'clicks';

  try {
    const url = `${baseUrl}/act_${accountId}/insights?fields=${field}&breakdowns=impression_device&time_range={"since":"${since}","until":"${until}"}&access_token=${accessToken}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('Meta API error:', data.error);
      return {
        type: 'table',
        columns: ['Device', 'Value'],
        data: [],
        _demoData: true
      };
    }

    const devices = {};
    if (data.data && data.data.length > 0) {
      for (const item of data.data) {
        const device = item.impression_device || 'Unknown';

        // Clean and standardize device names
        let deviceName;
        if (device === 'desktop') {
          deviceName = 'Desktop';
        } else if (device === 'mobile_app' || device === 'mobile_web' || device === 'android_smartphone') {
          deviceName = 'Mobile';
        } else if (device === 'iphone') {
          deviceName = 'iPhone';
        } else if (device === 'ipad' || device === 'android_tablet') {
          deviceName = 'Tablet';
        } else if (device === 'ig_android_app' || device === 'ig_ios_app') {
          deviceName = 'Instagram';
        } else if (device === 'ipod') {
          deviceName = 'iPod';
        } else {
          deviceName = device.charAt(0).toUpperCase() + device.slice(1).replace(/_/g, ' ');
        }

        let value = item[field] || 0;
        if (metric === 'conversions' && item.actions) {
          value = item.actions.reduce((sum, action) => sum + parseFloat(action.value || 0), 0);
        }

        if (!devices[deviceName]) {
          devices[deviceName] = 0;
        }
        devices[deviceName] += parseFloat(value);
      }
    }

    // Sort by value and filter out zero/tiny values
    const deviceData = Object.keys(devices)
      .map(device => ({
        device: device,
        value: devices[device]
      }))
      .filter(d => d.value > 0) // Remove 0% items
      .sort((a, b) => b.value - a.value);

    // Calculate total for percentage calculation
    const total = deviceData.reduce((sum, d) => sum + d.value, 0);

    // Group small segments (< 2%) into "Other"
    const threshold = total * 0.02; // 2% threshold
    const mainDevices = [];
    let otherTotal = 0;

    for (const device of deviceData) {
      if (device.value >= threshold || mainDevices.length < 3) {
        // Keep top 3 devices and any device > 2%
        mainDevices.push(device);
      } else {
        otherTotal += device.value;
      }
    }

    // Add "Other" category if we grouped anything
    if (otherTotal > 0) {
      mainDevices.push({
        device: 'Other',
        value: otherTotal
      });
    }

    return {
      type: 'table',
      columns: ['Device', 'Clicks'],
      data: mainDevices.map(d => ({
        device: d.device,
        clicks: Math.round(d.value)
      }))
    };
  } catch (error) {
    console.error('Error fetching Meta device breakdown:', error);
    return {
      type: 'table',
      columns: ['Device', 'Clicks'],
      data: [],
      _demoData: true
    };
  }
}

// Country code to name mapping
const countryCodeMap = {
  'US': 'United States',
  'GB': 'United Kingdom',
  'CA': 'Canada',
  'AU': 'Australia',
  'DE': 'Germany',
  'FR': 'France',
  'IT': 'Italy',
  'ES': 'Spain',
  'NL': 'Netherlands',
  'BE': 'Belgium',
  'CH': 'Switzerland',
  'AT': 'Austria',
  'SE': 'Sweden',
  'NO': 'Norway',
  'DK': 'Denmark',
  'FI': 'Finland',
  'IE': 'Ireland',
  'PT': 'Portugal',
  'PL': 'Poland',
  'CZ': 'Czech Republic',
  'RO': 'Romania',
  'GR': 'Greece',
  'HU': 'Hungary',
  'BG': 'Bulgaria',
  'SK': 'Slovakia',
  'SI': 'Slovenia',
  'HR': 'Croatia',
  'LT': 'Lithuania',
  'LV': 'Latvia',
  'EE': 'Estonia',
  'TR': 'Turkey',
  'RU': 'Russia',
  'UA': 'Ukraine',
  'BY': 'Belarus',
  'RS': 'Serbia',
  'BA': 'Bosnia',
  'MK': 'North Macedonia',
  'AL': 'Albania',
  'ME': 'Montenegro',
  'IS': 'Iceland',
  'BR': 'Brazil',
  'MX': 'Mexico',
  'AR': 'Argentina',
  'CO': 'Colombia',
  'CL': 'Chile',
  'PE': 'Peru',
  'VE': 'Venezuela',
  'EC': 'Ecuador',
  'BO': 'Bolivia',
  'PY': 'Paraguay',
  'UY': 'Uruguay',
  'CN': 'China',
  'JP': 'Japan',
  'KR': 'South Korea',
  'IN': 'India',
  'ID': 'Indonesia',
  'TH': 'Thailand',
  'MY': 'Malaysia',
  'SG': 'Singapore',
  'PH': 'Philippines',
  'VN': 'Vietnam',
  'PK': 'Pakistan',
  'BD': 'Bangladesh',
  'LK': 'Sri Lanka',
  'NP': 'Nepal',
  'MM': 'Myanmar',
  'KH': 'Cambodia',
  'LA': 'Laos',
  'HK': 'Hong Kong',
  'TW': 'Taiwan',
  'MO': 'Macau',
  'AE': 'UAE',
  'SA': 'Saudi Arabia',
  'IL': 'Israel',
  'EG': 'Egypt',
  'ZA': 'South Africa',
  'NG': 'Nigeria',
  'KE': 'Kenya',
  'GH': 'Ghana',
  'MA': 'Morocco',
  'DZ': 'Algeria',
  'TN': 'Tunisia',
  'LY': 'Libya',
  'SD': 'Sudan',
  'ET': 'Ethiopia',
  'UG': 'Uganda',
  'TZ': 'Tanzania',
  'AO': 'Angola',
  'MZ': 'Mozambique',
  'ZW': 'Zimbabwe',
  'ZM': 'Zambia',
  'BW': 'Botswana',
  'NA': 'Namibia',
  'SN': 'Senegal',
  'CI': 'Ivory Coast',
  'CM': 'Cameroon',
  'NZ': 'New Zealand',
  'AZ': 'Azerbaijan',
  'GE': 'Georgia',
  'AM': 'Armenia',
  'KZ': 'Kazakhstan',
  'UZ': 'Uzbekistan',
  'KG': 'Kyrgyzstan',
  'TJ': 'Tajikistan',
  'TM': 'Turkmenistan',
  'IQ': 'Iraq',
  'IR': 'Iran',
  'SY': 'Syria',
  'JO': 'Jordan',
  'LB': 'Lebanon',
  'KW': 'Kuwait',
  'OM': 'Oman',
  'QA': 'Qatar',
  'BH': 'Bahrain',
  'YE': 'Yemen'
};

// Fetch country breakdown from Meta Ads API
async function fetchMetaAdsCountryBreakdown(accountId, accessToken, metric, since, until) {
  const baseUrl = 'https://graph.facebook.com/v18.0';

  const metricFieldMap = {
    spend: 'spend',
    impressions: 'impressions',
    clicks: 'clicks',
    reach: 'reach',
    conversions: 'actions'
  };

  const field = metricFieldMap[metric] || 'clicks';

  try {
    const url = `${baseUrl}/act_${accountId}/insights?fields=${field}&breakdowns=country&time_range={"since":"${since}","until":"${until}"}&access_token=${accessToken}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('Meta API error:', data.error);
      return {
        type: 'table',
        columns: ['Country', 'Value'],
        data: [],
        _demoData: true
      };
    }

    const countries = {};
    if (data.data && data.data.length > 0) {
      for (const item of data.data) {
        const countryCode = item.country || 'Unknown';

        let value = item[field] || 0;
        if (metric === 'conversions' && item.actions) {
          value = item.actions.reduce((sum, action) => sum + parseFloat(action.value || 0), 0);
        }

        if (!countries[countryCode]) {
          countries[countryCode] = 0;
        }
        countries[countryCode] += parseFloat(value);
      }
    }

    const countryData = Object.keys(countries).map(countryCode => {
      // Convert country code to full name, fallback to code if not found
      const countryName = countryCodeMap[countryCode] || countryCode;

      return {
        country: countryName,
        countryCode: countryCode,
        value: countries[countryCode]
      };
    }).sort((a, b) => b.value - a.value).slice(0, 10); // Top 10 countries

    // If only one country, add a note
    const isSingleCountry = countryData.length === 1;

    return {
      type: 'table',
      columns: ['Country', 'Clicks', 'Code'],
      data: countryData.map(c => ({
        country: isSingleCountry ? `${c.country} (Only market)` : c.country,
        clicks: Math.round(c.value),
        code: c.countryCode
      }))
    };
  } catch (error) {
    console.error('Error fetching Meta country breakdown:', error);
    return {
      type: 'table',
      columns: ['Country', 'Clicks'],
      data: [],
      _demoData: true
    };
  }
}

// Fetch campaign breakdown from Meta Ads API
async function fetchMetaAdsCampaignBreakdown(accountId, accessToken, metric, since, until) {
  const baseUrl = 'https://graph.facebook.com/v18.0';

  const metricFieldMap = {
    spend: 'spend',
    impressions: 'impressions',
    clicks: 'clicks',
    reach: 'reach',
    conversions: 'actions'
  };

  const field = metricFieldMap[metric] || 'spend';

  try {
    const url = `${baseUrl}/act_${accountId}/campaigns?fields=name,insights.time_range({"since":"${since}","until":"${until}"}){${field}}&access_token=${accessToken}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('Meta API error:', data.error);
      return {
        type: 'table',
        columns: ['Campaign', 'Spend'],
        data: [],
        _demoData: true
      };
    }

    const campaigns = [];
    if (data.data && data.data.length > 0) {
      for (const campaign of data.data) {
        if (campaign.insights && campaign.insights.data && campaign.insights.data.length > 0) {
          const insight = campaign.insights.data[0];
          let value = insight[field] || 0;

          if (metric === 'conversions' && insight.actions) {
            value = insight.actions.reduce((sum, action) => sum + parseFloat(action.value || 0), 0);
          }

          campaigns.push({
            campaign: campaign.name,
            value: parseFloat(value)
          });
        }
      }
    }

    campaigns.sort((a, b) => b.value - a.value);

    return {
      type: 'table',
      columns: ['Campaign', metric === 'spend' ? 'Spend' : 'Clicks'],
      data: campaigns.slice(0, 10).map(c => ({
        campaign: c.campaign,
        [metric === 'spend' ? 'spend' : 'clicks']: metric === 'spend' ? c.value.toFixed(2) : Math.round(c.value)
      }))
    };
  } catch (error) {
    console.error('Error fetching Meta campaign breakdown:', error);
    return {
      type: 'table',
      columns: ['Campaign', 'Spend'],
      data: [],
      _demoData: true
    };
  }
}

// Fetch ad sets breakdown from Meta Ads API
async function fetchMetaAdsAdSetBreakdown(accountId, accessToken, metric, since, until) {
  const baseUrl = 'https://graph.facebook.com/v18.0';

  const metricFieldMap = {
    spend: 'spend',
    impressions: 'impressions',
    clicks: 'clicks',
    reach: 'reach',
    conversions: 'actions',
    ctr: 'ctr',
    cpc: 'cpc'
  };

  const field = metricFieldMap[metric] || 'spend';

  try {
    // Fetch comprehensive metrics for ad sets
    const url = `${baseUrl}/act_${accountId}/adsets?fields=name,status,campaign{name},insights.time_range({"since":"${since}","until":"${until}"}){spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type,purchase_roas}&access_token=${accessToken}&limit=100`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('Meta API error:', data.error);
      return {
        type: 'table',
        columns: ['Ad Set', 'Campaign', 'Status', 'Spend', 'Impressions', 'Clicks', 'CTR', 'CPC', 'CPM', 'Reach', 'Frequency', 'Conversions', 'Cost/Conv', 'ROAS'],
        data: [],
        _demoData: true
      };
    }

    const adSets = [];
    if (data.data && data.data.length > 0) {
      for (const adSet of data.data) {
        if (adSet.insights && adSet.insights.data && adSet.insights.data.length > 0) {
          const insight = adSet.insights.data[0];

          // Calculate conversions
          let conversions = 0;
          if (insight.actions) {
            conversions = insight.actions.reduce((sum, action) => sum + parseFloat(action.value || 0), 0);
          }

          // Calculate cost per conversion
          let costPerConversion = 0;
          if (insight.cost_per_action_type && insight.cost_per_action_type.length > 0) {
            costPerConversion = insight.cost_per_action_type.reduce((sum, a) => sum + parseFloat(a.value || 0), 0) / insight.cost_per_action_type.length;
          } else if (conversions > 0) {
            costPerConversion = parseFloat(insight.spend || 0) / conversions;
          }

          // Get ROAS
          let roas = 0;
          if (insight.purchase_roas && insight.purchase_roas.length > 0) {
            roas = parseFloat(insight.purchase_roas[0].value || 0);
          }

          // Get primary metric value for sorting
          let value = insight[field] || 0;
          if (metric === 'conversions' && insight.actions) {
            value = conversions;
          }

          adSets.push({
            name: adSet.name,
            campaign: adSet.campaign ? adSet.campaign.name : 'N/A',
            status: adSet.status || 'UNKNOWN',
            spend: parseFloat(insight.spend || 0),
            impressions: parseInt(insight.impressions || 0),
            clicks: parseInt(insight.clicks || 0),
            ctr: parseFloat(insight.ctr || 0),
            cpc: parseFloat(insight.cpc || 0),
            cpm: parseFloat(insight.cpm || 0),
            reach: parseInt(insight.reach || 0),
            frequency: parseFloat(insight.frequency || 0),
            conversions: conversions,
            costPerConversion: costPerConversion,
            roas: roas,
            primaryValue: parseFloat(value)
          });
        }
      }
    }

    adSets.sort((a, b) => b.primaryValue - a.primaryValue);

    return {
      type: 'table',
      columns: ['Ad Set Name', 'Campaign', 'Status', 'Results', 'Budget Spent', 'People Reached', 'Impressions', 'Link Clicks', 'Click Rate (CTR)', 'Cost per Click', 'Cost per 1K (CPM)', 'Conversions', 'Conv. Rate', 'Cost/Conversion', 'ROAS'],
      data: adSets.slice(0, 50).map(a => {
        // Calculate conversion rate
        const conversionRate = a.clicks > 0 ? (a.conversions / a.clicks) * 100 : 0;

        // Format status with visual indicator
        let statusDisplay = a.status;
        if (a.status === 'ACTIVE') {
          statusDisplay = '● Active';
        } else if (a.status === 'PAUSED') {
          statusDisplay = '○ Paused';
        } else if (a.status === 'ARCHIVED') {
          statusDisplay = '□ Archived';
        }

        // Calculate results score (clicks + conversions * 10)
        const resultsScore = a.clicks + (a.conversions * 10);

        return {
          ad_set_name: a.name,
          campaign: a.campaign,
          status: statusDisplay,
          results: resultsScore.toLocaleString(),
          budget_spent: '$' + a.spend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}),
          people_reached: a.reach.toLocaleString(),
          impressions: a.impressions.toLocaleString(),
          link_clicks: a.clicks.toLocaleString(),
          click_rate_ctr: (a.ctr * 100).toFixed(2) + '%',
          cost_per_click: '$' + a.cpc.toFixed(2),
          cost_per_1k_cpm: '$' + a.cpm.toFixed(2),
          conversions: a.conversions.toLocaleString(),
          conv_rate: conversionRate > 0 ? conversionRate.toFixed(2) + '%' : '0%',
          cost_conversion: a.costPerConversion > 0 ? '$' + a.costPerConversion.toFixed(2) : '-',
          roas: a.roas > 0 ? a.roas.toFixed(2) + 'x' : '-'
        };
      })
    };
  } catch (error) {
    console.error('Error fetching Meta ad set breakdown:', error);
    return {
      type: 'table',
      columns: ['Ad Set Name', 'Campaign', 'Status', 'Results', 'Budget Spent', 'People Reached', 'Impressions', 'Link Clicks', 'Click Rate (CTR)', 'Cost per Click', 'Cost per 1K (CPM)', 'Conversions', 'Conv. Rate', 'Cost/Conversion', 'ROAS'],
      data: [],
      _demoData: true
    };
  }
}

// Fetch ads breakdown from Meta Ads API
async function fetchMetaAdsAdsBreakdown(accountId, accessToken, metric, since, until) {
  const baseUrl = 'https://graph.facebook.com/v18.0';

  const metricFieldMap = {
    spend: 'spend',
    impressions: 'impressions',
    clicks: 'clicks',
    reach: 'reach',
    conversions: 'actions',
    ctr: 'ctr',
    cpc: 'cpc'
  };

  const field = metricFieldMap[metric] || 'spend';

  try {
    // Fetch comprehensive metrics for ads including adset and campaign info
    const url = `${baseUrl}/act_${accountId}/ads?fields=name,status,adset{name,campaign{name}},insights.time_range({"since":"${since}","until":"${until}"}){spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type,purchase_roas,video_play_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions}&access_token=${accessToken}&limit=100`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('Meta API error:', data.error);
      return {
        type: 'table',
        columns: ['Ad Name', 'Ad Set', 'Campaign', 'Status', 'Performance Score', 'Budget Spent', 'People Reached', 'Impressions', 'Link Clicks', 'Click Rate (CTR)', 'Cost per Click', 'Avg. Frequency', 'Conversions', 'Conv. Rate', 'Cost/Conversion', 'Return on Ad Spend', 'Video Plays'],
        data: [],
        _demoData: true
      };
    }

    const ads = [];
    if (data.data && data.data.length > 0) {
      for (const ad of data.data) {
        if (ad.insights && ad.insights.data && ad.insights.data.length > 0) {
          const insight = ad.insights.data[0];

          // Calculate conversions
          let conversions = 0;
          if (insight.actions) {
            conversions = insight.actions.reduce((sum, action) => sum + parseFloat(action.value || 0), 0);
          }

          // Calculate cost per conversion
          let costPerConversion = 0;
          if (insight.cost_per_action_type && insight.cost_per_action_type.length > 0) {
            costPerConversion = insight.cost_per_action_type.reduce((sum, a) => sum + parseFloat(a.value || 0), 0) / insight.cost_per_action_type.length;
          } else if (conversions > 0) {
            costPerConversion = parseFloat(insight.spend || 0) / conversions;
          }

          // Get ROAS
          let roas = 0;
          if (insight.purchase_roas && insight.purchase_roas.length > 0) {
            roas = parseFloat(insight.purchase_roas[0].value || 0);
          }

          // Get video views (plays)
          let videoViews = 0;
          if (insight.video_play_actions && insight.video_play_actions.length > 0) {
            videoViews = insight.video_play_actions.reduce((sum, v) => sum + parseFloat(v.value || 0), 0);
          }

          // Get primary metric value for sorting
          let value = insight[field] || 0;
          if (metric === 'conversions' && insight.actions) {
            value = conversions;
          }

          // Get ad set and campaign names
          const adSetName = ad.adset ? ad.adset.name : 'N/A';
          const campaignName = ad.adset && ad.adset.campaign ? ad.adset.campaign.name : 'N/A';

          ads.push({
            name: ad.name,
            adSet: adSetName,
            campaign: campaignName,
            status: ad.status || 'UNKNOWN',
            spend: parseFloat(insight.spend || 0),
            impressions: parseInt(insight.impressions || 0),
            clicks: parseInt(insight.clicks || 0),
            ctr: parseFloat(insight.ctr || 0),
            cpc: parseFloat(insight.cpc || 0),
            cpm: parseFloat(insight.cpm || 0),
            reach: parseInt(insight.reach || 0),
            frequency: parseFloat(insight.frequency || 0),
            conversions: conversions,
            costPerConversion: costPerConversion,
            roas: roas,
            videoViews: videoViews,
            primaryValue: parseFloat(value)
          });
        }
      }
    }

    ads.sort((a, b) => b.primaryValue - a.primaryValue);

    return {
      type: 'table',
      columns: ['Ad Name', 'Ad Set', 'Campaign', 'Status', 'Performance Score', 'Budget Spent', 'People Reached', 'Impressions', 'Link Clicks', 'Click Rate (CTR)', 'Cost per Click', 'Avg. Frequency', 'Conversions', 'Conv. Rate', 'Cost/Conversion', 'Return on Ad Spend', 'Video Plays'],
      data: ads.slice(0, 50).map(a => {
        // Calculate conversion rate
        const conversionRate = a.clicks > 0 ? (a.conversions / a.clicks) * 100 : 0;

        // Calculate performance score based on CTR, conversions, and ROAS
        const ctrScore = (a.ctr * 100) * 10; // CTR weight
        const conversionScore = a.conversions * 50; // Conversion weight
        const roasScore = a.roas * 20; // ROAS weight
        const performanceScore = Math.round(ctrScore + conversionScore + roasScore);

        // Format status with visual indicator
        let statusDisplay = a.status;
        if (a.status === 'ACTIVE') {
          statusDisplay = '● Active';
        } else if (a.status === 'PAUSED') {
          statusDisplay = '○ Paused';
        } else if (a.status === 'ARCHIVED') {
          statusDisplay = '□ Archived';
        }

        return {
          ad_name: a.name,
          ad_set: a.adSet,
          campaign: a.campaign,
          status: statusDisplay,
          performance_score: performanceScore.toLocaleString(),
          budget_spent: '$' + a.spend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}),
          people_reached: a.reach.toLocaleString(),
          impressions: a.impressions.toLocaleString(),
          link_clicks: a.clicks.toLocaleString(),
          click_rate_ctr: (a.ctr * 100).toFixed(2) + '%',
          cost_per_click: '$' + a.cpc.toFixed(2),
          avg_frequency: a.frequency.toFixed(2) + 'x',
          conversions: a.conversions.toLocaleString(),
          conv_rate: conversionRate > 0 ? conversionRate.toFixed(2) + '%' : '0%',
          cost_conversion: a.costPerConversion > 0 ? '$' + a.costPerConversion.toFixed(2) : 'No Conv.',
          return_on_ad_spend: a.roas > 0 ? a.roas.toFixed(2) + 'x' : 'No Data',
          video_plays: a.videoViews > 0 ? a.videoViews.toLocaleString() : '-'
        };
      })
    };
  } catch (error) {
    console.error('Error fetching Meta ads breakdown:', error);
    return {
      type: 'table',
      columns: ['Ad Name', 'Ad Set', 'Campaign', 'Status', 'Performance Score', 'Budget Spent', 'People Reached', 'Impressions', 'Link Clicks', 'Click Rate (CTR)', 'Cost per Click', 'Avg. Frequency', 'Conversions', 'Conv. Rate', 'Cost/Conversion', 'Return on Ad Spend', 'Video Plays'],
      data: [],
      _demoData: true
    };
  }
}

// Fetch creative comparison from Meta Ads API
async function fetchMetaAdsCreativeComparison(accountId, accessToken, metric, since, until) {
  const baseUrl = 'https://graph.facebook.com/v18.0';

  try {
    // Fetch ads with comprehensive creative information and engagement metrics
    const url = `${baseUrl}/act_${accountId}/ads?fields=name,status,adset{name,campaign{name}},creative{object_story_spec,image_url,image_hash,video_id,thumbnail_url,effective_object_story_id},insights.time_range({"since":"${since}","until":"${until}"}){spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type,purchase_roas,video_play_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,engagement,post_engagement,link_url_clicks,post_reactions,post_shares,post_comments}&access_token=${accessToken}&limit=100`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('Meta API error:', data.error);
      return {
        type: 'table',
        columns: ['Creative/Ad Name', 'Type', 'Campaign', 'Ad Set', 'Status', 'Quality Score', 'Budget Spent', 'People Reached', 'Total Impressions', 'Link Clicks', 'Click Rate', 'Cost/Click', 'Engagement Rate', 'Total Engagement', 'Conversions', 'Conv. Rate', 'Cost/Conv.', 'ROAS', 'Video Completion'],
        data: [],
        _demoData: true
      };
    }

    const creatives = [];
    const creativeGroups = {}; // Group by creative hash for comparison

    if (data.data && data.data.length > 0) {
      for (const ad of data.data) {
        if (ad.insights && ad.insights.data && ad.insights.data.length > 0) {
          const insight = ad.insights.data[0];
          const creative = ad.creative || {};

          // Determine creative type and ID
          let creativeType = 'Unknown';
          let creativeId = creative.image_hash || creative.video_id || creative.effective_object_story_id || ad.id;

          if (creative.video_id) {
            creativeType = 'Video';
          } else if (creative.image_url || creative.image_hash) {
            creativeType = 'Image';
          } else if (creative.object_story_spec) {
            const spec = creative.object_story_spec;
            if (spec.link_data && spec.link_data.child_attachments) {
              creativeType = 'Carousel';
            } else if (spec.video_data) {
              creativeType = 'Video';
            } else {
              creativeType = 'Link/Post';
            }
          }

          // Calculate conversions
          let conversions = 0;
          if (insight.actions) {
            conversions = insight.actions.reduce((sum, action) => sum + parseFloat(action.value || 0), 0);
          }

          // Calculate cost per conversion
          let costPerConversion = 0;
          if (insight.cost_per_action_type && insight.cost_per_action_type.length > 0) {
            costPerConversion = insight.cost_per_action_type.reduce((sum, a) => sum + parseFloat(a.value || 0), 0) / insight.cost_per_action_type.length;
          } else if (conversions > 0) {
            costPerConversion = parseFloat(insight.spend || 0) / conversions;
          }

          // Get ROAS
          let roas = 0;
          if (insight.purchase_roas && insight.purchase_roas.length > 0) {
            roas = parseFloat(insight.purchase_roas[0].value || 0);
          }

          // Get video completion rate (100% views)
          let video100 = 0;
          if (insight.video_p100_watched_actions && insight.video_p100_watched_actions.length > 0) {
            video100 = insight.video_p100_watched_actions.reduce((sum, v) => sum + parseFloat(v.value || 0), 0);
          }

          // Calculate video completion rate percentage
          let videoCompletionRate = 0;
          const videoPlays = insight.video_play_actions && insight.video_play_actions.length > 0
            ? insight.video_play_actions.reduce((sum, v) => sum + parseFloat(v.value || 0), 0)
            : 0;
          if (videoPlays > 0 && video100 > 0) {
            videoCompletionRate = (video100 / videoPlays) * 100;
          }

          // Get engagement metrics
          let engagement = 0;
          if (insight.post_engagement) {
            engagement = parseInt(insight.post_engagement || 0);
          } else if (insight.engagement) {
            engagement = parseInt(insight.engagement || 0);
          }

          // Get link clicks
          let linkClicks = 0;
          if (insight.link_url_clicks) {
            linkClicks = parseInt(insight.link_url_clicks || 0);
          }

          // Get ad set and campaign names
          const adSetName = ad.adset ? ad.adset.name : 'N/A';
          const campaignName = ad.adset && ad.adset.campaign ? ad.adset.campaign.name : 'N/A';

          const creativeData = {
            name: ad.name,
            creativeId: creativeId,
            type: creativeType,
            campaign: campaignName,
            adSet: adSetName,
            status: ad.status || 'UNKNOWN',
            spend: parseFloat(insight.spend || 0),
            impressions: parseInt(insight.impressions || 0),
            clicks: parseInt(insight.clicks || 0),
            ctr: parseFloat(insight.ctr || 0),
            cpc: parseFloat(insight.cpc || 0),
            cpm: parseFloat(insight.cpm || 0),
            reach: parseInt(insight.reach || 0),
            frequency: parseFloat(insight.frequency || 0),
            conversions: conversions,
            costPerConversion: costPerConversion,
            roas: roas,
            video100: video100,
            videoCompletionRate: videoCompletionRate,
            engagement: engagement,
            linkClicks: linkClicks
          };

          creatives.push(creativeData);

          // Group creatives by creative ID for comparison
          if (!creativeGroups[creativeId]) {
            creativeGroups[creativeId] = [];
          }
          creativeGroups[creativeId].push(creativeData);
        }
      }
    }

    // Sort by spend (highest first)
    creatives.sort((a, b) => b.spend - a.spend);

    return {
      type: 'table',
      columns: ['Creative/Ad Name', 'Type', 'Campaign', 'Ad Set', 'Status', 'Quality Score', 'Budget Spent', 'People Reached', 'Total Impressions', 'Link Clicks', 'Click Rate', 'Cost/Click', 'Engagement Rate', 'Total Engagement', 'Conversions', 'Conv. Rate', 'Cost/Conv.', 'ROAS', 'Video Completion'],
      data: creatives.slice(0, 50).map(c => {
        // Calculate conversion rate
        const conversionRate = c.clicks > 0 ? (c.conversions / c.clicks) * 100 : 0;

        // Calculate engagement rate
        const engagementRate = c.impressions > 0 ? (c.engagement / c.impressions) * 100 : 0;

        // Calculate quality score based on CTR, engagement, and completion
        const ctrScore = (c.ctr * 100) * 15; // CTR weight
        const engagementScore = engagementRate * 10; // Engagement weight
        const videoScore = c.videoCompletionRate * 5; // Video completion weight
        const qualityScore = Math.round(ctrScore + engagementScore + videoScore);

        // Format status with visual indicator
        let statusDisplay = c.status;
        if (c.status === 'ACTIVE') {
          statusDisplay = '● Active';
        } else if (c.status === 'PAUSED') {
          statusDisplay = '○ Paused';
        } else if (c.status === 'ARCHIVED') {
          statusDisplay = '□ Archived';
        }

        // Format creative type with icon
        let typeDisplay = c.type;
        if (c.type === 'Video') {
          typeDisplay = '▶ Video';
        } else if (c.type === 'Image') {
          typeDisplay = '◼ Image';
        } else if (c.type === 'Carousel') {
          typeDisplay = '⊞ Carousel';
        } else if (c.type === 'Link/Post') {
          typeDisplay = '◈ Link/Post';
        }

        return {
          creative_ad_name: c.name,
          type: typeDisplay,
          campaign: c.campaign,
          ad_set: c.adSet,
          status: statusDisplay,
          quality_score: qualityScore.toLocaleString(),
          budget_spent: '$' + c.spend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}),
          people_reached: c.reach.toLocaleString(),
          total_impressions: c.impressions.toLocaleString(),
          link_clicks: c.clicks.toLocaleString(),
          click_rate: (c.ctr * 100).toFixed(2) + '%',
          cost_click: '$' + c.cpc.toFixed(2),
          engagement_rate: engagementRate > 0 ? engagementRate.toFixed(2) + '%' : '0%',
          total_engagement: c.engagement > 0 ? c.engagement.toLocaleString() : '0',
          conversions: c.conversions.toLocaleString(),
          conv_rate: conversionRate > 0 ? conversionRate.toFixed(2) + '%' : '0%',
          cost_conv: c.costPerConversion > 0 ? '$' + c.costPerConversion.toFixed(2) : 'No Conv.',
          roas: c.roas > 0 ? c.roas.toFixed(2) + 'x' : 'No Data',
          video_completion: c.video100 > 0 ? c.video100.toLocaleString() + ' (' + c.videoCompletionRate.toFixed(1) + '%)' : 'N/A'
        };
      }),
      _creativeGroups: Object.keys(creativeGroups).length // For future grouped view
    };
  } catch (error) {
    console.error('Error fetching Meta creative comparison:', error);
    return {
      type: 'table',
      columns: ['Creative/Ad Name', 'Type', 'Campaign', 'Ad Set', 'Status', 'Quality Score', 'Budget Spent', 'People Reached', 'Total Impressions', 'Link Clicks', 'Click Rate', 'Cost/Click', 'Engagement Rate', 'Total Engagement', 'Conversions', 'Conv. Rate', 'Cost/Conv.', 'ROAS', 'Video Completion'],
      data: [],
      _demoData: true
    };
  }
}

module.exports = {
  getAccountMetrics,
  getWidgetMetrics,
};
