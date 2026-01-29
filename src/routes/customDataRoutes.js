const express = require('express');
const router = express.Router();
const customDataController = require('../controllers/customDataController');
const authenticate = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Mounted at /api/workspaces/:workspaceId/custom-data - req.params.workspaceId is set by parent

// Upload and preview file
router.post(
  '/upload',
  customDataController.upload,
  customDataController.handleMulterError,
  customDataController.uploadFile
);

// Confirm import (after preview)
router.post(
  '/confirm',
  customDataController.confirmImport
);

// Get all custom data sources for workspace
router.get(
  '/sources',
  customDataController.getSources
);

// Get single custom data source
router.get(
  '/sources/:sourceId',
  customDataController.getSource
);

// Update custom data source
router.put(
  '/sources/:sourceId',
  customDataController.updateSource
);

// Delete custom data source
router.delete(
  '/sources/:sourceId',
  customDataController.deleteSource
);

// Get metrics data for widgets
router.get(
  '/sources/:sourceId/metrics',
  customDataController.getMetrics
);

// Query custom data with advanced filtering
router.post(
  '/sources/:sourceId/query',
  customDataController.queryData
);

// Trigger manual sync for Google Sheets
router.post(
  '/sources/:sourceId/sync',
  customDataController.triggerSync
);

// Get sync history
router.get(
  '/sources/:sourceId/sync-history',
  customDataController.getSyncHistory
);

module.exports = router;
