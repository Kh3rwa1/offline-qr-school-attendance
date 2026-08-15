import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { api } from '../../services/api';
import { StatCard } from '../../components/shared/StatCard';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { Button } from '../../components/shared/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { AlertTriangle, Download, RefreshCw } from 'lucide-react';
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

  return (
    <div className="space-y-8 text-left" id="trend-reports-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
            Longitudinal Attendance Trends
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            Multi-day attendance stability, historical turnout patterns, and daily absentee breakdown for {activeSchoolName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-surface-soft p-1 rounded-full border border-line">
            <button
              type="button"
              onClick={() => setTrendRange(7)}
              className={`px-3.5 py-1 text-xs font-bold rounded-full transition-all cursor-pointer font-display ${
                trendRange === 7 ? 'bg-surface text-ink shadow-2xs' : 'text-ink-soft hover:text-ink'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setTrendRange(30)}
              className={`px-3.5 py-1 text-xs font-bold rounded-full transition-all cursor-pointer font-display ${
                trendRange === 30 ? 'bg-surface text-ink shadow-2xs' : 'text-ink-soft hover:text-ink'
              }`}
            >
              30 Days
            </button>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/app/reports/exports')}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export Trend CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState type="stat-cards" message="Calculating multi-day attendance trends…" />
      ) : error ? (
        <ErrorState message={(error as any)?.message || 'Failed to load trend analytics'} onRetry={() => refetch()} />
      ) : (
        <>
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
                  <h3 className="text-base font-extrabold text-ink font-display">
                    Daily Attendance Trend ({trendRange} Days)
                  </h3>
                  <p className="t-body text-xs text-ink-soft mt-0.5">Historical presence percentages calculated from live database records</p>
                </div>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="p-2 rounded-full bg-surface-soft hover:bg-surface text-ink-soft hover:text-ink cursor-pointer border border-line"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 pt-2">
                {trends.map((row) => (
                  <div key={row.date} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-ink font-display">
                        {row.date} ({row.day}) — <span className="text-ink-soft font-normal">{row.presentStudents} present of {row.totalStudents}</span>
                      </span>
                      <span className="text-ink font-display font-mono">{row.percentage}%</span>
                    </div>
                    <div className="h-3 w-full bg-surface-soft rounded-full overflow-hidden p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          row.percentage >= 90 ? 'bg-forest-700' : row.percentage >= 75 ? 'bg-forest-600' : 'bg-warning-600'
                        }`}
                        style={{ width: `${Math.max(row.percentage, 2)}%` }}
                      />
                    </div>
                  </div>
                ))}

                {trends.length === 0 && (
                  <p className="py-8 text-center text-xs text-ink-soft">No attendance sessions recorded in the last {trendRange} days.</p>
                )}
              </div>
            </div>

            {/* Today's Absentees Queue (5 cols) */}
            <div className="lg:col-span-5 app-card p-6 sm:p-7 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-ink font-display">
                    Today's Flagged Absentees
                  </h3>
                  <span className="text-xs font-bold text-danger-800 bg-danger-50 px-2.5 py-0.5 rounded-full border border-danger-100 dark:border-danger-600/30 font-display">
                    {absentees.length} Unmarked / Absent
                  </span>
                </div>
                <p className="t-body text-xs text-ink-soft mt-0.5">Students with absence recorded today</p>

                <div className="space-y-2 mt-4 max-h-80 overflow-y-auto pr-1 divide-y divide-line">
                  {absentees.slice(0, 8).map((st: any, idx: number) => (
                    <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-ink font-display">{st.studentName}</p>
                        <p className="text-[11px] text-ink-muted font-mono">
                          {st.className} - {st.sectionName} • Roll #{st.rollNumber || '—'}
                        </p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30 font-display">
                        ABSENT
                      </span>
                    </div>
                  ))}

                  {absentees.length === 0 && (
                    <div className="py-8 text-center text-xs text-ink-soft">
                      No absentees reported for today's sessions.
                    </div>
                  )}
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/app/reports/daily')}
                className="w-full justify-center"
              >
                View Full Daily Roll
              </Button>
            </div>
          </div>

          {/* Chronic Absenteeism Early Warning Radar */}
          <div className="app-card p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning-600" />
                <div>
                  <h3 className="text-base font-extrabold text-ink font-display">Absenteeism Early Warning Radar</h3>
                  <p className="t-body text-xs text-ink-soft">Students recorded absent in today's sessions</p>
                </div>
              </div>
              <span className="text-xs font-bold text-warning-800 bg-warning-50 border border-warning-100 dark:border-warning-600/30 px-3 py-1 rounded-full font-display">
                {absentees.length} Students Flagged
              </span>
            </div>

            <div className="divide-y divide-line border border-line rounded-2xl overflow-hidden bg-surface">
              {absentees.slice(0, 5).map((st: any, i: number) => (
                <div key={i} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-soft transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-warning-50 text-warning-800 flex items-center justify-center font-bold text-xs font-display">
                      {st.rollNumber || '#'}
                    </div>
                    <div>
                      <p className="font-bold text-ink text-sm font-display">{st.studentName}</p>
                      <p className="text-xs text-ink-muted">{st.className} – {st.sectionName} • Code: {st.studentCode}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-danger-800 bg-danger-50 border border-danger-100 dark:border-danger-600/30 px-2.5 py-1 rounded-full font-display">
                      ABSENT TODAY
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => navigate('/app/school-admin/notifications')}
                    >
                      View SMS Alerts
                    </Button>
                  </div>
                </div>
              ))}

              {absentees.length === 0 && (
                <div className="p-8 text-center text-xs text-ink-soft">
                  No students flagged for chronic absenteeism today.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TrendReports;
