'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface PlatformResult {
  status: 'excellent' | 'good' | 'partial' | 'missing';
  summary: string;
  issues: string[];
  businessImpact: string;
  recommendations: string[];
}

interface ActionItem {
  priority: 'critical' | 'high' | 'medium' | 'low';
  platform: string;
  task: string;
  businessImpact: string;
  technicalDetails: string;
  estimatedTime: string;
  estimatedImpact: string;
  completed: boolean;
}

interface AuditResult {
  websiteUrl: string;
  technicalFindings: any;
  businessAnalysis: {
    overallScore: number;
    overallStatus: string;
    executiveSummary: string;
    criticalIssues: string[];
    platformResults: {
      meta: PlatformResult;
      ga4: PlatformResult;
      googleAds: PlatformResult;
      tiktok: PlatformResult;
      linkedin: PlatformResult;
      twitter: PlatformResult;
      pinterest: PlatformResult;
    };
    actionChecklist: ActionItem[];
    lostOpportunities: {
      cantMeasureROAS: boolean;
      cantTrackConversions: boolean;
      losingIOSAttribution: boolean;
      limitedOptimization: boolean;
      poorAudienceTargeting: boolean;
      missingFunnelData: boolean;
    };
    complianceIssues: string[];
    tokensUsed: number;
  };
  metadata: {
    auditDuration: number;
    timestamp: string;
    cachedAt?: string;
  };
}

