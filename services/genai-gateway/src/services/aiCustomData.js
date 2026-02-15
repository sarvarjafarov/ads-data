/**
 * AI Custom Data Service (Gateway version)
 * Schema detection, visualization suggestions, data quality analysis,
 * and natural language queries for custom imported data.
 */

const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

function getClient() {
  if (!config.anthropic?.apiKey) throw new Error('Anthropic API key not configured.');
  return new Anthropic({ apiKey: config.anthropic.apiKey });
}

async function detectSchema(sampleRows, filename, basicDetection = {}) {
  const anthropic = getClient();

  const systemPrompt = `You are an expert data analyst. Analyze sample rows and determine column types and roles.

Respond ONLY with valid JSON:
{
  "columns": [
    {
      "name": "column_name",
      "type": "string|number|date|currency|percentage|boolean",
      "role": "metric|dimension|date",
      "aggregation": "sum|avg|count|min|max|null",
      "format": "format_hint",
      "nullCount": 0,
      "sampleValues": ["v1", "v2"],
      "confidence": 0.95
    }
  ],
  "primaryDateColumn": "column_name or null",
  "confidence": 0.95,
  "warnings": [],
  "suggestions": []
}`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Analyze this data file schema:\n\nFilename: ${filename}\n\nSample data (${sampleRows.length} rows):\n${JSON.stringify(sampleRows, null, 2)}\n\n${basicDetection.columns ? `Basic detection:\n${JSON.stringify(basicDetection, null, 2)}` : ''}`,
    }],
    system: systemPrompt,
  });

  const responseText = message.content[0].text;
  let jsonStr = responseText;
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1];

  return {
    success: true,
    schema: JSON.parse(jsonStr.trim()),
    tokensUsed: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0),
  };
}

async function suggestVisualizations(schema, sampleData, dataContext = '') {
  const anthropic = getClient();

  const systemPrompt = `You are an expert data visualization designer. Recommend effective visualizations.

Available widget types: kpi_card, line_chart, bar_chart, pie_chart, table, comparison, gauge, heatmap

Respond ONLY with valid JSON:
{
  "recommendedWidgets": [
    {
      "widgetType": "widget_type",
      "title": "Widget title",
      "metric": "column_name",
      "dimensions": ["dimension_column"],
      "aggregation": "sum|avg|count",
      "priority": "high|medium|low",
      "reasoning": "Why recommended",
      "position": { "x": 0, "y": 0, "w": 4, "h": 4 }
    }
  ],
  "dashboardName": "Suggested name",
  "overallInsight": "What this data reveals"
}`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 3072,
    messages: [{
      role: 'user',
      content: `Suggest visualizations:\n\nSchema:\n${JSON.stringify(schema, null, 2)}\n\nSample (${sampleData.length} rows):\n${JSON.stringify(sampleData.slice(0, 5), null, 2)}\n\n${dataContext ? `Context: ${dataContext}` : ''}`,
    }],
    system: systemPrompt,
  });

  const responseText = message.content[0].text;
  let jsonStr = responseText;
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1];

  return {
    success: true,
    recommendations: JSON.parse(jsonStr.trim()),
    tokensUsed: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0),
  };
}

async function analyzeDataQuality(data, schema) {
  const anthropic = getClient();

  const stats = calculateBasicStats(data, schema);

  const systemPrompt = `You are a data quality expert. Analyze and identify issues.

Respond ONLY with valid JSON:
{
  "overallQuality": "excellent|good|fair|poor",
  "qualityScore": 0-100,
  "issues": [{ "severity": "critical|warning|info", "column": "...", "type": "...", "description": "...", "affectedRows": 0, "recommendation": "..." }],
  "strengths": [],
  "summary": "Overall assessment"
}`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Analyze data quality:\n\nSchema:\n${JSON.stringify(schema, null, 2)}\n\nStatistics:\n${JSON.stringify(stats, null, 2)}\n\nSample:\n${JSON.stringify(data.slice(0, 10), null, 2)}\n\nTotal rows: ${data.length}`,
    }],
    system: systemPrompt,
  });

  const responseText = message.content[0].text;
  let jsonStr = responseText;
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1];

  return {
    success: true,
    analysis: JSON.parse(jsonStr.trim()),
    tokensUsed: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0),
  };
}

async function generateNaturalLanguageQuery(prompt, schema) {
  const anthropic = getClient();

  const systemPrompt = `You are an expert at translating natural language queries into structured data queries.

Available columns:\n${JSON.stringify(schema.columns, null, 2)}

Respond ONLY with valid JSON:
{
  "metric": "column_name",
  "aggregation": "sum|avg|count|min|max",
  "groupBy": ["dimension"],
  "filters": [{ "column": "...", "operator": "equals|contains|greater_than|less_than|between", "value": "..." }],
  "dateRange": { "column": "...", "start": "...", "end": "..." },
  "sortBy": { "column": "...", "direction": "asc|desc" },
  "limit": 10,
  "interpretation": "How you understood the query"
}`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Convert to structured query:\n\nQuery: "${prompt}"\n\nSchema:\n${JSON.stringify(schema, null, 2)}`,
    }],
    system: systemPrompt,
  });

  const responseText = message.content[0].text;
  let jsonStr = responseText;
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1];

  return {
    success: true,
    query: JSON.parse(jsonStr.trim()),
    tokensUsed: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0),
  };
}

function calculateBasicStats(data, schema) {
  const stats = { totalRows: data.length, columns: {} };
  if (data.length === 0 || !schema.columns) return stats;

  schema.columns.forEach(column => {
    const values = data.map(row => row[column.name]);
    const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');

    const columnStats = {
      totalValues: values.length,
      nonNullValues: nonNull.length,
      nullValues: values.length - nonNull.length,
      nullPercentage: ((values.length - nonNull.length) / values.length * 100).toFixed(2),
      uniqueValues: new Set(nonNull).size,
    };

    if (column.role === 'metric' && nonNull.length > 0) {
      const nums = nonNull
        .map(v => parseFloat(String(v).replace(/[$\u20ac\u00a3\u00a5,\s]/g, '').replace('%', '')))
        .filter(v => !isNaN(v));
      if (nums.length > 0) {
        columnStats.min = Math.min(...nums);
        columnStats.max = Math.max(...nums);
        columnStats.avg = nums.reduce((s, v) => s + v, 0) / nums.length;
      }
    }

    stats.columns[column.name] = columnStats;
  });

  return stats;
}

module.exports = { detectSchema, suggestVisualizations, analyzeDataQuality, generateNaturalLanguageQuery };
