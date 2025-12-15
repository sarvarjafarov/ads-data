/**
 * Google Sheets Platform Service
 * Handles OAuth and data fetching for Google Sheets custom data import
 */

const axios = require('axios');

class GoogleSheetsService {
  /**
   * Get OAuth configuration
   */
  static getOAuthConfig(config) {
    return {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.readonly'
      ].join(' '),
    };
  }

  /**
   * Build OAuth authorization URL
   */
  static buildAuthUrl(config, state) {
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', config.google?.clientId || '');
    authUrl.searchParams.append('redirect_uri', config.google?.sheetsRedirectUri || config.google?.redirectUri || '');
    authUrl.searchParams.append('scope', [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly'
    ].join(' '));
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
      redirect_uri: config.google?.sheetsRedirectUri || config.google?.redirectUri,
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
   * Fetch spreadsheet metadata
   * @param {string} spreadsheetId - Google Sheets ID
   * @param {string} accessToken - OAuth access token
   * @returns {Object} Spreadsheet metadata
   */
  static async fetchSpreadsheetMetadata(spreadsheetId, accessToken) {
    try {
      const response = await axios.get(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          params: {
            fields: 'spreadsheetId,properties,sheets(properties)'
          }
        }
      );

      const data = response.data;

      return {
        spreadsheetId: data.spreadsheetId,
        title: data.properties.title,
        locale: data.properties.locale,
        timeZone: data.properties.timeZone,
        sheets: data.sheets.map(sheet => ({
          sheetId: sheet.properties.sheetId,
          title: sheet.properties.title,
          index: sheet.properties.index,
          rowCount: sheet.properties.gridProperties?.rowCount || 0,
          columnCount: sheet.properties.gridProperties?.columnCount || 0,
        })),
      };
    } catch (error) {
      console.error('Error fetching spreadsheet metadata:', error.response?.data || error.message);
      throw new Error(`Failed to fetch spreadsheet metadata: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Extract spreadsheet ID from Google Sheets URL
   * @param {string} url - Google Sheets URL
   * @returns {string} Spreadsheet ID
   */
  static extractSpreadsheetId(url) {
    // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      throw new Error('Invalid Google Sheets URL');
    }
    return match[1];
  }

  /**
   * Fetch sheet data
   * @param {string} spreadsheetId - Google Sheets ID
   * @param {string} range - Sheet range (e.g., 'Sheet1!A1:Z1000' or 'Sheet1')
   * @param {string} accessToken - OAuth access token
   * @returns {Object} Sheet data with rows and headers
   */
  static async fetchSheetData(spreadsheetId, range, accessToken) {
    try {
      const response = await axios.get(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          params: {
            majorDimension: 'ROWS',
            valueRenderOption: 'UNFORMATTED_VALUE',
            dateTimeRenderOption: 'FORMATTED_STRING'
          }
        }
      );

      const values = response.data.values || [];

      if (values.length === 0) {
        throw new Error('Sheet is empty or has no data');
      }

      // First row is headers
      const headers = values[0];

      // Remaining rows are data
      const dataRows = values.slice(1);

      // Convert to array of objects
      const rows = dataRows.map(row => {
        const rowObj = {};
        headers.forEach((header, index) => {
          rowObj[header] = row[index] !== undefined ? row[index] : null;
        });
        return rowObj;
      });

      return {
        rows,
        headers,
        totalRows: rows.length,
        range: response.data.range,
      };
    } catch (error) {
      console.error('Error fetching sheet data:', error.response?.data || error.message);
      throw new Error(`Failed to fetch sheet data: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Validate sheet structure (check if structure changed)
   * @param {string} spreadsheetId - Google Sheets ID
   * @param {string} range - Sheet range
   * @param {string} accessToken - OAuth access token
   * @param {Array} expectedHeaders - Expected column headers
   * @returns {Object} Validation result
   */
  static async validateSheetStructure(spreadsheetId, range, accessToken, expectedHeaders) {
    try {
      const data = await this.fetchSheetData(spreadsheetId, range, accessToken);

      const currentHeaders = data.headers;
      const headersDiff = {
        added: currentHeaders.filter(h => !expectedHeaders.includes(h)),
        removed: expectedHeaders.filter(h => !currentHeaders.includes(h)),
        reordered: JSON.stringify(currentHeaders) !== JSON.stringify(expectedHeaders)
      };

      const isValid = headersDiff.added.length === 0 &&
                     headersDiff.removed.length === 0;

      return {
        valid: isValid,
        currentHeaders,
        expectedHeaders,
        changes: headersDiff,
        warning: isValid ? null : 'Sheet structure has changed since last sync'
      };
    } catch (error) {
      console.error('Error validating sheet structure:', error);
      throw error;
    }
  }

  /**
   * Subscribe to changes using Google Drive Watch API
   * @param {string} spreadsheetId - Google Sheets ID
   * @param {string} accessToken - OAuth access token
   * @param {string} webhookUrl - Callback URL for notifications
   * @returns {Object} Watch channel information
   */
  static async subscribeToChanges(spreadsheetId, accessToken, webhookUrl) {
    try {
      const response = await axios.post(
        `https://www.googleapis.com/drive/v3/files/${spreadsheetId}/watch`,
        {
          id: `sheet-${spreadsheetId}-${Date.now()}`,
          type: 'web_hook',
          address: webhookUrl,
          expiration: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        channelId: response.data.id,
        resourceId: response.data.resourceId,
        expiration: response.data.expiration,
      };
    } catch (error) {
      console.error('Error subscribing to sheet changes:', error.response?.data || error.message);
      throw new Error(`Failed to subscribe to changes: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Unsubscribe from change notifications
   * @param {string} channelId - Watch channel ID
   * @param {string} resourceId - Resource ID
   * @param {string} accessToken - OAuth access token
   */
  static async unsubscribeFromChanges(channelId, resourceId, accessToken) {
    try {
      await axios.post(
        'https://www.googleapis.com/drive/v3/channels/stop',
        {
          id: channelId,
          resourceId: resourceId,
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return { success: true };
    } catch (error) {
      console.error('Error unsubscribing from changes:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get last modified time of spreadsheet
   * @param {string} spreadsheetId - Google Sheets ID
   * @param {string} accessToken - OAuth access token
   * @returns {Date} Last modified timestamp
   */
  static async getLastModifiedTime(spreadsheetId, accessToken) {
    try {
      const response = await axios.get(
        `https://www.googleapis.com/drive/v3/files/${spreadsheetId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
          params: {
            fields: 'modifiedTime'
          }
        }
      );

      return new Date(response.data.modifiedTime);
    } catch (error) {
      console.error('Error fetching last modified time:', error);
      throw error;
    }
  }
}

module.exports = GoogleSheetsService;
