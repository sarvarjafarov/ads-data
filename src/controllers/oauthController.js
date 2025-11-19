const axios = require('axios');
const config = require('../config/config');
const { query } = require('../config/database');

/**
 * Initiate Meta OAuth flow
 * Redirects user to Meta's OAuth consent page
 */
const initiateMetaOAuth = (req, res) => {
  try {
    const { workspaceId } = req.query;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Workspace ID is required',
      });
    }

    if (!config.meta.appId) {
      return res.status(500).json({
        success: false,
        message: 'Meta OAuth is not configured. Please set META_APP_ID in environment variables.',
      });
    }

    // Store workspace ID in session/state for callback
    const state = Buffer.from(JSON.stringify({
      workspaceId,
      userId: req.user.id,
      timestamp: Date.now(),
    })).toString('base64');

    // Build Meta OAuth URL
    const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
    authUrl.searchParams.append('client_id', config.meta.appId);
    authUrl.searchParams.append('redirect_uri', config.meta.redirectUri);
    authUrl.searchParams.append('scope', config.meta.scopes);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('response_type', 'code');

    res.json({
      success: true,
      authUrl: authUrl.toString(),
    });
  } catch (error) {
    console.error('Meta OAuth initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate Meta OAuth',
      error: error.message,
    });
  }
};

/**
 * Handle Meta OAuth callback
 * Exchanges code for access token and stores it
 */
const handleMetaCallback = async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Handle OAuth errors
    if (error) {
      console.error('Meta OAuth error:', error, error_description);
      return res.redirect(`http://localhost:3000/dashboard?oauth=error&message=${encodeURIComponent(error_description || error)}`);
    }

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'Missing authorization code or state',
      });
    }

    // Decode and validate state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Invalid state parameter',
      });
    }

    const { workspaceId, userId } = stateData;

    // Exchange code for access token
    const tokenUrl = 'https://graph.facebook.com/v18.0/oauth/access_token';
    const tokenResponse = await axios.get(tokenUrl, {
      params: {
        client_id: config.meta.appId,
        client_secret: config.meta.appSecret,
        redirect_uri: config.meta.redirectUri,
        code,
      },
    });

    const { access_token, expires_in, token_type } = tokenResponse.data;

    // Get long-lived token
    const longLivedTokenUrl = 'https://graph.facebook.com/v18.0/oauth/access_token';
    const longLivedResponse = await axios.get(longLivedTokenUrl, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: config.meta.appId,
        client_secret: config.meta.appSecret,
        fb_exchange_token: access_token,
      },
    });

    const { access_token: longLivedToken, expires_in: longLivedExpires } = longLivedResponse.data;

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (longLivedExpires || expires_in || 5184000)); // Default 60 days

    // Store or update OAuth token
    const existingToken = await query(
      `SELECT id FROM oauth_tokens
       WHERE user_id = $1 AND workspace_id = $2 AND platform = 'meta'`,
      [userId, workspaceId]
    );

    if (existingToken.rows.length > 0) {
      // Update existing token
      await query(
        `UPDATE oauth_tokens
         SET access_token = $1, token_type = $2, expires_at = $3, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $4 AND workspace_id = $5 AND platform = 'meta'`,
        [longLivedToken, token_type || 'Bearer', expiresAt, userId, workspaceId]
      );
    } else {
      // Insert new token
      await query(
        `INSERT INTO oauth_tokens (user_id, workspace_id, platform, access_token, token_type, expires_at, scope)
         VALUES ($1, $2, 'meta', $3, $4, $5, $6)`,
        [userId, workspaceId, longLivedToken, token_type || 'Bearer', expiresAt, config.meta.scopes]
      );
    }

    // Fetch and store ad accounts
    await fetchAndStoreAdAccounts(userId, workspaceId, longLivedToken);

    // Redirect to success page
    res.redirect(`http://localhost:3000/dashboard?oauth=success&platform=meta`);
  } catch (error) {
    console.error('Meta OAuth callback error:', error);
    res.redirect(`http://localhost:3000/dashboard?oauth=error&message=${encodeURIComponent(error.message)}`);
  }
};

/**
 * Fetch user's Meta ad accounts and store them
 */
