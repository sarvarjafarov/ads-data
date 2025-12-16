const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config/config');

/**
 * AI Widget Analysis Service
 *
 * Provides critical performance analysis and actionable recommendations for dashboard widgets
 * using Claude API. Focuses on business impact, ROI, and cost efficiency.
 */
class AIWidgetAnalysisService {
  constructor() {
    this.anthropic = null;
    this.initializeClient();
  }

  /**
   * Initialize Anthropic client
   */
  initializeClient() {
    if (!config.anthropic?.apiKey) {
      throw new Error('Anthropic API key not configured. Please set ANTHROPIC_API_KEY in environment variables.');
    }

    this.anthropic = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
  }

  /**
   * Main widget analysis function
   *
   * @param {Object} widget - Widget configuration
   * @param {Object} metricsData - Current metrics data
   * @param {Object} options - Additional options
   * @returns {Object} AI analysis with insights and recommendations
   */
  async analyzeWidget(widget, metricsData, options = {}) {
    try {
      // Validate inputs
      if (!widget || !metricsData) {
        throw new Error('Widget and metrics data are required');
      }

      // Build analysis prompt
      const prompt = this.buildAnalysisPrompt(widget, metricsData, options);

      // Call Claude API
      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        system: this.getSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      // Parse response
      const responseText = message.content[0].text;
      const analysis = this.parseAnalysisResponse(responseText);

      // Add token usage
      analysis.tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0);

      return analysis;

    } catch (error) {
      console.error('AI widget analysis error:', error);
      throw new Error(`Failed to analyze widget: ${error.message}`);
    }
  }

  /**
   * Get system prompt for critical analysis
   *
   * @returns {string} System prompt
   */
  getSystemPrompt() {
    return `You are a critical advertising performance analyst with expertise in digital marketing metrics and ROI optimization.

Your role is to provide brutally honest, business-focused analysis of advertising performance data. You are direct, specific, and prioritize actionable insights over general observations.

ANALYSIS APPROACH:
1. Be direct about performance issues - don't sugarcoat problems
2. Focus on business impact (ROI, cost efficiency, wasted spend, revenue)
3. Prioritize urgent issues that require immediate action
4. Provide specific, quantified recommendations with expected impact
5. Compare against industry benchmarks and best practices
6. Identify relationships between metrics (e.g., spend increasing while conversions declining)

CRITICAL FACTORS TO CONSIDER:
- Budget efficiency and wasted spend
- Trend direction, velocity, and acceleration
- Conversion funnel performance
- Cost per acquisition vs customer lifetime value
- ROAS and overall profitability
- Campaign pacing and budget exhaustion
- Competitive performance standards
- Seasonality and market conditions

OUTPUT REQUIREMENTS:
Return ONLY valid JSON with this exact structure:
{
  "status": "excellent" | "good" | "concerning" | "critical",
  "statusDescription": "One-sentence summary of overall performance",
  "trendAssessment": "Detailed analysis of trends and patterns (2-3 sentences)",
  "criticalInsights": [
    "Top 3-5 most important observations with specific numbers",
    "Focus on actionable insights, not generic statements"
  ],
  "riskAlerts": [
    "Urgent issues requiring immediate attention (if any)",
    "Only include if there are genuine risks"
  ],
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "title": "Clear, action-oriented title",
      "description": "Specific steps to take with context",
      "expectedImpact": "Quantified expected result (e.g., 'Save $X/week', 'Improve ROAS by Y%')"
    }
  ]
}

QUALITY STANDARDS:
- Be specific with numbers and percentages
- Avoid vague statements like "performance could be better"
- Prioritize high-impact recommendations first
- Include expected outcomes for recommendations
- Only flag risks if they're genuinely concerning
- Keep insights focused on what matters most to the business`;
  }

  /**
   * Build analysis prompt from widget data
   *
   * @param {Object} widget - Widget configuration
   * @param {Object} metricsData - Metrics data
   * @param {Object} options - Additional options
   * @returns {string} Analysis prompt
   */
  buildAnalysisPrompt(widget, metricsData, options = {}) {
    const { widgetType, title, dataSource } = widget;
    const { value, previousValue, changePercent, timeSeries, currency } = metricsData;

    const metric = dataSource?.metric || 'unknown';
    const dateRange = dataSource?.dateRange || 'unknown';

    let prompt = `Analyze the performance of this advertising widget:

WIDGET INFORMATION:
- Widget Type: ${widgetType}
- Title: ${title}
- Metric: ${metric}
- Date Range: ${dateRange}

CURRENT PERFORMANCE:
- Current Value: ${this.formatMetricValue(metric, value, currency)}
- Previous Period: ${this.formatMetricValue(metric, previousValue, currency)}
- Change: ${changePercent !== undefined ? `${changePercent > 0 ? '+' : ''}${changePercent}%` : 'N/A'}`;

    // Add time series data if available
    if (timeSeries && Array.isArray(timeSeries) && timeSeries.length > 0) {
      const trendDirection = this.analyzeTrendDirection(timeSeries);
      prompt += `\n\nTIME SERIES TREND:
- Data Points: ${timeSeries.length} days
- Trend Direction: ${trendDirection.direction}
- Average Daily Value: ${this.formatMetricValue(metric, trendDirection.average, currency)}
- Volatility: ${trendDirection.volatility}`;

      // Add recent performance
      if (timeSeries.length >= 7) {
        const last7Days = timeSeries.slice(-7);
        const avg7Days = last7Days.reduce((sum, d) => sum + (d.value || 0), 0) / 7;
        prompt += `\n- Last 7 Days Average: ${this.formatMetricValue(metric, avg7Days, currency)}`;
      }
    }

    // Add target/goal if applicable
    if (dataSource?.target) {
      const targetProgress = (value / dataSource.target) * 100;
      prompt += `\n\nTARGET/GOAL:
- Target: ${this.formatMetricValue(metric, dataSource.target, currency)}
- Progress: ${targetProgress.toFixed(1)}%
- Gap: ${this.formatMetricValue(metric, dataSource.target - value, currency)}`;
    }

    // Add metric-specific context
    prompt += this.getMetricContext(metric);

    // Add analysis instructions
    prompt += `\n\nPROVIDE CRITICAL ANALYSIS:
1. What is the overall performance status?
2. What are the most critical insights from this data?
3. Are there any urgent risks or issues?
4. What specific actions should be taken to optimize performance?
5. What is the expected business impact of those actions?

Focus on actionable insights and business impact. Be direct and specific with recommendations.

Return your analysis as valid JSON following the specified structure.`;

    return prompt;
  }

  /**
   * Get metric-specific context and benchmarks
   *
   * @param {string} metric - Metric name
   * @returns {string} Context text
   */
  getMetricContext(metric) {
    const metricContexts = {
      spend: `\n\nMETRIC CONTEXT (Advertising Spend):
- Benchmark: Spend should be aligned with conversion targets and ROAS goals
- Key Concern: Spend increasing without proportional conversion growth = wasted budget
- Optimization: Focus on cost per conversion and ROAS`,

      cpc: `\n\nMETRIC CONTEXT (Cost Per Click):
- Industry Benchmark: $1-3 for search ads, $0.50-2 for social ads (varies by industry)
- Key Concern: High CPC with low conversion rate = inefficient spend
- Optimization: Improve quality score, refine targeting, test different ad copy`,

      ctr: `\n\nMETRIC CONTEXT (Click-Through Rate):
- Industry Benchmark: 2-5% for search ads, 0.5-1.5% for display ads
- Key Concern: Low CTR indicates poor ad relevance or targeting
- Optimization: A/B test ad creative, improve targeting, use emotional triggers`,

      conversions: `\n\nMETRIC CONTEXT (Conversions):
- Benchmark: Should trend with spend and align with business goals
- Key Concern: Declining conversions while spend increases = major red flag
- Optimization: Review landing pages, optimize conversion funnel, improve targeting`,

      roas: `\n\nMETRIC CONTEXT (Return on Ad Spend):
- Industry Benchmark: Minimum 3:1 for profitability, 5:1+ for strong performance
- Key Concern: ROAS below 2:1 means losing money on most campaigns
- Optimization: Focus on high-ROAS campaigns, cut underperformers immediately`,

      impressions: `\n\nMETRIC CONTEXT (Impressions):
- Benchmark: Should be sufficient to drive meaningful clicks and conversions
- Key Concern: Low impressions = limited reach, high impressions with low clicks = poor targeting
- Optimization: Adjust bidding strategy, expand or refine audience targeting`,

      cpm: `\n\nMETRIC CONTEXT (Cost Per Thousand Impressions):
- Industry Benchmark: $5-15 for display ads, $10-30 for social ads
- Key Concern: High CPM with low engagement = wasted budget
- Optimization: Improve ad relevance, refine audience targeting, test different creatives`
    };

    return metricContexts[metric] || `\n\nMETRIC CONTEXT:
- Analyze this metric in the context of overall campaign performance
- Consider industry benchmarks and best practices
- Focus on business impact and ROI`;
  }

  /**
   * Analyze trend direction from time series
   *
   * @param {Array} timeSeries - Time series data
   * @returns {Object} Trend analysis
   */
  analyzeTrendDirection(timeSeries) {
    if (!timeSeries || timeSeries.length === 0) {
      return { direction: 'Unknown', average: 0, volatility: 'Unknown' };
    }

    const values = timeSeries.map(d => d.value || 0);
    const average = values.reduce((sum, v) => sum + v, 0) / values.length;

    // Calculate trend (simple linear regression)
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

    const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;

    let direction;
    if (percentChange > 10) direction = 'Strong Upward Trend';
    else if (percentChange > 3) direction = 'Moderate Upward Trend';
    else if (percentChange > -3) direction = 'Stable';
    else if (percentChange > -10) direction = 'Moderate Downward Trend';
    else direction = 'Strong Downward Trend';

    // Calculate volatility (coefficient of variation)
    const stdDev = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - average, 2), 0) / values.length
    );
    const cv = (stdDev / average) * 100;

    let volatility;
    if (cv < 10) volatility = 'Low (Stable)';
    else if (cv < 25) volatility = 'Moderate';
    else volatility = 'High (Volatile)';

    return { direction, average, volatility };
  }

  /**
   * Format metric value for display
   *
   * @param {string} metric - Metric name
   * @param {number} value - Value to format
   * @param {string} currency - Currency code
   * @returns {string} Formatted value
   */
  formatMetricValue(metric, value, currency = 'USD') {
    if (value === null || value === undefined || isNaN(value)) {
      return 'N/A';
    }

    // Currency metrics
    if (['spend', 'revenue', 'cpc', 'cpm', 'cost_per_conversion'].includes(metric)) {
      const currencySymbols = { USD: '$', EUR: '€', GBP: '£' };
      const symbol = currencySymbols[currency] || '$';
      return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Percentage metrics
    if (['ctr', 'frequency'].includes(metric)) {
      return `${value.toFixed(2)}%`;
    }

    // Integer metrics
    if (['impressions', 'clicks', 'conversions', 'reach'].includes(metric)) {
      return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }

    // ROAS
    if (metric === 'roas') {
      return `${value.toFixed(2)}x`;
    }

    // Default
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  /**
   * Parse AI analysis response
   *
   * @param {string} responseText - Raw response text
   * @returns {Object} Parsed analysis
   */
  parseAnalysisResponse(responseText) {
    try {
      // Try to extract JSON from markdown code blocks
      let jsonStr = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const analysis = JSON.parse(jsonStr.trim());

      // Validate structure
      if (!analysis.status || !analysis.statusDescription) {
        throw new Error('Invalid analysis structure');
      }

      // Ensure arrays exist
      analysis.criticalInsights = analysis.criticalInsights || [];
      analysis.riskAlerts = analysis.riskAlerts || [];
      analysis.recommendations = analysis.recommendations || [];

      // Validate recommendations structure
      analysis.recommendations = analysis.recommendations.map(rec => ({
        priority: rec.priority || 'medium',
        title: rec.title || 'Recommendation',
        description: rec.description || '',
        expectedImpact: rec.expectedImpact || 'Impact not specified'
      }));

      return analysis;

    } catch (error) {
      console.error('Failed to parse AI response:', error);

      // Return fallback analysis
      return {
        status: 'good',
        statusDescription: 'Analysis completed. Review the data for insights.',
        trendAssessment: responseText.substring(0, 200) + '...',
        criticalInsights: ['Unable to parse detailed analysis. Please try again.'],
        riskAlerts: [],
        recommendations: [{
          priority: 'medium',
          title: 'Review Performance Manually',
          description: 'AI analysis could not be completed. Please review the metrics manually.',
          expectedImpact: 'Ensure performance is on track'
        }]
      };
    }
  }

  /**
   * Compare multiple widgets
   *
   * @param {Array} widgets - Array of widgets with metrics
   * @returns {Object} Comparative analysis
   */
  async compareWidgets(widgets) {
    // TODO: Implement multi-widget comparative analysis
    // This would analyze performance across multiple widgets and identify patterns
    throw new Error('Multi-widget comparison not yet implemented');
  }

  /**
   * Deep trend analysis with historical data
   *
   * @param {Object} widget - Widget configuration
   * @param {Array} historicalData - Historical metrics data
   * @returns {Object} Trend analysis
   */
  async analyzeTrend(widget, historicalData) {
    // TODO: Implement deep historical trend analysis
    // This would analyze long-term patterns and seasonality
    throw new Error('Deep trend analysis not yet implemented');
  }
}

// Export singleton instance
module.exports = new AIWidgetAnalysisService();
