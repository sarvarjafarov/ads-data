/**
 * Google Ads Platform Service
 * Handles OAuth and metrics fetching for Google Ads
 */

const axios = require('axios');

class GoogleAdsService {
  /**
   * Get OAuth configuration
   */
  static getOAuthConfig(config) {
    return {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: 'https://www.googleapis.com/auth/adwords',
    };
  }

  /**
   * Build OAuth authorization URL
   */
  static buildAuthUrl(config, state) {
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', config.google?.clientId || '');
    authUrl.searchParams.append('redirect_uri', config.google?.redirectUri || '');
    authUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/adwords');
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');
    return authUrl.toString();
  }

  /**
   * Exchange code for access token
   */
  static async exchangeCodeForToken(config, code) {
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: config.google?.clientId,
      client_secret: config.google?.clientSecret,
      redirect_uri: config.google?.redirectUri,
      code,
      grant_type: 'authorization_code',
    });

    return {
      accessToken: tokenResponse.data.access_token,
      refreshToken: tokenResponse.data.refresh_token,
      expiresIn: tokenResponse.data.expires_in || 3600,
      tokenType: tokenResponse.data.token_type || 'Bearer',
    };
  }

  /**
   * Refresh access token
   */
  static async refreshAccessToken(config, refreshToken) {
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: config.google?.clientId,
      client_secret: config.google?.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    return {
      accessToken: tokenResponse.data.access_token,
      expiresIn: tokenResponse.data.expires_in || 3600,
    };
  }

  /**
   * Fetch ad accounts (Google Ads customer accounts)
   */
  static async fetchAdAccounts(accessToken, config) {
    try {
      // Use Google Ads API to list accessible customer accounts
      const response = await axios.get(
        'https://googleads.googleapis.com/v14/customers:listAccessibleCustomers',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': config.google?.developerToken || '',
          },
        }
      );

      const customerIds = response.data.resourceNames || [];

      // Get details for each customer
      const accounts = [];
      for (const resourceName of customerIds) {
        const customerId = resourceName.replace('customers/', '');
        try {
          const customerResponse = await axios.post(
            `https://googleads.googleapis.com/v14/customers/${customerId}/googleAds:searchStream`,
            {
              query: `SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1`,
            },
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'developer-token': config.google?.developerToken || '',
              },
            }
          );

          if (customerResponse.data && customerResponse.data[0]) {
            const customer = customerResponse.data[0].results[0].customer;
            accounts.push({
              accountId: customer.id,
              accountName: customer.descriptiveName || `Account ${customer.id}`,
              currency: customer.currencyCode || 'USD',
              timezone: customer.timeZone || 'America/New_York',
              status: 'active',
            });
          }
        } catch (err) {
          // Customer might not be accessible
          accounts.push({
            accountId: customerId,
            accountName: `Account ${customerId}`,
            currency: 'USD',
            timezone: 'America/New_York',
            status: 'active',
          });
        }
      }

      return accounts;
    } catch (error) {
      console.error('Error fetching Google Ads accounts:', error);
      return [];
    }
  }

  /**
   * Fetch metrics for a Google Ads account
   */
  static async fetchMetrics(accountId, accessToken, metric, since, until, config) {
    try {
      const metricFieldMap = {
        spend: 'metrics.cost_micros',
        impressions: 'metrics.impressions',
        clicks: 'metrics.clicks',
        ctr: 'metrics.ctr',
        cpc: 'metrics.average_cpc',
        cpm: 'metrics.average_cpm',
        conversions: 'metrics.conversions',
        cost_per_conversion: 'metrics.cost_per_conversion',
      };

      const field = metricFieldMap[metric] || 'metrics.cost_micros';

      // Build GAQL query
      const query = `
        SELECT
          ${field},
          segments.date
        FROM customer
        WHERE segments.date BETWEEN '${since}' AND '${until}'
        ORDER BY segments.date
      `;

      const response = await axios.post(
        `https://googleads.googleapis.com/v14/customers/${accountId}/googleAds:searchStream`,
        { query },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': config?.google?.developerToken || '',
          },
        }
      );

      // Parse response
      let totalValue = 0;
      const timeSeries = [];

      if (response.data) {
        for (const batch of response.data) {
          for (const result of batch.results || []) {
            const value = this.parseGoogleMetricValue(result.metrics, metric);
            totalValue += value;
            timeSeries.push({
              date: result.segments.date,
              value,
            });
          }
        }
      }

      // Calculate previous period (simplified)
      const daysDiff = Math.ceil((new Date(until) - new Date(since)) / (1000 * 60 * 60 * 24));
      const changePercent = 0; // Would need another API call for previous period

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
      console.error('Error fetching Google Ads metrics:', error);
      return {
        value: 0,
        label: metric,
        error: error.message,
      };
    }
  }

  /**
   * Parse Google Ads metric value
   */
  static parseGoogleMetricValue(metrics, metric) {
    switch (metric) {
      case 'spend':
        // Google returns cost in micros (millionths)
        return (metrics.costMicros || 0) / 1000000;
      case 'impressions':
        return metrics.impressions || 0;
      case 'clicks':
        return metrics.clicks || 0;
      case 'ctr':
        return (metrics.ctr || 0) * 100;
      case 'cpc':
        return (metrics.averageCpc || 0) / 1000000;
      case 'cpm':
        return (metrics.averageCpm || 0) / 1000000;
      case 'conversions':
        return metrics.conversions || 0;
      case 'cost_per_conversion':
        return (metrics.costPerConversion || 0) / 1000000;
      default:
        return 0;
    }
  }
}

module.exports = GoogleAdsService;
