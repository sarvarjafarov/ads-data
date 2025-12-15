/**
 * AI Custom Data Service
 * Uses Claude API for intelligent column detection, visualization suggestions,
 * and natural language query support for custom imported data
 */

const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config/config');

/**
 * Detect schema from sample data using AI
 * @param {Array} sampleRows - Sample rows from uploaded file (first 10-20 rows)
 * @param {string} filename - Original filename for context
 * @param {Object} basicDetection - Basic regex-based detection results
 * @returns {Object} Enhanced schema with AI-detected types and roles
 */
async function detectSchema(sampleRows, filename, basicDetection = {}) {
  if (!config.anthropic?.apiKey) {
    throw new Error('Anthropic API key not configured. Please set ANTHROPIC_API_KEY in environment variables.');
  }

  const anthropic = new Anthropic({
    apiKey: config.anthropic.apiKey,
  });

  const systemPrompt = `You are an expert data analyst specializing in identifying data types and structures in business data files.

Your task is to analyze sample rows from a data file and determine:
1. The data type of each column (string, number, date, currency, percentage, boolean)
2. The role of each column (metric, dimension, or date)
3. Appropriate aggregation method for metrics (sum, avg, count, min, max)
4. Which column should be used as the primary date/time dimension
5. Data quality issues (missing values, inconsistencies, outliers)

Column roles:
- **metric**: Numeric values that can be aggregated (spend, clicks, revenue, quantity)
- **dimension**: Categorical values for grouping (campaign_name, region, product)
- **date**: Date/time values for time-series analysis

Respond ONLY with valid JSON in this exact format:
{
  "columns": [
    {
      "name": "column_name",
      "type": "string|number|date|currency|percentage|boolean",
      "role": "metric|dimension|date",
      "aggregation": "sum|avg|count|min|max|null",
      "format": "format_hint_if_applicable",
      "nullCount": 0,
      "sampleValues": ["value1", "value2"],
      "confidence": 0.95
    }
  ],
  "primaryDateColumn": "column_name or null",
  "confidence": 0.95,
  "warnings": [
    "Data quality warning if any"
  ],
  "suggestions": [
    "Suggestion for how to use this data"
  ]
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Analyze this data file and detect the schema:

Filename: ${filename}

Sample data (first ${sampleRows.length} rows):
${JSON.stringify(sampleRows, null, 2)}

${basicDetection.columns ? `\nBasic regex-based detection results:\n${JSON.stringify(basicDetection, null, 2)}` : ''}

Provide a detailed schema analysis with column types, roles, and recommendations.`,
        },
      ],
      system: systemPrompt,
    });

    // Extract JSON from response
    const responseText = message.content[0].text;
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const schema = JSON.parse(jsonStr.trim());

    return {
      success: true,
      schema,
      tokensUsed: message.usage?.input_tokens + message.usage?.output_tokens,
    };
  } catch (error) {
    console.error('AI schema detection error:', error);
    throw error;
  }
}

/**
 * Suggest appropriate visualizations for the detected schema
 * @param {Object} schema - Detected schema from detectSchema()
 * @param {Array} sampleData - Sample data rows
 * @param {string} dataContext - Additional context about the data (optional)
 * @returns {Object} Visualization recommendations
 */
