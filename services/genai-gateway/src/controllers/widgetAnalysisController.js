const aiWidgetAnalysis = require('../services/aiWidgetAnalysis');

const analyzeWidget = async (req, res) => {
  try {
    const { widget, metricsData, options } = req.body;
    if (!widget || !metricsData) {
      return res.status(400).json({ success: false, error: 'widget and metricsData are required' });
    }

    const analysis = await aiWidgetAnalysis.analyzeWidget(widget, metricsData, options || {});
    res.json({ success: true, data: analysis, tokensUsed: analysis.tokensUsed });
  } catch (error) {
    console.error('[GenAI Gateway] Widget analysis error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

const compareWidgets = async (req, res) => {
  try {
    const { widgetsData } = req.body;
    if (!widgetsData || widgetsData.length < 2) {
      return res.status(400).json({ success: false, error: 'At least 2 widgets required' });
    }

    const analysis = await aiWidgetAnalysis.compareWidgets(widgetsData);
    res.json({ success: true, data: analysis, tokensUsed: analysis.tokensUsed });
  } catch (error) {
    console.error('[GenAI Gateway] Widget comparison error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

const analyzeTrend = async (req, res) => {
  try {
    const { widget, metricsData } = req.body;
    if (!widget || !metricsData) {
      return res.status(400).json({ success: false, error: 'widget and metricsData are required' });
    }

    const analysis = await aiWidgetAnalysis.analyzeTrend(widget, metricsData);
    res.json({ success: true, data: analysis, tokensUsed: analysis.tokensUsed });
  } catch (error) {
    console.error('[GenAI Gateway] Trend analysis error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { analyzeWidget, compareWidgets, analyzeTrend };
