/**
 * TikTok Ads Platform Service
 * Handles OAuth and metrics fetching for TikTok Ads
 */

const axios = require('axios');

const BASE_URL = 'https://business-api.tiktok.com/open_api/v1.3';

class TikTokAdsService {
  /**
   * Get OAuth configuration
   */
  static getOAuthConfig(config) {
    return {
      authUrl: 'https://ads.tiktok.com/marketing_api/auth',
      tokenUrl: `${BASE_URL}/oauth2/access_token/`,
      scopes: 'advertiser.read,advertiser.write',
    };
  }

  /**
   * Build OAuth authorization URL
   */
  static buildAuthUrl(config, state) {
    const authUrl = new URL('https://ads.tiktok.com/marketing_api/auth');
    authUrl.searchParams.append('app_id', config.tiktok?.appId || '');
    authUrl.searchParams.append('redirect_uri', config.tiktok?.redirectUri || '');
    authUrl.searchParams.append('state', state);
    return authUrl.toString();
  }

  /**
   * Exchange code for access token
   */
  static async exchangeCodeForToken(config, code) {
    const tokenResponse = await axios.post(`${BASE_URL}/oauth2/access_token/`, {
      app_id: config.tiktok?.appId,
      secret: config.tiktok?.appSecret,
      auth_code: code,
    });

    const data = tokenResponse.data.data;

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 86400,
      tokenType: 'Bearer',
      advertiserId: data.advertiser_ids?.[0],
    };
  }

  /**
   * Fetch ad accounts (TikTok advertisers)
   */
  static async fetchAdAccounts(accessToken, config) {
    try {
      const response = await axios.get(`${BASE_URL}/oauth2/advertiser/get/`, {
        headers: {
          'Access-Token': accessToken,
        },
        params: {
          app_id: config.tiktok?.appId,
          secret: config.tiktok?.appSecret,
        },
      });

      const advertisers = response.data.data?.list || [];

      return advertisers.map(advertiser => ({
        accountId: advertiser.advertiser_id,
        accountName: advertiser.advertiser_name || `Advertiser ${advertiser.advertiser_id}`,
        currency: advertiser.currency || 'USD',
        timezone: advertiser.timezone || 'UTC',
        status: advertiser.status === 'STATUS_ENABLE' ? 'active' : 'inactive',
      }));
    } catch (error) {
      console.error('Error fetching TikTok advertisers:', error);
      return [];
    }
  }

  /**
   * Fetch metrics for a TikTok advertiser
   */
  static async fetchMetrics(accountId, accessToken, metric, since, until) {
    try {
      const metricFieldMap = {
        spend: 'spend',
        impressions: 'impressions',
        clicks: 'clicks',
        ctr: 'ctr',
        cpc: 'cpc',
        cpm: 'cpm',
        reach: 'reach',
        conversions: 'conversion',
        cost_per_conversion: 'cost_per_conversion',
      };

      const field = metricFieldMap[metric] || 'spend';

      // Fetch aggregate report
      const response = await axios.get(`${BASE_URL}/report/integrated/get/`, {
        headers: {
          'Access-Token': accessToken,
        },
        params: {
          advertiser_id: accountId,
          report_type: 'BASIC',
          dimensions: '["stat_time_day"]',
          metrics: `["${field}"]`,
          data_level: 'AUCTION_ADVERTISER',
          start_date: since,
          end_date: until,
          page_size: 100,
        },
      });

      const reportData = response.data.data?.list || [];

      // Parse time-series data
      const timeSeries = reportData.map(row => ({
        date: row.dimensions?.stat_time_day,
        value: parseFloat(row.metrics?.[field]) || 0,
      }));

      // Calculate total
      const totalValue = timeSeries.reduce((sum, day) => sum + day.value, 0);

      // For change percent, we'd need another API call for previous period
      const changePercent = 0;

      return {
        value: totalValue,
        previousValue: 0,
        changePercent,
        label: metric,
        dateRange: { since, until },
        currency: 'USD',
        timeSeries,
      };
    } catch (error) {
      console.error('Error fetching TikTok metrics:', error);
      return {
        value: 0,
        label: metric,
        error: error.message,
      };
    }
  }
}

module.exports = TikTokAdsService;
