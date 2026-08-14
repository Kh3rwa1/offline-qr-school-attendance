import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { EmptyState } from '../../components/shared/EmptyState';

export const SchoolsOverview: React.FC = () => {
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchools = async () => {
    setLoading(true);
    try {
      const res = await api<{ success: boolean; data: any }>('/api/v1/dashboard/super-admin/summary');
      if (res.data?.schools) {
        setSchools(res.data.schools);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load school directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSchools();
  }, []);

  if (loading) return <LoadingState message="Loading registered school tenants…" />;
  if (error) return <ErrorState message={error} onRetry={fetchSchools} />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900">Registered School Tenants</h2>
          <p className="text-xs text-slate-500">Multi-tenant school directory with UDISE mapping and operational status</p>
        </div>
      </div>

      {schools.length === 0 ? (
        <EmptyState title="No school tenants found" description="No schools have been provisioned on this instance yet." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                <tr>
                  <th className="px-4 py-3">School Name</th>
                  <th className="px-4 py-3">UDISE Code</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Provisioned Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {schools.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900">{s.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{s.udiseCode || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {s.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolsOverview;
