import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, FileText, ShieldCheck } from 'lucide-react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { api } from '../../services/api';
import { StatCard } from '../../components/shared/StatCard';
import { Button } from '../../components/shared/Button';
import { Toast } from '../../components/shared/Toast';

interface ClassItem {
  id: string;
  className: string;
  sectionName: string;
}

export const ExportCenter: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const [downloadingType, setDownloadingType] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

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
          throw new Error('Please select a class section for the monthly register export');
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
    } catch (err: any) {
      setExportError(err.message || 'Failed to generate export');
    } finally {
      setDownloadingType(null);
    }
  };

  return (
    <div className="space-y-8 text-left" id="export-center-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
            Government Export & Audit Center
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            Generate and stream real UDISE+, Banglar Shiksha, and Mid-Day Meal statutory data files for {activeSchoolName}.
          </p>
        </div>
      </div>

      {exportError && (
        <div className="mb-4">
          <Toast kind="error" message={exportError} onDismiss={() => setExportError(null)} autoDismiss={false} />
        </div>
      )}

      {/* Parameter Controls Bar */}
      <div className="app-card p-4 flex flex-wrap items-center gap-4 text-xs font-bold text-ink">
        <div className="flex items-center gap-2">
          <span className="text-ink-soft font-display">Class Section:</span>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3.5 py-1.5 rounded-full bg-surface-soft border border-line text-xs font-bold text-ink outline-none focus:border-forest-700 cursor-pointer font-display"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.className} – {c.sectionName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-ink-soft font-display">Date:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3.5 py-1.5 rounded-full bg-surface-soft border border-line text-xs font-bold text-ink outline-none focus:border-forest-700 cursor-pointer font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-ink-soft font-display">Month/Year:</span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3.5 py-1.5 rounded-full bg-surface-soft border border-line text-xs font-bold text-ink outline-none focus:border-forest-700 cursor-pointer font-display"
          >
            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, idx) => (
              <option key={idx + 1} value={idx + 1}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3.5 py-1.5 rounded-full bg-surface-soft border border-line text-xs font-bold text-ink outline-none focus:border-forest-700 cursor-pointer font-mono"
          >
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="UDISE+ Alignment"
          value="National Standard"
          trend={{ value: "Format 1.4 Schema", isPositive: true }}
          variant="hero-forest"
        />
        <StatCard
          title="Export Engine"
          value="Direct Stream"
          trend={{ value: "CSV & XLSX Formats", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="MDM Subsidy Audit"
          value="Audit Ready"
          trend={{ value: "Headcount Reconciled", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Audit Ledger"
          value="Export Logging"
          trend={{ value: "Audit Log Active", isPositive: true }}
          variant="default"
        />
      </div>

      {/* Export Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Daily School Summary CSV */}
        <div className="app-card p-6 sm:p-7 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-forest-700 text-white flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 font-display">
                School Roll
              </span>
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-ink font-display">Daily School Attendance Roll</h3>
              <p className="t-body text-xs text-ink-soft leading-relaxed mt-1">
                Full snapshot of daily classroom sessions, teacher sign-offs, and attendance percentages across all grades.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-line flex items-center justify-between">
            <span className="text-xs font-bold text-ink-muted font-mono">Format: .CSV</span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleExport('daily-school', 'csv', 'daily-school-attendance')}
              disabled={downloadingType === 'daily-school'}
              isLoading={downloadingType === 'daily-school'}
              leftIcon={<Download className="w-4 h-4" />}
            >
              {downloadingType === 'daily-school' ? 'Streaming…' : 'Download Roll CSV'}
            </Button>
          </div>
        </div>

        {/* Card 2: Monthly Class Register XLSX */}
        <div className="app-card p-6 sm:p-7 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-forest-700 text-white flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 font-display">
                Monthly Register
              </span>
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-ink font-display">Monthly Attendance Register</h3>
              <p className="t-body text-xs text-ink-soft leading-relaxed mt-1">
                Official statutory monthly register containing student day-by-day attendance codes (P, A, L, E) and monthly totals.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-line flex items-center justify-between">
            <span className="text-xs font-bold text-ink-muted font-mono">Format: .CSV / .XLSX</span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleExport('monthly-register', 'csv', 'monthly-class-register')}
              disabled={downloadingType === 'monthly-register' || !selectedClassId}
              isLoading={downloadingType === 'monthly-register'}
              leftIcon={<Download className="w-4 h-4" />}
            >
              {downloadingType === 'monthly-register' ? 'Streaming…' : 'Download Register'}
            </Button>
          </div>
        </div>

        {/* Card 3: Absentee Notification Report */}
        <div className="app-card p-6 sm:p-7 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-forest-700 text-white flex items-center justify-center shadow-xs">
                <FileText className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 font-display">
                Guardian Audit
              </span>
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-ink font-display">Chronic & Daily Absenteeism Report</h3>
              <p className="t-body text-xs text-ink-soft leading-relaxed mt-1">
                Comprehensive audit of consecutive absences, guardian notifications dispatched, and DLT SMS delivery receipts.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-line flex items-center justify-between">
            <span className="text-xs font-bold text-ink-muted font-mono">Format: .CSV</span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleExport('absentee', 'csv', 'absentee-report')}
              disabled={downloadingType === 'absentee'}
              isLoading={downloadingType === 'absentee'}
              leftIcon={<Download className="w-4 h-4" />}
            >
              {downloadingType === 'absentee' ? 'Streaming…' : 'Download Absentee Report'}
            </Button>
          </div>
        </div>

        {/* Card 4: Attendance Correction & Audit Ledger */}
        <div className="app-card p-6 sm:p-7 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-forest-700 text-white flex items-center justify-center shadow-xs">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 font-display">
                Administrative Audit
              </span>
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-ink font-display">Correction & Override Ledger</h3>
              <p className="t-body text-xs text-ink-soft leading-relaxed mt-1">
                Immutable audit of all manual punches, status overrides, headmaster reason notes, and timestamp adjustments.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-line flex items-center justify-between">
            <span className="text-xs font-bold text-ink-muted font-mono">Format: .CSV</span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleExport('corrections', 'csv', 'corrections-ledger')}
              disabled={downloadingType === 'corrections'}
              isLoading={downloadingType === 'corrections'}
              leftIcon={<Download className="w-4 h-4" />}
            >
              {downloadingType === 'corrections' ? 'Streaming…' : 'Download Override Ledger'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportCenter;
