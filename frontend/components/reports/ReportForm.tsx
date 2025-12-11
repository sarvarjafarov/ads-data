'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ReportFormProps {
  workspaceId: string;
  reportId?: string;
  initialData?: any;
}

export default function ReportForm({ workspaceId, reportId, initialData }: ReportFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    report_type: 'performance',
    frequency: 'daily',
    day_of_week: '',
    day_of_month: '',
    time_of_day: '09:00:00',
    timezone: 'UTC',
    ad_account_ids: [] as string[],
    platforms: [] as string[],
    metrics: ['impressions', 'clicks', 'spend', 'conversions'],
    date_range: 'last_7_days',
    recipients: '',
    email_format: 'html',
    include_charts: true,
    include_recommendations: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        recipients: initialData.recipients?.join(', ') || '',
      });
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const url = reportId
        ? `http://localhost:3000/api/reports/reports/${reportId}`
        : `http://localhost:3000/api/reports/workspaces/${workspaceId}/reports`;

      const recipients = formData.recipients
        .split(',')
        .map(email => email.trim())
        .filter(email => email);

      const payload = {
        ...formData,
        recipients,
      };

      const response = await fetch(url, {
        method: reportId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (data.success) {
        router.push(`/workspaces/${workspaceId}/reports`);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to save report');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleMetricsChange = (metric: string) => {
    setFormData(prev => ({
      ...prev,
      metrics: prev.metrics.includes(metric)
        ? prev.metrics.filter(m => m !== metric)
        : [...prev.metrics, metric],
    }));
  };

  const handlePlatformsChange = (platform: string) => {
    setFormData(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Basic Information */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Basic Information</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-white mb-2">Report Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
              placeholder="Weekly Performance Report"
            />
          </div>

          <div>
            <label className="block text-white mb-2">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
              placeholder="Brief description of the report"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white mb-2">Report Type *</label>
              <select
                name="report_type"
                value={formData.report_type}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
              >
                <option value="performance">Performance</option>
                <option value="budget">Budget</option>
                <option value="anomaly">Anomaly Detection</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-white mb-2">Date Range *</label>
              <select
                name="date_range"
                value={formData.date_range}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
              >
                <option value="yesterday">Yesterday</option>
                <option value="last_7_days">Last 7 Days</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Configuration */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Schedule</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-white mb-2">Frequency *</label>
            <select
              name="frequency"
              value={formData.frequency}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {formData.frequency === 'weekly' && (
            <div>
              <label className="block text-white mb-2">Day of Week *</label>
              <select
                name="day_of_week"
                value={formData.day_of_week}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
              >
                <option value="">Select day</option>
                <option value="monday">Monday</option>
                <option value="tuesday">Tuesday</option>
                <option value="wednesday">Wednesday</option>
                <option value="thursday">Thursday</option>
                <option value="friday">Friday</option>
                <option value="saturday">Saturday</option>
                <option value="sunday">Sunday</option>
              </select>
            </div>
          )}

          {formData.frequency === 'monthly' && (
            <div>
              <label className="block text-white mb-2">Day of Month *</label>
              <input
                type="number"
                name="day_of_month"
                value={formData.day_of_month}
                onChange={handleChange}
                min="1"
                max="31"
                required
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                placeholder="1-31"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white mb-2">Time of Day *</label>
              <input
                type="time"
                name="time_of_day"
                value={formData.time_of_day}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-white mb-2">Timezone *</label>
              <select
                name="timezone"
                value={formData.timezone}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Asia/Tokyo">Tokyo</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Data Configuration */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Data & Metrics</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-white mb-2">Platforms</label>
            <div className="grid grid-cols-3 gap-3">
              {['Google Ads', 'Facebook Ads', 'LinkedIn Ads'].map((platform) => (
                <label key={platform} className="flex items-center space-x-2 text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.platforms.includes(platform)}
                    onChange={() => handlePlatformsChange(platform)}
                    className="form-checkbox h-5 w-5 text-primary"
                  />
                  <span>{platform}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-white mb-2">Metrics to Include</label>
            <div className="grid grid-cols-3 gap-3">
              {['impressions', 'clicks', 'spend', 'conversions', 'ctr', 'cpc', 'cpa', 'roas'].map((metric) => (
                <label key={metric} className="flex items-center space-x-2 text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.metrics.includes(metric)}
                    onChange={() => handleMetricsChange(metric)}
                    className="form-checkbox h-5 w-5 text-primary"
                  />
                  <span className="capitalize">{metric}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Email Configuration */}
      <div className="card">
        <h2 className="text-xl font-semibold text-white mb-4">Email Settings</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-white mb-2">Recipients (comma-separated) *</label>
            <input
              type="text"
              name="recipients"
              value={formData.recipients}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
              placeholder="email1@example.com, email2@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-white mb-2">Email Format</label>
              <select
                name="email_format"
                value={formData.email_format}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
              >
                <option value="html">HTML</option>
                <option value="text">Plain Text</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center space-x-2 text-white cursor-pointer">
              <input
                type="checkbox"
                name="include_charts"
                checked={formData.include_charts}
                onChange={handleChange}
                className="form-checkbox h-5 w-5 text-primary"
              />
              <span>Include Charts</span>
            </label>

            <label className="flex items-center space-x-2 text-white cursor-pointer">
              <input
                type="checkbox"
                name="include_recommendations"
                checked={formData.include_recommendations}
                onChange={handleChange}
                className="form-checkbox h-5 w-5 text-primary"
              />
              <span>Include AI Recommendations</span>
            </label>
          </div>
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Saving...' : reportId ? 'Update Report' : 'Create Report'}
        </button>
      </div>
    </form>
  );
}
