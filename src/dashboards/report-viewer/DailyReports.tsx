import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { StatCard } from '../../components/shared/StatCard';
import { motion } from 'motion/react';
import { Calendar, Download, Printer, Filter, Users, CheckCircle2, QrCode, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ClassItem {
  id: string;
  className: string;
  sectionName: string;
}

interface StudentRollRecord {
  studentId: string;
  fullName: string;
  rollNumber: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  firstScanTime?: string;
  source?: string;
}

export const DailyReports: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const navigate = useNavigate();

  // Query: Classes
  const { data: classesData } = useQuery({
    queryKey: ['schools', activeSchoolId, 'class-sections'],
    queryFn: async () => {
      if (!activeSchoolId) return [];
      const res = await api<{ classSections: ClassItem[] }>(`/api/v1/schools/${activeSchoolId}/class-sections`);
      const list = res.classSections || [];
      if (list.length > 0 && !selectedClassId) {
        setSelectedClassId(list[0].id);
      }
      return list;
    },
    enabled: Boolean(activeSchoolId),
  });

  const activeClassId = selectedClassId || classesData?.[0]?.id || '';

  // Query: Daily Class Report
  const { data: reportData, isLoading, error, refetch } = useQuery({
    queryKey: ['schools', activeSchoolId, 'reports', 'daily-class', activeClassId, selectedDate],
    queryFn: async () => {
      if (!activeSchoolId || !activeClassId) return null;
      const res = await api<any>(
        `/api/v1/schools/${activeSchoolId}/reports/daily-class?classSectionId=${activeClassId}&date=${selectedDate}`
      );
      return res;
    },
    enabled: Boolean(activeSchoolId && activeClassId),
  });

  const classes = classesData || [];
  const rawRecords = reportData?.roster || reportData?.records || [];
  const records: StudentRollRecord[] = rawRecords.map((r: any) => ({
    studentId: r.studentId,
    fullName: r.studentName || r.fullName || 'Student',
    rollNumber: r.rollNumber !== undefined && r.rollNumber !== null ? String(r.rollNumber) : '—',
    status: r.status || 'UNMARKED',
    firstScanTime: r.firstScannedAt ? new Date(r.firstScannedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—',
    source: r.firstScannedAt ? 'QR / Barcode' : 'Standard Roll',
  }));

  const presentCount = records.filter((s) => s.status === 'PRESENT').length;
  const lateCount = records.filter((s) => s.status === 'LATE').length;
  const absentCount = records.filter((s) => s.status === 'ABSENT').length;
  const totalCount = records.length;
  const attendanceRate = totalCount > 0 ? Math.round(((presentCount + lateCount) / totalCount) * 100) : 0;

  const handleExportCSV = () => {
    const csvContent = [
      ['Roll Number', 'Student Name', 'Status', 'First Scan Time', 'Capture Method'].join(','),
      ...records.map((r) => [
        `"${r.rollNumber || ''}"`,
        `"${r.fullName}"`,
        `"${r.status}"`,
        `"${r.firstScanTime || '—'}"`,
        `"${r.source || 'Standard Roll'}"`,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daily-roll-${activeClassId}-${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <LoadingState message="Loading official daily roll report…" />;
  if (error) return <ErrorState message={(error as any)?.message || 'Failed to load report'} onRetry={() => refetch()} />;

  return (
    <div className="space-y-8" id="daily-reports-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
            Daily Attendance Inspection
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Official classroom roll register and student punch timestamps for {activeSchoolName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => window.print()}
            className="btn-forest-primary text-sm font-display cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Roll Sheet</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExportCSV}
            disabled={records.length === 0}
            className="btn-pill-secondary text-sm font-display shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export CSV</span>
          </motion.button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Attendance Rate"
          value={`${attendanceRate}%`}
          trend={{ value: `${presentCount + lateCount} / ${totalCount} Enrolled`, isPositive: attendanceRate >= 90 }}
          variant="hero-forest"
        />
        <StatCard
          title="Present & Verified"
          value={`${presentCount} Students`}
          trend={{ value: `${lateCount} Marked Late`, isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Unexcused Absentees"
          value={`${absentCount} Students`}
          trend={{ value: "SMS Notifications Sent", isPositive: false }}
          variant="default"
        />
        <StatCard
          title="Mid-Day Meal Count"
          value={`${presentCount + lateCount} Meals`}
          trend={{ value: "Eligible Students Present", isPositive: true }}
          variant="default"
        />
      </div>

      {/* Filter and Date Bar */}
      <div className="app-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 font-display">Grade & Section:</span>
            <select
              value={activeClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:border-[#144e39] transition-all cursor-pointer"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.className} – {c.sectionName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 font-display">Roll Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:border-[#144e39] cursor-pointer"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          className="p-2 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
          title="Refresh roll data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Student Roll Table */}
      <div className="app-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 font-display">
                <th className="py-4 px-6">Roll #</th>
                <th className="py-4 px-6">Student Name</th>
                <th className="py-4 px-6">Attendance Status</th>
                <th className="py-4 px-6">First Scan Time</th>
                <th className="py-4 px-6">Mid-Day Meal</th>
                <th className="py-4 px-6 text-right">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {records.map((student) => (
                <tr key={student.studentId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-6 font-mono font-bold text-slate-900">
                    #{student.rollNumber || '—'}
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-extrabold text-slate-900 block font-display">
                      {student.fullName}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      ID: {student.studentId.slice(0, 8)}…
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase font-display ${
                      student.status === 'PRESENT'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : student.status === 'LATE'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {student.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-mono text-slate-600">
                    {student.firstScanTime
                      ? new Date(student.firstScanTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      student.status !== 'ABSENT' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {student.status !== 'ABSENT' ? 'Eligible' : 'Not Eligible'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right font-medium text-slate-500">
                    {student.source || 'Optical QR / RFID'}
                  </td>
                </tr>
              ))}

              {records.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    No attendance records found for this class section on {selectedDate}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DailyReports;
