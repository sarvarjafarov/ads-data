/**
 * AI Dashboard Generation Service
 * Uses Claude API to generate dashboards from natural language prompts
 */

const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config/config');
const CustomDataSource = require('../models/CustomDataSource');

// Available widget types and metrics for context
const AVAILABLE_WIDGETS = [
  'kpi_card',      // Single metric display
  'line_chart',    // Time series data
  'bar_chart',     // Comparison data
  'pie_chart',     // Distribution data
  'table',         // Detailed data table
  'comparison',    // Before/after comparison
  'gauge',         // Progress indicator
  'heatmap',       // Time-based heatmap
];

const AVAILABLE_METRICS = [
  // Paid advertising metrics
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
  // Search Console (organic search) metrics
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

/**
 * Generate dashboard configuration from user prompt
 */
async function generateDashboardFromPrompt(prompt, options = {}) {
  const { adAccountId, workspaceId, platform = 'meta', customSourceIds = [] } = options;

  if (!config.anthropic?.apiKey) {
    throw new Error('Anthropic API key not configured. Please set ANTHROPIC_API_KEY in environment variables.');
  }

  // Fetch custom data sources if provided
  const customSources = [];
  if (customSourceIds.length > 0) {
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

  const anthropic = new Anthropic({
    apiKey: config.anthropic.apiKey,
  });

  // Build custom metrics list
  const customMetrics = customSources.flatMap(source =>
    source.metrics.map(metric => ({
      id: `custom_${source.id}_${metric}`,
      name: `${source.name} - ${metric}`,
      description: `${metric} from custom data source: ${source.name}`,
      category: 'custom',
      sourceId: source.id,
      sourceName: source.name,
      metricName: metric,
    }))
  );

  const allMetrics = [...AVAILABLE_METRICS, ...customMetrics];

  const systemPrompt = `You are an expert advertising analytics dashboard designer. Your task is to create comprehensive, insightful dashboards based on user requirements.

Available widget types:
${AVAILABLE_WIDGETS.map(w => `- ${w}`).join('\n')}

Available metrics:
${allMetrics.map(m => `- ${m.id}: ${m.name} - ${m.description}`).join('\n')}

${customSources.length > 0 ? `\nCustom Data Sources Available:
${customSources.map(s => `- ${s.name} (${s.type}): ${s.metrics.join(', ')}`).join('\n')}

When using custom data sources, set the widget's dataSource to:
{
  "type": "custom_data",
  "customSourceId": "source_id",
  "metric": "metric_name",
  "aggregation": "sum|avg|count"
}
` : ''}

Dashboard grid is 12 columns wide. Widgets have positions: { x: 0-11, y: row, w: width (1-12), h: height (typically 4-8) }

When designing dashboards:
1. Start with high-level KPIs at the top (row 0)
2. Add trend charts in the middle
3. Include detailed breakdowns at the bottom
4. Use appropriate widget types for each metric
5. Ensure logical flow and grouping of related metrics
6. Consider visual hierarchy and balance

Respond ONLY with valid JSON in this exact format:
{
  "name": "Dashboard name based on the prompt",
  "description": "Brief description of what this dashboard tracks",
  "widgets": [
    {
      "widgetType": "widget_type",
      "title": "Widget title",
      "metric": "metric_id",
      "position": { "x": 0, "y": 0, "w": 4, "h": 4 },
      "description": "What this widget shows"
    }
  ],
  "insights": [
    "Key insight or recommendation about this dashboard"
  ]
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Create a comprehensive advertising analytics dashboard for the following requirement:\n\n"${prompt}"\n\nGenerate a well-structured dashboard with appropriate widgets and metrics. Make it detailed and actionable.`,
        },
      ],
      system: systemPrompt,
    });

    // Extract the JSON from the response
    const responseText = message.content[0].text;

    // Parse JSON from response (handle potential markdown code blocks)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const dashboardConfig = JSON.parse(jsonStr.trim());

    // Validate and enhance the configuration
    const validatedConfig = validateAndEnhanceConfig(dashboardConfig, options);

    return {
      success: true,
      dashboard: validatedConfig,
      tokensUsed: message.usage?.input_tokens + message.usage?.output_tokens,
    };
  } catch (error) {
    console.error('AI Dashboard generation error:', error);
    throw error;
  }
}

/**
 * Validate and enhance the AI-generated configuration
 */
