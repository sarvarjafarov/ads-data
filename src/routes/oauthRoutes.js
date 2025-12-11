const express = require('express');
const {
  initiateMetaOAuth,
  handleMetaCallback,
  initiateGoogleOAuth,
  handleGoogleCallback,
  initiateTikTokOAuth,
  handleTikTokCallback,
  initiateLinkedInOAuth,
  handleLinkedInCallback,
  initiateSearchConsoleOAuth,
  handleSearchConsoleCallback,
  getConnectedAccounts,
  disconnectAccount,
  getSupportedPlatforms,
} = require('../controllers/oauthController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// Get supported platforms
router.get('/platforms', getSupportedPlatforms);

// Meta OAuth flow
router.get('/meta', authenticate, initiateMetaOAuth);
router.get('/meta/callback', handleMetaCallback);

// Google OAuth flow
router.get('/google', authenticate, initiateGoogleOAuth);
router.get('/google/callback', handleGoogleCallback);

// TikTok OAuth flow
router.get('/tiktok', authenticate, initiateTikTokOAuth);
router.get('/tiktok/callback', handleTikTokCallback);

// LinkedIn OAuth flow
router.get('/linkedin', authenticate, initiateLinkedInOAuth);
router.get('/linkedin/callback', handleLinkedInCallback);

// Google Search Console OAuth flow
router.get('/search-console', authenticate, initiateSearchConsoleOAuth);
router.get('/search-console/callback', handleSearchConsoleCallback);

// Account management
router.get('/accounts/:workspaceId', authenticate, getConnectedAccounts);
router.delete('/accounts/:accountId', authenticate, disconnectAccount);

module.exports = router;
