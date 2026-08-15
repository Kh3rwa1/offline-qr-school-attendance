import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { StatCard } from '../../components/shared/StatCard';
import { Button } from '../../components/shared/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { Download, Printer, RefreshCw } from 'lucide-react';

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
  firstScannedAt?: string | null;
  source?: string;
}

export const DailyReports: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

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
    firstScannedAt: r.firstScannedAt || null,
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
        `"${r.firstScannedAt ? new Date(r.firstScannedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}"`,
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

  return (
    <div className="space-y-8 text-left" id="daily-reports-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
            Daily Attendance Inspection
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            Official classroom roll register and student punch timestamps for {activeSchoolName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={() => window.print()}
            leftIcon={<Printer className="w-4 h-4" />}
          >
            Print Roll Sheet
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={handleExportCSV}
            disabled={records.length === 0}
            leftIcon={<Download className="w-4 h-4 text-ink-soft" />}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState type="table" message="Loading official daily roll report…" />
      ) : error ? (
        <ErrorState message={(error as any)?.message || 'Failed to load report'} onRetry={() => refetch()} />
      ) : (
        <>
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
                <span className="text-xs font-bold text-ink-soft font-display">Grade & Section:</span>
                <select
                  value={activeClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="px-4 py-2 rounded-full bg-surface-soft border border-line text-xs font-bold text-ink outline-none focus:border-forest-700 transition-all cursor-pointer font-display"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.className} – {c.sectionName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink-soft font-display">Roll Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3.5 py-1.5 rounded-full bg-surface-soft border border-line text-xs font-bold text-ink outline-none focus:border-forest-700 cursor-pointer font-mono"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => refetch()}
              className="p-2 rounded-full bg-surface-soft hover:bg-surface text-ink-soft hover:text-ink transition-all cursor-pointer border border-line"
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
                  <tr className="border-b border-line bg-surface-soft text-[11px] font-extrabold uppercase tracking-wider text-ink-muted font-display">
                    <th className="py-4 px-6">Roll #</th>
                    <th className="py-4 px-6">Student Name</th>
                    <th className="py-4 px-6">Attendance Status</th>
                    <th className="py-4 px-6">First Scan Time</th>
                    <th className="py-4 px-6">Mid-Day Meal</th>
                    <th className="py-4 px-6 text-right">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs">
                  {records.map((student) => (
                    <tr key={student.studentId} className="table-row-hover">
                      <td className="py-4 px-6 font-mono font-bold text-ink">
                        #{student.rollNumber || '—'}
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-extrabold text-ink block font-display">
                          {student.fullName}
                        </span>
                        <span className="text-[11px] text-ink-muted font-mono">
                          ID: {student.studentId.slice(0, 8)}…
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase font-display ${
                          student.status === 'PRESENT'
                            ? 'bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30'
                            : student.status === 'LATE'
                            ? 'bg-warning-50 text-warning-800 border border-warning-100 dark:border-warning-600/30'
                            : 'bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30'
                        }`}>
                          {student.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-ink-muted">
                        {student.firstScannedAt
                          ? new Date(student.firstScannedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold font-display ${
                          student.status !== 'ABSENT' ? 'bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30' : 'bg-surface-soft text-ink-muted border border-line'
                        }`}>
                          {student.status !== 'ABSENT' ? 'Eligible' : 'Not Eligible'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right font-medium text-ink-soft">
                        {student.source || 'Optical QR / RFID'}
                      </td>
                    </tr>
                  ))}

                  {records.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8">
                        <EmptyState
                          kind="generic"
                          title="No attendance records found"
                          description={`No attendance records found for this class section on ${selectedDate}.`}
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DailyReports;
