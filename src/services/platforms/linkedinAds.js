/**
 * LinkedIn Ads Platform Service
 * Handles OAuth and metrics fetching for LinkedIn Campaign Manager
 */

const axios = require('axios');

const BASE_URL = 'https://api.linkedin.com/v2';

class LinkedInAdsService {
  /**
   * Get OAuth configuration
   */
  static getOAuthConfig(config) {
    return {
      authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
      scopes: 'r_ads,r_ads_reporting,r_organization_social',
    };
  }

  /**
   * Build OAuth authorization URL
   */
  static buildAuthUrl(config, state) {
    const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', config.linkedin?.clientId || '');
    authUrl.searchParams.append('redirect_uri', config.linkedin?.redirectUri || '');
    authUrl.searchParams.append('scope', 'r_ads r_ads_reporting r_organization_social');
    authUrl.searchParams.append('state', state);
    return authUrl.toString();
  }

  /**
   * Exchange code for access token
   */
  static async exchangeCodeForToken(config, code) {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', config.linkedin?.redirectUri || '');
    params.append('client_id', config.linkedin?.clientId || '');
    params.append('client_secret', config.linkedin?.clientSecret || '');

    const tokenResponse = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return {
      accessToken: tokenResponse.data.access_token,
      refreshToken: tokenResponse.data.refresh_token,
      expiresIn: tokenResponse.data.expires_in || 5184000, // 60 days default
      tokenType: 'Bearer',
    };
  }

  /**
   * Refresh access token
   */
  static async refreshAccessToken(config, refreshToken) {
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    params.append('client_id', config.linkedin?.clientId || '');
    params.append('client_secret', config.linkedin?.clientSecret || '');

    const tokenResponse = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return {
      accessToken: tokenResponse.data.access_token,
      expiresIn: tokenResponse.data.expires_in || 5184000,
    };
  }

  /**
   * Fetch ad accounts (LinkedIn Campaign Manager accounts)
   */
  static async fetchAdAccounts(accessToken) {
    try {
      // Get ad accounts the user has access to
      const response = await axios.get(`${BASE_URL}/adAccountsV2`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
        params: {
          q: 'search',
        },
      });

      const accounts = response.data.elements || [];

      return accounts.map(account => ({
        accountId: account.id,
        accountName: account.name || `Account ${account.id}`,
        currency: account.currency || 'USD',
        timezone: account.timeZone || 'America/Los_Angeles',
        status: account.status === 'ACTIVE' ? 'active' : 'inactive',
      }));
    } catch (error) {
      console.error('Error fetching LinkedIn ad accounts:', error);
      return [];
    }
  }

  /**
   * Fetch metrics for a LinkedIn ad account
   */
  static async fetchMetrics(accountId, accessToken, metric, since, until) {
    try {
      const metricFieldMap = {
        spend: 'costInLocalCurrency',
        impressions: 'impressions',
        clicks: 'clicks',
        ctr: 'clickThroughRate',
        cpc: 'costPerClick',
        cpm: 'costPerMille',
        reach: 'uniqueImpressions',
        conversions: 'externalWebsiteConversions',
        cost_per_conversion: 'costPerExternalWebsiteConversion',
      };

      const field = metricFieldMap[metric] || 'costInLocalCurrency';

      // Format dates for LinkedIn API (timestamp in milliseconds)
      const startDate = new Date(since).getTime();
      const endDate = new Date(until).getTime();

      // Fetch analytics
      const response = await axios.get(`${BASE_URL}/adAnalyticsV2`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
        },
        params: {
          q: 'analytics',
          pivot: 'ACCOUNT',
          dateRange: {
            start: {
              day: new Date(since).getDate(),
              month: new Date(since).getMonth() + 1,
              year: new Date(since).getFullYear(),
            },
            end: {
              day: new Date(until).getDate(),
              month: new Date(until).getMonth() + 1,
              year: new Date(until).getFullYear(),
            },
          },
          timeGranularity: 'DAILY',
          accounts: [`urn:li:sponsoredAccount:${accountId}`],
          fields: field,
        },
      });

      const reportData = response.data.elements || [];

      // Parse time-series data
      const timeSeries = reportData.map(row => {
        const dateRange = row.dateRange || {};
        const startDay = dateRange.start || {};
        const date = `${startDay.year}-${String(startDay.month).padStart(2, '0')}-${String(startDay.day).padStart(2, '0')}`;

        return {
          date,
          value: parseFloat(row[field]) || 0,
        };
      });

      // Calculate total
      const totalValue = timeSeries.reduce((sum, day) => sum + day.value, 0);

      return {
        value: totalValue,
        previousValue: 0,
        changePercent: 0,
        label: metric,
        dateRange: { since, until },
        currency: 'USD',
        timeSeries,
      };
    } catch (error) {
      console.error('Error fetching LinkedIn metrics:', error);
      return {
        value: 0,
        label: metric,
        error: error.message,
      };
    }
  }
}

module.exports = LinkedInAdsService;
