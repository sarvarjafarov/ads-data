const express = require('express');
const router = express.Router();
const customDataController = require('../controllers/customDataController');
const authenticate = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Upload and preview file
router.post(
  '/workspaces/:workspaceId/custom-data/upload',
  customDataController.upload,
  customDataController.handleMulterError,
  customDataController.uploadFile
);

// Confirm import (after preview)
router.post(
  '/workspaces/:workspaceId/custom-data/confirm',
  customDataController.confirmImport
);

// Get all custom data sources for workspace
router.get(
  '/workspaces/:workspaceId/custom-data/sources',
  customDataController.getSources
);

// Get single custom data source
router.get(
  '/workspaces/:workspaceId/custom-data/sources/:sourceId',
  customDataController.getSource
);

// Update custom data source
router.put(
  '/workspaces/:workspaceId/custom-data/sources/:sourceId',
  customDataController.updateSource
);

// Delete custom data source
router.delete(
  '/workspaces/:workspaceId/custom-data/sources/:sourceId',
  customDataController.deleteSource
);

// Get metrics data for widgets
router.get(
  '/workspaces/:workspaceId/custom-data/sources/:sourceId/metrics',
  customDataController.getMetrics
);

// Query custom data with advanced filtering
router.post(
  '/workspaces/:workspaceId/custom-data/sources/:sourceId/query',
  customDataController.queryData
);

// Trigger manual sync for Google Sheets
router.post(
  '/workspaces/:workspaceId/custom-data/sources/:sourceId/sync',
  customDataController.triggerSync
);

// Get sync history
router.get(
  '/workspaces/:workspaceId/custom-data/sources/:sourceId/sync-history',
  customDataController.getSyncHistory
);

module.exports = router;
