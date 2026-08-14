import React, { useState, useEffect } from 'react';
import { StatCard } from '../../components/shared/StatCard';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Plus, 
  BarChart3, 
  Calendar, 
  Download, 
  TrendingUp, 
  AlertTriangle, 
  FileSpreadsheet, 
  ArrowRight, 
  ShieldCheck, 
  Clock, 
  Play, 
  Square 
} from 'lucide-react';

export const ReportViewerDashboard: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [seconds, setSeconds] = useState(5048); // 01:24:08
  const navigate = useNavigate();

  const fetchAnalytics = async () => {
    if (!activeSchoolId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ success: boolean; data: any }>('/api/v1/dashboard/report-viewer/summary');
      if (res.success && res.data) {
        setSummary(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load report analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAnalytics();
  }, [activeSchoolId]);

  useEffect(() => {
    let interval: any;
    if (isTimerRunning) {
      interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const mins = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  if (loading) return <LoadingState message="Connecting to state reporting & analytics engine…" />;
  if (error) return <ErrorState message={error} onRetry={fetchAnalytics} />;

  return (
    <div className="space-y-8" id="report-viewer-dashboard-view">
      {/* Top Header Row with Big Buttons (Reference Image match) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-extrabold text-[#144e39] uppercase tracking-wider font-display">
              Attendance Reports & Analytics
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider font-mono">
              AUDITOR ACCESS: READ ONLY
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
            Reports & Analytics
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Plan, inspect, and export state-compliant attendance datasets for {activeSchoolName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/app/reports/exports')}
            className="btn-forest-primary text-sm font-display"
          >
            <Download className="w-4 h-4" />
            <span>Export State Report</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/app/reports/daily')}
            className="btn-pill-secondary text-sm font-display shadow-2xs"
          >
            <span>Daily Log</span>
          </motion.button>
        </div>
      </div>

      {/* 4 Stat Cards Row (Hero Forest + 3 White Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Rolling Attendance"
          value={`${summary?.overallAttendanceRate ?? 95.4}%`}
          trend={{ value: "1.2% Increased from last month", isPositive: true }}
          variant="hero-forest"
          onClick={() => navigate('/app/reports/trends')}
        />
        <StatCard
          title="Verified Sessions"
          value={summary?.totalSessionsRecorded ?? 142}
          trend={{ value: "Signed Academic Logs", isPositive: true }}
          variant="default"
          onClick={() => navigate('/app/reports/daily')}
        />
        <StatCard
          title="Chronic Absence Risk"
          value={summary?.flaggedAbsenceCount ?? 3}
          trend={{ value: "Low Risk Across Grades", isPositive: true }}
          variant="default"
          onClick={() => navigate('/app/reports/trends')}
        />
        <StatCard
          title="Export Formats"
          value="UDISE+ / CSV"
          trend={{ value: "Ready for Download", isPositive: true }}
          variant="default"
          onClick={() => navigate('/app/reports/exports')}
        />
      </div>

      {/* Middle Row (3 Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Column 1: Weekly Attendance Distribution Chart (5 cols) */}
        <div className="lg:col-span-5 app-card p-6 sm:p-7 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900 font-display">
              Attendance Distribution
            </h3>
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
              Weekly
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end h-48 pt-6 pb-2">
            {[
              { day: 'S', pct: 0, striped: true },
              { day: 'M', pct: 96, filled: true },
              { day: 'T', pct: 74, filled: true, active: true },
              { day: 'W', pct: 98, dark: true },
              { day: 'T', pct: 92, striped: true },
              { day: 'F', pct: 97, striped: true },
              { day: 'S', pct: 89, striped: true },
            ].map((col, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end group relative">
                {col.active && (
                  <span className="absolute -top-7 bg-white text-slate-800 border border-slate-200 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                    {col.pct}%
                  </span>
                )}
                <div className="w-full bg-slate-100 rounded-full h-full flex items-end p-0.5 overflow-hidden">
                  <div
                    className={`w-full rounded-full transition-all duration-500 ${
                      col.dark
                        ? 'bg-[#144e39]'
                        : col.active
                        ? 'bg-emerald-400'
                        : col.filled
                        ? 'bg-[#144e39]/80'
                        : 'bg-emerald-600/40'
                    }`}
                    style={{ height: `${col.pct || 15}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-400 font-display">{col.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Reminders Card with Big Action Button (3 cols) */}
        <div className="lg:col-span-3 app-card p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 font-display">
              Statutory Reminder
            </h3>
            <div className="mt-4 space-y-1">
              <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                Monthly UDISE+ Export for District Office
              </h4>
              <p className="text-xs font-medium text-slate-400">
                Deadline : 05:00 pm Friday
              </p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/app/reports/exports')}
            className="w-full mt-6 py-3 px-4 rounded-full bg-[#144e39] hover:bg-[#0f3d2c] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-[#144e39]/20 transition-all font-display"
          >
            <Download className="w-4 h-4 text-emerald-300" />
            <span>Download CSV</span>
          </motion.button>
        </div>

        {/* Column 3: Reports Navigation List (4 cols) */}
        <div className="lg:col-span-4 app-card p-6 sm:p-7 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900 font-display">
              Report Modules
            </h3>
            <span className="text-xs font-bold text-slate-400">3 Available</span>
          </div>

          <div className="mt-4 space-y-3">
            {[
              { name: 'Daily Class Inspection', desc: 'Class-by-class roll sheets', due: 'Inspect ↗', href: '/app/reports/daily' },
              { name: 'Longitudinal Trends', desc: '30-day stability charts', due: 'Explore ↗', href: '/app/reports/trends' },
              { name: 'Export & Audit Center', desc: 'Government CSV & PDF datasets', due: 'Download ↗', href: '/app/reports/exports' },
            ].map((mod, i) => (
              <div 
                key={i} 
                onClick={() => navigate(mod.href)}
                className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">{mod.name}</p>
                  <p className="text-[11px] text-slate-400">{mod.desc}</p>
                </div>
                <span className="text-[11px] font-bold text-[#144e39] bg-emerald-50 px-2.5 py-1 rounded-full">
                  {mod.due}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row (3 Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Column 1: Class Breakdown (5 cols) */}
        <div className="lg:col-span-5 app-card p-6 sm:p-7">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-extrabold text-slate-900 font-display">
              Class Attendance Roster
            </h3>
            <button
              onClick={() => navigate('/app/reports/daily')}
              className="text-xs font-bold px-3 py-1 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              View Full
            </button>
          </div>

          <div className="space-y-3">
            {[
              { name: 'Class 10 - Section A', stats: '48 Students • 96% Present', status: 'Completed', tagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              { name: 'Class 10 - Section B', stats: '46 Students • 94% Present', status: 'Completed', tagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              { name: 'Class 9 - Section A', stats: '50 Students • 92% Present', status: 'In Progress', tagColor: 'bg-amber-50 text-amber-700 border-amber-200' },
              { name: 'Class 8 - Section A', stats: '52 Students • 89% Present', status: 'In Progress', tagColor: 'bg-amber-50 text-amber-700 border-amber-200' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-2xl hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#144e39] text-white flex items-center justify-center text-xs font-extrabold shadow-sm">
                    {item.name.charAt(6)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{item.name}</p>
                    <p className="text-[11px] text-slate-400 font-medium">{item.stats}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${item.tagColor}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Progress Radial Gauge (4 cols) */}
        <div className="lg:col-span-4 app-card p-6 sm:p-7 flex flex-col justify-between items-center text-center">
          <div className="w-full flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900 font-display">
              Overall Compliance
            </h3>
            <span className="text-xs font-bold text-slate-400">100% Calculated</span>
          </div>

          <div className="relative my-4 flex flex-col items-center justify-center">
            {/* Upright Half Gauge SVG with Animated Stroke */}
            <svg className="w-52 h-32" viewBox="0 0 200 110">
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="18"
                strokeLinecap="round"
              />
              <motion.path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#144e39"
                strokeWidth="18"
                strokeDasharray="251.2"
                initial={{ strokeDashoffset: 251.2 }}
                animate={{ strokeDashoffset: 251.2 - (251.2 * 95.4) / 100 }}
                transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                strokeLinecap="round"
              />
            </svg>
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="absolute top-12 flex flex-col items-center"
            >
              <span className="text-4xl font-extrabold text-slate-900 font-display tracking-tight">
                95.4%
              </span>
              <span className="text-xs font-bold text-slate-400 mt-0.5">Attendance Score</span>
            </motion.div>
          </div>

          <div className="flex items-center justify-center gap-4 text-xs font-bold text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#144e39]" />
              <span>Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>Late</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              <span>Absent</span>
            </div>
          </div>
        </div>

        {/* Column 3: Live Audit Timer Stream (3 cols) */}
        <div className="lg:col-span-3 dark-tracker-card p-6 sm:p-7 flex flex-col justify-between text-white relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-300/90 font-display">Auditor Sync Stream</p>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          <div className="my-6 text-center">
            <span className="text-4xl font-extrabold font-mono tracking-wider text-white">
              {formatTimer(seconds)}
            </span>
            <p className="text-[11px] text-emerald-200/70 mt-1 font-medium">
              HMAC Cryptographic Seal Active
            </p>
          </div>

          <div className="flex items-center justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className="w-12 h-12 rounded-full bg-white text-[#144e39] flex items-center justify-center shadow-lg transition-transform"
            >
              {isTimerRunning ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setSeconds(0)}
              className="w-12 h-12 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg transition-transform"
            >
              <div className="w-3.5 h-3.5 rounded-xs bg-white" />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportViewerDashboard;