const fetchAndStoreAdAccounts = async (userId, workspaceId, accessToken) => {
  try {
    // Get the user's ad accounts
    const meUrl = 'https://graph.facebook.com/v18.0/me/adaccounts';
    const accountsResponse = await axios.get(meUrl, {
      params: {
        access_token: accessToken,
        fields: 'id,name,account_id,currency,timezone_name,account_status',
      },
    });

    const adAccounts = accountsResponse.data.data || [];

    // Get the oauth_token_id
    const tokenResult = await query(
      `SELECT id FROM oauth_tokens
       WHERE user_id = $1 AND workspace_id = $2 AND platform = 'meta'`,
      [userId, workspaceId]
    );

    if (!tokenResult.rows[0]) {
      throw new Error('OAuth token not found');
    }

    const oauthTokenId = tokenResult.rows[0].id;

    // Store each ad account
    for (const account of adAccounts) {
      const accountId = account.account_id || account.id.replace('act_', '');
      const accountName = account.name || 'Unnamed Account';
      const currency = account.currency || 'USD';
      const timezone = account.timezone_name || 'UTC';
      const status = account.account_status === 1 ? 'active' : 'inactive';

      // Check if account already exists
      const existing = await query(
        `SELECT id FROM ad_accounts
         WHERE workspace_id = $1 AND platform = 'meta' AND account_id = $2`,
        [workspaceId, accountId]
      );

      if (existing.rows.length > 0) {
        // Update existing account
        await query(
          `UPDATE ad_accounts
           SET account_name = $1, currency = $2, timezone = $3, status = $4,
               oauth_token_id = $5, updated_at = CURRENT_TIMESTAMP
           WHERE workspace_id = $6 AND platform = 'meta' AND account_id = $7`,
          [accountName, currency, timezone, status, oauthTokenId, workspaceId, accountId]
        );
      } else {
        // Insert new account
        await query(
          `INSERT INTO ad_accounts (workspace_id, oauth_token_id, platform, account_id,
                                    account_name, currency, timezone, status)
           VALUES ($1, $2, 'meta', $3, $4, $5, $6, $7)`,
          [workspaceId, oauthTokenId, accountId, accountName, currency, timezone, status]
        );
      }
    }

    console.log(`✅ Stored ${adAccounts.length} Meta ad accounts for workspace ${workspaceId}`);
  } catch (error) {
    console.error('Error fetching Meta ad accounts:', error);
    throw error;
  }
};

/**
 * Get connected ad accounts for a workspace
 */
