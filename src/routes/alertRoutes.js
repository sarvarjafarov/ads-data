const express = require('express');
const {
  getWorkspaceAlerts,
  createAlert,
  updateAlert,
  deleteAlert,
  getAlertHistory,
  getRecentAlerts,
  acknowledgeAlert,
} = require('../controllers/alertController');
const {
  getCustomAlerts,
  getCustomAlert,
  createCustomAlert,
  updateCustomAlert,
  deleteCustomAlert,
} = require('../controllers/customAlertController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Alert CRUD
router.get('/workspace/:workspaceId', getWorkspaceAlerts);
router.get('/workspace/:workspaceId/recent', getRecentAlerts);
router.post('/', createAlert);
router.put('/:id', updateAlert);
router.delete('/:id', deleteAlert);

// Alert history
router.get('/:id/history', getAlertHistory);
router.post('/history/:historyId/acknowledge', acknowledgeAlert);

// Custom Alert Rules
router.get('/workspaces/:workspaceId/custom-alerts', getCustomAlerts);
router.post('/workspaces/:workspaceId/custom-alerts', createCustomAlert);
router.get('/custom-alerts/:alertId', getCustomAlert);
router.put('/custom-alerts/:alertId', updateCustomAlert);
router.delete('/custom-alerts/:alertId', deleteCustomAlert);

module.exports = router;
