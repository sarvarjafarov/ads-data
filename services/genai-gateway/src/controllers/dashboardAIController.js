const {
  generateDashboardFromPrompt,
  generateRecommendations,
  suggestDashboardImprovements,
  AVAILABLE_WIDGETS,
  AVAILABLE_METRICS,
} = require('../services/aiDashboard');

const generate = async (req, res) => {
  try {
    const { prompt, adAccountId, workspaceId, platform, customSources, customSourceIds } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'Prompt is required' });

    const result = await generateDashboardFromPrompt(prompt, {
      adAccountId,
      workspaceId,
      platform,
      customSources: customSources || [],
      customSourceIds: customSourceIds || [],
    });

    res.json(result);
  } catch (error) {
    console.error('[GenAI Gateway] Dashboard generation error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

const recommendations = async (req, res) => {
  try {
    const { dashboardId, metrics } = req.body;
    if (!metrics) return res.status(400).json({ success: false, error: 'Metrics data is required' });

    const result = await generateRecommendations(dashboardId, metrics);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[GenAI Gateway] Recommendations error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

const improvements = async (req, res) => {
  try {
    const { currentWidgets, goals } = req.body;
    const result = await suggestDashboardImprovements(
      currentWidgets || [],
      goals || 'Improve overall dashboard effectiveness'
    );
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[GenAI Gateway] Improvements error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

const options = (req, res) => {
  res.json({ success: true, data: { widgets: AVAILABLE_WIDGETS, metrics: AVAILABLE_METRICS } });
};

module.exports = { generate, recommendations, improvements, options };
