'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ReportForm from '@/components/reports/ReportForm';

interface ExecutionRecord {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export default function EditReportPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const reportId = params.reportId as string;
  const [reportData, setReportData] = useState(null);
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'history'>('edit');

  useEffect(() => {
    fetchReport();
    fetchExecutions();
  }, [reportId]);

  const fetchReport = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/reports/reports/${reportId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setReportData(data.data);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to load report');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExecutions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/reports/reports/${reportId}/executions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setExecutions(data.data);
      }
    } catch (err) {
      console.error('Failed to load execution history:', err);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-500/20 text-green-400';
      case 'failed':
        return 'bg-red-500/20 text-red-400';
      case 'processing':
        return 'bg-blue-500/20 text-blue-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-dark pt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-dark pt-20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Edit Scheduled Report</h1>
          <p className="text-white/60">Update report configuration and view execution history</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-white/10">
          <button
            onClick={() => setActiveTab('edit')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'edit'
                ? 'text-primary border-b-2 border-primary'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Edit Report
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-primary border-b-2 border-primary'
                : 'text-white/60 hover:text-white'
            }`}
          >
            Execution History
          </button>
        </div>

        {/* Content */}
        {activeTab === 'edit' ? (
          <ReportForm workspaceId={workspaceId} reportId={reportId} initialData={reportData} />
        ) : (
          <div className="space-y-4">
            {executions.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-white/60">No execution history yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {executions.map((execution) => (
                  <div key={execution.id} className="card">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(execution.status)}`}>
                            {execution.status.toUpperCase()}
                          </span>
                          <span className="text-white/60 text-sm">
                            {formatDate(execution.started_at)}
                          </span>
                        </div>
                        {execution.error_message && (
                          <div className="text-red-400 text-sm mt-2">
                            Error: {execution.error_message}
                          </div>
                        )}
                      </div>
                      {execution.completed_at && (
                        <div className="text-white/60 text-sm">
                          Completed: {formatDate(execution.completed_at)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
