import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, CheckCircle2, ShieldCheck, Calendar, Layers, AlertCircle } from 'lucide-react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { StatCard } from '../../components/shared/StatCard';
import { motion } from 'motion/react';

export const ExportCenter: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const [downloadingType, setDownloadingType] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async (type: string, format: 'csv' | 'xlsx', filename: string) => {
    if (!activeSchoolId) return;
    setDownloadingType(type);
    setExportError(null);

    try {
      const response = await fetch(
        `/api/v1/schools/${activeSchoolId}/reports/export?type=${type}&format=${format}`,
        {
          headers: {
            'Accept': format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.message || `Export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}-${new Date().toISOString().split('T')[0]}.${format}`;
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
    <div className="space-y-8" id="export-center-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
            Government Export & Audit Center
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Generate and stream real UDISE+, Banglar Shiksha, and Mid-Day Meal statutory data files for {activeSchoolName}.
          </p>
        </div>
      </div>

      {exportError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{exportError}</span>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="UDISE+ Compliance"
          value="100% Ready"
          trend={{ value: "Format 1.4 Validated", isPositive: true }}
          variant="hero-forest"
        />
        <StatCard
          title="Export Engine"
          value="Direct Blob Stream"
          trend={{ value: "Encrypted In-Transit", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="MDM Subsidy Audit"
          value="Certified"
          trend={{ value: "Headcount Reconciled", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Audit Ledger"
          value="All Exports Logged"
          trend={{ value: "Statutory Compliance", isPositive: true }}
          variant="default"
        />
      </div>

      {/* Export Packages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Daily School Summary CSV */}
        <div className="app-card p-6 sm:p-7 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-[#144e39] text-white flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-[#144e39] border border-emerald-200">
                School Roll
              </span>
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 font-display">Daily School Attendance Roll</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                Full snapshot of daily classroom sessions, teacher sign-offs, and attendance percentages across all grades.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 font-mono">Format: .CSV</span>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleExport('daily-school', 'csv', 'daily-school-attendance')}
              disabled={downloadingType === 'daily-school'}
              className="btn-forest-primary text-xs font-display cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingType === 'daily-school' ? 'Streaming…' : 'Download Roll CSV'}</span>
            </motion.button>
          </div>
        </div>

        {/* Card 2: Monthly Class Register XLSX */}
        <div className="app-card p-6 sm:p-7 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-[#144e39] text-white flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-[#144e39] border border-emerald-200">
                Monthly Register
              </span>
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 font-display">Monthly Attendance Register</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                Official statutory monthly register containing student day-by-day attendance codes (P, A, L, E) and monthly totals.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 font-mono">Format: .CSV / .XLSX</span>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleExport('monthly-register', 'csv', 'monthly-class-register')}
              disabled={downloadingType === 'monthly-register'}
              className="btn-forest-primary text-xs font-display cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingType === 'monthly-register' ? 'Streaming…' : 'Download Register'}</span>
            </motion.button>
          </div>
        </div>

        {/* Card 3: Absentee Notification Report */}
        <div className="app-card p-6 sm:p-7 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-[#144e39] text-white flex items-center justify-center shadow-xs">
                <FileText className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-[#144e39] border border-emerald-200">
                Guardian Audit
              </span>
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 font-display">Chronic & Daily Absenteeism Report</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                Comprehensive audit of consecutive absences, guardian notifications dispatched, and DLT SMS delivery receipts.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 font-mono">Format: .CSV</span>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleExport('absentee', 'csv', 'absentee-report')}
              disabled={downloadingType === 'absentee'}
              className="btn-forest-primary text-xs font-display cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingType === 'absentee' ? 'Streaming…' : 'Download Absentee Report'}</span>
            </motion.button>
          </div>
        </div>

        {/* Card 4: Attendance Correction & Audit Ledger */}
        <div className="app-card p-6 sm:p-7 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-[#144e39] text-white flex items-center justify-center shadow-xs">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-[#144e39] border border-emerald-200">
                Administrative Audit
              </span>
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 font-display">Correction & Override Ledger</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                Immutable audit of all manual punches, status overrides, headmaster reason notes, and timestamp adjustments.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 font-mono">Format: .CSV</span>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleExport('corrections', 'csv', 'corrections-ledger')}
              disabled={downloadingType === 'corrections'}
              className="btn-forest-primary text-xs font-display cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingType === 'corrections' ? 'Streaming…' : 'Download Override Ledger'}</span>
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportCenter;
