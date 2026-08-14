import React, { useState } from 'react';
import { ReportsModal } from '../ReportsModal';
import { Student, Language } from '../../types';

export interface ReportViewerDashboardProps {
  students: Student[];
  language?: Language;
}

export const ReportViewerDashboard: React.FC<ReportViewerDashboardProps> = ({
  students,
  language = 'en',
}) => {
  return (
    <div className="space-y-6" id="report-viewer-dashboard">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-cyan-950 via-teal-900 to-slate-900 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="bg-cyan-500/30 text-cyan-200 text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border border-cyan-400/30">
              Read-Only Analytics & Intelligence
            </span>
            <h2 className="text-2xl font-black mt-2">Executive Attendance & Audit Center</h2>
            <p className="text-cyan-200 text-xs mt-1">
              Longitudinal attendance trends, high absence intervention flags, and exportable audit reports
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 text-xs font-bold rounded-lg border border-cyan-400/30">
              🔒 Read-Only Auditor View
            </span>
          </div>
        </div>
      </div>

      {/* Main Reporting Component */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <ReportsModal students={students} language={language} />
      </div>
    </div>
  );
};
