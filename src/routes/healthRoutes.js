const express = require('express');
const {
  getHealth,
  getSystemMetrics,
  getErrorLogs,
  getPerformanceMetrics,
} = require('../controllers/healthController');

const router = express.Router();

// Basic health check (no auth required)
router.get('/', getHealth);

// Detailed monitoring endpoints
router.get('/metrics', getSystemMetrics);
router.get('/errors', getErrorLogs);
router.get('/performance', getPerformanceMetrics);

module.exports = router;
