const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config/config');

/**
 * AI Website Audit Service
 *
 * Provides critical business impact analysis and actionable recommendations for website tracking
 * using Claude API. Acts as a brutal but fair marketing technology auditor.
 */
class AIWebsiteAuditService {
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
   * Analyze business impact of technical findings
   * @param {Object} technicalFindings - Technical findings from websiteAuditService
   * @param {string} websiteUrl - Website URL being audited
   * @returns {Object} Business impact analysis with recommendations
   */
  async analyzeBusinessImpact(technicalFindings, websiteUrl) {
    try {
      // Build analysis prompt
      const prompt = this.buildAnalysisPrompt(technicalFindings, websiteUrl);

      // Call Claude API
      const message = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 16384, // Increased to ensure full JSON response with all platforms and recommendations
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
      console.error('AI website audit error:', error);

      // Return fallback analysis if AI fails
      return this.getFallbackAnalysis(technicalFindings);
    }
  }

  /**
   * Get system prompt for critical marketing analyst
   * @returns {string} System prompt
   */
  getSystemPrompt() {
    return `You are a critical marketing technology auditor with 15+ years of experience in digital advertising and conversion optimization.

Your role is to provide brutally honest, business-focused analysis of website tracking implementations. You call out problems directly and quantify their business impact in real dollars and lost opportunities.

TONE & APPROACH:
- Be direct about performance issues - don't sugarcoat problems
- Focus on business impact: revenue loss, wasted spend, missed opportunities
- Prioritize issues by severity and business impact (critical > high > medium > low)
- Provide specific, technical recommendations with code examples
- Use industry benchmarks and best practices to contextualize findings
- Quantify impact when possible (e.g., "losing 40-60% of iOS conversions")

CRITICAL PRIORITIES (in order of business impact):
1. **Missing pixels** = 100% blind to platform performance, cannot optimize
2. **Missing conversion events** (Purchase, Lead) = Cannot measure ROI or optimize campaigns
3. **Missing funnel events** (AddToCart, InitiateCheckout) = Limited optimization capabilities
4. **No CAPI/server-side tracking** = Losing 40-60% of conversions due to iOS 14.5+ privacy changes
5. **Poor event matching** = Limited audience building and conversion attribution
6. **Missing event parameters** (value, currency, content_ids) = Reduced optimization precision

BUSINESS IMPACT KNOWLEDGE:
- Without Purchase event: Cannot calculate ROAS, cannot optimize for conversions, flying blind
- Without CAPI: Losing 40-60% of iOS attribution, significantly underreporting conversions
- Without event matching: Poor lookalike audiences, limited retargeting effectiveness
- Without AddToCart: Can only optimize for clicks/views, not for people likely to buy
- Without proper GA4: No visibility into user behavior, funnel drop-offs, or content performance

OUTPUT FORMAT:
Return ONLY valid JSON with this exact structure:
{
  "overallScore": 0-100 (integer),
  "overallStatus": "excellent" | "good" | "concerning" | "critical",
  "executiveSummary": "2-3 sentence summary of overall tracking health and most critical issues",
  "criticalIssues": [
    "Array of 3-5 most critical issues that cost real money/opportunities",
    "Be specific with platform names and missing functionality"
  ],
  "platformResults": {
    "meta": {
      "status": "excellent" | "good" | "partial" | "missing",
      "summary": "One sentence summary",
      "issues": ["Array of specific issues"],
      "businessImpact": "What this means for business (revenue, optimization, attribution)",
      "recommendations": ["Specific actions to take with code examples when relevant"]
    },
    "ga4": { /* same structure */ },
    "googleAds": { /* same structure */ },
    "tiktok": { /* same structure */ },
    "linkedin": { /* same structure */ },
    "twitter": { /* same structure */ },
    "pinterest": { /* same structure */ }
  },
  "actionChecklist": [
    {
      "priority": "critical" | "high" | "medium" | "low",
      "platform": "platform name",
      "task": "Clear, actionable task title",
      "businessImpact": "Why this matters for business (revenue, ROAS, attribution)",
      "technicalDetails": "Specific implementation steps, include code examples",
      "estimatedTime": "Realistic time estimate (15 min, 1 hour, 1 day)",
      "estimatedImpact": "Quantified expected result (e.g., 'Recover 40-60% of iOS conversions', 'Improve ROAS by 20-30%')",
      "completed": false
    }
  ],
  "lostOpportunities": {
    "cantMeasureROAS": true/false,
    "cantTrackConversions": true/false,
    "losingIOSAttribution": true/false,
    "limitedOptimization": true/false,
    "poorAudienceTargeting": true/false,
    "missingFunnelData": true/false
  },
  "complianceIssues": [
    "Privacy/compliance concerns if any (e.g., collecting PII without hashing)"
  ]
}

SCORING GUIDELINES:
- 90-100: Excellent - All platforms properly configured with CAPI, event matching, all events
- 70-89: Good - Major platforms installed, conversion tracking works, minor issues
- 40-69: Concerning - Missing critical events or platforms, CAPI not implemented
- 0-39: Critical - Missing pixels, no conversion tracking, major revenue impact

QUALITY STANDARDS:
- Be specific with numbers and technical details
- Avoid vague statements like "could be improved"
- Include code examples in technicalDetails when relevant
- Prioritize actionChecklist items by business impact (revenue > optimization > reporting)
- Only flag risks that genuinely impact business performance
- Quantify impact whenever possible (percentages, dollar ranges)

CRITICAL REQUIREMENT FOR ACTION CHECKLIST:
- ALL tasks must be DIRECTLY based on the technical findings from THIS specific website audit
- Use the ACTUAL pixel IDs, measurement IDs, and data found in the audit results
- If Meta Pixel ID 123456789 was detected, reference it specifically in recommendations
- If GA4 measurement ID G-XXXXXXXXX was found, include it in implementation examples
- DO NOT include generic compliance tasks (GDPR, banking regulations, etc.) unless directly related to tracking implementation
- Focus ONLY on fixing detected technical issues: missing pixels, missing events, missing CAPI, poor event matching, etc.
- Every task in actionChecklist must solve a specific problem found in platformResults or criticalIssues

Examples of GOOD tasks (based on actual findings):
- "Add Purchase event to Meta Pixel 123456789" (if pixel found but Purchase event missing)
- "Implement Meta CAPI for Pixel 123456789 to recover iOS attribution" (if pixel exists without CAPI)
- "Add conversion tracking to Google Ads using existing GA4 G-XXXXXXXXX" (if GA4 exists but Google Ads doesn't)

Examples of BAD tasks (generic, not based on findings):
- "Audit data collection for Azerbaijan banking regulations" (not related to tracking implementation)
- "Review GDPR compliance" (unless specific PII collection issue found)
- "General privacy policy review" (not a tracking technical issue)

Remember: Your analysis directly affects business decisions. Be thorough, be critical, be actionable. Every recommendation must fix a REAL issue found in THIS website's audit.`;
  }

