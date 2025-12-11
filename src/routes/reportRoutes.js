const express = require('express');
const {
  getScheduledReports,
  getScheduledReport,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  triggerReport,
  getExecutionHistory,
} = require('../controllers/reportController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// All report routes require authentication
router.use(authenticate);

// Scheduled reports for a workspace
router.get('/workspaces/:workspaceId/reports', getScheduledReports);
router.post('/workspaces/:workspaceId/reports', createScheduledReport);

// Individual report operations
router.get('/reports/:reportId', getScheduledReport);
router.put('/reports/:reportId', updateScheduledReport);
router.delete('/reports/:reportId', deleteScheduledReport);

// Manual trigger and execution history
router.post('/reports/:reportId/trigger', triggerReport);
router.get('/reports/:reportId/executions', getExecutionHistory);

module.exports = router;
