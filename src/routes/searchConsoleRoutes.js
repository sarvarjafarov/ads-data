const express = require('express');
const {
  getSearchAnalytics,
  getTopQueries,
  getPagePerformance,
  getDeviceBreakdown,
  getCountryBreakdown,
  getQueryPageAnalysis,
  getSearchAppearance,
} = require('../controllers/searchConsoleController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Comprehensive analytics report
router.get('/:accountId/analytics', getSearchAnalytics);

// Individual analytics endpoints
router.get('/:accountId/queries', getTopQueries);
router.get('/:accountId/pages', getPagePerformance);
router.get('/:accountId/devices', getDeviceBreakdown);
router.get('/:accountId/countries', getCountryBreakdown);
router.get('/:accountId/query-pages', getQueryPageAnalysis);
router.get('/:accountId/appearance', getSearchAppearance);

module.exports = router;
