const express = require('express');
const {
  auditWebsite,
  getAuditHistory,
  getAuditStats
} = require('../controllers/websiteAuditController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// All website audit routes require authentication
router.use(authenticate);

/**
 * Audit a website for tracking pixels and events
 * POST /api/website-audit/workspaces/:workspaceId/audit
 *
 * Request body:
 * {
 *   "url": "https://example.com"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "websiteUrl": "https://example.com",
 *     "technicalFindings": {...},
 *     "businessAnalysis": {...},
 *     "metadata": {...}
 *   },
 *   "cached": false
 * }
 *
 * Rate limit: 5 audits per hour per workspace
 */
router.post('/workspaces/:workspaceId/audit', auditWebsite);

/**
 * Get audit history for a workspace
 * GET /api/website-audit/workspaces/:workspaceId/history?limit=20&offset=0
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "audits": [...],
 *     "total": 100,
 *     "limit": 20,
 *     "offset": 0
 *   }
 * }
 */
router.get('/workspaces/:workspaceId/history', getAuditHistory);

/**
 * Get audit statistics for a workspace
 * GET /api/website-audit/workspaces/:workspaceId/stats
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "total_audits": 10,
 *     "avg_score": 75.5,
 *     "avg_duration_ms": 15000,
 *     "recent_audits_last_hour": 2,
 *     "rate_limit_remaining": 3
 *   }
 * }
 */
router.get('/workspaces/:workspaceId/stats', getAuditStats);

module.exports = router;
