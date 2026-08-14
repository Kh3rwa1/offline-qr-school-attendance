import React, { useState, useEffect } from 'react';
import { StatCard } from '../../components/shared/StatCard';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Plus, 
  Building2, 
  Users, 
  Radio, 
  CheckCircle2, 
  Calendar, 
  ArrowRight,
  Download,
  Bell,
  Sparkles,
  School
} from 'lucide-react';

export const SuperAdminDashboard: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState<number>(2); // Default to Tuesday
  const navigate = useNavigate();

  const fetchTelemetry = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ success: boolean; data: any }>('/api/v1/dashboard/super-admin/summary');
      if (res.success && res.data) {
        setSummary(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load district attendance summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTelemetry();
  }, []);

  const weeklyData = [
    { day: 'Mon', fullDay: 'Monday', pct: 96.2, present: 4050, total: 4210 },
    { day: 'Tue', fullDay: 'Tuesday', pct: 94.8, present: 3991, total: 4210 },
    { day: 'Wed', fullDay: 'Wednesday', pct: 97.4, present: 4100, total: 4210, isHighest: true },
    { day: 'Thu', fullDay: 'Thursday', pct: 93.5, present: 3936, total: 4210 },
    { day: 'Fri', fullDay: 'Friday', pct: 95.8, present: 4033, total: 4210 },
    { day: 'Sat', fullDay: 'Saturday', pct: 91.2, present: 3839, total: 4210 },
    { day: 'Today', fullDay: 'Today (Live)', pct: 95.0, present: 4000, total: 4210, isCurrent: true },
  ];

  if (loading) return <LoadingState message="Connecting to state education attendance portal…" />;
  if (error) return <ErrorState message={error} onRetry={fetchTelemetry} />;

  return (
    <div className="space-y-8" id="super-admin-dashboard-view">
      {/* Top Header Row with Big Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-extrabold text-[#144e39] uppercase tracking-wider mb-2 font-display">
            <span>Multi-Tenant Platform Hub</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
            District Education Overview
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Monitor daily student attendance, Mid-Day Meals, and school check-in stations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/app/super-admin/schools')}
            className="btn-forest-primary text-sm font-display"
          >
            <Plus className="w-4 h-4" />
            <span>Register New School</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/app/reports/exports')}
            className="btn-pill-secondary text-sm font-display shadow-2xs"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export District CSV</span>
          </motion.button>
        </div>
      </div>

      {/* 4 Stat Cards Row (Hero Forest + 3 White Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Overall Attendance Today"
          value="94.8%"
          trend={{ value: "3,991 of 4,210 Students Present", isPositive: true }}
          variant="hero-forest"
          onClick={() => navigate('/app/reports/trends')}
        />
        <StatCard
          title="Affiliated Schools"
          value={summary?.totalSchools ?? 14}
          trend={{ value: "All 14 Schools Reporting", isPositive: true }}
          variant="default"
          onClick={() => navigate('/app/super-admin/schools')}
        />
        <StatCard
          title="Mid-Day Meals Count"
          value="3,840"
          trend={{ value: "Headcount Approved for Today", isPositive: true }}
          variant="default"
          onClick={() => navigate('/app/reports/daily')}
        />
        <StatCard
          title="Parent SMS Sent"
          value="219"
          trend={{ value: "Absence & Late Alerts Delivered", isPositive: true }}
          variant="default"
          onClick={() => navigate('/app/school-admin/notifications')}
        />
      </div>

      {/* Middle Row (3 Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Column 1: Weekly State Attendance Trend (5 cols) */}
        <div className="lg:col-span-5 app-card p-6 sm:p-7 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 font-display">
                Weekly Attendance Trend
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Average daily turnout across all 14 schools</p>
            </div>
            <span className="text-xs font-bold text-[#144e39] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              This Week
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2.5 sm:gap-3 items-end h-52 pt-8 pb-2">
            {weeklyData.map((col, idx) => (
              <div 
                key={idx} 
                onClick={() => setActiveDayIndex(idx)}
                className="flex flex-col items-center gap-2 h-full justify-end group relative cursor-pointer"
              >
                {activeDayIndex === idx && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -top-10 bg-slate-900 text-white text-[11px] font-bold px-2 py-1 rounded-lg shadow-md whitespace-nowrap z-20 flex flex-col items-center pointer-events-none"
                  >
                    <span>{col.pct}%</span>
                    <span className="text-[9px] text-emerald-300 font-normal">{col.present} present</span>
                    <div className="w-2 h-2 bg-slate-900 rotate-45 -mb-1 mt-0.5" />
                  </motion.div>
                )}

                <div className={`w-full rounded-2xl h-full flex items-end p-1 transition-all duration-300 ${
                  activeDayIndex === idx ? 'bg-emerald-100/70 ring-2 ring-[#144e39]/30' : 'bg-slate-100 hover:bg-slate-200/70'
                }`}>
                  <div
                    className={`w-full rounded-xl transition-all duration-500 ${
                      activeDayIndex === idx
                        ? 'bg-[#144e39] shadow-sm'
                        : col.isHighest
                        ? 'bg-emerald-600'
                        : 'bg-[#144e39]/70'
                    }`}
                    style={{ height: `${col.pct}%` }}
                  />
                </div>
                <span className={`text-xs font-bold font-display transition-colors ${
                  activeDayIndex === idx ? 'text-[#144e39] font-extrabold' : 'text-slate-500'
                }`}>
                  {col.day}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Daily Reminders & Notices (3 cols) */}
        <div className="lg:col-span-3 app-card p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 font-display">
                Daily School Notice
              </h3>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>

            <div className="mt-4 p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200/60 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#144e39]">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mid-Day Meal Verification</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Headmaster certification completed for 3,840 student meals. Ready for block portal sync.
              </p>
            </div>

            <div className="mt-3 text-xs text-slate-500 flex justify-between font-medium">
              <span>Next Routine Sync:</span>
              <span className="font-bold text-slate-800">04:30 PM Today</span>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/app/reports/exports')}
            className="w-full mt-6 py-3.5 px-4 rounded-full bg-[#144e39] hover:bg-[#0f3d2c] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-[#144e39]/20 transition-all font-display"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>Generate Daily Summary</span>
          </motion.button>
        </div>

        {/* Column 3: Schools Directory Quick List (4 cols) */}
        <div className="lg:col-span-4 app-card p-6 sm:p-7 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900 font-display">
              Schools Summary
            </h3>
            <button
              onClick={() => navigate('/app/super-admin/schools')}
              className="text-xs font-bold px-3 py-1 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              View All 14
            </button>
          </div>

          <div className="mt-4 space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {(!summary?.schools || summary.schools.length === 0) ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No schools provisioned yet. Click Register New School to begin.
              </div>
            ) : (
              summary.schools.slice(0, 5).map((school: any, i: number) => (
                <div key={school.id || i} className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-50 transition-colors border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#144e39] text-white flex items-center justify-center text-xs font-extrabold shadow-xs">
                      {school.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{school.name}</p>
                      <p className="text-[11px] text-slate-400 font-medium">{school.district || 'District N/A'} • {school.udiseCode ? `UDISE: ${school.udiseCode}` : 'Unassigned'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${school.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                      {school.status || 'ACTIVE'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row (3 Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Column 1: District Attendance Breakdown (5 cols) */}
        <div className="lg:col-span-5 app-card p-6 sm:p-7">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 font-display">
                District Schools Distribution
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">District-wise registered institutions</p>
            </div>
            <button
              onClick={() => navigate('/app/super-admin/schools')}
              className="text-xs font-bold px-3 py-1 rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Details
            </button>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {(() => {
              const districtCounts: Record<string, number> = {};
              (summary?.schools || []).forEach((s: any) => {
                const dist = s.district || 'Unassigned District';
                districtCounts[dist] = (districtCounts[dist] || 0) + 1;
              });
              const entries = Object.entries(districtCounts);
              if (entries.length === 0) {
                return <p className="text-xs text-slate-400 py-4 text-center">No district records available</p>;
              }
              return entries.map(([district, count], i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-slate-100">
                  <div>
                    <p className="text-xs font-bold text-slate-900">{district}</p>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">{count} {count === 1 ? 'School' : 'Schools'} Registered</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200">
                      Active District
                    </span>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Column 2: Progress Radial Gauge (4 cols) */}
        <div className="lg:col-span-4 app-card p-6 sm:p-7 flex flex-col justify-between items-center text-center">
          <div className="w-full flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900 font-display">
              State Attendance Target
            </h3>
            <span className="text-xs font-bold text-[#144e39] bg-emerald-50 px-2.5 py-0.5 rounded-full">
              95% Target
            </span>
          </div>

          {/* Correct Upright Semi-Circle Gauge with Smooth Animated Stroke */}
          <div className="relative my-4 flex flex-col items-center justify-center">
            <svg className="w-52 h-32" viewBox="0 0 200 110">
              {/* Background Track (Top Arc from Left to Right) */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="18"
                strokeLinecap="round"
              />
              {/* Foreground Value (Top Arc) with micro-animation */}
              <motion.path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#144e39"
                strokeWidth="18"
                strokeDasharray="251.2"
                initial={{ strokeDashoffset: 251.2 }}
                animate={{ strokeDashoffset: 251.2 - (251.2 * 94.8) / 100 }}
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
                94.8%
              </span>
              <span className="text-xs font-bold text-slate-400 mt-0.5">District Average</span>
            </motion.div>
          </div>

          <div className="flex items-center justify-center gap-4 text-xs font-bold text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#144e39]" />
              <span>Present: 3,991</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>Late: 141</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <span>Absent: 78</span>
            </div>
          </div>
        </div>

        {/* Column 3: Live Gate Entry Telemetry (3 cols) */}
        <div className="lg:col-span-3 dark-tracker-card p-6 sm:p-7 flex flex-col justify-between text-white relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-emerald-300 font-display">Live School Gates</p>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-300 font-bold uppercase">Online</span>
              </div>
            </div>

            <div className="my-6 text-center">
              <span className="text-4xl font-extrabold font-display tracking-tight text-white block">
                4,120
              </span>
              <p className="text-xs text-emerald-200/80 mt-1 font-medium">
                Total Check-in Taps Today
              </p>
            </div>
          </div>

          <div className="space-y-2.5 bg-emerald-950/60 p-3.5 rounded-2xl border border-emerald-500/20 text-xs">
            <div className="flex justify-between text-emerald-200/90 font-medium">
              <span>Main Gate Scanner</span>
              <span className="font-bold text-white">2,850 Taps</span>
            </div>
            <div className="flex justify-between text-emerald-200/90 font-medium">
              <span>Classroom QR Wands</span>
              <span className="font-bold text-white">1,270 Scans</span>
            </div>
            <div className="flex justify-between text-emerald-300 font-bold pt-1 border-t border-emerald-500/20">
              <span>Avg. Scan Time</span>
              <span className="font-mono text-emerald-300">0.8 sec</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
