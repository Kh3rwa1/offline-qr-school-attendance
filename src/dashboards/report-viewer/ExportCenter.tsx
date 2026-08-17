import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Info } from 'lucide-react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useLanguage } from '../../app/LanguageProvider';
import { getUserSafeError } from '../../errors/userSafeErrors';
import { api } from '../../services/api';
import { Button } from '../../components/shared/Button';
import { Toast } from '../../components/shared/Toast';

interface ClassItem {
  id: string;
  className: string;
  sectionName: string;
}

export const ExportCenter: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const { language, t } = useLanguage();
  const [downloadingType, setDownloadingType] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Selected parameters
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
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

  const classes = classesData || [];

  const handleExport = async (type: string, format: 'csv' | 'xlsx', fallbackFilename: string) => {
    if (!activeSchoolId) return;
    setDownloadingType(type);
    setExportError(null);

    try {
      const params = new URLSearchParams({
        type,
        format,
      });

      if (type === 'daily-school') {
        params.append('date', selectedDate);
      } else if (type === 'monthly-register') {
        if (!selectedClassId) {
          throw new Error(t('selectClassExportError'));
        }
        params.append('classSectionId', selectedClassId);
        params.append('year', String(selectedYear));
        params.append('month', String(selectedMonth));
      } else if (type === 'absentee') {
        params.append('startDate', selectedDate);
        if (selectedClassId) {
          params.append('classSectionId', selectedClassId);
        }
      }

      const response = await fetch(
        `/api/v1/schools/${activeSchoolId}/reports/export?${params.toString()}`,
        {
          headers: {
            Accept: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || `Export failed with status ${response.status}`);
      }

      let filename = `${fallbackFilename}-${new Date().toISOString().split('T')[0]}.${format}`;
      const disposition = response.headers.get('content-disposition');
      if (disposition) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccessToast(t('fileDownloadedSuccess'));
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      const safe = getUserSafeError(err, language);
      setExportError(safe.message);
    } finally {
      setDownloadingType(null);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-6 sm:space-y-8 text-left max-w-6xl mx-auto" id="export-center-view">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50">
          <Toast kind="success" message={successToast} onDismiss={() => setSuccessToast(null)} />
        </div>
      )}

      {exportError && (
        <div className="mb-4">
          <Toast kind="error" message={exportError} onDismiss={() => setExportError(null)} autoDismiss={false} />
        </div>
      )}

      {/* Header */}
      <div className="bg-surface p-6 rounded-3xl border border-line shadow-xs">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
          {t('exportCenterTitle')}
        </h1>
        <p className="t-body text-sm text-ink-soft mt-1">
          {t('exportCenterSubtitle', { schoolName: activeSchoolName })}
        </p>
      </div>

      {/* Parameter Controls Bar */}
      <div className="app-card p-4 sm:p-5 flex flex-wrap items-center gap-4 text-sm font-bold text-ink">
        <div className="flex items-center gap-2">
          <label htmlFor="export-class-select" className="text-ink-soft font-display cursor-pointer">{t('classLabel')}</label>
          <select
            id="export-class-select"
            aria-label={t('classLabel')}
            value={selectedClassId}
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
          <label htmlFor="export-date-input" className="text-ink-soft font-display cursor-pointer">{t('dateLabel')}</label>
          <input
            id="export-date-input"
            aria-label={t('dateLabel')}
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-bold text-ink outline-none focus:border-forest-700 cursor-pointer font-mono min-h-[44px]"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="export-month-select" className="text-ink-soft font-display cursor-pointer">{t('monthYearLabel')}</label>
          <select
            id="export-month-select"
            aria-label={t('monthYearLabel')}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-bold text-ink outline-none focus:border-forest-700 cursor-pointer font-display min-h-[44px]"
          >
            {monthNames.map((m, idx) => (
              <option key={idx + 1} value={idx + 1}>{m}</option>
            ))}
          </select>
          <select
            id="export-year-select"
            aria-label="Year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-bold text-ink outline-none focus:border-forest-700 cursor-pointer font-mono min-h-[44px]"
          >
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>
        </div>
      </div>

      {/* UDISE+ Government Explainer Card */}
      <div className="p-4 rounded-2xl bg-surface-soft border border-line flex items-start gap-3 text-sm text-ink-soft">
        <Info className="w-5 h-5 text-forest-700 dark:text-forest-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          {t('monthlyRegisterDesc')}
        </p>
      </div>

      {/* Export Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Card 1: Monthly Class Register XLSX */}
        <div className="app-card p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-forest-700 text-white flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-sm font-bold bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 font-display">
                Excel (.xlsx)
              </span>
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-ink font-display">
                {t('monthlyRegisterTitle')}
              </h3>
              <p className="t-body text-sm text-ink-soft leading-relaxed mt-1">
                {t('monthlyRegisterDesc')}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-line flex items-center justify-end">
            <Button
              variant="primary"
              size="md"
              onClick={() => handleExport('monthly-register', 'xlsx', 'monthly-attendance-register')}
              disabled={downloadingType === 'monthly-register'}
              isLoading={downloadingType === 'monthly-register'}
              leftIcon={<Download className="w-4 h-4" />}
              className="min-h-[44px] rounded-2xl font-display text-sm font-bold"
            >
              {t('downloadExcel')}
            </Button>
          </div>
        </div>

        {/* Card 2: Daily School Summary CSV */}
        <div className="app-card p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-forest-700 text-white flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-sm font-bold bg-surface-soft text-ink-soft border border-line font-display">
                CSV (.csv)
              </span>
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-ink font-display">
                {t('dailySummaryExportTitle')}
              </h3>
              <p className="t-body text-sm text-ink-soft leading-relaxed mt-1">
                {t('dailySummaryExportDesc')}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-line flex items-center justify-end">
            <Button
              variant="secondary"
              size="md"
              onClick={() => handleExport('daily-school', 'csv', 'daily-school-attendance')}
              disabled={downloadingType === 'daily-school'}
              isLoading={downloadingType === 'daily-school'}
              leftIcon={<Download className="w-4 h-4" />}
              className="min-h-[44px] rounded-2xl font-display text-sm font-bold"
            >
              {t('downloadCsv')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportCenter;
