const express = require('express');
const {
  getBudgetConfig,
  updateBudgetConfig,
  getBudgetPacing,
  getBudgetAlerts,
  acknowledgeBudgetAlert,
} = require('../controllers/budgetController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// All budget routes require authentication
router.use(authenticate);

// Get budget configuration for an ad account
router.get('/accounts/:adAccountId/config', getBudgetConfig);

// Update budget configuration
router.put('/accounts/:adAccountId/config', updateBudgetConfig);

// Get budget pacing data (current spend, projections, alerts)
router.get('/accounts/:adAccountId/pacing', getBudgetPacing);

// Get budget alerts history
router.get('/accounts/:adAccountId/alerts', getBudgetAlerts);

// Acknowledge a budget alert
router.post('/alerts/:alertId/acknowledge', acknowledgeBudgetAlert);

module.exports = router;
