'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface ScheduledReport {
  id: string;
  name: string;
  description: string;
  report_type: string;
  frequency: string;
  is_active: boolean;
  last_sent_at: string | null;
  next_scheduled_at: string | null;
  recipients: string[];
  created_at: string;
}

export default function ScheduledReportsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchReports();
  }, [workspaceId]);

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/reports/workspaces/${workspaceId}/reports`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setReports(data.data);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to load scheduled reports');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/reports/reports/${reportId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        fetchReports();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Failed to delete report');
      console.error(err);
    }
  };

  const toggleReportStatus = async (reportId: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/reports/reports/${reportId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      const data = await response.json();
      if (data.success) {
        fetchReports();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Failed to update report status');
      console.error(err);
    }
  };

  const triggerReport = async (reportId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/reports/reports/${reportId}/trigger`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        alert('Report triggered successfully!');
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Failed to trigger report');
      console.error(err);
    }
  };

  const formatFrequency = (frequency: string) => {
    return frequency.charAt(0).toUpperCase() + frequency.slice(1);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
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
            <h1 className="text-3xl font-bold text-white mb-2">Scheduled Reports</h1>
            <p className="text-white/60">Manage automated report delivery</p>
          </div>
          <Link
            href={`/workspaces/${workspaceId}/reports/new`}
            className="btn-primary"
          >
            Create Report
          </Link>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {reports.length === 0 ? (
          <div className="card text-center py-16">
            <h3 className="text-xl font-semibold text-white mb-2">No scheduled reports</h3>
            <p className="text-white/60 mb-6">Create your first scheduled report to get started</p>
            <Link
              href={`/workspaces/${workspaceId}/reports/new`}
              className="btn-primary inline-block"
            >
              Create Report
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {reports.map((report) => (
              <div key={report.id} className="card">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-white">{report.name}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        report.is_active
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {report.is_active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    {report.description && (
                      <p className="text-white/60 mb-3">{report.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-white/60">
                      <div>
                        <span className="font-medium">Type:</span> {report.report_type}
                      </div>
                      <div>
                        <span className="font-medium">Frequency:</span> {formatFrequency(report.frequency)}
                      </div>
                      <div>
                        <span className="font-medium">Recipients:</span> {report.recipients.length}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleReportStatus(report.id, report.is_active)}
                      className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors text-sm"
                    >
                      {report.is_active ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      onClick={() => triggerReport(report.id)}
                      className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors text-sm"
                    >
                      Trigger Now
                    </button>
                    <Link
                      href={`/workspaces/${workspaceId}/reports/${report.id}`}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors text-sm"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => deleteReport(report.id)}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="border-t border-white/10 pt-4 mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-white/60">Last Sent:</span>
                    <div className="text-white mt-1">{formatDate(report.last_sent_at)}</div>
                  </div>
                  <div>
                    <span className="text-white/60">Next Scheduled:</span>
                    <div className="text-white mt-1">{formatDate(report.next_scheduled_at)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
