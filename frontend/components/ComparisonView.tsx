'use client';

import { useState, useEffect } from 'react';

interface Campaign {
  id: string;
  name: string;
  platform: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
}

interface ComparisonViewProps {
  workspaceId: string;
}

export default function ComparisonView({ workspaceId }: ComparisonViewProps) {
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [comparisonData, setComparisonData] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'table'>('side-by-side');

  useEffect(() => {
    // Fetch available campaigns
    fetchCampaigns();
  }, [workspaceId]);

  const fetchCampaigns = async () => {
    // Mock data - replace with actual API call
    const mockCampaigns: Campaign[] = [
      {
        id: '1',
        name: 'Summer Sale 2024',
        platform: 'Google Ads',
        spend: 5000,
        impressions: 150000,
        clicks: 7500,
        conversions: 250,
        ctr: 5.0,
        cpc: 0.67,
        cpa: 20,
        roas: 4.5,
      },
      {
        id: '2',
        name: 'Black Friday Campaign',
        platform: 'Facebook Ads',
        spend: 8000,
        impressions: 200000,
        clicks: 10000,
        conversions: 400,
        ctr: 5.0,
        cpc: 0.80,
        cpa: 20,
        roas: 5.2,
      },
      {
        id: '3',
        name: 'Product Launch',
        platform: 'LinkedIn Ads',
        spend: 3000,
        impressions: 50000,
        clicks: 2500,
        conversions: 100,
        ctr: 5.0,
        cpc: 1.20,
        cpa: 30,
        roas: 3.8,
      },
    ];
    setCampaigns(mockCampaigns);
  };

  const handleCampaignSelect = (campaignId: string) => {
    if (selectedCampaigns.includes(campaignId)) {
      setSelectedCampaigns(selectedCampaigns.filter(id => id !== campaignId));
    } else if (selectedCampaigns.length < 4) {
      setSelectedCampaigns([...selectedCampaigns, campaignId]);
    }
  };

  const compareSelectedCampaigns = () => {
    const selected = campaigns.filter(c => selectedCampaigns.includes(c.id));
    setComparisonData(selected);
  };

  const clearComparison = () => {
    setSelectedCampaigns([]);
    setComparisonData([]);
  };

  const getBestValue = (metric: keyof Campaign, campaigns: Campaign[]) => {
    if (campaigns.length === 0) return null;

    const values = campaigns.map(c => c[metric] as number);
    const metricsToMinimize = ['cpc', 'cpa'];

    if (metricsToMinimize.includes(metric)) {
      return Math.min(...values);
    }
    return Math.max(...values);
  };

  const isbestValue = (value: number, metric: keyof Campaign) => {
    const best = getBestValue(metric, comparisonData);
    return value === best;
  };

  const formatMetric = (value: number, metric: string) => {
    if (['spend', 'cpc', 'cpa'].includes(metric)) {
      return `$${value.toLocaleString()}`;
    }
    if (metric === 'ctr') {
      return `${value.toFixed(2)}%`;
    }
    if (metric === 'roas') {
      return `${value.toFixed(2)}x`;
    }
    return value.toLocaleString();
  };

  const metrics = [
    { key: 'spend', label: 'Total Spend' },
    { key: 'impressions', label: 'Impressions' },
    { key: 'clicks', label: 'Clicks' },
    { key: 'conversions', label: 'Conversions' },
    { key: 'ctr', label: 'CTR' },
    { key: 'cpc', label: 'CPC' },
    { key: 'cpa', label: 'CPA' },
    { key: 'roas', label: 'ROAS' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Campaign Comparison</h2>
          <p className="text-white/60">Compare up to 4 campaigns side-by-side</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('side-by-side')}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              viewMode === 'side-by-side'
                ? 'bg-primary text-black'
                : 'bg-white/5 hover:bg-white/10 text-white'
            }`}
          >
            Side-by-Side
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              viewMode === 'table'
                ? 'bg-primary text-black'
                : 'bg-white/5 hover:bg-white/10 text-white'
            }`}
          >
            Table View
          </button>
        </div>
      </div>

      {/* Campaign Selection */}
      <div className="card">
        <h3 className="text-lg font-semibold text-white mb-4">
          Select Campaigns ({selectedCampaigns.length}/4)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {campaigns.map((campaign) => (
            <button
              key={campaign.id}
              onClick={() => handleCampaignSelect(campaign.id)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                selectedCampaigns.includes(campaign.id)
                  ? 'border-primary bg-primary/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <div className="font-semibold text-white mb-1">{campaign.name}</div>
              <div className="text-xs text-white/60">{campaign.platform}</div>
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={compareSelectedCampaigns}
            disabled={selectedCampaigns.length < 2}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Compare Selected
          </button>
          {selectedCampaigns.length > 0 && (
            <button
              onClick={clearComparison}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Comparison Results */}
      {comparisonData.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-6">Comparison Results</h3>

          {viewMode === 'side-by-side' ? (
            /* Side-by-Side View */
            <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${comparisonData.length}, 1fr)` }}>
              {comparisonData.map((campaign) => (
                <div key={campaign.id} className="space-y-4">
                  <div className="pb-4 border-b border-white/10">
                    <h4 className="font-semibold text-white text-lg mb-1">{campaign.name}</h4>
                    <p className="text-white/60 text-sm">{campaign.platform}</p>
                  </div>
                  {metrics.map((metric) => (
                    <div key={metric.key} className="space-y-1">
                      <div className="text-white/60 text-sm">{metric.label}</div>
                      <div
                        className={`text-white font-semibold ${
                          isbestValue(campaign[metric.key as keyof Campaign] as number, metric.key as keyof Campaign)
                            ? 'text-primary'
                            : ''
                        }`}
                      >
                        {formatMetric(campaign[metric.key as keyof Campaign] as number, metric.key)}
                        {isbestValue(campaign[metric.key as keyof Campaign] as number, metric.key as keyof Campaign) && (
                          <span className="ml-2 text-xs">⭐</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            /* Table View */
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-white font-semibold">Metric</th>
                    {comparisonData.map((campaign) => (
                      <th key={campaign.id} className="text-left py-3 px-4">
                        <div className="font-semibold text-white">{campaign.name}</div>
                        <div className="text-white/60 text-xs font-normal">{campaign.platform}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((metric, index) => (
                    <tr
                      key={metric.key}
                      className={index % 2 === 0 ? 'bg-white/5' : ''}
                    >
                      <td className="py-3 px-4 text-white/80">{metric.label}</td>
                      {comparisonData.map((campaign) => (
                        <td
                          key={campaign.id}
                          className={`py-3 px-4 font-semibold ${
                            isbestValue(campaign[metric.key as keyof Campaign] as number, metric.key as keyof Campaign)
                              ? 'text-primary'
                              : 'text-white'
                          }`}
                        >
                          {formatMetric(campaign[metric.key as keyof Campaign] as number, metric.key)}
                          {isbestValue(campaign[metric.key as keyof Campaign] as number, metric.key as keyof Campaign) && (
                            <span className="ml-2">⭐</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
