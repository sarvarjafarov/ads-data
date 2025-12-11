const express = require('express');
const {
  exportToCSV,
  getExportHistory,
} = require('../controllers/exportController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// All export routes require authentication
router.use(authenticate);

// Export operations
router.post('/workspaces/:workspaceId/export/csv', exportToCSV);
router.get('/workspaces/:workspaceId/export/history', getExportHistory);

module.exports = router;
