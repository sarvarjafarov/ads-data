'use client';

import { useState } from 'react';

interface Condition {
  field: string;
  operator: string;
  value: string;
  logic?: 'AND' | 'OR';
}

interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'in-app';
  config: any;
}

interface CustomAlertBuilderProps {
  workspaceId: string;
  onSave?: (alert: any) => void;
}

const FIELDS = [
  { label: 'Spend', value: 'spend', type: 'number' },
  { label: 'Conversions', value: 'conversions', type: 'number' },
  { label: 'CPA', value: 'cpa', type: 'number' },
  { label: 'ROAS', value: 'roas', type: 'number' },
  { label: 'CTR', value: 'ctr', type: 'number' },
  { label: 'Impressions', value: 'impressions', type: 'number' },
  { label: 'Clicks', value: 'clicks', type: 'number' },
  { label: 'Budget Remaining', value: 'budget_remaining', type: 'number' },
  { label: 'Campaign Status', value: 'status', type: 'select' },
];

const OPERATORS = [
  { label: 'Greater than', value: 'gt' },
  { label: 'Less than', value: 'lt' },
  { label: 'Equals', value: 'eq' },
  { label: 'Greater than or equal', value: 'gte' },
  { label: 'Less than or equal', value: 'lte' },
  { label: 'Changes by more than', value: 'change_gt' },
  { label: 'Changes by less than', value: 'change_lt' },
];

export default function CustomAlertBuilder({ workspaceId, onSave }: CustomAlertBuilderProps) {
  const [alertName, setAlertName] = useState('');
  const [description, setDescription] = useState('');
  const [conditions, setConditions] = useState<Condition[]>([
    { field: '', operator: '', value: '', logic: 'AND' },
  ]);
  const [frequency, setFrequency] = useState<'immediate' | 'hourly' | 'daily'>('immediate');
  const [channels, setChannels] = useState<AlertChannel[]>([
    { type: 'in-app', config: {} },
  ]);
  const [loading, setLoading] = useState(false);

  const addCondition = () => {
    setConditions([
      ...conditions,
      { field: '', operator: '', value: '', logic: 'AND' },
    ]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, key: keyof Condition, value: any) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], [key]: value };
    setConditions(newConditions);
  };

  const addChannel = (type: AlertChannel['type']) => {
    if (!channels.find(c => c.type === type)) {
      setChannels([...channels, { type, config: {} }]);
    }
  };

  const removeChannel = (type: AlertChannel['type']) => {
    setChannels(channels.filter(c => c.type !== type));
  };

  const updateChannelConfig = (type: AlertChannel['type'], config: any) => {
    setChannels(
      channels.map(c => (c.type === type ? { ...c, config: { ...c.config, ...config } } : c))
    );
  };

  const handleSave = async () => {
    if (!alertName.trim()) {
      alert('Please enter an alert name');
      return;
    }

    if (conditions.length === 0 || !conditions[0].field) {
      alert('Please add at least one condition');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3000/api/alerts/workspaces/${workspaceId}/custom-alerts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: alertName,
            description,
            conditions,
            alert_channels: channels,
            frequency,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        onSave?.(data.data);
        // Reset form
        setAlertName('');
        setDescription('');
        setConditions([{ field: '', operator: '', value: '', logic: 'AND' }]);
        setChannels([{ type: 'in-app', config: {} }]);
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Failed to create alert');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold text-white mb-6">Create Custom Alert</h2>

        {/* Basic Info */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-white mb-2">Alert Name *</label>
            <input
              type="text"
              value={alertName}
              onChange={(e) => setAlertName(e.target.value)}
              placeholder="High CPA Alert"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-white mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Alert when CPA exceeds $50"
              rows={2}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Conditions */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Conditions</h3>
          <div className="space-y-3">
            {conditions.map((condition, index) => (
              <div key={index} className="space-y-2">
                {index > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateCondition(index, 'logic', 'AND')}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        condition.logic === 'AND'
                          ? 'bg-primary text-black'
                          : 'bg-white/5 text-white hover:bg-white/10'
                      }`}
                    >
                      AND
                    </button>
                    <button
                      onClick={() => updateCondition(index, 'logic', 'OR')}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        condition.logic === 'OR'
                          ? 'bg-primary text-black'
                          : 'bg-white/5 text-white hover:bg-white/10'
                      }`}
                    >
                      OR
                    </button>
                  </div>
                )}
                <div className="flex gap-3 items-start">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <select
                      value={condition.field}
                      onChange={(e) => updateCondition(index, 'field', e.target.value)}
                      className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                    >
                      <option value="">Select metric...</option>
                      {FIELDS.map((field) => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={condition.operator}
                      onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                      disabled={!condition.field}
                      className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary disabled:opacity-50"
                    >
                      <option value="">Operator...</option>
                      {OPERATORS.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      value={condition.value}
                      onChange={(e) => updateCondition(index, 'value', e.target.value)}
                      disabled={!condition.operator}
                      placeholder="Value..."
                      className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary disabled:opacity-50"
                    />
                  </div>

                  {conditions.length > 1 && (
                    <button
                      onClick={() => removeCondition(index)}
                      className="p-2 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={addCondition}
            className="mt-3 text-primary hover:text-primary/80 font-medium text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Condition
          </button>
        </div>

        {/* Alert Channels */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Alert Channels</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {(['in-app', 'email', 'slack', 'webhook'] as const).map((type) => (
              <button
                key={type}
                onClick={() =>
                  channels.find(c => c.type === type)
                    ? removeChannel(type)
                    : addChannel(type)
                }
                className={`p-4 rounded-lg border-2 transition-all ${
                  channels.find(c => c.type === type)
                    ? 'border-primary bg-primary/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <div className="text-white font-medium capitalize">{type}</div>
              </button>
            ))}
          </div>

          {/* Channel Configs */}
          {channels.map((channel) => (
            <div key={channel.type} className="mb-4 p-4 bg-white/5 rounded-lg">
              <h4 className="text-white font-medium mb-3 capitalize">{channel.type} Settings</h4>
              {channel.type === 'email' && (
                <input
                  type="email"
                  placeholder="recipient@example.com"
                  value={channel.config.email || ''}
                  onChange={(e) =>
                    updateChannelConfig('email', { email: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                />
              )}
              {channel.type === 'slack' && (
                <input
                  type="text"
                  placeholder="Slack Webhook URL"
                  value={channel.config.webhook_url || ''}
                  onChange={(e) =>
                    updateChannelConfig('slack', { webhook_url: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                />
              )}
              {channel.type === 'webhook' && (
                <input
                  type="url"
                  placeholder="Webhook URL"
                  value={channel.config.url || ''}
                  onChange={(e) =>
                    updateChannelConfig('webhook', { url: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                />
              )}
            </div>
          ))}
        </div>

        {/* Frequency */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Alert Frequency</h3>
          <div className="flex gap-3">
            {(['immediate', 'hourly', 'daily'] as const).map((freq) => (
              <button
                key={freq}
                onClick={() => setFrequency(freq)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${
                  frequency === freq
                    ? 'bg-primary text-black'
                    : 'bg-white/5 text-white hover:bg-white/10'
                }`}
              >
                {freq}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
          <button
            onClick={() => {
              setAlertName('');
              setDescription('');
              setConditions([{ field: '', operator: '', value: '', logic: 'AND' }]);
            }}
            className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Creating...' : 'Create Alert'}
          </button>
        </div>
      </div>
    </div>
  );
}
