const express = require('express');
const {
  getWorkspaceDashboards,
  getDashboard,
  createDashboard,
  updateDashboard,
  deleteDashboard,
  addWidget,
  updateWidget,
  deleteWidget,
  createShareLink,
  getShareLinks,
  getSharedDashboard,
  deleteShareLink,
  toggleShareLink,
  listTemplates,
  createFromTemplate,
  generateAIDashboard,
  getAIRecommendations,
  getAIImprovements,
  getAIOptions,
  analyzeWidgetWithAI,
  getAIJobStatus,
} = require('../controllers/dashboardController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// Public route for shared dashboards (no auth required)
router.get('/shared/:shareToken', getSharedDashboard);

// All other dashboard routes require authentication
router.use(authenticate);

// Dashboard CRUD
router.get('/workspace/:workspaceId', getWorkspaceDashboards);
router.get('/:id', getDashboard);
router.post('/', createDashboard);
router.put('/:id', updateDashboard);
router.delete('/:id', deleteDashboard);

// Widget management
router.post('/:dashboardId/widgets', addWidget);
router.put('/widgets/:widgetId', updateWidget);
router.delete('/widgets/:widgetId', deleteWidget);

// AI Widget Analysis
router.post('/widgets/:widgetId/analyze', analyzeWidgetWithAI);
router.get('/ai-jobs/:jobId', getAIJobStatus);

// Share link management
router.post('/:dashboardId/share', createShareLink);
router.get('/:dashboardId/shares', getShareLinks);
router.delete('/shares/:shareId', deleteShareLink);
router.patch('/shares/:shareId/toggle', toggleShareLink);

// Templates
router.get('/templates/list', listTemplates);
router.post('/templates/create', createFromTemplate);

// AI Dashboard Generation
router.get('/ai/options', getAIOptions);
router.post('/ai/generate', generateAIDashboard);
router.get('/ai/:dashboardId/recommendations', getAIRecommendations);
router.post('/ai/:dashboardId/improvements', getAIImprovements);

module.exports = router;
