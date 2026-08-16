import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useLanguage } from '../../app/LanguageProvider';
import { api } from '../../services/api';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { Button } from '../../components/shared/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { Download, TrendingUp, Users } from 'lucide-react';
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
  const { t } = useLanguage();
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
  const totalRecordedSessions = trends.reduce((acc, tItem) => acc + tItem.totalStudents, 0);
  const totalPresentStudents = trends.reduce((acc, tItem) => acc + tItem.presentStudents, 0);
  const overallAvg = totalRecordedSessions > 0
    ? Math.round((totalPresentStudents / totalRecordedSessions) * 1000) / 10
    : 0;

  return (
    <div className="space-y-6 sm:space-y-8 text-left max-w-6xl mx-auto" id="trend-reports-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-3xl border border-line shadow-xs">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
            {t('navMonthlyTrends')}
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            {t('trendReportsSubtitle', { schoolName: activeSchoolName })}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-surface-soft p-1 rounded-2xl border border-line">
            <button
              type="button"
              onClick={() => setTrendRange(7)}
              className={`px-4 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer font-display min-h-[44px] ${
                trendRange === 7 ? 'bg-forest-700 text-white shadow-2xs' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {t('last7Days')}
            </button>
            <button
              type="button"
              onClick={() => setTrendRange(30)}
              className={`px-4 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer font-display min-h-[44px] ${
                trendRange === 30 ? 'bg-forest-700 text-white shadow-2xs' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {t('last30Days')}
            </button>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/app/reports/exports')}
            leftIcon={<Download className="w-4 h-4" />}
            className="min-h-[44px] rounded-2xl font-display text-sm font-bold"
          >
            {t('navDownloadReports')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState type="stat-cards" message={t('loadingTrendReports')} />
      ) : error ? (
        <ErrorState message={(error as any)?.message || 'Failed to load trends'} onRetry={() => refetch()} />
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-6 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
              <div className="flex items-center justify-between text-ink-muted">
                <span className="text-sm font-bold uppercase font-display">
                  {t('averageTurnout')}
                </span>
                <TrendingUp className="w-5 h-5 text-forest-700 dark:text-forest-600" />
              </div>
              <div className="text-4xl font-extrabold text-forest-700 dark:text-forest-600 font-display font-mono">
                {overallAvg}%
              </div>
              <p className="text-sm text-ink-soft font-display">
                {t('calculatedAcrossDays', { days: trendRange })}
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
              <div className="flex items-center justify-between text-ink-muted">
                <span className="text-sm font-bold uppercase font-display">
                  {t('todaysAbsentees')}
                </span>
                <Users className="w-5 h-5 text-danger-700" />
              </div>
              <div className="text-4xl font-extrabold text-danger-800 font-display font-mono">
                {absentees.length}
              </div>
              <p className="text-sm text-ink-soft font-display">
                {absentees.length} {t('studentsAbsentTodayUnit')}
              </p>
            </div>
          </div>

          {/* Daily Turnout Bars */}
          <div className="app-card p-6">
            <h3 className="text-base font-extrabold text-ink font-display mb-4">
              {t('dailyTurnoutBreakdown')}
            </h3>

            {trends.length === 0 ? (
              <div className="py-8">
                <EmptyState
                  kind="generic"
                  title={t('noTrendDataTitle')}
                  description={t('noTrendDataDesc')}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {trends.map((tItem) => (
                  <div key={tItem.date} className="space-y-1">
                    <div className="flex items-center justify-between text-sm font-bold font-display">
                      <span>{tItem.day} ({tItem.date})</span>
                      <span className="text-forest-700 dark:text-forest-600">{tItem.percentage}% ({tItem.presentStudents} / {tItem.totalStudents})</span>
                    </div>
                    <div className="w-full bg-surface-soft h-3.5 rounded-full overflow-hidden border border-line">
                      <div
                        className="bg-forest-700 h-full rounded-full transition-all duration-500"
                        style={{ width: `${tItem.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TrendReports;
