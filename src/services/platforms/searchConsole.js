/**
 * Google Search Console Platform Service
 * Handles OAuth and search analytics fetching for Google Search Console
 */

const axios = require('axios');

class SearchConsoleService {
  /**
   * Get OAuth configuration
   */
  static getOAuthConfig(config) {
    return {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: 'https://www.googleapis.com/auth/webmasters.readonly',
    };
  }

  /**
   * Build OAuth authorization URL
   */
  static buildAuthUrl(config, state) {
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', config.searchConsole?.clientId || config.google?.clientId || '');
    authUrl.searchParams.append('redirect_uri', config.searchConsole?.redirectUri || config.google?.redirectUri?.replace('/google/', '/search-console/') || '');
    authUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/webmasters.readonly');
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
      client_id: config.searchConsole?.clientId || config.google?.clientId,
      client_secret: config.searchConsole?.clientSecret || config.google?.clientSecret,
      redirect_uri: config.searchConsole?.redirectUri || config.google?.redirectUri?.replace('/google/', '/search-console/') || '',
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
      client_id: config.searchConsole?.clientId || config.google?.clientId,
      client_secret: config.searchConsole?.clientSecret || config.google?.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    return {
      accessToken: tokenResponse.data.access_token,
      expiresIn: tokenResponse.data.expires_in || 3600,
    };
  }

