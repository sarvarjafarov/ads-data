/**
 * AI Widget Analysis Service (Gateway version)
 * Provides performance analysis and recommendations for dashboard widgets.
 * Identical to the monolith version but reads config from gateway config.
 */

const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

class AIWidgetAnalysisService {
  constructor() {
    this.anthropic = null;
  }

  ensureClient() {
    if (this.anthropic) return;
    if (!config.anthropic?.apiKey) {
      throw new Error('Anthropic API key not configured.');
    }
    this.anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
  }

  async analyzeWidget(widget, metricsData, options = {}) {
    this.ensureClient();
    if (!widget || !metricsData) throw new Error('Widget and metrics data are required');

    const prompt = this.buildAnalysisPrompt(widget, metricsData, options);
    const startTime = Date.now();

    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: this.getSystemPrompt(),
      messages: [{ role: 'user', content: prompt }],
    });

    console.log(`[GenAI Gateway] Widget analysis completed in ${Date.now() - startTime}ms`);

    const responseText = message.content[0].text;
    const analysis = this.parseAnalysisResponse(responseText);
    analysis.tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0);
    return analysis;
  }

  async compareWidgets(widgetsData) {
    this.ensureClient();
    if (!widgetsData || widgetsData.length < 2) throw new Error('At least 2 widgets required');

    let prompt = `Analyze the correlation and relationships between these ${widgetsData.length} widgets:\n\nCROSS-WIDGET INTELLIGENCE ANALYSIS:\n\n`;

    widgetsData.forEach((item, idx) => {
      const { widget, metricsData } = item;
      const metric = widget.dataSource?.metric || 'unknown';
      prompt += `WIDGET ${idx + 1}: ${widget.title}\n- Metric: ${metric}\n- Current Value: ${this.formatMetricValue(metric, metricsData.value, metricsData.currency)}\n- Change: ${metricsData.changePercent ? metricsData.changePercent.toFixed(1) + '%' : 'N/A'}\n\n`;
    });

    prompt += `\nProvide specific insights about how these metrics interact. Include exact dollar amounts for recommended budget shifts.\n\nReturn your analysis as valid JSON following the specified structure.`;

    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: this.getSystemPrompt(),
      messages: [{ role: 'user', content: prompt }],
    });

    const analysis = this.parseAnalysisResponse(message.content[0].text);
    analysis.tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0);
    analysis.widgetsAnalyzed = widgetsData.length;
    return analysis;
  }

  async analyzeTrend(widget, metricsData) {
    this.ensureClient();
    const metric = widget.dataSource?.metric || 'unknown';
    const { timeSeries } = metricsData;

    if (!timeSeries || timeSeries.length < 14) {
      throw new Error('Insufficient data for trend analysis (minimum 14 days required)');
    }

    const prompt = `Perform deep historical trend analysis for widget: ${widget.title}, Metric: ${metric}.\n\nTime series: ${JSON.stringify(timeSeries.slice(-30))}\n\nReturn your analysis as valid JSON following the specified structure.`;

    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      system: this.getSystemPrompt(),
      messages: [{ role: 'user', content: prompt }],
    });

    const analysis = this.parseAnalysisResponse(message.content[0].text);
    analysis.tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0);
    return analysis;
  }

  getSystemPrompt() {
    return `You are a senior advertising performance analyst. Provide BRUTALLY HONEST, data-driven, business-focused analysis.

Return ONLY valid JSON with this structure:
{
  "status": "excellent" | "good" | "concerning" | "critical",
  "statusDescription": "One-sentence summary with specific metrics",
  "trendAssessment": "Deep pattern analysis (3-5 sentences)",
  "criticalInsights": ["Top 3-7 insights with SPECIFIC numbers"],
  "riskAlerts": ["Urgent issues with EXACT $ impact"],
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "title": "Specific action with numbers",
      "description": "WHY + WHAT to do",
      "expectedImpact": "Quantified result with timeline",
      "implementation": "Step-by-step execution plan",
      "urgency": "Timeframe with justification"
    }
  ]
}`;
  }

  buildAnalysisPrompt(widget, metricsData, options = {}) {
    const { widgetType, title, dataSource } = widget;
    const { value, previousValue, changePercent, timeSeries, currency, type, data, columns } = metricsData;
    const metric = dataSource?.metric || 'unknown';
    const dateRange = dataSource?.dateRange || 'unknown';

    let prompt = `Analyze this advertising widget:\n\nWIDGET: Type=${widgetType}, Title=${title}, Metric=${metric}, DateRange=${dateRange}`;

    if (type === 'table' && data && Array.isArray(data) && data.length > 0) {
      prompt += `\n\nBREAKDOWN DATA:\n${JSON.stringify(data, null, 2)}`;
    } else if (timeSeries && Array.isArray(timeSeries) && timeSeries.length > 0) {
      prompt += `\n\nCurrent: ${value}, Previous: ${previousValue}, Change: ${changePercent}%`;
      prompt += `\n\nTIME SERIES (${timeSeries.length} points):\n${JSON.stringify(timeSeries.slice(-14), null, 2)}`;
    } else {
      prompt += `\n\nCurrent: ${value}, Previous: ${previousValue}, Change: ${changePercent}%`;
    }

    prompt += `\n\nReturn your analysis as valid JSON.`;
    return prompt;
  }

  parseAnalysisResponse(responseText) {
    try {
      let jsonStr = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1];

      const analysis = JSON.parse(jsonStr.trim());
      if (!analysis.status || !analysis.statusDescription) throw new Error('Invalid structure');

      analysis.criticalInsights = analysis.criticalInsights || [];
      analysis.riskAlerts = analysis.riskAlerts || [];
      analysis.recommendations = (analysis.recommendations || []).map(rec => ({
        priority: rec.priority || 'medium',
        title: rec.title || 'Recommendation',
        description: rec.description || '',
        expectedImpact: rec.expectedImpact || 'Impact not specified',
        implementation: rec.implementation || null,
        urgency: rec.urgency || null,
      }));
      return analysis;
    } catch (error) {
      return {
        status: 'good',
        statusDescription: 'Analysis completed.',
        trendAssessment: responseText.substring(0, 200),
        criticalInsights: ['Unable to parse detailed analysis.'],
        riskAlerts: [],
        recommendations: [{
          priority: 'medium',
          title: 'Review Performance Manually',
          description: 'AI analysis could not be fully parsed.',
          expectedImpact: 'Ensure performance is on track',
        }],
      };
    }
  }

  formatMetricValue(metric, value, currency = 'USD') {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    if (['spend', 'revenue', 'cpc', 'cpm', 'cost_per_conversion'].includes(metric)) {
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (['ctr', 'frequency'].includes(metric)) return `${value.toFixed(2)}%`;
    if (metric === 'roas') return `${value.toFixed(2)}x`;
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
}

module.exports = new AIWidgetAnalysisService();