const getConnectedAccounts = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    // Verify user has access to this workspace
    const workspaceAccess = await query(
      `SELECT id FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, req.user.id]
    );

    if (workspaceAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this workspace',
      });
    }

    // Get all ad accounts for this workspace
    const accounts = await query(
      `SELECT id, platform, account_id, account_name, currency, timezone,
              status, last_sync_at, sync_status, created_at, updated_at
       FROM ad_accounts
       WHERE workspace_id = $1
       ORDER BY platform, account_name`,
      [workspaceId]
    );

    res.json({
      success: true,
      count: accounts.rows.length,
      data: accounts.rows,
    });
  } catch (error) {
    console.error('Error fetching connected accounts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch connected accounts',
      error: error.message,
    });
  }
};

/**
 * Disconnect an ad account
 */
const disconnectAccount = async (req, res) => {
  try {
    const { accountId } = req.params;

    // Verify user has access to this account
    const accountAccess = await query(
      `SELECT aa.id, aa.workspace_id
       FROM ad_accounts aa
       JOIN workspace_members wm ON wm.workspace_id = aa.workspace_id
       WHERE aa.id = $1 AND wm.user_id = $2`,
      [accountId, req.user.id]
    );

    if (accountAccess.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this account',
      });
    }

    // Delete the ad account (cascading will delete related data)
    await query('DELETE FROM ad_accounts WHERE id = $1', [accountId]);

    res.json({
      success: true,
      message: 'Ad account disconnected successfully',
    });
  } catch (error) {
    console.error('Error disconnecting account:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect account',
      error: error.message,
    });
  }
};

// Import platform services
const { getPlatformService, getPlatformInfo } = require('../services/platforms');

/**
 * Get list of supported platforms
 */
const getSupportedPlatforms = (req, res) => {
  const platforms = ['meta', 'google', 'tiktok', 'linkedin'].map(platform => ({
    id: platform,
    ...getPlatformInfo(platform),
    configured: isPlatformConfigured(platform),
  }));

  res.json({
    success: true,
    data: platforms,
  });
};

function isPlatformConfigured(platform) {
  switch (platform) {
    case 'meta': return !!config.meta?.appId;
    case 'google': return !!config.google?.clientId;
    case 'tiktok': return !!config.tiktok?.appId;
    case 'linkedin': return !!config.linkedin?.clientId;
    default: return false;
  }
}

/**
 * Initiate Google OAuth flow
 */
const initiateGoogleOAuth = (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Workspace ID is required' });
    }
    if (!config.google?.clientId) {
      return res.status(500).json({ success: false, message: 'Google OAuth is not configured' });
    }

    const state = Buffer.from(JSON.stringify({
      workspaceId, userId: req.user.id, timestamp: Date.now(),
    })).toString('base64');

    const GoogleAdsService = getPlatformService('google');
    const authUrl = GoogleAdsService.buildAuthUrl(config, state);
    res.json({ success: true, authUrl });
  } catch (error) {
    console.error('Google OAuth initiation error:', error);
    res.status(500).json({ success: false, message: 'Failed to initiate Google OAuth', error: error.message });
  }
};

/**
 * Handle Google OAuth callback
 */
const handleGoogleCallback = async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) return res.redirect(`/dashboard?oauth=error&message=${encodeURIComponent(error)}`);

    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { workspaceId, userId } = stateData;

    const GoogleAdsService = getPlatformService('google');
    const tokenData = await GoogleAdsService.exchangeCodeForToken(config, code);
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expiresIn);

    await storeOrUpdateToken(userId, workspaceId, 'google', tokenData.accessToken, tokenData.refreshToken, expiresAt);
    const accounts = await GoogleAdsService.fetchAdAccounts(tokenData.accessToken, config);
    await storeAdAccounts(userId, workspaceId, 'google', accounts);

    res.redirect(`/dashboard?oauth=success&platform=google`);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.redirect(`/dashboard?oauth=error&message=${encodeURIComponent(error.message)}`);
  }
};

/**
 * Initiate TikTok OAuth flow
 */
const initiateTikTokOAuth = (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Workspace ID is required' });
    }
    if (!config.tiktok?.appId) {
      return res.status(500).json({ success: false, message: 'TikTok OAuth is not configured' });
    }

    const state = Buffer.from(JSON.stringify({
      workspaceId, userId: req.user.id, timestamp: Date.now(),
    })).toString('base64');

    const TikTokAdsService = getPlatformService('tiktok');
    const authUrl = TikTokAdsService.buildAuthUrl(config, state);
    res.json({ success: true, authUrl });
  } catch (error) {
    console.error('TikTok OAuth initiation error:', error);
    res.status(500).json({ success: false, message: 'Failed to initiate TikTok OAuth', error: error.message });
  }
};

/**
 * Handle TikTok OAuth callback
 */
const handleTikTokCallback = async (req, res) => {
  try {
    const { auth_code, state } = req.query;
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { workspaceId, userId } = stateData;

    const TikTokAdsService = getPlatformService('tiktok');
    const tokenData = await TikTokAdsService.exchangeCodeForToken(config, auth_code);
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expiresIn);

    await storeOrUpdateToken(userId, workspaceId, 'tiktok', tokenData.accessToken, null, expiresAt);
    const accounts = await TikTokAdsService.fetchAdAccounts(tokenData.accessToken, config);
    await storeAdAccounts(userId, workspaceId, 'tiktok', accounts);

    res.redirect(`/dashboard?oauth=success&platform=tiktok`);
  } catch (error) {
    console.error('TikTok OAuth callback error:', error);
    res.redirect(`/dashboard?oauth=error&message=${encodeURIComponent(error.message)}`);
  }
};

/**
 * Initiate LinkedIn OAuth flow
 */
const initiateLinkedInOAuth = (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Workspace ID is required' });
    }
    if (!config.linkedin?.clientId) {
      return res.status(500).json({ success: false, message: 'LinkedIn OAuth is not configured' });
    }

    const state = Buffer.from(JSON.stringify({
      workspaceId, userId: req.user.id, timestamp: Date.now(),
    })).toString('base64');

    const LinkedInAdsService = getPlatformService('linkedin');
    const authUrl = LinkedInAdsService.buildAuthUrl(config, state);
    res.json({ success: true, authUrl });
  } catch (error) {
    console.error('LinkedIn OAuth initiation error:', error);
    res.status(500).json({ success: false, message: 'Failed to initiate LinkedIn OAuth', error: error.message });
  }
};

/**
 * Handle LinkedIn OAuth callback
 */
const handleLinkedInCallback = async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) return res.redirect(`/dashboard?oauth=error&message=${encodeURIComponent(error)}`);

    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { workspaceId, userId } = stateData;

    const LinkedInAdsService = getPlatformService('linkedin');
    const tokenData = await LinkedInAdsService.exchangeCodeForToken(config, code);
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expiresIn);

    await storeOrUpdateToken(userId, workspaceId, 'linkedin', tokenData.accessToken, tokenData.refreshToken, expiresAt);
    const accounts = await LinkedInAdsService.fetchAdAccounts(tokenData.accessToken);
    await storeAdAccounts(userId, workspaceId, 'linkedin', accounts);

    res.redirect(`/dashboard?oauth=success&platform=linkedin`);
  } catch (error) {
    console.error('LinkedIn OAuth callback error:', error);
    res.redirect(`/dashboard?oauth=error&message=${encodeURIComponent(error.message)}`);
  }
};

// Helper functions
async function storeOrUpdateToken(userId, workspaceId, platform, accessToken, refreshToken, expiresAt) {
  const existing = await query(
    `SELECT id FROM oauth_tokens WHERE user_id = $1 AND workspace_id = $2 AND platform = $3`,
    [userId, workspaceId, platform]
  );

  if (existing.rows.length > 0) {
    await query(
      `UPDATE oauth_tokens SET access_token = $1, refresh_token = COALESCE($2, refresh_token), expires_at = $3, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $4 AND workspace_id = $5 AND platform = $6`,
      [accessToken, refreshToken, expiresAt, userId, workspaceId, platform]
    );
  } else {
    await query(
      `INSERT INTO oauth_tokens (user_id, workspace_id, platform, access_token, refresh_token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, workspaceId, platform, accessToken, refreshToken, expiresAt]
    );
  }
}