  /**
   * Build analysis prompt from technical findings
   * @param {Object} findings - Technical findings
   * @param {string} websiteUrl - Website URL
   * @returns {string} Analysis prompt
   */
  buildAnalysisPrompt(findings, websiteUrl) {
    const { platforms, metadata } = findings;

    let prompt = `Analyze the tracking implementation for this e-commerce/lead generation website:

**WEBSITE**: ${websiteUrl}
**AUDIT METADATA**:
- Total Network Requests: ${metadata.totalRequests}
- Data Layer Present: ${metadata.hasDataLayer ? 'Yes' : 'No'}

---

## PLATFORM DETECTION RESULTS:

`;

    // Meta Pixel
    prompt += `### Meta/Facebook Pixel
- **Detected**: ${platforms.meta.detected ? 'Yes' : 'No'}
- **Pixel ID**: ${platforms.meta.pixelId || 'N/A'}
- **Standard Events**: ${platforms.meta.standardEvents.length > 0 ? platforms.meta.standardEvents.join(', ') : 'None detected'}
- **Custom Events**: ${platforms.meta.customEvents.length > 0 ? platforms.meta.customEvents.join(', ') : 'None'}
- **CAPI Detected**: ${platforms.meta.capiDetected ? 'Yes' : 'No'}
- **Event Matching Quality**: ${platforms.meta.eventMatchingQuality}
- **Technical Issues**: ${platforms.meta.issues.length > 0 ? platforms.meta.issues.join(', ') : 'None'}

`;

    // GA4
    prompt += `### Google Analytics GA4
- **Detected**: ${platforms.ga4.detected ? 'Yes' : 'No'}
- **Measurement ID**: ${platforms.ga4.measurementId || 'N/A'}
- **Events Detected**: ${platforms.ga4.events.length > 0 ? platforms.ga4.events.join(', ') : 'None'}
- **E-commerce Tracking**: ${platforms.ga4.ecommerce ? 'Yes' : 'No'}
- **Technical Issues**: ${platforms.ga4.issues.length > 0 ? platforms.ga4.issues.join(', ') : 'None'}

`;

    // Google Ads
    prompt += `### Google Ads Conversion Tracking
- **Detected**: ${platforms.googleAds.detected ? 'Yes' : 'No'}
- **Conversion IDs**: ${platforms.googleAds.conversionIds.length > 0 ? platforms.googleAds.conversionIds.join(', ') : 'None'}
- **Conversion Labels**: ${platforms.googleAds.conversionLabels.length}
- **Remarketing**: ${platforms.googleAds.remarketingDetected ? 'Yes' : 'No'}
- **Technical Issues**: ${platforms.googleAds.issues.length > 0 ? platforms.googleAds.issues.join(', ') : 'None'}

`;

    // TikTok
    prompt += `### TikTok Pixel
- **Detected**: ${platforms.tiktok.detected ? 'Yes' : 'No'}
- **Pixel ID**: ${platforms.tiktok.pixelId || 'N/A'}
- **Events Detected**: ${platforms.tiktok.events.length > 0 ? platforms.tiktok.events.join(', ') : 'None'}
- **Technical Issues**: ${platforms.tiktok.issues.length > 0 ? platforms.tiktok.issues.join(', ') : 'None'}

`;

    // LinkedIn
    prompt += `### LinkedIn Insight Tag
- **Detected**: ${platforms.linkedin.detected ? 'Yes' : 'No'}
- **Partner ID**: ${platforms.linkedin.partnerId || 'N/A'}
- **Conversion IDs**: ${platforms.linkedin.conversionIds.length}
- **Technical Issues**: ${platforms.linkedin.issues.length > 0 ? platforms.linkedin.issues.join(', ') : 'None'}

`;

    // Twitter
    prompt += `### Twitter/X Pixel
- **Detected**: ${platforms.twitter.detected ? 'Yes' : 'No'}
- **Pixel ID**: ${platforms.twitter.pixelId || 'N/A'}
- **Events Detected**: ${platforms.twitter.events.length > 0 ? platforms.twitter.events.join(', ') : 'None'}
- **Technical Issues**: ${platforms.twitter.issues.length > 0 ? platforms.twitter.issues.join(', ') : 'None'}

`;

    // Pinterest
    prompt += `### Pinterest Tag
- **Detected**: ${platforms.pinterest.detected ? 'Yes' : 'No'}
- **Tag ID**: ${platforms.pinterest.tagId || 'N/A'}
- **Events Detected**: ${platforms.pinterest.events.length > 0 ? platforms.pinterest.events.join(', ') : 'None'}
- **Technical Issues**: ${platforms.pinterest.issues.length > 0 ? platforms.pinterest.issues.join(', ') : 'None'}

---

## YOUR TASK:

Analyze these technical findings and provide:

1. **Overall tracking health score** (0-100) with brutally honest assessment
2. **Critical business issues** - What's costing them money RIGHT NOW?
3. **Platform-by-platform analysis** - Status, issues, business impact
4. **Prioritized action checklist** - Sorted by business impact with specific implementation steps
5. **Lost opportunities** - What can't they measure/optimize without fixing these issues?

Focus on actionable insights that will improve ROAS, attribution accuracy, and conversion optimization.

Return your analysis as valid JSON following the specified structure.`;

    return prompt;
  }

