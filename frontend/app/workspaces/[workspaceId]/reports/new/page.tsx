'use client';

import { useParams } from 'next/navigation';
import ReportForm from '@/components/reports/ReportForm';

export default function NewReportPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  return (
    <div className="min-h-screen bg-gray-dark pt-20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Create Scheduled Report</h1>
          <p className="text-white/60">Set up automated report delivery for your workspace</p>
        </div>

        <ReportForm workspaceId={workspaceId} />
      </div>
    </div>
  );
}
