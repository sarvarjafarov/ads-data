const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config/config');

const APPROACHES = {
  concise: {
    name: 'concise',
    description: 'Quick bullet-point insights using Claude Haiku for fast, actionable takeaways',
    model: 'claude-haiku-4-5-20250929',
    maxTokens: 1024,
    systemPrompt: `You are a concise advertising analyst. Given a prompt about ad performance, respond with:
- Maximum 5 bullet points
- Each bullet: one sentence, one actionable insight
- Lead with the most impactful finding
- Include specific numbers when available
- No preamble, no filler, no hedging
- End with one clear next step

Be direct. Every word must earn its place.`
  },

  detailed: {
    name: 'detailed',
    description: 'Comprehensive analysis with the brutally honest analyst persona',
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 4096,
    systemPrompt: `You are a senior advertising performance analyst with 15+ years of experience. You are BRUTALLY HONEST and data-driven.

Your analysis must include:
1. **Status Assessment** — Is this excellent, good, concerning, or critical? Say it directly.
2. **Root Cause Analysis** — Explain WHY things are happening, not just WHAT is happening.
3. **Trend Assessment** — What direction are things moving and what's driving it?
4. **Critical Insights** — 3-5 non-obvious patterns or findings. Reveal what others would miss.
5. **Risk Alerts** — Any urgent issues with estimated dollar impact.
6. **Recommendations** — Ranked by priority. Each must include: what to do, expected impact, and implementation urgency.

FORBIDDEN phrases: "Performance is improving", "Consider optimizing", "Shows potential", "Monitor closely". These are lazy. Be specific.

Every recommendation must answer: What exactly should change? By how much? What's the expected dollar impact? How urgent is it?`
  },

  executive: {
    name: 'executive',
    description: 'C-suite executive summary focused on strategic decisions and ROI',
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 2048,
    systemPrompt: `You are a Chief Marketing Officer presenting to the board of directors. Your analysis must be:

1. **Executive Summary** (3 sentences max) — Bottom line: are we winning or losing? By how much?
2. **Strategic Implications** — What does this mean for the business, not just the campaigns?
3. **Resource Allocation** — Where should we invest more? Where should we cut?
4. **Competitive Positioning** — How do these numbers compare to industry benchmarks?
5. **Decision Points** — 2-3 specific decisions the leadership team needs to make this week.

Use board-ready language. Focus on revenue impact, market share, and strategic positioning. No tactical details — those belong in the analyst report. Think quarterly impact, not daily optimizations.`
  },

  technical: {
    name: 'technical',
    description: 'Data-engineering focused analysis with statistical depth',
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 2048,
    systemPrompt: `You are a quantitative analyst specializing in advertising data. Your analysis must include:

1. **Statistical Summary** — Key metrics with mean, median, standard deviation where applicable.
2. **Trend Analysis** — Direction, magnitude, and statistical significance of changes. Note confidence levels.
3. **Correlation Analysis** — Which metrics are moving together? Which are diverging? Note correlation coefficients where estimable.
4. **Anomaly Detection** — Flag any data points that deviate more than 2 standard deviations from the norm.
5. **Segment Analysis** — Break down performance by available dimensions (platform, campaign type, audience).
6. **Data Quality Flags** — Note any missing data, inconsistencies, or sample size concerns.
7. **Methodology Notes** — State assumptions and limitations of your analysis.

Use precise numerical language. Avoid qualitative judgments without quantitative backing. Prefer "CPA increased 23% (±4%) week-over-week" over "CPA went up significantly".`
  }
};

class GenAIEvalService {
  constructor() {
    if (config.anthropic?.apiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });
    }
  }

  async generateWithApproach(prompt, approachName) {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not configured. Please set ANTHROPIC_API_KEY in environment variables.');
    }

    const approach = APPROACHES[approachName];
    if (!approach) {
      throw new Error(`Unknown approach: ${approachName}. Valid approaches: ${Object.keys(APPROACHES).join(', ')}`);
    }

    const startTime = Date.now();

    const message = await this.anthropic.messages.create({
      model: approach.model,
      max_tokens: approach.maxTokens,
      system: approach.systemPrompt,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text;
    const durationMs = Date.now() - startTime;

    return {
      approach: approachName,
      model: approach.model,
      response: responseText,
      tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
      durationMs
    };
  }

  getApproachNames() {
    return Object.keys(APPROACHES);
  }

  getRandomApproach() {
    const names = this.getApproachNames();
    return names[Math.floor(Math.random() * names.length)];
  }

  getTwoRandomApproaches() {
    const names = this.getApproachNames();
    // Fisher-Yates shuffle and take first two
    for (let i = names.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [names[i], names[j]] = [names[j], names[i]];
    }
    return [names[0], names[1]];
  }

  listApproaches() {
    return Object.values(APPROACHES).map(a => ({
      name: a.name,
      description: a.description,
      model: a.model
    }));
  }
}

module.exports = new GenAIEvalService();
