const express = require('express');
const {
  initiateLinkedInAuth,
  handleLinkedInCallback,
  getLinkedInStatus,
  disconnectLinkedIn,
  syncLinkedInData,
} = require('../controllers/linkedinOAuthController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// LinkedIn OAuth flow
router.get('/workspaces/:workspaceId/auth', authenticate, initiateLinkedInAuth);
router.get('/callback', handleLinkedInCallback);

// LinkedIn connection management (require authentication)
router.use(authenticate);
router.get('/workspaces/:workspaceId/status', getLinkedInStatus);
router.post('/workspaces/:workspaceId/disconnect', disconnectLinkedIn);
router.post('/workspaces/:workspaceId/sync', syncLinkedInData);

module.exports = router;
