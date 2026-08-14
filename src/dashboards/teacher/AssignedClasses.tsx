import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { useNavigate } from 'react-router-dom';

export const AssignedClasses: React.FC = () => {
  const { activeSchoolId } = useActiveSchool();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      if (!activeSchoolId) return;
      setLoading(true);
      try {
        const res = await api<{ success: boolean; data: any[] }>(`/api/v1/schools/${activeSchoolId}/attendance/classes`);
        setClasses(res.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load assigned classes');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [activeSchoolId]);

  if (loading) return <LoadingState message="Loading your assigned classes…" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900">My Assigned Classes</h2>
        <p className="text-xs text-slate-500">Classes designated for your daily attendance sessions</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map((cls) => (
          <div key={cls.classSectionId} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-base">
              🎓
            </span>
            <div>
              <h3 className="font-black text-base text-slate-900">{cls.className} - {cls.sectionName}</h3>
              <p className="text-xs text-slate-500 mt-1">Section Code: {cls.classSectionId.slice(0, 8)}…</p>
            </div>
            <button
              onClick={() => navigate('/app/teacher')}
              className="w-full mt-2 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors"
            >
              Open Attendance Station
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssignedClasses;
