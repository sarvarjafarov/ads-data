const express = require('express');
const {
  initiateTikTokAuth,
  handleTikTokCallback,
  getTikTokStatus,
  disconnectTikTok,
  syncTikTokData,
} = require('../controllers/tiktokOAuthController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// TikTok OAuth flow
router.get('/workspaces/:workspaceId/auth', authenticate, initiateTikTokAuth);
router.get('/callback', handleTikTokCallback);

// TikTok connection management (require authentication)
router.use(authenticate);
router.get('/workspaces/:workspaceId/status', getTikTokStatus);
router.post('/workspaces/:workspaceId/disconnect', disconnectTikTok);
router.post('/workspaces/:workspaceId/sync', syncTikTokData);

module.exports = router;