export default function WebsiteAuditPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [checklist, setChecklist] = useState<ActionItem[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAuditResult(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3000/api/website-audit/workspaces/${workspaceId}/audit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ url }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Audit failed');
      }

      if (data.success) {
        setAuditResult(data.data);
        setChecklist(data.data.businessAnalysis.actionChecklist || []);
      } else {
        setError(data.error || 'Audit failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to audit website');
    } finally {
      setLoading(false);
    }
  };

  const toggleChecklistItem = (index: number) => {
    const updated = [...checklist];
    updated[index].completed = !updated[index].completed;
    setChecklist(updated);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'bg-green-500/20 text-green-400 border-green-500';
      case 'good':
        return 'bg-blue-500/20 text-blue-400 border-blue-500';
      case 'partial':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      case 'missing':
        return 'bg-red-500/20 text-red-400 border-red-500';
      case 'concerning':
        return 'bg-orange-500/20 text-orange-400 border-orange-500';
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500';
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      case 'low':
        return 'bg-blue-500/20 text-blue-400 border-blue-500';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500';
    }
  };

  const platformNames: Record<string, string> = {
    meta: 'Meta / Facebook Pixel',
    ga4: 'Google Analytics GA4',
    googleAds: 'Google Ads',
    tiktok: 'TikTok Pixel',
    linkedin: 'LinkedIn Insight Tag',
    twitter: 'Twitter / X Pixel',
    pinterest: 'Pinterest Tag',
  };

  return (
    <div className="min-h-screen bg-gray-dark pt-20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/workspaces/${workspaceId}/reports`}
            className="text-white/60 hover:text-white inline-flex items-center mb-4"
          >
            ← Back to Reports
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">
            Website Tracking Audit
          </h1>
          <p className="text-white/60">
            Analyze tracking pixel installations and get expert recommendations to optimize your advertising performance.
          </p>
        </div>

        {/* URL Input Form */}
        <div className="card mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white mb-2 font-semibold">
                Website URL
              </label>
              <div className="flex gap-4">
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                  placeholder="https://example.com"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary px-8 whitespace-nowrap"
                >
                  {loading ? 'Analyzing...' : 'Audit Website'}
                </button>
              </div>
              <p className="text-white/40 text-sm mt-2">
                We'll analyze tracking pixels from Meta, Google, TikTok, LinkedIn, Twitter, and Pinterest
              </p>
            </div>
          </form>

          {/* Loading State */}
          {loading && (
            <div className="mt-6 p-6 bg-white/5 rounded-lg border border-white/10 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-white font-semibold">Analyzing your website...</p>
              <p className="text-white/60 text-sm mt-2">
                This may take up to 30 seconds. We're checking all tracking pixels, events, and configurations.
              </p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 font-semibold">Error:</p>
              <p className="text-red-400/80">{error}</p>
            </div>
          )}
        </div>

        {/* Audit Results */}
        {auditResult && (
          <div className="space-y-6">
            {/* Overall Score */}
            <div className="card bg-gradient-to-br from-white/5 to-white/0 border-2 border-white/10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Audit Results
                  </h2>
                  <p className="text-white/60">{auditResult.websiteUrl}</p>
                </div>
                <div className="text-right">
                  <div
                    className={`text-6xl font-bold ${getScoreColor(
                      auditResult.businessAnalysis.overallScore
                    )}`}
                  >
                    {auditResult.businessAnalysis.overallScore}
                  </div>
                  <div
                    className={`text-sm mt-1 px-3 py-1 rounded-full border inline-block ${getStatusColor(
                      auditResult.businessAnalysis.overallStatus
                    )}`}
                  >
                    {auditResult.businessAnalysis.overallStatus.toUpperCase()}
                  </div>
                </div>
              </div>

              <p className="text-white/90 text-lg leading-relaxed">
                {auditResult.businessAnalysis.executiveSummary}
              </p>

              {auditResult.metadata.cachedAt && (
                <p className="text-white/40 text-sm mt-4">
                  ✓ Cached result from {new Date(auditResult.metadata.cachedAt).toLocaleString()}
                </p>
              )}
            </div>

            {/* Critical Issues */}
            {auditResult.businessAnalysis.criticalIssues.length > 0 && (
              <div className="card bg-red-500/5 border-2 border-red-500/20">
                <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center">
                  <span className="text-2xl mr-2">⚠️</span>
                  Critical Issues Requiring Immediate Attention
                </h3>
                <ul className="space-y-2">
                  {auditResult.businessAnalysis.criticalIssues.map((issue, idx) => (
                    <li key={idx} className="text-red-400/90 flex items-start">
                      <span className="mr-2 mt-1">•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Lost Opportunities */}
            {Object.values(auditResult.businessAnalysis.lostOpportunities).some(
              (v) => v
            ) && (
              <div className="card bg-yellow-500/5 border border-yellow-500/20">
                <h3 className="text-xl font-bold text-yellow-400 mb-4">
                  Lost Opportunities
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {auditResult.businessAnalysis.lostOpportunities.cantMeasureROAS && (
                    <div className="text-yellow-400/80">
                      ❌ Cannot measure ROAS
                    </div>
                  )}
                  {auditResult.businessAnalysis.lostOpportunities.cantTrackConversions && (
                    <div className="text-yellow-400/80">
                      ❌ Cannot track conversions
                    </div>
                  )}
                  {auditResult.businessAnalysis.lostOpportunities.losingIOSAttribution && (
                    <div className="text-yellow-400/80">
                      ❌ Losing 40-60% iOS attribution
                    </div>
                  )}
                  {auditResult.businessAnalysis.lostOpportunities.limitedOptimization && (
                    <div className="text-yellow-400/80">
                      ❌ Limited campaign optimization
                    </div>
                  )}
                  {auditResult.businessAnalysis.lostOpportunities.poorAudienceTargeting && (
                    <div className="text-yellow-400/80">
                      ❌ Poor audience targeting capability
                    </div>
                  )}
                  {auditResult.businessAnalysis.lostOpportunities.missingFunnelData && (
                    <div className="text-yellow-400/80">
                      ❌ Missing conversion funnel data
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Platform Results */}
            <div>
              <h3 className="text-2xl font-bold text-white mb-4">
                Platform Analysis
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(auditResult.businessAnalysis.platformResults).map(
                  ([platform, result]) => (
                    <div key={platform} className="card">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="text-lg font-bold text-white">
                          {platformNames[platform]}
                        </h4>
                        <span
                          className={`px-3 py-1 rounded-full text-xs border ${getStatusColor(
                            result.status
                          )}`}
                        >
                          {result.status.toUpperCase()}
                        </span>
                      </div>

                      <p className="text-white/80 mb-3">{result.summary}</p>

                      {result.issues.length > 0 && (
                        <div className="mb-3">
                          <p className="text-white/60 text-sm font-semibold mb-2">
                            Issues:
                          </p>
                          <ul className="space-y-1">
                            {result.issues.map((issue, idx) => (
                              <li
                                key={idx}
                                className="text-red-400/80 text-sm flex items-start"
                              >
                                <span className="mr-2">•</span>
                                <span>{issue}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {result.businessImpact && (
                        <div className="p-3 bg-white/5 rounded-lg">
                          <p className="text-white/60 text-xs font-semibold mb-1">
                            Business Impact:
                          </p>
                          <p className="text-white/90 text-sm">
                            {result.businessImpact}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Action Checklist */}
            {checklist.length > 0 && (
              <div className="card">
                <h3 className="text-2xl font-bold text-white mb-2">
                  Action Checklist
                </h3>
                <p className="text-white/60 mb-6">
                  Follow these recommendations to optimize your tracking setup. Click items to mark as completed.
                </p>

                <div className="space-y-4">
                  {checklist.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border ${
                        item.completed
                          ? 'bg-green-500/5 border-green-500/20'
                          : 'bg-white/5 border-white/10'
                      } cursor-pointer hover:bg-white/10 transition-colors`}
                      onClick={() => toggleChecklistItem(idx)}
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 mt-1">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => {}}
                            className="w-5 h-5 rounded border-white/20"
                          />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`px-2 py-1 rounded text-xs border ${getPriorityColor(
                                    item.priority
                                  )}`}
                                >
                                  {item.priority.toUpperCase()}
                                </span>
                                <span className="text-white/60 text-xs">
                                  {item.platform}
                                </span>
                              </div>
                              <h4
                                className={`text-lg font-semibold ${
                                  item.completed
                                    ? 'text-white/50 line-through'
                                    : 'text-white'
                                }`}
                              >
                                {item.task}
                              </h4>
                            </div>
                            <div className="text-right ml-4">
                              <p className="text-white/60 text-xs">
                                Est. Time
                              </p>
                              <p className="text-white text-sm font-semibold">
                                {item.estimatedTime}
                              </p>
                            </div>
                          </div>

                          <p className="text-white/70 text-sm mb-3">
                            <span className="font-semibold text-white/90">
                              Business Impact:
                            </span>{' '}
                            {item.businessImpact}
                          </p>

                          {item.estimatedImpact && (
                            <div className="p-3 bg-primary/10 rounded-lg mb-3">
                              <p className="text-primary text-sm font-semibold">
                                Expected Impact: {item.estimatedImpact}
                              </p>
                            </div>
                          )}

                          <details className="mt-3">
                            <summary className="text-white/80 text-sm font-semibold cursor-pointer hover:text-white">
                              View Technical Details →
                            </summary>
                            <div className="mt-3 p-4 bg-black/30 rounded-lg">
                              <pre className="text-white/80 text-xs whitespace-pre-wrap font-mono">
                                {item.technicalDetails}
                              </pre>
                            </div>
                          </details>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-white/5 rounded-lg">
                  <p className="text-white/60 text-sm">
                    Progress: {checklist.filter((i) => i.completed).length} of{' '}
                    {checklist.length} items completed
                  </p>
                  <div className="mt-2 bg-black/30 rounded-full h-2">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          (checklist.filter((i) => i.completed).length /
                            checklist.length) *
                          100
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            {/* Compliance Issues */}
            {auditResult.businessAnalysis.complianceIssues.length > 0 && (
              <div className="card bg-purple-500/5 border border-purple-500/20">
                <h3 className="text-xl font-bold text-purple-400 mb-4">
                  Compliance & Privacy Considerations
                </h3>
                <ul className="space-y-2">
                  {auditResult.businessAnalysis.complianceIssues.map(
                    (issue, idx) => (
                      <li key={idx} className="text-purple-400/90 flex items-start">
                        <span className="mr-2 mt-1">•</span>
                        <span>{issue}</span>
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}

            {/* Audit Metadata */}
            <div className="text-center text-white/40 text-sm">
              <p>
                Audit completed in {auditResult.metadata.auditDuration}ms •{' '}
                {auditResult.businessAnalysis.tokensUsed} AI tokens used
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
