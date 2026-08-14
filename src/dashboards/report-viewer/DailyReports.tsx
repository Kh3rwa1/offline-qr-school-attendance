import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';

export const DailyReports: React.FC = () => {
  const { activeSchoolId } = useActiveSchool();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      if (!activeSchoolId) return;
      try {
        const res = await api<{ success: boolean; data: any[] }>(`/api/v1/schools/${activeSchoolId}/attendance/classes`);
        setClasses(res.data || []);
        if (res.data?.[0]?.classSectionId) {
          setSelectedClassId(res.data[0].classSectionId);
        }
      } catch {}
    }
    void load();
  }, [activeSchoolId]);

  useEffect(() => {
    async function loadRep() {
      if (!activeSchoolId || !selectedClassId) return;
      setLoading(true);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const rep = await api<any>(`/api/v1/schools/${activeSchoolId}/reports/daily-class?classSectionId=${selectedClassId}&date=${today}`);
        setReport(rep);
      } catch {
        setReport(null);
      } finally {
        setLoading(false);
      }
    }
    void loadRep();
  }, [activeSchoolId, selectedClassId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">Daily Class Report</h2>
          <p className="text-xs text-slate-500">Read-only student roster and attendance status breakdown</p>
        </div>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-800"
        >
          {classes.map((c) => (
            <option key={c.classSectionId} value={c.classSectionId}>
              {c.className} - {c.sectionName}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingState message="Loading class report data…" />
      ) : report ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <pre className="text-xs font-mono bg-slate-50 p-4 rounded-xl overflow-x-auto text-slate-800">
            {JSON.stringify(report, null, 2)}
          </pre>
        </div>
      ) : (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
          Select a class to inspect attendance records.
        </div>
      )}
    </div>
  );
};

export default DailyReports;
