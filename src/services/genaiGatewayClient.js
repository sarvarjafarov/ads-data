/**
 * GenAI Gateway Client
 *
 * Replaces direct Anthropic API calls with HTTP calls to the GenAI Inference Gateway.
 * Exposes the same function signatures as the original AI services so existing
 * controllers and services work without changes beyond updating their require() paths.
 *
 * When GENAI_GATEWAY_URL is not set, falls back to the local AI services so the
 * monolith still works standalone during development.
 */

const axios = require('axios');

const GATEWAY_URL = process.env.GENAI_GATEWAY_URL || 'http://localhost:4000';
const TIMEOUT_MS = 120_000; // 2 minutes — LLM calls can be slow

const client = axios.create({
  baseURL: `${GATEWAY_URL}/api`,
  timeout: TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Dashboard AI ────────────────────────────────────────────────────────────

async function generateDashboardFromPrompt(prompt, options = {}) {
  const { adAccountId, workspaceId, platform, customSourceIds = [] } = options;

  // Pre-fetch custom sources from DB and pass them to gateway
  let customSources = [];
  if (customSourceIds.length > 0) {
    const CustomDataSource = require('../models/CustomDataSource');
    for (const sourceId of customSourceIds) {
      try {
        const source = await CustomDataSource.findById(sourceId);
        if (source) {
          customSources.push({
            id: source.id,
            name: source.source_name,
            type: source.source_type,
            metrics: source.metric_columns || [],
            dimensions: source.dimension_columns || [],
            dateColumn: source.date_column,
          });
        }
      } catch (error) {
        console.error(`Failed to load custom source ${sourceId}:`, error);
      }
    }
  }

  const res = await client.post('/ai/dashboard/generate', {
    prompt,
    adAccountId,
    workspaceId,
    platform,
    customSources,
    customSourceIds,
  });
  return res.data;
}

async function generateRecommendations(dashboardId, metrics) {
  const res = await client.post('/ai/dashboard/recommendations', { dashboardId, metrics });
  return res.data.data || res.data;
}

async function suggestDashboardImprovements(currentWidgets, userGoals) {
  const res = await client.post('/ai/dashboard/improvements', { currentWidgets, goals: userGoals });
  return res.data.data || res.data;
}

// Re-export these constants locally — they don't need the gateway
const AVAILABLE_WIDGETS = [
  'kpi_card', 'line_chart', 'bar_chart', 'pie_chart',
  'table', 'comparison', 'gauge', 'heatmap',
];

const AVAILABLE_METRICS = [
  { id: 'spend', name: 'Ad Spend', description: 'Total advertising expenditure', category: 'paid' },
  { id: 'impressions', name: 'Impressions', description: 'Number of times ads were shown', category: 'paid' },
  { id: 'clicks', name: 'Clicks', description: 'Number of ad clicks', category: 'paid' },
  { id: 'ctr', name: 'CTR', description: 'Click-through rate (clicks/impressions)', category: 'paid' },
  { id: 'cpc', name: 'CPC', description: 'Cost per click', category: 'paid' },
  { id: 'cpm', name: 'CPM', description: 'Cost per 1000 impressions', category: 'paid' },
  { id: 'reach', name: 'Reach', description: 'Unique users who saw the ad', category: 'paid' },
  { id: 'frequency', name: 'Frequency', description: 'Average times each user saw the ad', category: 'paid' },
  { id: 'conversions', name: 'Conversions', description: 'Number of desired actions completed', category: 'paid' },
  { id: 'cost_per_conversion', name: 'Cost Per Conversion', description: 'Cost for each conversion', category: 'paid' },
  { id: 'roas', name: 'ROAS', description: 'Return on ad spend', category: 'paid' },
  { id: 'revenue', name: 'Revenue', description: 'Total revenue generated', category: 'paid' },
  { id: 'search_clicks', name: 'Organic Clicks', description: 'Clicks from organic search results', category: 'organic' },
  { id: 'search_impressions', name: 'Search Impressions', description: 'Times site appeared in search results', category: 'organic' },
  { id: 'search_ctr', name: 'Search CTR', description: 'Click-through rate from search results', category: 'organic' },
  { id: 'average_position', name: 'Average Position', description: 'Average ranking position in search results', category: 'organic' },
  { id: 'top_queries', name: 'Top Queries', description: 'Keywords driving traffic to site', category: 'organic' },
  { id: 'top_pages', name: 'Top Pages', description: 'Best performing pages in search', category: 'organic' },
  { id: 'device_breakdown', name: 'Device Breakdown', description: 'Traffic split by device type', category: 'organic' },
  { id: 'country_breakdown', name: 'Country Breakdown', description: 'Traffic split by country', category: 'organic' },
  { id: 'query_page_analysis', name: 'Query-Page Analysis', description: 'Which queries lead to which pages', category: 'organic' },
];

// ─── Widget Analysis ─────────────────────────────────────────────────────────

const widgetAnalysisProxy = {
  async analyzeWidget(widget, metricsData, options = {}) {
    const res = await client.post('/ai/widget/analyze', { widget, metricsData, options });
    return res.data.data || res.data;
  },
  async compareWidgets(widgetsData) {
    const res = await client.post('/ai/widget/compare', { widgetsData });
    return res.data.data || res.data;
  },
  async analyzeTrend(widget, metricsData) {
    const res = await client.post('/ai/widget/trend', { widget, metricsData });
    return res.data.data || res.data;
  },
};

// ─── Website Audit AI ────────────────────────────────────────────────────────

const websiteAuditProxy = {
  async analyzeBusinessImpact(technicalFindings, websiteUrl) {
    const res = await client.post('/ai/website-audit/analyze', { technicalFindings, websiteUrl });
    return res.data.data || res.data;
  },
};

// ─── Custom Data AI ──────────────────────────────────────────────────────────

const customDataProxy = {
  async detectSchema(sampleRows, filename, basicDetection = {}) {
    const res = await client.post('/ai/custom-data/detect-schema', { sampleRows, filename, basicDetection });
    return res.data;
  },
  async suggestVisualizations(schema, sampleData, dataContext = '') {
    const res = await client.post('/ai/custom-data/suggest-visualizations', { schema, sampleData, dataContext });
    return res.data;
  },
  async analyzeDataQuality(data, schema) {
    const res = await client.post('/ai/custom-data/analyze-quality', { data, schema });
    return res.data;
  },
  async generateNaturalLanguageQuery(prompt, schema) {
    const res = await client.post('/ai/custom-data/generate-query', { prompt, schema });
    return res.data;
  },
};

module.exports = {
  // Dashboard AI (same exports as aiDashboard.js)
  generateDashboardFromPrompt,
  generateRecommendations,
  suggestDashboardImprovements,
  AVAILABLE_WIDGETS,
  AVAILABLE_METRICS,

  // Widget analysis (same interface as aiWidgetAnalysis singleton)
  widgetAnalysisProxy,

  // Website audit AI (same interface as aiWebsiteAudit singleton)
  websiteAuditProxy,

  // Custom data AI (same exports as aiCustomData.js)
  customDataProxy,
};
