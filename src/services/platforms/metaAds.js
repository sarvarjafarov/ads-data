/**
 * Meta Ads Platform Service
 * Handles OAuth and metrics fetching for Meta (Facebook/Instagram) Ads
 */

const axios = require('axios');

const BASE_URL = 'https://graph.facebook.com/v18.0';

class MetaAdsService {
  /**
   * Get OAuth configuration
   */
  static getOAuthConfig(config) {
    return {
      authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
      tokenUrl: `${BASE_URL}/oauth/access_token`,
      scopes: config.meta?.scopes || 'ads_read,ads_management,business_management',
    };
  }

  /**
   * Build OAuth authorization URL
   */
  static buildAuthUrl(config, state) {
    const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
    authUrl.searchParams.append('client_id', config.meta.appId);
    authUrl.searchParams.append('redirect_uri', config.meta.redirectUri);
    authUrl.searchParams.append('scope', config.meta.scopes);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('response_type', 'code');
    return authUrl.toString();
  }

  /**
   * Exchange code for access token
   */
  static async exchangeCodeForToken(config, code) {
    const tokenResponse = await axios.get(`${BASE_URL}/oauth/access_token`, {
      params: {
        client_id: config.meta.appId,
        client_secret: config.meta.appSecret,
        redirect_uri: config.meta.redirectUri,
        code,
      },
    });

    // Get long-lived token
    const longLivedResponse = await axios.get(`${BASE_URL}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: config.meta.appId,
        client_secret: config.meta.appSecret,
        fb_exchange_token: tokenResponse.data.access_token,
      },
    });

    return {
      accessToken: longLivedResponse.data.access_token,
      expiresIn: longLivedResponse.data.expires_in || 5184000,
      tokenType: longLivedResponse.data.token_type || 'Bearer',
    };
  }

  /**
   * Fetch ad accounts for the user
   */
  static async fetchAdAccounts(accessToken) {
    const response = await axios.get(`${BASE_URL}/me/adaccounts`, {
      params: {
        access_token: accessToken,
        fields: 'id,name,account_id,currency,timezone_name,account_status',
      },
    });

    return (response.data.data || []).map(account => ({
      accountId: account.account_id || account.id.replace('act_', ''),
      accountName: account.name || 'Unnamed Account',
      currency: account.currency || 'USD',
      timezone: account.timezone_name || 'UTC',
      status: account.account_status === 1 ? 'active' : 'inactive',
    }));
  }

  /**
   * Fetch metrics for an ad account
   */
  static async fetchMetrics(accountId, accessToken, metric, since, until) {
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
      const aggregateUrl = `${BASE_URL}/act_${accountId}/insights?fields=${field}&time_range={"since":"${since}","until":"${until}"}&access_token=${accessToken}`;
      const aggregateResponse = await fetch(aggregateUrl);
      const aggregateData = await aggregateResponse.json();

      // Fetch time-series data
      const timeSeriesUrl = `${BASE_URL}/act_${accountId}/insights?fields=${field}&time_range={"since":"${since}","until":"${until}"}&time_increment=1&access_token=${accessToken}`;
      const timeSeriesResponse = await fetch(timeSeriesUrl);
      const timeSeriesData = await timeSeriesResponse.json();

      // Calculate previous period
      const daysDiff = Math.ceil((new Date(until) - new Date(since)) / (1000 * 60 * 60 * 24));
      const prevUntil = new Date(since);
      prevUntil.setDate(prevUntil.getDate() - 1);
      const prevSince = new Date(prevUntil);
      prevSince.setDate(prevSince.getDate() - daysDiff);

      const prevUrl = `${BASE_URL}/act_${accountId}/insights?fields=${field}&time_range={"since":"${prevSince.toISOString().split('T')[0]}","until":"${prevUntil.toISOString().split('T')[0]}"}&access_token=${accessToken}`;
      const prevResponse = await fetch(prevUrl);
      const prevData = await prevResponse.json();

      if (aggregateData.error) {
        return {
          value: 0,
          label: metric,
          error: aggregateData.error.message,
        };
      }

      // Parse values
      let value = 0;
      let currency = 'USD';

      if (aggregateData.data && aggregateData.data.length > 0) {
        const insights = aggregateData.data[0];
        value = this.parseMetricValue(insights, field, metric);
        currency = insights.account_currency || 'USD';
      }

      let previousValue = 0;
      if (prevData.data && prevData.data.length > 0) {
        previousValue = this.parseMetricValue(prevData.data[0], field, metric);
      }

      // Parse time-series
      const timeSeries = [];
      if (timeSeriesData.data && timeSeriesData.data.length > 0) {
        for (const day of timeSeriesData.data) {
          timeSeries.push({
            date: day.date_start,
            value: parseFloat(this.parseMetricValue(day, field, metric)) || 0,
          });
        }
      }

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
          until: prevUntil.toISOString().split('T')[0],
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

  /**
   * Parse metric value from API response
   */
  static parseMetricValue(data, field, metric) {
    let value = data[field];

    if (metric === 'conversions' && data.actions) {
      value = data.actions.reduce((sum, action) => sum + parseFloat(action.value || 0), 0);
    } else if (metric === 'cost_per_conversion' && data.cost_per_action_type) {
      const actions = data.cost_per_action_type;
      value = actions.length > 0
        ? actions.reduce((sum, a) => sum + parseFloat(a.value || 0), 0) / actions.length
        : 0;
    }

    return value || 0;
  }
}

module.exports = MetaAdsService;
