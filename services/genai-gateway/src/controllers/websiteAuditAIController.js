const aiWebsiteAudit = require('../services/aiWebsiteAudit');

const analyzeBusinessImpact = async (req, res) => {
  try {
    const { technicalFindings, websiteUrl } = req.body;
    if (!technicalFindings || !websiteUrl) {
      return res.status(400).json({ success: false, error: 'technicalFindings and websiteUrl are required' });
    }

    const analysis = await aiWebsiteAudit.analyzeBusinessImpact(technicalFindings, websiteUrl);
    res.json({ success: true, data: analysis, tokensUsed: analysis.tokensUsed });
  } catch (error) {
    console.error('[GenAI Gateway] Website audit AI error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { analyzeBusinessImpact };
