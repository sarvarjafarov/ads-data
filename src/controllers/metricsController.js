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
      if (widgetType === 'pie_chart' || widgetTitle.includes('breakdown') || widgetTitle.includes('device') || widgetTitle.includes('country') || widgetTitle.includes('geographic')) {
        // Return breakdown data for pie charts
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
        if (insights.purchase_roas && insights.purchase_roas.length > 0) {
          value = parseFloat(insights.purchase_roas[0].value || 0);
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
          }
          const spend = parseFloat(insights.spend || 0);
          value = spend > 0 ? purchaseValue / spend : 0;
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

module.exports = {
  getAccountMetrics,
  getWidgetMetrics,
};
