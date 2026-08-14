import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';

export const AcademicManagement: React.FC = () => {
  const { activeSchoolId } = useActiveSchool();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClasses = async () => {
    if (!activeSchoolId) return;
    setLoading(true);
    try {
      const res = await api<{ success: boolean; data: any[] }>(`/api/v1/schools/${activeSchoolId}/attendance/classes`);
      setClasses(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load academic classes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchClasses();
  }, [activeSchoolId]);

  if (loading) return <LoadingState message="Loading academic classes…" />;
  if (error) return <ErrorState message={error} onRetry={fetchClasses} />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900">Academic Classes & Sections</h2>
        <p className="text-xs text-slate-500">Active class sections configured for offline attendance tracking</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map((cls) => (
          <div key={cls.classSectionId} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm">
                📚
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                Active
              </span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">{cls.className} - {cls.sectionName}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Section Identifier: <span className="font-mono text-[10px]">{cls.classSectionId.slice(0, 8)}…</span></p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AcademicManagement;
