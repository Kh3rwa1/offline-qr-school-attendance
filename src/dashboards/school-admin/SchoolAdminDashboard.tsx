import React, { useState, useEffect } from 'react';
import { StatCard } from '../../components/shared/StatCard';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';

export const SchoolAdminDashboard: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchSummary = async () => {
    if (!activeSchoolId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ success: boolean; data: any }>('/api/v1/dashboard/school-admin/summary');
      if (res.success && res.data) {
        setSummary(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load school administration summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSummary();
  }, [activeSchoolId]);

  if (loading) return <LoadingState message="Loading school operations summary…" />;
  if (error) return <ErrorState message={error} onRetry={fetchSummary} />;

  return (
    <div className="space-y-6" id="school-admin-dashboard-view">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="bg-blue-500/30 text-blue-200 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-blue-400/30">
              School Administration
            </span>
            <h2 className="text-2xl sm:text-3xl font-black mt-2">{activeSchoolName}</h2>
            <p className="text-xs text-blue-200 mt-1">
              Roster management, teacher permissions, academic classes, and credential lifecycle
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-2.5 rounded-2xl text-center">
            <p className="text-[10px] text-blue-200 font-bold uppercase tracking-wider">Today's Attendance</p>
            <p className="text-2xl font-black text-emerald-300 mt-0.5">
              {summary?.todayAttendancePercentage ?? 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Enrolled Students"
          value={(summary?.totalStudents ?? 0).toLocaleString()}
          subtitle="Active student records"
          icon="🎓"
          variant="indigo"
        />
        <StatCard
          title="Class Sections"
          value={summary?.totalClasses ?? 0}
          subtitle="Registered class rosters"
          icon="📚"
          variant="emerald"
        />
        <StatCard
          title="RFID Gateways"
          value={summary?.totalReaders ?? 0}
          subtitle="Active gate readers"
          icon="📡"
          variant="amber"
        />
        <StatCard
          title="Pending Notifications"
          value={summary?.pendingSmsNotifications ?? 0}
          subtitle="Queued guardian SMS"
          icon="💬"
          variant="purple"
        />
      </div>

      {/* Navigation Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/app/school-admin/users')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all text-left space-y-2 group"
        >
          <span className="text-2xl group-hover:scale-110 inline-block transition-transform">👥</span>
          <h3 className="text-sm font-bold text-slate-900">User & Staff Management</h3>
          <p className="text-xs text-slate-500">Manage teachers, assign class sections, and revoke device authorizations.</p>
        </button>

        <button
          onClick={() => navigate('/app/school-admin/academics')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all text-left space-y-2 group"
        >
          <span className="text-2xl group-hover:scale-110 inline-block transition-transform">📚</span>
          <h3 className="text-sm font-bold text-slate-900">Academic Classes & Sections</h3>
          <p className="text-xs text-slate-500">Create new class sections, manage academic years, and view student lists.</p>
        </button>

        <button
          onClick={() => navigate('/app/school-admin/attendance')}
          className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all text-left space-y-2 group"
        >
          <span className="text-2xl group-hover:scale-110 inline-block transition-transform">📝</span>
          <h3 className="text-sm font-bold text-slate-900">Attendance Session Oversight</h3>
          <p className="text-xs text-slate-500">Review open daily sessions, verify teacher submissions, and review overrides.</p>
        </button>
      </div>
    </div>
  );
};

export default SchoolAdminDashboard;