async function storeAdAccounts(userId, workspaceId, platform, accounts) {
  const tokenResult = await query(
    `SELECT id FROM oauth_tokens WHERE user_id = $1 AND workspace_id = $2 AND platform = $3`,
    [userId, workspaceId, platform]
  );
  if (!tokenResult.rows[0]) return;
  const oauthTokenId = tokenResult.rows[0].id;

  for (const account of accounts) {
    const existing = await query(
      `SELECT id FROM ad_accounts WHERE workspace_id = $1 AND platform = $2 AND account_id = $3`,
      [workspaceId, platform, account.accountId]
    );

    if (existing.rows.length > 0) {
      await query(
        `UPDATE ad_accounts SET account_name = $1, currency = $2, timezone = $3, status = $4, oauth_token_id = $5, updated_at = CURRENT_TIMESTAMP
         WHERE workspace_id = $6 AND platform = $7 AND account_id = $8`,
        [account.accountName, account.currency, account.timezone, account.status, oauthTokenId, workspaceId, platform, account.accountId]
      );
    } else {
      await query(
        `INSERT INTO ad_accounts (workspace_id, oauth_token_id, platform, account_id, account_name, currency, timezone, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [workspaceId, oauthTokenId, platform, account.accountId, account.accountName, account.currency, account.timezone, account.status]
      );
    }
  }
  console.log(`Stored ${accounts.length} ${platform} ad accounts for workspace ${workspaceId}`);
}

module.exports = {
  initiateMetaOAuth,
  handleMetaCallback,
  initiateGoogleOAuth,
  handleGoogleCallback,
  initiateTikTokOAuth,
  handleTikTokCallback,
  initiateLinkedInOAuth,
  handleLinkedInCallback,
  getConnectedAccounts,
  disconnectAccount,
  getSupportedPlatforms,
};
