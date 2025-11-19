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

module.exports = router;
