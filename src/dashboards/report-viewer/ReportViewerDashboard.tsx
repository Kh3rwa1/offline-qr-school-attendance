import React, { useState, useEffect } from 'react';
import { StatCard } from '../../components/shared/StatCard';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';

export const ReportViewerDashboard: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchAnalytics = async () => {
    if (!activeSchoolId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ success: boolean; data: any }>('/api/v1/dashboard/report-viewer/summary');
      if (res.success && res.data) {
        setSummary(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load report analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAnalytics();
  }, [activeSchoolId]);

  if (loading) return <LoadingState message="Loading analytics dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={fetchAnalytics} />;

  return (
    <div className="space-y-6" id="report-viewer-dashboard-view">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-cyan-950 via-teal-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="bg-cyan-500/30 text-cyan-200 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-cyan-400/30">
              Read-Only Intelligence Portal
            </span>
            <h2 className="text-2xl sm:text-3xl font-black mt-2">Attendance Reports & Analytics</h2>
            <p className="text-xs text-cyan-200 mt-1">
              Longitudinal school trends, daily class attendance breakdowns, and exportable datasets
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-cyan-500/20 text-cyan-200 rounded-full border border-cyan-400/30">
            AUDITOR ACCESS: READ ONLY
          </span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Attendance Rate"
          value={`${summary?.overallAttendanceRate ?? 95}%`}
          subtitle="Schoolwide rolling average"
          icon="📊"
          variant="cyan"
        />
        <StatCard
          title="Recorded Sessions"
          value={summary?.totalSessionsRecorded ?? 0}
          subtitle="Finalized attendance logs"
          icon="📅"
          variant="indigo"
        />
        <StatCard
          title="High Absence Flags"
          value={summary?.flaggedAbsenceCount ?? 0}
          subtitle="Students with >3 absences"
          icon="⚠️"
          variant="rose"
        />
        <StatCard
          title="Export Formats"
          value="CSV / PDF"
          subtitle="Government reporting ready"
          icon="💾"
          variant="emerald"
        />
      </div>

      {/* Navigation Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/app/reports/daily')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-cyan-300 hover:shadow-md transition-all text-left space-y-2 group"
        >
          <span className="text-2xl group-hover:scale-110 inline-block transition-transform">📅</span>
          <h3 className="text-sm font-bold text-slate-900">Daily Class Reports</h3>
          <p className="text-xs text-slate-500">Inspect class-by-class attendance rosters for any specific calendar date.</p>
        </button>

        <button
          onClick={() => navigate('/app/reports/trends')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-cyan-300 hover:shadow-md transition-all text-left space-y-2 group"
        >
          <span className="text-2xl group-hover:scale-110 inline-block transition-transform">📈</span>
          <h3 className="text-sm font-bold text-slate-900">Longitudinal Trends</h3>
          <p className="text-xs text-slate-500">Examine 7-day and 30-day attendance distributions across sections.</p>
        </button>

        <button
          onClick={() => navigate('/app/reports/exports')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-cyan-300 hover:shadow-md transition-all text-left space-y-2 group"
        >
          <span className="text-2xl group-hover:scale-110 inline-block transition-transform">💾</span>
          <h3 className="text-sm font-bold text-slate-900">Export Center</h3>
          <p className="text-xs text-slate-500">Download formatted CSV reports for external education department audits.</p>
        </button>
      </div>
    </div>
  );
};

export default ReportViewerDashboard;
