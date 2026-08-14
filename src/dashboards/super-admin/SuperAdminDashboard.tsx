import React, { useState, useEffect } from 'react';
import { StatCard } from '../../components/shared/StatCard';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';

export const SuperAdminDashboard: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchTelemetry = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ success: boolean; data: any }>('/api/v1/dashboard/super-admin/summary');
      if (res.success && res.data) {
        setSummary(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load platform telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTelemetry();
  }, []);

  if (loading) return <LoadingState message="Connecting to platform telemetry…" />;
  if (error) return <ErrorState message={error} onRetry={fetchTelemetry} />;

  return (
    <div className="space-y-6" id="super-admin-dashboard-view">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="bg-purple-500/30 text-purple-200 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-purple-400/30">
              Platform Administration
            </span>
            <h2 className="text-2xl sm:text-3xl font-black mt-2">Multi-Tenant Platform Hub</h2>
            <p className="text-xs text-purple-200 mt-1">
              Cross-school governance, infrastructure telemetry, and centralized tenant management
            </p>
          </div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            {summary?.systemHealth || 'OPERATIONAL'}
          </span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Tenants"
          value={summary?.totalSchools ?? 0}
          subtitle="Provisioned school tenants"
          icon="🏢"
          variant="purple"
        />
        <StatCard
          title="Total Students"
          value={(summary?.totalStudents ?? 0).toLocaleString()}
          subtitle="Enrolled across platform"
          icon="🎓"
          variant="indigo"
        />
        <StatCard
          title="Teaching Staff"
          value={summary?.totalTeachers ?? 0}
          subtitle="Active faculty memberships"
          icon="👥"
          variant="emerald"
        />
        <StatCard
          title="Attendance Sessions"
          value={(summary?.totalAttendanceSessions ?? 0).toLocaleString()}
          subtitle="Recorded attendance events"
          icon="📝"
          variant="cyan"
        />
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/app/super-admin/schools')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all text-left space-y-2 group"
        >
          <span className="text-2xl group-hover:scale-110 inline-block transition-transform">🏫</span>
          <h3 className="text-sm font-bold text-slate-900">Manage School Tenants</h3>
          <p className="text-xs text-slate-500">Provision new schools, update UDISE codes, and view school directories.</p>
        </button>

        <button
          onClick={() => navigate('/app/super-admin/security')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all text-left space-y-2 group"
        >
          <span className="text-2xl group-hover:scale-110 inline-block transition-transform">🛡️</span>
          <h3 className="text-sm font-bold text-slate-900">Security & Key Health</h3>
          <p className="text-xs text-slate-500">Review RLS policies, token signing rotation, and Redis rate limiters.</p>
        </button>

        <button
          onClick={() => navigate('/app/super-admin/audit')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all text-left space-y-2 group"
        >
          <span className="text-2xl group-hover:scale-110 inline-block transition-transform">📋</span>
          <h3 className="text-sm font-bold text-slate-900">Global Audit Explorer</h3>
          <p className="text-xs text-slate-500">Inspect cross-tenant audit events, staff authentication logs, and mutations.</p>
        </button>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
