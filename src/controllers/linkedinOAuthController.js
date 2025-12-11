/**
 * LinkedIn Ads OAuth Controller
 * Handles LinkedIn Marketing Developer Platform OAuth flow
 */

const axios = require('axios');
const { query } = require('../config/database');

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_API_URL = 'https://api.linkedin.com/v2';

/**
 * Initiate LinkedIn OAuth flow
 */
const initiateLinkedInAuth = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Verify workspace access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
    const state = `${workspaceId}:${req.user.id}:${Date.now()}`;
    const scope = 'r_ads r_ads_reporting rw_ads';

    const authUrl = `${LINKEDIN_AUTH_URL}?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&state=${state}&scope=${encodeURIComponent(scope)}`;

    res.json({
      success: true,
      authUrl,
    });
  } catch (error) {
    console.error('LinkedIn OAuth initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate LinkedIn authentication',
      error: error.message,
    });
  }
};

/**
 * Handle LinkedIn OAuth callback
 */
const handleLinkedInCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'Missing authorization code or state',
      });
    }

    // Parse state
    const [workspaceId, userId] = state.split(':');

    // Exchange code for access token
    const tokenResponse = await axios.post(
      LINKEDIN_TOKEN_URL,
      null,
      {
        params: {
          grant_type: 'authorization_code',
          code,
          client_id: process.env.LINKEDIN_CLIENT_ID,
          client_secret: process.env.LINKEDIN_CLIENT_SECRET,
          redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, expires_in } = tokenResponse.data;

    // Store credentials
    await query(
      `INSERT INTO platform_credentials (
        workspace_id, platform, credentials, is_active
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (workspace_id, platform)
      DO UPDATE SET
        credentials = EXCLUDED.credentials,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()`,
      [
        workspaceId,
        'linkedin',
        JSON.stringify({
          access_token,
          expires_in,
          connected_at: new Date().toISOString(),
        }),
        true,
      ]
    );

    res.redirect(
      `${process.env.FRONTEND_URL}/workspaces/${workspaceId}?linkedin=connected`
    );
  } catch (error) {
    console.error('LinkedIn OAuth callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete LinkedIn authentication',
      error: error.message,
    });
  }
};

/**
 * Get LinkedIn connection status
 */
const getLinkedInStatus = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Verify workspace access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const result = await query(
      `SELECT
        is_active,
        last_sync_at,
        sync_status,
        error_message,
        created_at
      FROM platform_credentials
      WHERE workspace_id = $1 AND platform = 'linkedin'`,
      [workspaceId]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        connected: false,
      });
    }

    res.json({
      success: true,
      connected: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get LinkedIn status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get LinkedIn status',
      error: error.message,
    });
  }
};

/**
 * Disconnect LinkedIn
 */
const disconnectLinkedIn = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Verify workspace access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    await query(
      `UPDATE platform_credentials
       SET is_active = false, updated_at = NOW()
       WHERE workspace_id = $1 AND platform = 'linkedin'`,
      [workspaceId]
    );

    res.json({
      success: true,
      message: 'LinkedIn disconnected successfully',
    });
  } catch (error) {
    console.error('Disconnect LinkedIn error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect LinkedIn',
      error: error.message,
    });
  }
};

/**
 * Sync LinkedIn data
 */
const syncLinkedInData = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { startDate, endDate } = req.body;

    // Verify workspace access
    const workspaceAccess = await query(
      `SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Get credentials
    const credResult = await query(
      `SELECT credentials FROM platform_credentials
       WHERE workspace_id = $1 AND platform = 'linkedin' AND is_active = true`,
      [workspaceId]
    );

    if (credResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'LinkedIn not connected',
      });
    }

    const { access_token } = credResult.rows[0].credentials;

    // Create sync history record
    const syncHistoryResult = await query(
      `INSERT INTO platform_sync_history (
        workspace_id, platform, sync_type, status, started_at
      ) VALUES ($1, $2, $3, $4, NOW())
      RETURNING id`,
      [workspaceId, 'linkedin', 'campaigns', 'running']
    );

    const syncId = syncHistoryResult.rows[0].id;

    // Trigger background sync (this would typically be handled by a job queue)
    res.json({
      success: true,
      message: 'LinkedIn data sync initiated',
      syncId,
    });

    // Background sync process would go here
    // This would fetch campaign data from LinkedIn API and store in linkedin_campaigns table
  } catch (error) {
    console.error('Sync LinkedIn data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync LinkedIn data',
      error: error.message,
    });
  }
};

module.exports = {
  initiateLinkedInAuth,
  handleLinkedInCallback,
  getLinkedInStatus,
  disconnectLinkedIn,
  syncLinkedInData,
};
