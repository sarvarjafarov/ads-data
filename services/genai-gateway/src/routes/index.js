const express = require('express');
const dashboardAI = require('../controllers/dashboardAIController');
const widgetAnalysis = require('../controllers/widgetAnalysisController');
const websiteAuditAI = require('../controllers/websiteAuditAIController');
const customDataAI = require('../controllers/customDataAIController');
const { getMetrics } = require('../middleware/usageLogger');

const router = express.Router();

// --- Dashboard AI ---
router.post('/ai/dashboard/generate', dashboardAI.generate);
router.post('/ai/dashboard/recommendations', dashboardAI.recommendations);
router.post('/ai/dashboard/improvements', dashboardAI.improvements);
router.get('/ai/dashboard/options', dashboardAI.options);

// --- Widget Analysis ---
router.post('/ai/widget/analyze', widgetAnalysis.analyzeWidget);
router.post('/ai/widget/compare', widgetAnalysis.compareWidgets);
router.post('/ai/widget/trend', widgetAnalysis.analyzeTrend);

// --- Website Audit AI ---
router.post('/ai/website-audit/analyze', websiteAuditAI.analyzeBusinessImpact);

// --- Custom Data AI ---
router.post('/ai/custom-data/detect-schema', customDataAI.detectSchema);
router.post('/ai/custom-data/suggest-visualizations', customDataAI.suggestVisualizations);
router.post('/ai/custom-data/analyze-quality', customDataAI.analyzeDataQuality);
router.post('/ai/custom-data/generate-query', customDataAI.generateQuery);

// --- Gateway Metrics ---
router.get('/metrics', (req, res) => {
  res.json({ success: true, data: getMetrics() });
});

// --- Health Check ---
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'genai-gateway',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
