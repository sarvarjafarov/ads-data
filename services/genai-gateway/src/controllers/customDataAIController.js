const aiCustomData = require('../services/aiCustomData');

const detectSchema = async (req, res) => {
  try {
    const { sampleRows, filename, basicDetection } = req.body;
    if (!sampleRows || !filename) {
      return res.status(400).json({ success: false, error: 'sampleRows and filename are required' });
    }

    const result = await aiCustomData.detectSchema(sampleRows, filename, basicDetection || {});
    res.json(result);
  } catch (error) {
    console.error('[GenAI Gateway] Schema detection error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

const suggestVisualizations = async (req, res) => {
  try {
    const { schema, sampleData, dataContext } = req.body;
    if (!schema || !sampleData) {
      return res.status(400).json({ success: false, error: 'schema and sampleData are required' });
    }

    const result = await aiCustomData.suggestVisualizations(schema, sampleData, dataContext || '');
    res.json(result);
  } catch (error) {
    console.error('[GenAI Gateway] Visualization suggestion error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

const analyzeDataQuality = async (req, res) => {
  try {
    const { data, schema } = req.body;
    if (!data || !schema) {
      return res.status(400).json({ success: false, error: 'data and schema are required' });
    }

    const result = await aiCustomData.analyzeDataQuality(data, schema);
    res.json(result);
  } catch (error) {
    console.error('[GenAI Gateway] Data quality error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

const generateQuery = async (req, res) => {
  try {
    const { prompt, schema } = req.body;
    if (!prompt || !schema) {
      return res.status(400).json({ success: false, error: 'prompt and schema are required' });
    }

    const result = await aiCustomData.generateNaturalLanguageQuery(prompt, schema);
    res.json(result);
  } catch (error) {
    console.error('[GenAI Gateway] NL query error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { detectSchema, suggestVisualizations, analyzeDataQuality, generateQuery };