  /**
   * Fetch verified properties (sites)
   */
  static async fetchProperties(accessToken) {
    try {
      const response = await axios.get(
        'https://www.googleapis.com/webmasters/v3/sites',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      const sites = response.data.siteEntry || [];

      return sites.map(site => ({
        accountId: encodeURIComponent(site.siteUrl),
        accountName: site.siteUrl,
        currency: 'N/A',
        timezone: 'UTC',
        status: 'active',
        permissionLevel: site.permissionLevel,
      }));
    } catch (error) {
      console.error('Error fetching Search Console properties:', error);
      return [];
    }
  }

  /**
   * Fetch search analytics data
   */
  static async fetchSearchAnalytics(siteUrl, accessToken, options = {}) {
    try {
      const {
        startDate,
        endDate,
        dimensions = ['date'],
        rowLimit = 1000,
        startRow = 0,
        dimensionFilterGroups = [],
      } = options;

      const response = await axios.post(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
          startDate,
          endDate,
          dimensions,
          rowLimit,
          startRow,
          dimensionFilterGroups,
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.rows || [];
    } catch (error) {
      console.error('Error fetching search analytics:', error);
      throw error;
    }
  }

  /**
   * Fetch metrics for dashboard widgets
   */
  static async fetchMetrics(siteUrl, accessToken, metric, since, until, config) {
    try {
      // Handle table-based metrics
      if (metric === 'top_queries') {
        const data = await this.getTopQueries(siteUrl, accessToken, {
          startDate: since,
          endDate: until,
          rowLimit: 25,
        });
        return {
          type: 'table',
          label: 'Top Keywords/Queries',
          columns: ['Query', 'Clicks', 'Impressions', 'CTR', 'Position'],
          data: data.map(row => ({
            query: row.query,
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr + '%',
            position: row.position,
          })),
          dateRange: { since, until },
        };
      }

      if (metric === 'top_pages') {
        const data = await this.getPagePerformance(siteUrl, accessToken, {
          startDate: since,
          endDate: until,
          rowLimit: 25,
        });
        return {
          type: 'table',
          label: 'Top Pages',
          columns: ['Page', 'Clicks', 'Impressions', 'CTR', 'Position'],
          data: data.map(row => ({
            page: row.page.replace(siteUrl, '/'),
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr + '%',
            position: row.position,
          })),
          dateRange: { since, until },
        };
      }

      if (metric === 'device_breakdown') {
        const data = await this.getDeviceBreakdown(siteUrl, accessToken, {
          startDate: since,
          endDate: until,
        });
        return {
          type: 'table',
          label: 'Device Breakdown',
          columns: ['Device', 'Clicks', 'Impressions', 'CTR', 'Position'],
          data: data.map(row => ({
            device: row.device.charAt(0).toUpperCase() + row.device.slice(1),
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr + '%',
            position: row.position,
          })),
          dateRange: { since, until },
        };
      }

      if (metric === 'country_breakdown') {
        const data = await this.getCountryBreakdown(siteUrl, accessToken, {
          startDate: since,
          endDate: until,
          rowLimit: 25,
        });
        return {
          type: 'table',
          label: 'Country Breakdown',
          columns: ['Country', 'Clicks', 'Impressions', 'CTR', 'Position'],
          data: data.map(row => ({
            country: row.country,
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr + '%',
            position: row.position,
          })),
          dateRange: { since, until },
        };
      }

      // Standard single-value metrics
      const rows = await this.fetchSearchAnalytics(siteUrl, accessToken, {
        startDate: since,
        endDate: until,
        dimensions: ['date'],
      });

      // Aggregate metrics
      let totalValue = 0;
      const timeSeries = [];

      for (const row of rows) {
        const value = this.extractMetricValue(row, metric);
        totalValue += value;
        timeSeries.push({
          date: row.keys[0],
          value,
        });
      }

      // For CTR and position, calculate averages
      if (metric === 'ctr' || metric === 'position') {
        totalValue = rows.length > 0 ? totalValue / rows.length : 0;
      }

      return {
        value: totalValue,
        previousValue: 0,
        changePercent: 0,
        label: metric,
        dateRange: { since, until },
        timeSeries,
      };
    } catch (error) {
      console.error('Error fetching Search Console metrics:', error);
      return {
        value: 0,
        label: metric,
        error: error.message,
      };
    }
  }

  /**
   * Extract metric value from row
   */
  static extractMetricValue(row, metric) {
    switch (metric) {
      case 'clicks':
        return row.clicks || 0;
      case 'impressions':
        return row.impressions || 0;
      case 'ctr':
        return (row.ctr || 0) * 100;
      case 'position':
        return row.position || 0;
      default:
        return 0;
    }
  }

  /**
   * Get top queries (keywords)
   */
  static async getTopQueries(siteUrl, accessToken, options = {}) {
    const { startDate, endDate, rowLimit = 100 } = options;

    const rows = await this.fetchSearchAnalytics(siteUrl, accessToken, {
      startDate,
      endDate,
      dimensions: ['query'],
      rowLimit,
    });

    return rows.map(row => ({
      query: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: (row.ctr * 100).toFixed(2),
      position: row.position.toFixed(1),
    }));
  }

  /**
   * Get page performance
   */
  static async getPagePerformance(siteUrl, accessToken, options = {}) {
    const { startDate, endDate, rowLimit = 100 } = options;

    const rows = await this.fetchSearchAnalytics(siteUrl, accessToken, {
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit,
    });

    return rows.map(row => ({
      page: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: (row.ctr * 100).toFixed(2),
      position: row.position.toFixed(1),
    }));
  }

  /**
   * Get device breakdown
   */
  static async getDeviceBreakdown(siteUrl, accessToken, options = {}) {
    const { startDate, endDate } = options;

    const rows = await this.fetchSearchAnalytics(siteUrl, accessToken, {
      startDate,
      endDate,
      dimensions: ['device'],
    });

    return rows.map(row => ({
      device: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: (row.ctr * 100).toFixed(2),
      position: row.position.toFixed(1),
    }));
  }

  /**
   * Get country breakdown
   */
  static async getCountryBreakdown(siteUrl, accessToken, options = {}) {
    const { startDate, endDate, rowLimit = 50 } = options;

    const rows = await this.fetchSearchAnalytics(siteUrl, accessToken, {
      startDate,
      endDate,
      dimensions: ['country'],
      rowLimit,
    });

    return rows.map(row => ({
      country: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: (row.ctr * 100).toFixed(2),
      position: row.position.toFixed(1),
    }));
  }

  /**
   * Get query-page analysis (which queries lead to which pages)
   */
  static async getQueryPageAnalysis(siteUrl, accessToken, options = {}) {
    const { startDate, endDate, rowLimit = 100 } = options;

    const rows = await this.fetchSearchAnalytics(siteUrl, accessToken, {
      startDate,
      endDate,
      dimensions: ['query', 'page'],
      rowLimit,
    });

    return rows.map(row => ({
      query: row.keys[0],
      page: row.keys[1],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: (row.ctr * 100).toFixed(2),
      position: row.position.toFixed(1),
    }));
  }

  /**
   * Get search appearance data (rich results, etc.)
   */
  static async getSearchAppearance(siteUrl, accessToken, options = {}) {
    const { startDate, endDate } = options;

    try {
      const rows = await this.fetchSearchAnalytics(siteUrl, accessToken, {
        startDate,
        endDate,
        dimensions: ['searchAppearance'],
      });

      return rows.map(row => ({
        appearance: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: (row.ctr * 100).toFixed(2),
        position: row.position.toFixed(1),
      }));
    } catch (error) {
      // searchAppearance might not be available for all sites
      return [];
    }
  }

  /**
   * Get comprehensive analytics report
   */
  static async getComprehensiveReport(siteUrl, accessToken, options = {}) {
    const { startDate, endDate } = options;

    const [
      overview,
      topQueries,
      topPages,
      devices,
      countries,
      queryPages,
    ] = await Promise.all([
      this.fetchSearchAnalytics(siteUrl, accessToken, {
        startDate,
        endDate,
        dimensions: ['date'],
      }),
      this.getTopQueries(siteUrl, accessToken, { startDate, endDate, rowLimit: 25 }),
      this.getPagePerformance(siteUrl, accessToken, { startDate, endDate, rowLimit: 25 }),
      this.getDeviceBreakdown(siteUrl, accessToken, { startDate, endDate }),
      this.getCountryBreakdown(siteUrl, accessToken, { startDate, endDate, rowLimit: 10 }),
      this.getQueryPageAnalysis(siteUrl, accessToken, { startDate, endDate, rowLimit: 25 }),
    ]);

    // Calculate totals
    const totals = overview.reduce((acc, row) => ({
      clicks: acc.clicks + row.clicks,
      impressions: acc.impressions + row.impressions,
      ctr: acc.ctr + row.ctr,
      position: acc.position + row.position,
    }), { clicks: 0, impressions: 0, ctr: 0, position: 0 });

    const avgCtr = overview.length > 0 ? (totals.ctr / overview.length * 100).toFixed(2) : 0;
    const avgPosition = overview.length > 0 ? (totals.position / overview.length).toFixed(1) : 0;

    return {
      summary: {
        totalClicks: totals.clicks,
        totalImpressions: totals.impressions,
        averageCtr: avgCtr,
        averagePosition: avgPosition,
        dateRange: { startDate, endDate },
      },
      timeSeries: overview.map(row => ({
        date: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: (row.ctr * 100).toFixed(2),
        position: row.position.toFixed(1),
      })),
      topQueries,
      topPages,
      devices,
      countries,
      queryPages,
    };
  }

  /**
   * Get index coverage status
   */
  static async getIndexCoverage(siteUrl, accessToken) {
    try {
      // Note: Index coverage requires the Search Console API v1
      // This is a simplified version
      const response = await axios.get(
        `https://searchconsole.googleapis.com/v1/sites/${encodeURIComponent(siteUrl)}/urlInspection/index`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching index coverage:', error);
      return null;
    }
  }
}

module.exports = SearchConsoleService;
