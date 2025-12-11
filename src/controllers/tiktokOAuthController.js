/**
 * TikTok Ads OAuth Controller
 * Handles TikTok for Business API OAuth flow
 */

const axios = require('axios');
const { query } = require('../config/database');

const TIKTOK_AUTH_URL = 'https://business-api.tiktok.com/open_api/v1.3/oauth2/authorize/';
const TIKTOK_TOKEN_URL = 'https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/';
const TIKTOK_API_URL = 'https://business-api.tiktok.com/open_api/v1.3';

/**
 * Initiate TikTok OAuth flow
 */
const initiateTikTokAuth = async (req, res) => {
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

    const appId = process.env.TIKTOK_APP_ID;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI;
    const state = `${workspaceId}:${req.user.id}:${Date.now()}`;

    const authUrl = `${TIKTOK_AUTH_URL}?app_id=${appId}&state=${state}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=ad_management_read,ad_management_write`;

    res.json({
      success: true,
      authUrl,
    });
  } catch (error) {
    console.error('TikTok OAuth initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate TikTok authentication',
      error: error.message,
    });
  }
};

/**
 * Handle TikTok OAuth callback
 */
const handleTikTokCallback = async (req, res) => {
  try {
    const { auth_code, state } = req.query;

    if (!auth_code || !state) {
      return res.status(400).json({
        success: false,
        message: 'Missing authorization code or state',
      });
    }

    // Parse state
    const [workspaceId, userId] = state.split(':');

    // Exchange auth code for access token
    const tokenResponse = await axios.post(TIKTOK_TOKEN_URL, {
      app_id: process.env.TIKTOK_APP_ID,
      secret: process.env.TIKTOK_APP_SECRET,
      auth_code,
    });

    const { access_token, advertiser_ids } = tokenResponse.data.data;

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
        'tiktok',
        JSON.stringify({
          access_token,
          advertiser_ids: advertiser_ids || [],
          connected_at: new Date().toISOString(),
        }),
        true,
      ]
    );

    res.redirect(
      `${process.env.FRONTEND_URL}/workspaces/${workspaceId}?tiktok=connected`
    );
  } catch (error) {
    console.error('TikTok OAuth callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete TikTok authentication',
      error: error.message,
    });
  }
};

/**
 * Get TikTok connection status
 */
const getTikTokStatus = async (req, res) => {
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
      WHERE workspace_id = $1 AND platform = 'tiktok'`,
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
    console.error('Get TikTok status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get TikTok status',
      error: error.message,
    });
  }
};

/**
 * Disconnect TikTok
 */
const disconnectTikTok = async (req, res) => {
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
       WHERE workspace_id = $1 AND platform = 'tiktok'`,
      [workspaceId]
    );

    res.json({
      success: true,
      message: 'TikTok disconnected successfully',
    });
  } catch (error) {
    console.error('Disconnect TikTok error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect TikTok',
      error: error.message,
    });
  }
};

/**
 * Sync TikTok data
 */
const syncTikTokData = async (req, res) => {
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
       WHERE workspace_id = $1 AND platform = 'tiktok' AND is_active = true`,
      [workspaceId]
    );

    if (credResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'TikTok not connected',
      });
    }

    const { access_token, advertiser_ids } = credResult.rows[0].credentials;

    // Create sync history record
    const syncHistoryResult = await query(
      `INSERT INTO platform_sync_history (
        workspace_id, platform, sync_type, status, started_at
      ) VALUES ($1, $2, $3, $4, NOW())
      RETURNING id`,
      [workspaceId, 'tiktok', 'campaigns', 'running']
    );

    const syncId = syncHistoryResult.rows[0].id;

    // Trigger background sync (this would typically be handled by a job queue)
    // For now, we'll return a success response and the actual sync would happen async
    res.json({
      success: true,
      message: 'TikTok data sync initiated',
      syncId,
    });

    // Background sync process would go here
    // This would fetch campaign data from TikTok API and store in tiktok_campaigns table
  } catch (error) {
    console.error('Sync TikTok data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync TikTok data',
      error: error.message,
    });
  }
};

module.exports = {
  initiateTikTokAuth,
  handleTikTokCallback,
  getTikTokStatus,
  disconnectTikTok,
  syncTikTokData,
};
