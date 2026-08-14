import React from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';

export const ExportCenter: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();

  const handleExportCSV = () => {
    alert(`Initiating verified CSV export for ${activeSchoolName}…`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900">Attendance Export Center</h2>
        <p className="text-xs text-slate-500">Generate formatted and audited attendance data packages</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-emerald-600">
            <FileSpreadsheet className="w-6 h-6" />
            <h3 className="font-bold text-sm text-slate-900">Monthly Schoolwide Attendance CSV</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Exports complete student attendance matrix formatted for state MIS compliance.
          </p>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download CSV Export
          </button>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-indigo-600">
            <FileText className="w-6 h-6" />
            <h3 className="font-bold text-sm text-slate-900">Auditor Summary Report</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Consolidated overview containing roll-level presence, excused leaves, and discrepancy counters.
          </p>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download Summary
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportCenter;
