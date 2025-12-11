const express = require('express');
const {
  getAnomalies,
  updateAnomalyStatus,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getAnomalyStats,
} = require('../controllers/anomalyController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// All anomaly routes require authentication
router.use(authenticate);

// Anomaly endpoints
router.get('/workspaces/:workspaceId/anomalies', getAnomalies);
router.get('/workspaces/:workspaceId/anomalies/stats', getAnomalyStats);
router.put('/anomalies/:anomalyId/status', updateAnomalyStatus);

// Notification endpoints
router.get('/notifications', getNotifications);
router.put('/notifications/:notificationId/read', markNotificationRead);
router.put('/notifications/read-all', markAllNotificationsRead);
router.delete('/notifications/:notificationId', deleteNotification);

module.exports = router;
