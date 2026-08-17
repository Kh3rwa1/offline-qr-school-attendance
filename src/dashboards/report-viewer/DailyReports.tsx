import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useLanguage } from '../../app/LanguageProvider';
import { getUserSafeError } from '../../errors/userSafeErrors';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { Button } from '../../components/shared/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { Download, Printer, RefreshCw, CalendarCheck2, Users, Utensils } from 'lucide-react';

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
}

export const DailyReports: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const { language, t } = useLanguage();
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
  }));

  const presentCount = records.filter((s) => s.status === 'PRESENT').length;
  const lateCount = records.filter((s) => s.status === 'LATE').length;
  const absentCount = records.filter((s) => s.status === 'ABSENT').length;
  const totalCount = records.length;
  const attendanceRate = totalCount > 0 ? Math.round(((presentCount + lateCount) / totalCount) * 100) : 0;

  const handleExportCSV = () => {
    const csvContent = [
      ['Roll Number', 'Student Name', 'Status', 'Recorded Time'].join(','),
      ...records.map((r) => [
        `"${r.rollNumber || ''}"`,
        `"${r.fullName}"`,
        `"${r.status}"`,
        `"${r.firstScannedAt ? new Date(r.firstScannedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}"`,
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return (
          <span className="px-3 py-1 rounded-full text-sm font-bold bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 font-display">
            {t('statusPresent')}
          </span>
        );
      case 'LATE':
        return (
          <span className="px-3 py-1 rounded-full text-sm font-bold bg-amber-50 text-amber-800 border border-amber-200 font-display">
            {t('statusLate')}
          </span>
        );
      case 'ABSENT':
        return (
          <span className="px-3 py-1 rounded-full text-sm font-bold bg-danger-50 text-danger-800 border border-danger-200 font-display">
            {t('statusAbsent')}
          </span>
        );
      case 'LEAVE':
      case 'EXCUSED':
        return (
          <span className="px-3 py-1 rounded-full text-sm font-bold bg-surface-soft text-ink-soft border border-line font-display">
            {t('statusOnLeave')}
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-sm font-bold bg-surface-soft text-ink-muted border border-line font-display">
            {t('statusNotMarkedYet')}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 text-left max-w-6xl mx-auto" id="daily-reports-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-3xl border border-line shadow-xs">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
            {t('navDailyLog')}
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            {t('dailyRegisterSubtitle', { schoolName: activeSchoolName })}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.print()}
            leftIcon={<Printer className="w-4 h-4" />}
            className="min-h-[44px] rounded-2xl font-display text-sm font-bold"
          >
            {t('printSheet')}
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={handleExportCSV}
            disabled={records.length === 0}
            leftIcon={<Download className="w-4 h-4" />}
            className="min-h-[44px] rounded-2xl font-display text-sm font-bold"
          >
            {t('exportCsv')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState type="table" message={t('loadingDailyReport')} />
      ) : error ? (
        <ErrorState message={getUserSafeError(error, language).message} onRetry={() => refetch()} />
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
              <div className="flex items-center justify-between text-ink-muted">
                <span className="text-sm font-bold uppercase font-display">{t('turnoutRate')}</span>
                <CalendarCheck2 className="w-4 h-4 text-forest-700 dark:text-forest-600" />
              </div>
              <div className="text-3xl font-extrabold text-forest-700 dark:text-forest-600 font-display font-mono">
                {attendanceRate}%
              </div>
              <p className="text-sm text-ink-soft font-display">
                {presentCount + lateCount} / {totalCount} {t('statusPresent')}
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
              <div className="flex items-center justify-between text-ink-muted">
                <span className="text-sm font-bold uppercase font-display">{t('statusAbsent')}</span>
                <Users className="w-4 h-4 text-danger-700" />
              </div>
              <div className="text-3xl font-extrabold text-danger-800 font-display font-mono">
                {absentCount}
              </div>
              <p className="text-sm text-ink-soft font-display">
                {absentCount} {t('absentStudentsUnit')}
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
              <div className="flex items-center justify-between text-ink-muted">
                <span className="text-sm font-bold uppercase font-display">{t('midDayMeal')}</span>
                <Utensils className="w-4 h-4 text-forest-700 dark:text-forest-600" />
              </div>
              <div className="text-3xl font-extrabold text-ink font-display font-mono">
                {presentCount + lateCount}
              </div>
              <p className="text-sm text-ink-soft font-display">
                {presentCount + lateCount} {t('eligibleMeals')}
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="app-card p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label htmlFor="daily-class-select" className="text-sm font-bold text-ink-soft font-display cursor-pointer">
                  {t('classLabel')}
                </label>
                <select
                  id="daily-class-select"
                  aria-label={t('classLabel')}
                  value={activeClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-bold text-ink outline-none focus:border-forest-700 cursor-pointer font-display min-h-[44px]"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.className} – {c.sectionName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-ink-soft font-display">
                  {t('dateLabel')}
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-bold text-ink outline-none focus:border-forest-700 cursor-pointer font-mono min-h-[44px]"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => refetch()}
              className="p-2.5 rounded-2xl bg-surface-soft hover:bg-surface text-ink-soft hover:text-ink cursor-pointer border border-line min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Student Roll List */}
          <div className="app-card overflow-hidden">
            {records.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  kind="generic"
                  title={t('noAttendanceFoundTitle')}
                  description={t('noAttendanceFoundDesc', { date: selectedDate })}
                />
              </div>
            ) : (
              <div className="divide-y divide-line">
                {records.map((r) => (
                  <div
                    key={r.studentId}
                    className="p-4 sm:p-5 flex items-center justify-between gap-4 bg-surface hover:bg-surface-soft transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-surface-soft text-ink flex items-center justify-center font-extrabold text-sm font-display shrink-0">
                        #{r.rollNumber}
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold text-ink font-display">{r.fullName}</h4>
                        {r.firstScannedAt && (
                          <p className="text-sm text-ink-muted font-mono">
                            {new Date(r.firstScannedAt).toLocaleTimeString(language === 'bn' ? 'bn-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {getStatusBadge(r.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DailyReports;
