import React, { useState, useEffect } from 'react';
import { HeadmasterDashboard } from '../HeadmasterDashboard';
import { Language, Student } from '../../types';

export interface SchoolAdminDashboardProps {
  students: Student[];
  language?: Language;
  onReissueQr: (studentId: string) => void;
  onRevokeQr: (studentId: string) => void;
  schoolId?: string;
}

export const SchoolAdminDashboard: React.FC<SchoolAdminDashboardProps> = ({
  students,
  language = 'en',
  onReissueQr,
  onRevokeQr,
  schoolId,
}) => {
  const [summary, setSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch('/api/v1/dashboard/school-admin/summary');
        if (res.ok) {
          const json = await res.json();
          setSummary(json.data);
        }
      } catch {
        // Fallback to local students array
      } finally {
        setLoadingSummary(false);
      }
    };
    fetchSummary();
  }, [schoolId]);

  return (
    <div className="space-y-6" id="school-admin-dashboard">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="bg-blue-500/30 text-blue-200 text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border border-blue-400/30">
              School Administration Console
            </span>
            <h2 className="text-2xl font-black mt-2">Headmaster & School Admin Hub</h2>
            <p className="text-blue-200 text-xs mt-1">
              Student enrolment, academic sessions, teacher permissions, and credential security
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-blue-800/60 border border-blue-400/30 px-4 py-2 rounded-xl text-center">
              <p className="text-xs text-blue-200 font-bold">Today's Attendance</p>
              <p className="text-2xl font-black text-emerald-300">
                {summary?.todayAttendancePercentage ?? 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Students</p>
          <p className="text-3xl font-black text-slate-900 mt-2">
            {summary?.totalStudents ?? students.length}
          </p>
          <p className="text-xs text-slate-400 mt-1">Enrolled in active year</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Class Sections</p>
          <p className="text-3xl font-black text-blue-600 mt-2">{summary?.totalClasses ?? 8}</p>
          <p className="text-xs text-slate-400 mt-1">Active class rosters</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active RFID Readers</p>
          <p className="text-3xl font-black text-amber-600 mt-2">{summary?.totalReaders ?? 0}</p>
          <p className="text-xs text-slate-400 mt-1">Hardware gateways online</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Notifications</p>
          <p className="text-3xl font-black text-purple-600 mt-2">{summary?.pendingSmsNotifications ?? 0}</p>
          <p className="text-xs text-slate-400 mt-1">SMS queue jobs</p>
        </div>
      </div>

      {/* Main Administrative Tabs Component */}
      <HeadmasterDashboard
        students={students}
        language={language}
        onReissueQr={onReissueQr}
        onRevokeQr={onRevokeQr}
      />
    </div>
  );
};
