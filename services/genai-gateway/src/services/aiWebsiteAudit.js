/**
 * AI Website Audit Service (Gateway version)
 * Provides business impact analysis for website tracking audits.
 */

const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');

class AIWebsiteAuditService {
  constructor() {
    this.anthropic = null;
  }

  ensureClient() {
    if (this.anthropic) return;
    if (!config.anthropic?.apiKey) throw new Error('Anthropic API key not configured.');
    this.anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
  }

  async analyzeBusinessImpact(technicalFindings, websiteUrl) {
    this.ensureClient();
    const prompt = this.buildAnalysisPrompt(technicalFindings, websiteUrl);

    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16384,
      system: this.getSystemPrompt(),
      messages: [{ role: 'user', content: prompt }],
    });

    const analysis = this.parseAnalysisResponse(message.content[0].text);
    analysis.tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0);
    return analysis;
  }

  getSystemPrompt() {
    return `You are a critical marketing technology auditor with 15+ years of experience.

Return ONLY valid JSON with this structure:
{
  "overallScore": 0-100,
  "overallStatus": "excellent" | "good" | "concerning" | "critical",
  "executiveSummary": "2-3 sentence summary",
  "criticalIssues": ["Array of critical issues"],
  "platformResults": {
    "meta": { "status": "...", "summary": "...", "issues": [], "businessImpact": "...", "recommendations": [] },
    "ga4": { ... },
    "googleAds": { ... },
    "tiktok": { ... },
    "linkedin": { ... },
    "twitter": { ... },
    "pinterest": { ... }
  },
  "actionChecklist": [
    {
      "priority": "critical|high|medium|low",
      "platform": "...",
      "task": "...",
      "businessImpact": "...",
      "technicalDetails": "...",
      "estimatedTime": "...",
      "estimatedImpact": "...",
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
  "complianceIssues": []
}`;
  }

  buildAnalysisPrompt(findings, websiteUrl) {
    const { platforms, metadata } = findings;

    let prompt = `Analyze tracking implementation for: ${websiteUrl}\nTotal Requests: ${metadata.totalRequests}, Data Layer: ${metadata.hasDataLayer ? 'Yes' : 'No'}\n\n`;

    const platformEntries = [
      ['Meta Pixel', platforms.meta, ['detected', 'pixelId', 'standardEvents', 'customEvents', 'capiDetected', 'eventMatchingQuality', 'issues']],
      ['GA4', platforms.ga4, ['detected', 'measurementId', 'events', 'ecommerce', 'issues']],
      ['Google Ads', platforms.googleAds, ['detected', 'conversionIds', 'conversionLabels', 'remarketingDetected', 'issues']],
      ['TikTok', platforms.tiktok, ['detected', 'pixelId', 'events', 'issues']],
      ['LinkedIn', platforms.linkedin, ['detected', 'partnerId', 'conversionIds', 'issues']],
      ['Twitter', platforms.twitter, ['detected', 'pixelId', 'events', 'issues']],
      ['Pinterest', platforms.pinterest, ['detected', 'tagId', 'events', 'issues']],
    ];

    for (const [name, data, fields] of platformEntries) {
      prompt += `### ${name}\n`;
      for (const field of fields) {
        const val = data[field];
        if (Array.isArray(val)) prompt += `- ${field}: ${val.length > 0 ? val.join(', ') : 'None'}\n`;
        else prompt += `- ${field}: ${val ?? 'N/A'}\n`;
      }
      prompt += '\n';
    }

    prompt += `Provide business impact analysis as valid JSON.`;
    return prompt;
  }

  parseAnalysisResponse(responseText) {
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```')) {
      const lines = jsonStr.split('\n');
      lines.shift();
      if (lines[lines.length - 1].trim() === '```') lines.pop();
      jsonStr = lines.join('\n');
    }

    const analysis = JSON.parse(jsonStr.trim());
    if (analysis.overallScore === null || analysis.overallScore === undefined || !analysis.executiveSummary) {
      throw new Error('Invalid analysis structure');
    }

    analysis.criticalIssues = analysis.criticalIssues || [];
    analysis.platformResults = analysis.platformResults || {};
    analysis.actionChecklist = (analysis.actionChecklist || []).sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.priority] - order[b.priority];
    });
    analysis.lostOpportunities = analysis.lostOpportunities || {};
    analysis.complianceIssues = analysis.complianceIssues || [];

    return analysis;
  }
}

module.exports = new AIWebsiteAuditService();
