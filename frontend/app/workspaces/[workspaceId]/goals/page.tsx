'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Goal {
  id: string;
  goal_name: string;
  goal_type: string;
  target_value: number;
  current_value: number;
  start_date: string;
  end_date: string;
  status: string;
  progress_percentage: number;
  platform: string;
  campaign_id: string;
}

export default function GoalsPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    goal_name: '',
    goal_type: 'conversions',
    target_value: '',
    start_date: '',
    end_date: '',
    alert_threshold: '80',
    platform: '',
    campaign_id: '',
  });

  useEffect(() => {
    fetchGoals();
  }, [workspaceId]);

  const fetchGoals = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3000/api/goals/workspaces/${workspaceId}/goals`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setGoals(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const createGoal = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3000/api/goals/workspaces/${workspaceId}/goals`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...formData,
            target_value: parseFloat(formData.target_value),
            alert_threshold: parseFloat(formData.alert_threshold),
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        setShowCreateDialog(false);
        setFormData({
          goal_name: '',
          goal_type: 'conversions',
          target_value: '',
          start_date: '',
          end_date: '',
          alert_threshold: '80',
          platform: '',
          campaign_id: '',
        });
        fetchGoals();
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Failed to create goal');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400';
      case 'completed':
        return 'bg-blue-500/20 text-blue-400';
      case 'failed':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-dark pt-20">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Campaign Goals</h1>
            <p className="text-white/60">Track and manage performance goals</p>
          </div>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="btn-primary"
          >
            Create Goal
          </button>
        </div>

        {/* Create Goal Dialog */}
        {showCreateDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-white mb-6">Create New Goal</h2>
              <form onSubmit={createGoal} className="space-y-4">
                <div>
                  <label className="block text-white mb-2">Goal Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.goal_name}
                    onChange={(e) =>
                      setFormData({ ...formData, goal_name: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                    placeholder="Q1 Conversion Goal"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white mb-2">Goal Type *</label>
                    <select
                      required
                      value={formData.goal_type}
                      onChange={(e) =>
                        setFormData({ ...formData, goal_type: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                    >
                      <option value="conversions">Conversions</option>
                      <option value="roas">ROAS</option>
                      <option value="cpa">CPA</option>
                      <option value="clicks">Clicks</option>
                      <option value="impressions">Impressions</option>
                      <option value="spend">Spend</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-white mb-2">Target Value *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      value={formData.target_value}
                      onChange={(e) =>
                        setFormData({ ...formData, target_value: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                      placeholder="1000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white mb-2">Start Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={(e) =>
                        setFormData({ ...formData, start_date: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-white mb-2">End Date *</label>
                    <input
                      type="date"
                      required
                      value={formData.end_date}
                      onChange={(e) =>
                        setFormData({ ...formData, end_date: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-white mb-2">Alert Threshold (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.alert_threshold}
                    onChange={(e) =>
                      setFormData({ ...formData, alert_threshold: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-primary"
                    placeholder="80"
                  />
                  <p className="text-white/60 text-sm mt-1">
                    Get notified when goal reaches this percentage
                  </p>
                </div>

                <div className="flex gap-4">
                  <button type="submit" className="flex-1 btn-primary">
                    Create Goal
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateDialog(false)}
                    className="flex-1 px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Goals Grid */}
        {goals.length === 0 ? (
          <div className="card text-center py-16">
            <h3 className="text-xl font-semibold text-white mb-2">No goals yet</h3>
            <p className="text-white/60 mb-6">Create your first goal to start tracking progress</p>
            <button onClick={() => setShowCreateDialog(true)} className="btn-primary inline-block">
              Create Goal
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {goals.map((goal) => (
              <div key={goal.id} className="card">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-white">{goal.goal_name}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(goal.status)}`}>
                    {goal.status}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm text-white/60 mb-2">
                    <span>{goal.goal_type.toUpperCase()}</span>
                    <span>{goal.progress_percentage}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full ${getProgressColor(goal.progress_percentage)} transition-all duration-500`}
                      style={{ width: `${Math.min(goal.progress_percentage, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-white/60 mb-1">Current</div>
                    <div className="text-white font-semibold">{goal.current_value.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-white/60 mb-1">Target</div>
                    <div className="text-white font-semibold">{goal.target_value.toLocaleString()}</div>
                  </div>
                </div>

                <div className="border-t border-white/10 mt-4 pt-4 text-sm text-white/60">
                  {new Date(goal.start_date).toLocaleDateString()} -{' '}
                  {new Date(goal.end_date).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