async function suggestVisualizations(schema, sampleData, dataContext = '') {
  if (!config.anthropic?.apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const anthropic = new Anthropic({
    apiKey: config.anthropic.apiKey,
  });

  const AVAILABLE_WIDGET_TYPES = [
    'kpi_card',      // Single metric display
    'line_chart',    // Time series data
    'bar_chart',     // Comparison data
    'pie_chart',     // Distribution data
    'table',         // Detailed data table
    'comparison',    // Before/after comparison
    'gauge',         // Progress indicator
    'heatmap',       // Time-based heatmap
  ];

  const systemPrompt = `You are an expert data visualization designer. Your task is to recommend the most effective visualizations for custom imported data.

Available widget types:
${AVAILABLE_WIDGET_TYPES.map(w => `- ${w}`).join('\n')}

Guidelines:
1. KPI cards for key single metrics
2. Line charts for time-series trends (requires date column)
3. Bar charts for comparing categories
4. Pie charts for proportions/distributions (max 6-8 slices)
5. Tables for detailed breakdowns
6. Gauges for progress toward goals
7. Heatmaps for time-based patterns

Respond ONLY with valid JSON in this exact format:
{
  "recommendedWidgets": [
    {
      "widgetType": "widget_type",
      "title": "Suggested widget title",
      "metric": "column_name",
      "dimensions": ["dimension_column"],
      "aggregation": "sum|avg|count",
      "priority": "high|medium|low",
      "reasoning": "Why this visualization is recommended",
      "position": { "x": 0, "y": 0, "w": 4, "h": 4 }
    }
  ],
  "dashboardName": "Suggested name for dashboard",
  "overallInsight": "What this data can tell you"
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 3072,
      messages: [
        {
          role: 'user',
          content: `Suggest visualizations for this custom data:

Schema:
${JSON.stringify(schema, null, 2)}

Sample data (first ${sampleData.length} rows):
${JSON.stringify(sampleData.slice(0, 5), null, 2)}

${dataContext ? `\nAdditional context: ${dataContext}` : ''}

Recommend 4-8 widgets that would create an insightful dashboard for this data.`,
        },
      ],
      system: systemPrompt,
    });

    const responseText = message.content[0].text;
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const recommendations = JSON.parse(jsonStr.trim());

    return {
      success: true,
      recommendations,
      tokensUsed: message.usage?.input_tokens + message.usage?.output_tokens,
    };
  } catch (error) {
    console.error('AI visualization suggestion error:', error);
    throw error;
  }
}

/**
 * Analyze data quality and provide insights
 * @param {Array} data - Full dataset or large sample
 * @param {Object} schema - Detected schema
 * @returns {Object} Data quality analysis
 */
async function analyzeDataQuality(data, schema) {
  if (!config.anthropic?.apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const anthropic = new Anthropic({
    apiKey: config.anthropic.apiKey,
  });

  // Calculate basic statistics
  const stats = calculateBasicStats(data, schema);

  const systemPrompt = `You are a data quality expert. Analyze the provided dataset and identify:
1. Missing or null values
2. Inconsistent data formats
3. Potential outliers or anomalies
4. Data completeness issues
5. Recommendations for data cleanup

Respond ONLY with valid JSON in this exact format:
{
  "overallQuality": "excellent|good|fair|poor",
  "qualityScore": 0-100,
  "issues": [
    {
      "severity": "critical|warning|info",
      "column": "column_name",
      "type": "missing_values|inconsistent_format|outliers|other",
      "description": "Detailed description",
      "affectedRows": 10,
      "recommendation": "How to fix this"
    }
  ],
  "strengths": [
    "Positive aspect of the data quality"
  ],
  "summary": "Overall data quality assessment"
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Analyze the data quality for this dataset:

Schema:
${JSON.stringify(schema, null, 2)}

Statistics:
${JSON.stringify(stats, null, 2)}

Sample rows:
${JSON.stringify(data.slice(0, 10), null, 2)}

Total rows: ${data.length}

Provide a comprehensive data quality analysis.`,
        },
      ],
      system: systemPrompt,
    });

    const responseText = message.content[0].text;
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const analysis = JSON.parse(jsonStr.trim());

    return {
      success: true,
      analysis,
      tokensUsed: message.usage?.input_tokens + message.usage?.output_tokens,
    };
  } catch (error) {
    console.error('Data quality analysis error:', error);
    throw error;
  }
}

/**
 * Convert natural language query to filters and aggregations
 * @param {string} prompt - Natural language query (e.g., "Show me total revenue by region for last quarter")
 * @param {Object} schema - Available columns and their types
 * @returns {Object} Structured query configuration
 */
async function generateNaturalLanguageQuery(prompt, schema) {
  if (!config.anthropic?.apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const anthropic = new Anthropic({
    apiKey: config.anthropic.apiKey,
  });

  const systemPrompt = `You are an expert at translating natural language queries into structured data queries.

Available columns and types:
${JSON.stringify(schema.columns, null, 2)}

Respond ONLY with valid JSON in this exact format:
{
  "metric": "column_name",
  "aggregation": "sum|avg|count|min|max",
  "groupBy": ["dimension_column"],
  "filters": [
    {
      "column": "column_name",
      "operator": "equals|contains|greater_than|less_than|between",
      "value": "value or array for between"
    }
  ],
  "dateRange": {
    "column": "date_column_name",
    "start": "YYYY-MM-DD or relative like 'last_30_days'",
    "end": "YYYY-MM-DD or 'today'"
  },
  "sortBy": {
    "column": "column_name",
    "direction": "asc|desc"
  },
  "limit": 10,
  "interpretation": "How you understood the query"
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Convert this natural language query into a structured query:

Query: "${prompt}"

Available schema:
${JSON.stringify(schema, null, 2)}

Generate a structured query that can be executed against this custom data.`,
        },
      ],
      system: systemPrompt,
    });

    const responseText = message.content[0].text;
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const query = JSON.parse(jsonStr.trim());

    return {
      success: true,
      query,
      tokensUsed: message.usage?.input_tokens + message.usage?.output_tokens,
    };
  } catch (error) {
    console.error('Natural language query generation error:', error);
    throw error;
  }
}

/**
 * Calculate basic statistics for data quality analysis
 * @param {Array} data - Dataset
 * @param {Object} schema - Schema information
 * @returns {Object} Statistics
 */
function calculateBasicStats(data, schema) {
  const stats = {
    totalRows: data.length,
    columns: {},
  };

  if (data.length === 0 || !schema.columns) {
    return stats;
  }

  schema.columns.forEach(column => {
    const columnName = column.name;
    const values = data.map(row => row[columnName]);
    const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');

    const columnStats = {
      totalValues: values.length,
      nonNullValues: nonNullValues.length,
      nullValues: values.length - nonNullValues.length,
      nullPercentage: ((values.length - nonNullValues.length) / values.length * 100).toFixed(2),
      uniqueValues: new Set(nonNullValues).size,
    };

    // For numeric columns, calculate additional stats
    if (column.role === 'metric' && nonNullValues.length > 0) {
      const numericValues = nonNullValues
        .map(v => parseFloat(String(v).replace(/[$€£¥,\s]/g, '').replace('%', '')))
        .filter(v => !isNaN(v));

      if (numericValues.length > 0) {
        columnStats.min = Math.min(...numericValues);
        columnStats.max = Math.max(...numericValues);
        columnStats.avg = numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length;
        columnStats.median = calculateMedian(numericValues);
      }
    }

    stats.columns[columnName] = columnStats;
  });

  return stats;
}

/**
 * Calculate median value
 * @param {Array} numbers - Array of numbers
 * @returns {number} Median value
 */
function calculateMedian(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

module.exports = {
  detectSchema,
  suggestVisualizations,
  analyzeDataQuality,
  generateNaturalLanguageQuery,
};
