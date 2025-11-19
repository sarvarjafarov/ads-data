const express = require('express');
const { getAccountMetrics, getWidgetMetrics } = require('../controllers/metricsController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get metrics for a specific ad account
router.get('/account/:adAccountId', getAccountMetrics);

// Get metrics for a specific widget
router.get('/widget/:widgetId', getWidgetMetrics);

module.exports = router;