  /**
   * Parse AI analysis response
   * @param {string} responseText - Raw response text
   * @returns {Object} Parsed analysis
   */
  parseAnalysisResponse(responseText) {
    try {
      // Try to extract JSON from markdown code blocks
      let jsonStr = responseText.trim();

      // Remove markdown code block markers if present
      if (jsonStr.startsWith('```')) {
        const lines = jsonStr.split('\n');
        // Remove first line (```json or ```)
        lines.shift();
        // Remove last line if it's just ```
        if (lines[lines.length - 1].trim() === '```') {
          lines.pop();
        }
        jsonStr = lines.join('\n');
      }

      const analysis = JSON.parse(jsonStr.trim());

      // Validate structure (check for null/undefined, not falsy values since score can be 0)
      if (analysis.overallScore === null || analysis.overallScore === undefined || !analysis.executiveSummary) {
        throw new Error('Invalid analysis structure');
      }

      // Ensure required fields exist
      analysis.criticalIssues = analysis.criticalIssues || [];
      analysis.platformResults = analysis.platformResults || {};
      analysis.actionChecklist = analysis.actionChecklist || [];
      analysis.lostOpportunities = analysis.lostOpportunities || {};
      analysis.complianceIssues = analysis.complianceIssues || [];

      // Sort action checklist by priority
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      analysis.actionChecklist.sort((a, b) => {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      return analysis;

    } catch (error) {
      console.error('Failed to parse AI response:', error.message);
      console.error('Response length:', responseText.length);
      console.error('Response first 1000 chars:', responseText.substring(0, 1000));
      console.error('Response last 500 chars:', responseText.substring(Math.max(0, responseText.length - 500)));

      // Return error structure
      throw new Error('Failed to parse AI analysis response');
    }
  }

  /**
   * Get fallback analysis if AI fails
   * @param {Object} findings - Technical findings
   * @returns {Object} Fallback analysis
   */
  getFallbackAnalysis(findings) {
    const { platforms } = findings;

    // Count detected platforms
    const detectedPlatforms = Object.values(platforms).filter(p => p.detected).length;
    const totalPlatforms = Object.keys(platforms).length;

    // Calculate basic score
    let score = (detectedPlatforms / totalPlatforms) * 50; // Max 50 for detection

    // Bonus points for critical features
    if (platforms.meta.detected) {
      if (platforms.meta.standardEvents.includes('Purchase')) score += 10;
      if (platforms.meta.capiDetected) score += 10;
      if (platforms.meta.eventMatchingQuality === 'advanced') score += 5;
    }

    if (platforms.ga4.detected && platforms.ga4.ecommerce) score += 10;

    score = Math.min(100, Math.round(score));

    const status = score >= 70 ? 'good' : score >= 40 ? 'concerning' : 'critical';

    return {
      overallScore: score,
      overallStatus: status,
      executiveSummary: 'AI analysis temporarily unavailable. Basic technical scan completed. Please review platform detection results for issues.',
      criticalIssues: platforms.meta.detected ? [] : ['Meta Pixel not detected - cannot track or optimize Facebook/Instagram ads'],
      platformResults: {
        meta: {
          status: platforms.meta.detected ? 'partial' : 'missing',
          summary: platforms.meta.detected ? 'Pixel detected but may have issues' : 'Not detected',
          issues: platforms.meta.issues,
          businessImpact: 'Review technical issues for business impact',
          recommendations: ['Review technical findings and consult documentation']
        },
        ga4: {
          status: platforms.ga4.detected ? 'partial' : 'missing',
          summary: platforms.ga4.detected ? 'GA4 detected' : 'Not detected',
          issues: platforms.ga4.issues,
          businessImpact: 'Review technical issues for business impact',
          recommendations: ['Review technical findings and consult documentation']
        },
        googleAds: {
          status: platforms.googleAds.detected ? 'partial' : 'missing',
          summary: platforms.googleAds.detected ? 'Conversion tracking detected' : 'Not detected',
          issues: platforms.googleAds.issues,
          businessImpact: 'Review technical issues for business impact',
          recommendations: ['Review technical findings and consult documentation']
        },
        tiktok: {
          status: platforms.tiktok.detected ? 'partial' : 'missing',
          summary: platforms.tiktok.detected ? 'Pixel detected' : 'Not detected',
          issues: platforms.tiktok.issues,
          businessImpact: 'Review technical issues for business impact',
          recommendations: ['Review technical findings and consult documentation']
        },
        linkedin: {
          status: platforms.linkedin.detected ? 'partial' : 'missing',
          summary: platforms.linkedin.detected ? 'Insight Tag detected' : 'Not detected',
          issues: platforms.linkedin.issues,
          businessImpact: 'Review technical issues for business impact',
          recommendations: ['Review technical findings and consult documentation']
        },
        twitter: {
          status: platforms.twitter.detected ? 'partial' : 'missing',
          summary: platforms.twitter.detected ? 'Pixel detected' : 'Not detected',
          issues: platforms.twitter.issues,
          businessImpact: 'Review technical issues for business impact',
          recommendations: ['Review technical findings and consult documentation']
        },
        pinterest: {
          status: platforms.pinterest.detected ? 'partial' : 'missing',
          summary: platforms.pinterest.detected ? 'Tag detected' : 'Not detected',
          issues: platforms.pinterest.issues,
          businessImpact: 'Review technical issues for business impact',
          recommendations: ['Review technical findings and consult documentation']
        }
      },
      actionChecklist: [],
      lostOpportunities: {
        cantMeasureROAS: !platforms.meta.standardEvents?.includes('Purchase'),
        cantTrackConversions: !platforms.meta.detected && !platforms.ga4.detected,
        losingIOSAttribution: !platforms.meta.capiDetected,
        limitedOptimization: true,
        poorAudienceTargeting: platforms.meta.eventMatchingQuality === 'none',
        missingFunnelData: !platforms.meta.standardEvents?.includes('AddToCart')
      },
      complianceIssues: [],
      tokensUsed: 0
    };
  }
}

// Export singleton instance
module.exports = new AIWebsiteAuditService();
