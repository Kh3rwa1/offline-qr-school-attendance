import React, { useState, useEffect } from 'react';

export interface SuperAdminDashboardProps {
  onSelectSchool?: (schoolId: string) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onSelectSchool }) => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/dashboard/super-admin/summary');
      if (!res.ok) throw new Error('Failed to load super admin summary');
      const json = await res.json();
      setSummary(json.data);
    } catch (err: any) {
      setError(err.message || 'Error loading platform overview');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center" id="super-admin-loading">
        <div className="animate-spin text-3xl mb-2">⚙️</div>
        <p className="text-sm font-semibold text-slate-600">Loading platform multi-tenant telemetry...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700" id="super-admin-error">
        <h3 className="font-bold text-base mb-1">Super Admin Dashboard Error</h3>
        <p className="text-xs mb-3">{error}</p>
        <button onClick={fetchSummary} className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-semibold">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="super-admin-dashboard">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex justify-between items-center">
          <div>
            <span className="bg-purple-500/30 text-purple-200 text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border border-purple-400/30">
              Global Multi-Tenant Hub
            </span>
            <h2 className="text-2xl font-black mt-2">Platform Administration Workspace</h2>
            <p className="text-purple-200 text-xs mt-1">Cross-school management, tenant provisioning, and global system health</p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/40">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {summary?.systemHealth || 'OPERATIONAL'}
            </span>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Provisioned Schools</p>
          <p className="text-3xl font-black text-slate-900 mt-2">{summary?.totalSchools ?? 0}</p>
          <p className="text-xs text-slate-400 mt-1">Active multi-tenant instances</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Enrolled Students</p>
          <p className="text-3xl font-black text-indigo-600 mt-2">{(summary?.totalStudents ?? 0).toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">Across all registered tenants</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Registered Teachers</p>
          <p className="text-3xl font-black text-emerald-600 mt-2">{summary?.totalTeachers ?? 0}</p>
          <p className="text-xs text-slate-400 mt-1">Active staff memberships</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attendance Sessions</p>
          <p className="text-3xl font-black text-purple-600 mt-2">{(summary?.totalAttendanceSessions ?? 0).toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">Total recorded sessions</p>
        </div>
      </div>

      {/* School Directory */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="text-sm font-bold text-slate-800">Managed School Tenants</h3>
          <span className="text-xs font-semibold text-slate-500">{summary?.schools?.length || 0} Tenants</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-100 uppercase text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">School Name</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Provisioned Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {summary?.schools?.map((school: any) => (
                <tr key={school.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-900">{school.name}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{school.code}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {school.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {school.createdAt ? new Date(school.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {onSelectSchool && (
                      <button
                        onClick={() => onSelectSchool(school.id)}
                        className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition-colors"
                        id={`enter-tenant-btn-${school.id}`}
                      >
                        Enter Tenant →
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