function validateAndEnhanceConfig(config, options) {
  const { adAccountId, customSourceIds = [] } = options;

  // Ensure required fields
  if (!config.name) config.name = 'AI Generated Dashboard';
  if (!config.description) config.description = 'Dashboard created by AI';
  if (!config.widgets) config.widgets = [];
  if (!config.insights) config.insights = [];

  // Validate and enhance each widget
  config.widgets = config.widgets.map((widget, index) => {
    // Ensure valid widget type
    if (!AVAILABLE_WIDGETS.includes(widget.widgetType)) {
      widget.widgetType = 'kpi_card';
    }

    // Check if this is a custom data widget
    const isCustomMetric = widget.metric?.startsWith('custom_');

    // Handle data source configuration
    if (widget.dataSource?.type === 'custom_data' || isCustomMetric) {
      // Custom data source widget
      let customSourceId = widget.dataSource?.customSourceId;
      let metricName = widget.dataSource?.metric;

      // Extract from metric ID if not explicitly provided
      if (isCustomMetric && !customSourceId) {
        const parts = widget.metric.split('_');
        if (parts.length >= 3) {
          customSourceId = parts[1]; // custom_<sourceId>_<metric>
          metricName = parts.slice(2).join('_');
        }
      }

      // Validate custom source exists in provided sources
      if (customSourceId && customSourceIds.includes(customSourceId)) {
        widget.dataSource = {
          type: 'custom_data',
          customSourceId,
          metric: metricName || widget.metric,
          aggregation: widget.dataSource?.aggregation || 'sum',
          filters: widget.dataSource?.filters || {},
          groupBy: widget.dataSource?.groupBy || [],
          dateRange: widget.dataSource?.dateRange || 'last_30_days',
        };
      } else {
        // Fallback to first custom source or platform data
        if (customSourceIds.length > 0) {
          widget.dataSource = {
            type: 'custom_data',
            customSourceId: customSourceIds[0],
            metric: metricName || 'spend',
            aggregation: 'sum',
            dateRange: 'last_30_days',
          };
        } else {
          // No custom sources available, use platform data
          widget.dataSource = {
            type: 'platform',
            adAccountId: adAccountId || null,
            metric: 'spend',
            dateRange: 'last_30_days',
          };
        }
      }
    } else {
      // Platform data source widget
      const validMetric = AVAILABLE_METRICS.find(m => m.id === widget.metric);
      if (!validMetric) {
        widget.metric = 'spend';
      }

      widget.dataSource = {
        type: 'platform',
        adAccountId: adAccountId || null,
        metric: widget.metric,
        dateRange: 'last_30_days',
      };
    }

    // Ensure valid position
    if (!widget.position) {
      widget.position = {
        x: (index % 3) * 4,
        y: Math.floor(index / 3) * 4,
        w: 4,
        h: 4,
      };
    }

    // Clamp position values
    widget.position.x = Math.max(0, Math.min(11, widget.position.x || 0));
    widget.position.y = Math.max(0, widget.position.y || 0);
    widget.position.w = Math.max(1, Math.min(12, widget.position.w || 4));
    widget.position.h = Math.max(2, Math.min(12, widget.position.h || 4));

    return widget;
  });

  return config;
}

/**
 * Generate dashboard recommendations based on existing data
 */
async function generateRecommendations(dashboardId, metrics) {
  if (!config.anthropic?.apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const anthropic = new Anthropic({
    apiKey: config.anthropic.apiKey,
  });

  const systemPrompt = `You are an expert advertising analyst. Analyze the provided metrics and generate actionable recommendations.

Provide recommendations in this JSON format:
{
  "recommendations": [
    {
      "type": "optimization|alert|insight",
      "priority": "high|medium|low",
      "title": "Short title",
      "description": "Detailed recommendation",
      "metric": "affected_metric",
      "suggestedAction": "What to do"
    }
  ],
  "summary": "Brief overall analysis"
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Analyze these advertising metrics and provide recommendations:\n\n${JSON.stringify(metrics, null, 2)}`,
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

    return JSON.parse(jsonStr.trim());
  } catch (error) {
    console.error('Recommendation generation error:', error);
    throw error;
  }
}

/**
 * Suggest improvements for an existing dashboard
 */
async function suggestDashboardImprovements(currentWidgets, userGoals) {
  if (!config.anthropic?.apiKey) {
    throw new Error('Anthropic API key not configured');
  }

  const anthropic = new Anthropic({
    apiKey: config.anthropic.apiKey,
  });

  const systemPrompt = `You are an expert dashboard designer. Analyze the current dashboard configuration and suggest improvements.

Current available widgets: ${AVAILABLE_WIDGETS.join(', ')}
Available metrics: ${AVAILABLE_METRICS.map(m => m.id).join(', ')}

Provide suggestions in this JSON format:
{
  "suggestions": [
    {
      "type": "add|remove|modify|reposition",
      "widget": { /* widget configuration if adding/modifying */ },
      "reason": "Why this improvement helps",
      "impact": "Expected benefit"
    }
  ],
  "overallScore": 1-10,
  "summary": "Overall assessment"
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Current dashboard widgets:\n${JSON.stringify(currentWidgets, null, 2)}\n\nUser goals: ${userGoals}\n\nSuggest improvements to make this dashboard more effective.`,
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

    return JSON.parse(jsonStr.trim());
  } catch (error) {
    console.error('Dashboard improvement suggestion error:', error);
    throw error;
  }
}

module.exports = {
  generateDashboardFromPrompt,
  generateRecommendations,
  suggestDashboardImprovements,
  AVAILABLE_WIDGETS,
  AVAILABLE_METRICS,
};
