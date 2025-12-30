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
        max_tokens: 8192, // Increased for detailed breakdown analysis
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
    return `You are an expert advertising performance analyst with deep expertise in digital marketing metrics, ROI optimization, and business strategy.

Your role is to provide brutally honest, data-driven, business-focused analysis. You identify critical patterns, waste, opportunities, and provide specific, actionable recommendations with quantified impact.

CORE ANALYSIS PRINCIPLES:
1. **Widget-Type Intelligence**: Understand context based on widget type
   - KPI Cards: Focus on absolute performance, trend velocity, target achievement
   - Time Series Charts: Identify patterns, anomalies, cycles, inflection points
   - Breakdown Tables (Device/Country/Campaign): Analyze distribution, concentration risk, reallocation opportunities
   - Comparison Widgets: Period-over-period causality analysis

2. **Multi-Dimensional Context**:
   - For DEVICE breakdowns: Identify dominant device, performance gaps, concentration risk, mobile vs desktop strategy
   - For GEOGRAPHIC breakdowns: Find top markets by ROI, underperforming regions, untapped opportunities, market expansion potential
   - For CAMPAIGN/AD SET breakdowns: Rank by efficiency, detect budget misallocation, calculate reallocation impact
   - For CREATIVE breakdowns: Compare performance by type (video/image/carousel), engagement patterns

3. **Business Rules (CRITICAL ALERTS)**:
   - ROAS < 2.0 = losing money (CRITICAL)
   - Spend increasing + Conversions declining = waste (HIGH RISK)
   - 80%+ concentration in one segment = diversification risk
   - Declining trend for 7+ consecutive days = urgent attention
   - CPA > $100 or 3x industry avg = efficiency problem
   - CTR < 1% for search or < 0.5% for display = relevance issue

4. **Hyper-Specific Recommendations**:
   - Provide EXACT numbers: "Reallocate $1,200/day from Campaign A to Campaign C"
   - Calculate impact: "Will generate additional $4,800/day revenue (+156% ROI)"
   - Include implementation: "In Ads Manager: Reduce Campaign A to $300/day, increase Campaign C to $1,500/day"
   - Estimate timeline: "Impact visible within 24-48 hours"

OUTPUT REQUIREMENTS:
Return ONLY valid JSON with this exact structure:
{
  "status": "excellent" | "good" | "concerning" | "critical",
  "statusDescription": "One-sentence summary with specific metric and context",
  "trendAssessment": "Pattern analysis with velocity and direction (2-3 sentences)",
  "criticalInsights": [
    "Top 3-5 insights with SPECIFIC numbers and percentages",
    "Include comparison context (vs previous, vs benchmark, vs target)",
    "For breakdowns: identify winners, losers, and reallocation opportunities"
  ],
  "riskAlerts": [
    "Urgent issues with $ impact quantification",
    "Only include if genuinely critical (losing money, major waste, declining performance)"
  ],
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "title": "Specific action with exact numbers (e.g., 'Reallocate $800 from X to Y')",
      "description": "Step-by-step implementation with rationale and supporting data",
      "expectedImpact": "Quantified $ or % result with timeline (e.g., '+$2,400/day revenue within 48h')",
      "implementation": "Exact steps to execute (optional but preferred for high priority)",
      "urgency": "Hours/Days/Week timeframe for action (optional)"
    }
  ]
}

QUALITY STANDARDS:
- Use EXACT numbers, not ranges or approximations
- For breakdown data: always provide reallocation recommendations with $ impact
- Identify concentration risks (>70% in one segment)
- Calculate opportunity cost (underinvesting in high performers)
- Include industry benchmarks when relevant
- Prioritize recommendations by $ impact, not % improvement
- Be direct about waste and inefficiency`;
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
    const { value, previousValue, changePercent, timeSeries, currency, type, data, columns } = metricsData;

    const metric = dataSource?.metric || 'unknown';
    const dateRange = dataSource?.dateRange || 'unknown';
    const widgetTitle = (title || '').toLowerCase();

    let prompt = `Analyze the performance of this advertising widget:

WIDGET INFORMATION:
- Widget Type: ${widgetType}
- Title: ${title}
- Metric: ${metric}
- Date Range: ${dateRange}
- Context: ${this.getWidgetContextDescription(widgetType, widgetTitle)}`;

    // BREAKDOWN TABLE ANALYSIS (Device, Country, Campaign, Ad Sets, Creatives)
    if (type === 'table' && data && Array.isArray(data) && data.length > 0) {
      prompt += this.buildBreakdownAnalysis(widgetTitle, data, columns, metric);
    }
    // TIME SERIES ANALYSIS (KPI Cards, Line Charts, Bar Charts)
    else if (timeSeries && Array.isArray(timeSeries) && timeSeries.length > 0) {
      prompt += this.buildTimeSeriesAnalysis(timeSeries, value, previousValue, changePercent, metric, currency);
    }
    // SINGLE VALUE ANALYSIS (KPI Cards without time series)
    else {
      prompt += `\n\nCURRENT PERFORMANCE:
- Current Value: ${this.formatMetricValue(metric, value, currency)}
- Previous Period: ${this.formatMetricValue(metric, previousValue, currency)}
- Change: ${changePercent !== undefined ? `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%` : 'N/A'}`;
    }

    // Add target/goal if applicable
    if (dataSource?.target) {
      const targetProgress = (value / dataSource.target) * 100;
      const gap = dataSource.target - value;
      prompt += `\n\nTARGET/GOAL TRACKING:
- Target: ${this.formatMetricValue(metric, dataSource.target, currency)}
- Current Progress: ${targetProgress.toFixed(1)}%
- Gap to Target: ${this.formatMetricValue(metric, gap, currency)}
- Status: ${targetProgress >= 100 ? '✓ Target Achieved' : targetProgress >= 80 ? '⚠ Close to Target' : '✗ Behind Target'}`;
    }

    // Add metric-specific context
    prompt += this.getMetricContext(metric);

    // Add analysis instructions
    prompt += `\n\nPROVIDE CRITICAL ANALYSIS:
${this.getWidgetSpecificInstructions(widgetType, widgetTitle, type)}

Return your analysis as valid JSON following the specified structure.`;

    return prompt;
  }

  /**
   * Get widget context description
   */
  getWidgetContextDescription(widgetType, widgetTitle) {
    if (widgetTitle.includes('device')) return 'Device Performance Breakdown - Analyze platform-specific effectiveness';
    if (widgetTitle.includes('country') || widgetTitle.includes('geographic')) return 'Geographic Market Analysis - Identify market opportunities';
    if (widgetTitle.includes('campaign')) return 'Campaign Performance Comparison - Find budget reallocation opportunities';
    if (widgetTitle.includes('ad set') || widgetTitle.includes('adset')) return 'Ad Set Efficiency Analysis - Optimize targeting and budgets';
    if (widgetTitle.includes('creative')) return 'Creative Performance Comparison - Identify winning creative formats';
    if (widgetType === 'line_chart' || widgetType === 'bar_chart') return 'Time Series Trend Analysis - Detect patterns and anomalies';
    if (widgetType === 'kpi_card') return 'Key Performance Indicator - Track against targets and trends';
    return 'Performance Analysis';
  }

  /**
   * Build breakdown table analysis
   */
  buildBreakdownAnalysis(widgetTitle, data, columns, metric) {
    let analysis = '\n\nBREAKDOWN DATA ANALYSIS:';

    // Calculate total and percentages
    const total = data.reduce((sum, row) => {
      const value = Object.values(row).find(v => typeof v === 'number' && !isNaN(v));
      return sum + (value || 0);
    }, 0);

    // Identify breakdown type
    let breakdownType = 'General';
    if (widgetTitle.includes('device')) breakdownType = 'Device';
    else if (widgetTitle.includes('country') || widgetTitle.includes('geographic')) breakdownType = 'Geographic';
    else if (widgetTitle.includes('campaign')) breakdownType = 'Campaign';
    else if (widgetTitle.includes('ad set') || widgetTitle.includes('adset')) breakdownType = 'Ad Set';
    else if (widgetTitle.includes('creative')) breakdownType = 'Creative';

    analysis += `\n- Breakdown Type: ${breakdownType}
- Total ${metric}: ${total.toLocaleString()}
- Number of Segments: ${data.length}

DETAILED BREAKDOWN:`;

    // Format each row with percentage
    data.forEach((row, index) => {
      const name = Object.values(row)[0];
      const value = Object.values(row).find(v => typeof v === 'number' && !isNaN(v)) || 0;
      const percentage = total > 0 ? (value / total * 100).toFixed(1) : 0;

      // Get additional metrics if available (for ad sets/campaigns)
      const additionalMetrics = [];
      if (row.roas) additionalMetrics.push(`ROAS: ${row.roas}`);
      if (row.ctr || row.click_rate_ctr) additionalMetrics.push(`CTR: ${row.ctr || row.click_rate_ctr}`);
      if (row.cost_per_click || row.cpc) additionalMetrics.push(`CPC: ${row.cost_per_click || row.cpc}`);
      if (row.conversions) additionalMetrics.push(`Conv: ${row.conversions}`);
      if (row.status) additionalMetrics.push(`Status: ${row.status}`);

      const metricsStr = additionalMetrics.length > 0 ? ` | ${additionalMetrics.join(', ')}` : '';
      analysis += `\n${index + 1}. ${name}: ${value.toLocaleString()} (${percentage}%)${metricsStr}`;
    });

    // Add concentration analysis
    if (data.length > 0) {
      const topSegment = data[0];
      const topValue = Object.values(topSegment).find(v => typeof v === 'number' && !isNaN(v)) || 0;
      const topPercentage = total > 0 ? (topValue / total * 100) : 0;

      analysis += `\n\nCONCENTRATION ANALYSIS:
- Top Segment: ${Object.values(topSegment)[0]} (${topPercentage.toFixed(1)}%)
- Concentration Risk: ${topPercentage > 80 ? 'HIGH - Diversification needed' : topPercentage > 60 ? 'MEDIUM - Monitor closely' : 'LOW - Well diversified'}`;
    }

    return analysis;
  }

  /**
   * Build time series analysis
   */
  buildTimeSeriesAnalysis(timeSeries, value, previousValue, changePercent, metric, currency) {
    const trendDirection = this.analyzeTrendDirection(timeSeries);

    let analysis = `\n\nCURRENT PERFORMANCE:
- Current Value: ${this.formatMetricValue(metric, value, currency)}
- Previous Period: ${this.formatMetricValue(metric, previousValue, currency)}
- Change: ${changePercent !== undefined ? `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%` : 'N/A'}

TIME SERIES PATTERN ANALYSIS:
- Data Points: ${timeSeries.length} days
- Trend Direction: ${trendDirection.direction}
- Average Daily Value: ${this.formatMetricValue(metric, trendDirection.average, currency)}
- Volatility: ${trendDirection.volatility}`;

    // Add recent performance comparison
    if (timeSeries.length >= 7) {
      const last7Days = timeSeries.slice(-7);
      const prev7Days = timeSeries.slice(-14, -7);
      const avg7Days = last7Days.reduce((sum, d) => sum + (d.value || 0), 0) / 7;
      const avgPrev7Days = prev7Days.length > 0
        ? prev7Days.reduce((sum, d) => sum + (d.value || 0), 0) / prev7Days.length
        : 0;
      const weekChange = avgPrev7Days > 0 ? ((avg7Days - avgPrev7Days) / avgPrev7Days * 100) : 0;

      analysis += `\n- Last 7 Days Average: ${this.formatMetricValue(metric, avg7Days, currency)}
- Week-over-Week Change: ${weekChange > 0 ? '+' : ''}${weekChange.toFixed(1)}%`;
    }

    // Detect anomalies
    const values = timeSeries.map(d => d.value || 0);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
    const anomalies = timeSeries.filter(d => Math.abs((d.value || 0) - mean) > 2 * stdDev);

    if (anomalies.length > 0) {
      analysis += `\n\nANOMALIES DETECTED:
- ${anomalies.length} unusual data points identified
- Investigate: ${anomalies.map(a => `${a.date} (${this.formatMetricValue(metric, a.value, currency)})`).slice(0, 3).join(', ')}`;
    }

    return analysis;
  }

  /**
   * Get widget-specific analysis instructions
   */
  getWidgetSpecificInstructions(widgetType, widgetTitle, dataType) {
    if (dataType === 'table') {
      if (widgetTitle.includes('device')) {
        return `1. Identify the dominant device platform and its performance metrics
2. Calculate performance gaps between platforms (e.g., Mobile CPC vs Desktop CPC)
3. Assess concentration risk - is >70% coming from one device?
4. Recommend budget reallocation with EXACT dollar amounts and expected impact
5. Identify underperforming platforms that should have budgets reduced`;
      } else if (widgetTitle.includes('country') || widgetTitle.includes('geographic')) {
        return `1. Rank markets by efficiency (ROAS or conversion rate if available)
2. Identify top 3 markets by spend and their ROI
3. Find underperforming regions consuming budget with low returns
4. Discover high-potential markets (low spend but high efficiency)
5. Recommend EXACT budget shifts between markets with $ impact
6. Calculate opportunity cost of current allocation`;
      } else if (widgetTitle.includes('campaign') || widgetTitle.includes('ad set')) {
        return `1. Rank all campaigns/ad sets by efficiency (ROAS, CPA, or CTR)
2. Identify budget misallocation (high spend on low performers)
3. Calculate reallocation opportunity with EXACT dollar amounts
4. Recommend which campaigns to pause, reduce, or increase
5. Quantify daily revenue impact of recommended changes
6. Provide implementation steps for Ads Manager`;
      }
    }

    return `1. Assess overall performance status (excellent/good/concerning/critical)
2. Identify the most critical insights with specific numbers
3. Flag any urgent risks or issues requiring immediate action
4. Provide specific, actionable recommendations with quantified impact
5. Calculate expected business outcomes (revenue, cost savings, efficiency gains)`;
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

      // Validate recommendations structure with new optional fields
      analysis.recommendations = analysis.recommendations.map(rec => ({
        priority: rec.priority || 'medium',
        title: rec.title || 'Recommendation',
        description: rec.description || '',
        expectedImpact: rec.expectedImpact || 'Impact not specified',
        implementation: rec.implementation || null, // Optional: step-by-step implementation
        urgency: rec.urgency || null // Optional: timeframe for action
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
