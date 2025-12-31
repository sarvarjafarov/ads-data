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

      // Call Claude API with Sonnet for superior analysis quality
      console.log('[AI Analysis] Calling Claude API with Sonnet 4.5 for deep analysis...');
      const startTime = Date.now();

      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929', // Sonnet 4.5 for best analysis quality
        max_tokens: 4096, // Increased for comprehensive, detailed insights
        system: this.getSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const duration = Date.now() - startTime;
      console.log(`[AI Analysis] Claude API responded in ${duration}ms`);

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
    return `You are a senior advertising performance analyst with 15+ years of experience managing $100M+ ad budgets across Meta, Google, TikTok, and LinkedIn. Your expertise includes ROI optimization, predictive analytics, marketing mix modeling, and strategic business consulting.

Your role is to provide BRUTALLY HONEST, data-driven, business-focused analysis that drives real ROI improvements. You identify waste, inefficiencies, hidden opportunities, and provide SPECIFIC, ACTIONABLE recommendations with exact dollar amounts and implementation steps.

CRITICAL: AVOID GENERIC "BUZZ WORD" ANALYSIS
❌ BAD: "Performance is increasing, showing positive growth"
✅ GOOD: "ROAS jumped from 3.2x to 4.8x (+50%) because Desktop ROAS is 6.1x while Mobile is only 2.3x. Shifting $2,400/day from Mobile to Desktop campaigns would generate +$7,200/day additional revenue."

❌ BAD: "Wednesday outperforms other days"
✅ GOOD: "Wednesday generates $847/day vs $412/day average (-51% other days). Root cause: Your audience (B2B decision makers) are most active mid-week post-planning meetings. ACTION: Increase Wednesday budget by $600 and reduce Saturday/Sunday by $300 each for +$1,800/week revenue."

❌ BAD: "Consider optimizing your campaigns"
✅ GOOD: "Campaign 'Summer Sale 2024' has 12.3% CTR but $147 CPA vs target $80. Creative analysis shows video ads drive 3.2x conversions at $76 CPA. ACTION: Pause all image ads in this campaign (saving $940/day), shift budget to video creative. Expected: $2,820/week savings + 28% more conversions."

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

4. **Hyper-Specific Recommendations with ROOT CAUSE ANALYSIS**:
   - ALWAYS explain WHY: "Wednesday outperforms because..." with hypothesis based on audience behavior, industry patterns, or historical data
   - Provide EXACT numbers: "Reallocate $1,200/day from Campaign A to Campaign C"
   - Calculate impact: "Will generate additional $4,800/day revenue (+156% ROI)"
   - Include implementation: "In Ads Manager: Reduce Campaign A to $300/day, increase Campaign C to $1,500/day"
   - Estimate timeline: "Impact visible within 24-48 hours"
   - Compare to benchmarks: "Your 2.3% CTR is below industry avg 3.5% because..."
   - Strategic context: "This aligns with Q4 seasonality where B2B engagement peaks mid-week"

5. **PHASE 2 ADVANCED INTELLIGENCE** (NEW):
   - **Historical Context**: Compare current performance against multiple historical periods
     * Week-over-week, month-over-month, quarter-over-quarter, year-over-year
     * Identify if current trend is normal seasonal variation or genuine change
   - **Seasonal Pattern Recognition**:
     * Detect day-of-week patterns (e.g., weekends vs weekdays)
     * Identify monthly/quarterly cycles
     * Recognize holiday/event-driven spikes or drops
   - **Cross-Metric Correlation**:
     * When Spend increases by X%, how do Conversions typically respond?
     * Identify leading vs lagging indicators
   - **Predictive Forecasting**:
     * Based on historical trends, predict next 7-30 days
     * Calculate confidence intervals
     * Warn about expected seasonal drops or surges

FORBIDDEN PHRASES (NEVER use these generic statements):
❌ "Performance is improving/declining"
❌ "Consider optimizing"
❌ "Shows potential for growth"
❌ "Indicates opportunity"
❌ "Suggests further investigation needed"
❌ "Monitor closely"
❌ Any insight that just restates visible chart data without adding WHY or HOW

OUTPUT REQUIREMENTS:
Return ONLY valid JSON with this exact structure:
{
  "status": "excellent" | "good" | "concerning" | "critical",
  "statusDescription": "One-sentence summary with specific metric, exact numbers, and root cause (e.g., 'ROAS dropped 23% to 2.8x due to 47% CPA spike on Mobile platform')",
  "trendAssessment": "Deep pattern analysis explaining WHY trends exist, what drives them, and strategic implications (3-5 sentences with specific data points)",
  "criticalInsights": [
    "Top 3-7 insights that reveal NON-OBVIOUS patterns with SPECIFIC numbers",
    "MUST include root cause analysis (WHY this is happening)",
    "MUST compare to benchmarks, previous periods, or industry standards",
    "For breakdowns: identify top performers vs underperformers with EXACT reallocation amounts",
    "Each insight must be actionable or strategic, not just descriptive"
  ],
  "riskAlerts": [
    "Urgent issues with EXACT $ impact and root cause",
    "Only include if genuinely critical: losing money (ROAS<2), major waste (>$500/day), or declining trends (>7 days)",
    "Must include specific threshold breach (e.g., 'CPA $147 vs target $80, burning $940/day')"
  ],
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "title": "Specific action with exact numbers (e.g., 'Shift $1,200/day from Mobile to Desktop')",
      "description": "WHY this matters (root cause) + WHAT to do (specific steps) + supporting data. Must be 2-4 sentences explaining rationale with specific metrics. NO generic phrases like 'consider' or 'optimize' - be direct and prescriptive.",
      "expectedImpact": "Quantified $ or % result with timeline. MUST include exact number (e.g., '+$2,400/day revenue within 48h' or 'Save $940/day waste, +28% conversions within 3-5 days')",
      "implementation": "Step-by-step execution plan. For high priority: include exact platform steps (e.g., 'In Meta Ads Manager > Campaigns > Select Campaign X > Edit Budget > Change from $500 to $200'). Optional for medium/low priority.",
      "urgency": "Timeframe for action with business justification (e.g., 'Within 24h - losing $940/day currently' or '3-5 days - before weekend traffic spike')"
    }
  ]
}

QUALITY STANDARDS - EVERY INSIGHT MUST PASS THIS TEST:
✅ Does it explain WHY (root cause), not just WHAT (observation)?
✅ Does it include EXACT numbers and dollar impacts?
✅ For breakdowns: Does it specify which segments to fund more/less with $ amounts?
✅ Does it compare to benchmarks, targets, or historical periods?
✅ Does it reveal NON-OBVIOUS patterns (not just restating visible chart data)?
✅ Would a CMO pay $500/hour for this insight, or could they see it themselves in 10 seconds?

REJECTION CRITERIA (If insight matches any of these, REJECT IT):
❌ Just restates chart data without explaining WHY
❌ Uses vague terms: "consider", "optimize", "monitor", "potential", "suggests"
❌ Lacks specific numbers or dollar impacts
❌ Doesn't explain root cause or business context
❌ Generic advice that applies to any campaign ("improve targeting", "test creatives")
❌ Percentage-only insights without absolute $ impact

REMEMBER: The user pays for Claude Sonnet 4.5 analysis - deliver 10x more value than what they can see themselves in the chart. Find the hidden story in the data.`;
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
   * Build time series analysis (enhanced with Phase 2 features)
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

    // PHASE 2: Add seasonal pattern detection
    if (timeSeries.length >= 14) {
      const seasonalPatterns = this.detectSeasonalPatterns(timeSeries);

      if (seasonalPatterns.hasPatterns) {
        analysis += `\n\n🔄 SEASONAL PATTERNS DETECTED (PHASE 2):`;
        seasonalPatterns.insights.forEach(insight => {
          analysis += `\n- ${insight}`;
        });

        if (seasonalPatterns.weekendVsWeekday) {
          const { weekdayAvg, weekendAvg, differencePercent } = seasonalPatterns.weekendVsWeekday;
          analysis += `\n- Weekday Performance: ${this.formatMetricValue(metric, weekdayAvg, currency)}`;
          analysis += `\n- Weekend Performance: ${this.formatMetricValue(metric, weekendAvg, currency)}`;
          analysis += `\n- Weekend vs Weekday: ${differencePercent > 0 ? '+' : ''}${differencePercent.toFixed(1)}%`;
        }
      }
    }

    // PHASE 2: Add historical comparison
    if (timeSeries.length >= 30) {
      const metricsData = { timeSeries, value, previousValue };
      const historicalComparison = this.calculateHistoricalComparison(metricsData, metric);

      if (historicalComparison) {
        analysis += `\n\n📊 HISTORICAL COMPARISON (PHASE 2):
- 7-Day Average: ${this.formatMetricValue(metric, historicalComparison.last7Days, currency)}
- 14-Day Average: ${this.formatMetricValue(metric, historicalComparison.last14Days, currency)}
- 30-Day Average: ${this.formatMetricValue(metric, historicalComparison.last30Days, currency)}`;

        if (historicalComparison.trends.weekOverWeek) {
          analysis += `\n- Week-over-Week Momentum: ${historicalComparison.trends.weekOverWeek > 0 ? '+' : ''}${historicalComparison.trends.weekOverWeek.toFixed(1)}%`;
        }
        if (historicalComparison.trends.monthOverMonth) {
          analysis += `\n- Month-over-Month Momentum: ${historicalComparison.trends.monthOverMonth > 0 ? '+' : ''}${historicalComparison.trends.monthOverMonth.toFixed(1)}%`;
        }
      }
    }

    // PHASE 2: Add predictive forecast
    if (timeSeries.length >= 14) {
      const forecast = this.generateForecast(timeSeries, 7);

      if (forecast) {
        analysis += `\n\n🔮 PREDICTIVE FORECAST (PHASE 2 - Next 7 Days):
- Predicted Trend: ${forecast.trendDirection} (${forecast.trendStrength} strength)
- Forecast Confidence: ${forecast.confidence}
- Expected Average: ${this.formatMetricValue(metric, forecast.averagePrediction, currency)}`;

        // Add actionable forecast insight
        if (forecast.trendDirection === 'Increasing') {
          analysis += `\n- ⚠️ ACTION: Prepare for ${forecast.trendStrength} increase - consider scaling budgets`;
        } else if (forecast.trendDirection === 'Decreasing') {
          analysis += `\n- ⚠️ ACTION: Expect ${forecast.trendStrength} decline - investigate causes now`;
        }
      }
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
   * Detect seasonal patterns in time series data
   *
   * @param {Array} timeSeries - Time series data with date and value
   * @returns {Object} Seasonal pattern analysis
   */
  detectSeasonalPatterns(timeSeries) {
    if (!timeSeries || timeSeries.length < 14) {
      return { hasPatterns: false, message: 'Insufficient data for seasonal analysis' };
    }

    const patterns = {
      hasPatterns: false,
      dayOfWeek: {},
      weekendVsWeekday: null,
      monthlyTrend: null,
      insights: []
    };

    // Group by day of week
    const dayGroups = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }; // Sunday=0, Monday=1, etc.

    timeSeries.forEach(point => {
      const date = new Date(point.date);
      const dayOfWeek = date.getDay();
      dayGroups[dayOfWeek].push(point.value || 0);
    });

    // Calculate average for each day
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    Object.keys(dayGroups).forEach(day => {
      if (dayGroups[day].length > 0) {
        const avg = dayGroups[day].reduce((sum, v) => sum + v, 0) / dayGroups[day].length;
        patterns.dayOfWeek[dayNames[day]] = avg;
      }
    });

    // Weekend vs Weekday analysis
    const weekdayValues = [...(dayGroups[1] || []), ...(dayGroups[2] || []), ...(dayGroups[3] || []), ...(dayGroups[4] || []), ...(dayGroups[5] || [])];
    const weekendValues = [...(dayGroups[0] || []), ...(dayGroups[6] || [])];

    if (weekdayValues.length > 0 && weekendValues.length > 0) {
      const weekdayAvg = weekdayValues.reduce((sum, v) => sum + v, 0) / weekdayValues.length;
      const weekendAvg = weekendValues.reduce((sum, v) => sum + v, 0) / weekendValues.length;
      const difference = ((weekendAvg - weekdayAvg) / weekdayAvg * 100);

      patterns.weekendVsWeekday = {
        weekdayAvg,
        weekendAvg,
        differencePercent: difference
      };

      if (Math.abs(difference) > 15) {
        patterns.hasPatterns = true;
        patterns.insights.push(
          difference > 0
            ? `Strong weekend performance: ${difference.toFixed(1)}% higher than weekdays`
            : `Weekday dominance: ${Math.abs(difference).toFixed(1)}% higher than weekends`
        );
      }
    }

    // Find best and worst performing days
    const dayAverages = Object.entries(patterns.dayOfWeek);
    if (dayAverages.length > 0) {
      dayAverages.sort((a, b) => b[1] - a[1]);
      const bestDay = dayAverages[0];
      const worstDay = dayAverages[dayAverages.length - 1];
      const dayPerformanceGap = ((bestDay[1] - worstDay[1]) / worstDay[1] * 100);

      if (dayPerformanceGap > 30) {
        patterns.hasPatterns = true;
        patterns.insights.push(
          `${bestDay[0]} is strongest day (${dayPerformanceGap.toFixed(0)}% higher than ${worstDay[0]})`
        );
      }
    }

    return patterns;
  }

  /**
   * Calculate historical comparison across multiple time periods
   *
   * @param {Object} metricsData - Current metrics data with time series
   * @param {string} metric - Metric name
   * @returns {Object} Historical comparison
   */
  calculateHistoricalComparison(metricsData, metric) {
    const { timeSeries, value, previousValue } = metricsData;

    if (!timeSeries || timeSeries.length < 30) {
      return null;
    }

    const comparison = {
      currentPeriod: value,
      previousPeriod: previousValue,
      last7Days: 0,
      last14Days: 0,
      last30Days: 0,
      trends: {}
    };

    // Calculate averages for different periods
    if (timeSeries.length >= 7) {
      const last7 = timeSeries.slice(-7);
      comparison.last7Days = last7.reduce((sum, d) => sum + (d.value || 0), 0) / 7;
    }

    if (timeSeries.length >= 14) {
      const last14 = timeSeries.slice(-14);
      comparison.last14Days = last14.reduce((sum, d) => sum + (d.value || 0), 0) / 14;
    }

    if (timeSeries.length >= 30) {
      const last30 = timeSeries.slice(-30);
      comparison.last30Days = last30.reduce((sum, d) => sum + (d.value || 0), 0) / 30;
    }

    // Calculate week-over-week trends
    if (timeSeries.length >= 14) {
      const thisWeek = timeSeries.slice(-7).reduce((sum, d) => sum + (d.value || 0), 0) / 7;
      const lastWeek = timeSeries.slice(-14, -7).reduce((sum, d) => sum + (d.value || 0), 0) / 7;
      comparison.trends.weekOverWeek = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek * 100) : 0;
    }

    // Calculate month-over-month trend (comparing first half vs second half)
    if (timeSeries.length >= 30) {
      const firstHalf = timeSeries.slice(0, 15).reduce((sum, d) => sum + (d.value || 0), 0) / 15;
      const secondHalf = timeSeries.slice(-15).reduce((sum, d) => sum + (d.value || 0), 0) / 15;
      comparison.trends.monthOverMonth = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf * 100) : 0;
    }

    return comparison;
  }

  /**
   * Generate predictive forecast based on historical trends
   *
   * @param {Array} timeSeries - Time series data
   * @param {number} daysToForecast - Number of days to forecast (default 7)
   * @returns {Object} Forecast with predictions and confidence
   */
  generateForecast(timeSeries, daysToForecast = 7) {
    if (!timeSeries || timeSeries.length < 14) {
      return null;
    }

    const values = timeSeries.map(d => d.value || 0);
    const n = values.length;

    // Simple linear regression for trend
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((sum, v) => sum + v, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (values[i] - yMean);
      denominator += (i - xMean) ** 2;
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = yMean - slope * xMean;

    // Generate forecast
    const forecast = [];
    for (let i = 0; i < daysToForecast; i++) {
      const futureX = n + i;
      const prediction = intercept + slope * futureX;
      forecast.push({
        day: i + 1,
        predictedValue: Math.max(0, prediction) // Ensure non-negative
      });
    }

    // Calculate confidence based on recent volatility
    const recentValues = values.slice(-14);
    const recentMean = recentValues.reduce((sum, v) => sum + v, 0) / recentValues.length;
    const variance = recentValues.reduce((sum, v) => sum + (v - recentMean) ** 2, 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = recentMean > 0 ? (stdDev / recentMean) * 100 : 0;

    let confidence = 'High';
    if (coefficientOfVariation > 50) confidence = 'Low';
    else if (coefficientOfVariation > 25) confidence = 'Medium';

    // Determine trend direction
    const trendDirection = slope > 0 ? 'Increasing' : slope < 0 ? 'Decreasing' : 'Stable';
    const trendStrength = Math.abs(slope / yMean * 100);

    return {
      forecast,
      confidence,
      trendDirection,
      trendStrength: trendStrength.toFixed(1) + '%',
      averagePrediction: forecast.reduce((sum, f) => sum + f.predictedValue, 0) / daysToForecast
    };
  }

  /**
   * Compare multiple widgets and identify correlations (PHASE 2)
   *
   * @param {Array} widgetsData - Array of {widget, metricsData} objects
   * @returns {Object} Comparative analysis with correlations
   */
  async compareWidgets(widgetsData) {
    try {
      if (!widgetsData || widgetsData.length < 2) {
        throw new Error('At least 2 widgets required for comparison');
      }

      // Build comparative analysis prompt
      let prompt = `Analyze the correlation and relationships between these ${widgetsData.length} widgets:

CROSS-WIDGET INTELLIGENCE ANALYSIS:\n\n`;

      widgetsData.forEach((item, idx) => {
        const { widget, metricsData } = item;
        const metric = widget.dataSource?.metric || 'unknown';

        prompt += `WIDGET ${idx + 1}: ${widget.title}
- Metric: ${metric}
- Current Value: ${this.formatMetricValue(metric, metricsData.value, metricsData.currency)}
- Change: ${metricsData.changePercent ? metricsData.changePercent.toFixed(1) + '%' : 'N/A'}
- Trend: ${metricsData.timeSeries ? this.analyzeTrendDirection(metricsData.timeSeries).direction : 'Unknown'}

`;
      });

      prompt += `\nCROSS-METRIC CORRELATION ANALYSIS REQUIRED:
1. Identify cause-and-effect relationships (e.g., Spend↑ → Conversions↑?)
2. Detect inverse correlations (e.g., CPC↓ → CTR↑?)
3. Find efficiency metrics (ROAS = Revenue/Spend)
4. Calculate opportunity cost (underinvestment in high-ROAS areas)
5. Recommend budget reallocation between correlated metrics

Provide specific insights about how these metrics interact and influence each other. Include exact dollar amounts for any recommended budget shifts.

Return your analysis as valid JSON following the specified structure.`;

      // Call Claude API
      console.log('[AI Multi-Widget] Calling Claude Sonnet 4.5 for deep analysis...');
      const startTime = Date.now();

      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929', // Sonnet 4.5 for best analysis quality
        max_tokens: 4096,
        system: this.getSystemPrompt(),
        messages: [{ role: 'user', content: prompt }]
      });

      console.log(`[AI Multi-Widget] Completed in ${Date.now() - startTime}ms`);

      const responseText = message.content[0].text;
      const analysis = this.parseAnalysisResponse(responseText);
      analysis.tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0);
      analysis.widgetsAnalyzed = widgetsData.length;

      return analysis;

    } catch (error) {
      console.error('Multi-widget comparison error:', error);
      throw new Error(`Failed to compare widgets: ${error.message}`);
    }
  }

  /**
   * Deep trend analysis with historical data and seasonality (PHASE 2)
   *
   * @param {Object} widget - Widget configuration
   * @param {Object} metricsData - Current metrics data with time series
   * @returns {Object} Deep trend analysis with forecasting
   */
  async analyzeTrend(widget, metricsData) {
    try {
      const metric = widget.dataSource?.metric || 'unknown';
      const { timeSeries } = metricsData;

      if (!timeSeries || timeSeries.length < 14) {
        throw new Error('Insufficient data for trend analysis (minimum 14 days required)');
      }

      // Detect seasonal patterns
      const seasonalPatterns = this.detectSeasonalPatterns(timeSeries);

      // Calculate historical comparison
      const historicalComparison = this.calculateHistoricalComparison(metricsData, metric);

      // Generate forecast
      const forecast = this.generateForecast(timeSeries, 7);

      // Build enhanced analysis prompt
      let prompt = `Perform deep historical trend analysis for this widget:

WIDGET: ${widget.title}
METRIC: ${metric}
CURRENT VALUE: ${this.formatMetricValue(metric, metricsData.value, metricsData.currency)}

SEASONAL PATTERN ANALYSIS:`;

      if (seasonalPatterns.hasPatterns) {
        prompt += `\n✓ Patterns Detected:`;
        seasonalPatterns.insights.forEach(insight => {
          prompt += `\n  - ${insight}`;
        });

        if (seasonalPatterns.weekendVsWeekday) {
          const { weekdayAvg, weekendAvg, differencePercent } = seasonalPatterns.weekendVsWeekday;
          prompt += `\n  - Weekday Average: ${this.formatMetricValue(metric, weekdayAvg, metricsData.currency)}`;
          prompt += `\n  - Weekend Average: ${this.formatMetricValue(metric, weekendAvg, metricsData.currency)}`;
          prompt += `\n  - Difference: ${differencePercent > 0 ? '+' : ''}${differencePercent.toFixed(1)}%`;
        }
      } else {
        prompt += `\n✗ No significant seasonal patterns detected`;
      }

      if (historicalComparison) {
        prompt += `\n\nHISTORICAL COMPARISON:
- Last 7 Days Average: ${this.formatMetricValue(metric, historicalComparison.last7Days, metricsData.currency)}
- Last 14 Days Average: ${this.formatMetricValue(metric, historicalComparison.last14Days, metricsData.currency)}
- Last 30 Days Average: ${this.formatMetricValue(metric, historicalComparison.last30Days, metricsData.currency)}`;

        if (historicalComparison.trends.weekOverWeek) {
          prompt += `\n- Week-over-Week Trend: ${historicalComparison.trends.weekOverWeek > 0 ? '+' : ''}${historicalComparison.trends.weekOverWeek.toFixed(1)}%`;
        }
        if (historicalComparison.trends.monthOverMonth) {
          prompt += `\n- Month-over-Month Trend: ${historicalComparison.trends.monthOverMonth > 0 ? '+' : ''}${historicalComparison.trends.monthOverMonth.toFixed(1)}%`;
        }
      }

      if (forecast) {
        prompt += `\n\nPREDICTIVE FORECAST (Next 7 Days):
- Trend Direction: ${forecast.trendDirection}
- Trend Strength: ${forecast.trendStrength}
- Forecast Confidence: ${forecast.confidence}
- Average Predicted Value: ${this.formatMetricValue(metric, forecast.averagePrediction, metricsData.currency)}`;
      }

      prompt += `\n\nPROVIDE ADVANCED ANALYSIS:
1. Interpret seasonal patterns and their business implications
2. Assess if current performance is within normal seasonal variation or represents genuine change
3. Based on forecast, predict expected performance for next 7-30 days
4. Recommend proactive actions to capitalize on predicted trends or mitigate risks
5. Quantify the impact of following (or ignoring) the seasonal patterns

Return your analysis as valid JSON following the specified structure.`;

      // Call Claude API
      console.log('[AI Trend Analysis] Calling Claude Sonnet 4.5 for deep analysis...');
      const startTime = Date.now();

      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929', // Sonnet 4.5 for best analysis quality
        max_tokens: 4096,
        system: this.getSystemPrompt(),
        messages: [{ role: 'user', content: prompt }]
      });

      console.log(`[AI Trend Analysis] Completed in ${Date.now() - startTime}ms`);

      const responseText = message.content[0].text;
      const analysis = this.parseAnalysisResponse(responseText);

      // Add Phase 2 metadata
      analysis.tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0);
      analysis.seasonalPatterns = seasonalPatterns;
      analysis.forecast = forecast;
      analysis.historicalComparison = historicalComparison;

      return analysis;

    } catch (error) {
      console.error('Deep trend analysis error:', error);
      throw new Error(`Failed to analyze trend: ${error.message}`);
    }
  }
}

// Export singleton instance
module.exports = new AIWidgetAnalysisService();
