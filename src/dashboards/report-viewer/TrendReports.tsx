import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { api } from '../../services/api';
import { StatCard } from '../../components/shared/StatCard';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { motion } from 'motion/react';
import { TrendingUp, AlertTriangle, Calendar, Download, Users, ArrowUpRight, BarChart3, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TrendDayItem {
  date: string;
  day: string;
  totalStudents: number;
  presentStudents: number;
  absentStudents: number;
  percentage: number;
}

export const TrendReports: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const navigate = useNavigate();
  const [trendRange, setTrendRange] = useState<7 | 30>(7);

  // Query: Multi-Day Trends
  const { data: trendData, isLoading, error, refetch } = useQuery({
    queryKey: ['schools', activeSchoolId, 'reports', 'trends', trendRange],
    queryFn: async () => {
      if (!activeSchoolId) return null;
      const res = await api<{ success: boolean; days: number; trends: TrendDayItem[] }>(
        `/api/v1/schools/${activeSchoolId}/reports/trends?days=${trendRange}`
      );
      return res.trends || [];
    },
    enabled: Boolean(activeSchoolId),
  });

  // Query: Absentee List
  const { data: absenteeData } = useQuery({
    queryKey: ['schools', activeSchoolId, 'reports', 'absentees'],
    queryFn: async () => {
      if (!activeSchoolId) return { absentees: [] };
      const res = await api<{ absentees: any[] }>(
        `/api/v1/schools/${activeSchoolId}/reports/absentee?startDate=${new Date().toISOString().slice(0, 10)}`
      );
      return res;
    },
    enabled: Boolean(activeSchoolId),
  });

  const trends: TrendDayItem[] = trendData || [];
  const absentees = absenteeData?.absentees || [];

  // Compute stats
  const totalRecordedSessions = trends.reduce((acc, t) => acc + t.totalStudents, 0);
  const totalPresentStudents = trends.reduce((acc, t) => acc + t.presentStudents, 0);
  const overallAvg = totalRecordedSessions > 0
    ? Math.round((totalPresentStudents / totalRecordedSessions) * 1000) / 10
    : 0;

  let bestDay = '—';
  let bestDayPct = 0;
  trends.forEach((t) => {
    if (t.percentage > bestDayPct) {
      bestDayPct = t.percentage;
      bestDay = `${t.day} (${t.percentage}%)`;
    }
  });

  if (isLoading) return <LoadingState message="Calculating multi-day attendance trends…" />;
  if (error) return <ErrorState message={(error as any)?.message || 'Failed to load trend analytics'} onRetry={() => refetch()} />;

  return (
    <div className="space-y-8" id="trend-reports-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
            Longitudinal Attendance Trends
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Multi-day attendance stability, historical turnout patterns, and daily absentee breakdown for {activeSchoolName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-full border border-slate-200">
            <button
              type="button"
              onClick={() => setTrendRange(7)}
              className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                trendRange === 7 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setTrendRange(30)}
              className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                trendRange === 30 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              30 Days
            </button>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/app/reports/exports')}
            className="btn-forest-primary text-sm font-display cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Reports</span>
          </motion.button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title={`${trendRange}-Day Average`}
          value={`${overallAvg}%`}
          trend={{ value: `${totalPresentStudents} / ${totalRecordedSessions} Attendances`, isPositive: overallAvg >= 75 }}
          variant="hero-forest"
        />
        <StatCard
          title="Best Turnout Day"
          value={bestDay}
          trend={{ value: "Peak Student Turnout", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Today's Absentees"
          value={`${absentees.length} Students`}
          trend={{ value: "Recorded in today's sessions", isPositive: absentees.length === 0 }}
          variant="default"
        />
        <StatCard
          title="Trend Evaluation"
          value={overallAvg >= 90 ? "Stable" : overallAvg >= 75 ? "Moderate" : "Low Turnout"}
          trend={{ value: "Historical Trend Evaluation", isPositive: overallAvg >= 75 }}
          variant="default"
        />
      </div>

      {/* Trend Chart and Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trend Bar Matrix (7 cols) */}
        <div className="lg:col-span-7 app-card p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 font-display">
                Daily Attendance Trend ({trendRange} Days)
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Historical presence percentages calculated from live database records</p>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="p-1.5 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 pt-2">
            {trends.map((row) => (
              <div key={row.date} className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-800 font-display">
                    {row.date} ({row.day}) — <span className="text-slate-500 font-normal">{row.presentStudents} present of {row.totalStudents}</span>
                  </span>
                  <span className="text-slate-900 font-display">{row.percentage}%</span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      row.percentage >= 90 ? 'bg-[#144e39]' : row.percentage >= 75 ? 'bg-emerald-600' : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.max(row.percentage, 2)}%` }}
                  />
                </div>
              </div>
            ))}

            {trends.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-400">No attendance sessions recorded in the last {trendRange} days.</p>
            )}
          </div>
        </div>

        {/* Today's Absentees Queue (5 cols) */}
        <div className="lg:col-span-5 app-card p-6 sm:p-7 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 font-display">
                Today's Flagged Absentees
              </h3>
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                {absentees.length} Unmarked / Absent
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Students with absence recorded today</p>

            <div className="space-y-2 mt-4 max-h-80 overflow-y-auto pr-1 divide-y divide-slate-100">
              {absentees.slice(0, 8).map((st: any, idx: number) => (
                <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{st.studentName}</p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {st.className} - {st.sectionName} • Roll #{st.rollNumber || '—'}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    ABSENT
                  </span>
                </div>
              ))}

              {absentees.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400">
                  No absentees reported for today's sessions.
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/app/reports/daily')}
            className="w-full py-2.5 rounded-full border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 font-display transition-colors cursor-pointer"
          >
            View Full Daily Roll
          </button>
        </div>
      </div>

      {/* Chronic Absenteeism Early Warning Radar */}
      <div className="app-card p-6 sm:p-7 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="text-base font-extrabold text-slate-900 font-display">Absenteeism Early Warning Radar</h3>
              <p className="text-xs text-slate-400 font-medium">Students recorded absent in today's sessions</p>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
            {absentees.length} Students Flagged
          </span>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
          {absentees.slice(0, 5).map((st: any, i: number) => (
            <div key={i} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-xs">
                  {st.rollNumber || '#'}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{st.studentName}</p>
                  <p className="text-xs text-slate-400">{st.className} – {st.sectionName} • Code: {st.studentCode}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                  ABSENT TODAY
                </span>
                <button
                  onClick={() => navigate('/app/school-admin/notifications')}
                  className="px-3 py-1.5 rounded-full bg-[#144e39] text-white text-xs font-bold font-display hover:bg-[#0f3d2c] transition-all cursor-pointer"
                >
                  View SMS Alerts
                </button>
              </div>
            </div>
          ))}

          {absentees.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-400">
              No students flagged for chronic absenteeism today.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrendReports;
