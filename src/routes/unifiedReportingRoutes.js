const express = require('express');
const {
  getUnifiedCampaigns,
  getPlatformComparison,
  getCrossPlatformTrends,
  getUnifiedSummary,
} = require('../controllers/unifiedReportingController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Unified reporting endpoints
router.get('/workspaces/:workspaceId/campaigns', getUnifiedCampaigns);
router.get('/workspaces/:workspaceId/platform-comparison', getPlatformComparison);
router.get('/workspaces/:workspaceId/trends', getCrossPlatformTrends);
router.get('/workspaces/:workspaceId/summary', getUnifiedSummary);

module.exports = router;
