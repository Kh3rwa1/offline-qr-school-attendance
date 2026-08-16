import React, { useState, useEffect } from 'react';
import { StatCard } from '../../components/shared/StatCard';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { Button } from '../../components/shared/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useLanguage } from '../../app/LanguageProvider';
import { getUserSafeError } from '../../errors/userSafeErrors';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Download, 
  FileSpreadsheet, 
  CalendarCheck2, 
  TrendingUp, 
  ArrowRight,
  Info,
  CheckCircle2,
  Users
} from 'lucide-react';

export const ReportViewerDashboard: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const { language, t } = useLanguage();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      const safeErr = getUserSafeError(err, language);
      setError(safeErr.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAnalytics();
  }, [activeSchoolId, language]);

  if (loading) return <LoadingState type="stat-cards" message={language === 'bn' ? 'রিপোর্ট লোড হচ্ছে…' : 'Loading reports & analytics…'} />;
  if (error) return <ErrorState message={error} onRetry={fetchAnalytics} />;

  const hasSessions = (summary?.totalSessionsRecorded ?? 0) > 0;
  const attendanceRate = summary?.overallAttendanceRate ?? 0;
  const totalSessions = summary?.totalSessionsRecorded ?? 0;
  const flaggedAbsences = summary?.flaggedAbsenceCount ?? 0;

  return (
    <div className="space-y-6 sm:space-y-8 text-left max-w-6xl mx-auto" id="report-viewer-dashboard-view">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-3xl border border-line shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success-50 border border-success-100 dark:border-success-600/30 text-[11px] font-bold text-forest-700 dark:text-forest-600 uppercase tracking-wider font-display">
              {t('navReports')}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-soft border border-line text-[11px] font-bold text-ink-muted uppercase tracking-wider font-mono">
              {language === 'bn' ? 'অফিসিয়াল রিপোর্ট' : 'Official Reports'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
            {t('navReports')}
          </h1>
          <p className="t-body text-xs text-ink-soft mt-1">
            {activeSchoolName} • {new Date().toLocaleDateString(language === 'bn' ? 'bn-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/app/reports/exports')}
            leftIcon={<Download className="w-4 h-4" />}
            className="min-h-[44px] rounded-2xl font-display"
          >
            {t('exportStateReport')}
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={() => navigate('/app/reports/daily')}
            leftIcon={<CalendarCheck2 className="w-4 h-4 text-ink-soft" />}
            className="min-h-[44px] rounded-2xl font-display"
          >
            {t('dailyLog')}
          </Button>
        </div>
      </div>

      {/* 4 Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('rollingAttendance')}
          value={hasSessions ? `${attendanceRate}%` : '—'}
          trend={{ 
            value: hasSessions 
              ? (language === 'bn' ? 'গড় উপস্থিতির হার' : 'Average attendance rate') 
              : t('noAttendanceDataYet'), 
            isPositive: attendanceRate >= 75 
          }}
          variant="hero-forest"
          onClick={() => navigate('/app/reports/trends')}
        />
        <StatCard
          title={t('verifiedSessions')}
          value={totalSessions}
          trend={{ 
            value: hasSessions ? t('attendanceRecordedDesc') : t('noAttendanceDataYet'), 
            isPositive: totalSessions > 0 
          }}
          variant="default"
          onClick={() => navigate('/app/reports/daily')}
        />
        <StatCard
          title={t('chronicAbsenceRisk')}
          value={flaggedAbsences}
          trend={{ 
            value: flaggedAbsences === 0 ? t('lowRisk') : (language === 'bn' ? 'অনুপস্থিতির সংখ্যা' : 'Recorded absences'), 
            isPositive: flaggedAbsences === 0 
          }}
          variant="default"
          onClick={() => navigate('/app/reports/trends')}
        />
        <StatCard
          title={t('exportFormats')}
          value="Excel / CSV"
          trend={{ 
            value: language === 'bn' ? 'সরকারি রিপোর্টের জন্য প্রস্তুত' : 'Ready for download', 
            isPositive: true 
          }}
          variant="default"
          onClick={() => navigate('/app/reports/exports')}
        />
      </div>

      {/* Main Content Area */}
      {!hasSessions ? (
        <div className="app-card p-8 text-center bg-surface border border-line rounded-3xl">
          <EmptyState
            kind="generic"
            title={t('noAttendanceDataYet')}
            description={t('reportsWillBeGenerated')}
            actionText={t('dailyLog')}
            onAction={() => navigate('/app/reports/daily')}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Column 1: Attendance Turnout Gauge (6 cols) */}
          <div className="lg:col-span-6 app-card p-6 sm:p-7 flex flex-col justify-between items-center text-center bg-surface border border-line rounded-3xl shadow-xs">
            <div className="w-full flex items-center justify-between">
              <h3 className="text-base font-extrabold text-ink font-display">
                {t('overallCompliance')}
              </h3>
              <span className="text-xs font-bold text-forest-700 dark:text-forest-600 bg-success-50 px-2.5 py-1 rounded-full border border-success-100 dark:border-success-600/30 font-display">
                {totalSessions} {language === 'bn' ? 'টি সেশন' : 'Sessions'}
              </span>
            </div>

            <div className="relative my-6 flex flex-col items-center justify-center">
              <svg className="w-56 h-36" viewBox="0 0 200 110" aria-label={`Attendance Turnout ${attendanceRate}%`}>
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="var(--line)"
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <motion.path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="var(--forest-700)"
                  strokeWidth="18"
                  strokeDasharray="251.2"
                  initial={{ strokeDashoffset: 251.2 }}
                  animate={{ strokeDashoffset: 251.2 - (251.2 * Math.min(100, Math.max(0, attendanceRate))) / 100 }}
                  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute top-14 flex flex-col items-center">
                <span className="text-4xl font-extrabold text-ink font-display tracking-tight font-mono">
                  {attendanceRate}%
                </span>
                <span className="text-xs font-bold text-ink-muted mt-0.5 font-display">
                  {t('attendanceScore')}
                </span>
              </div>
            </div>

            <p className="text-xs text-ink-muted text-center max-w-sm">
              {t('calculatedNotice')}
            </p>
          </div>

          {/* Column 2: Available Reports Quick Actions (6 cols) */}
          <div className="lg:col-span-6 app-card p-6 sm:p-7 flex flex-col justify-between bg-surface border border-line rounded-3xl shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-ink font-display">
                {t('reportModules')}
              </h3>
              <span className="text-xs font-bold text-ink-muted bg-surface-soft px-2.5 py-1 rounded-full border border-line font-display">
                3 {language === 'bn' ? 'টি উপলব্ধ' : 'Available'}
              </span>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => navigate('/app/reports/daily')}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-surface-soft hover:bg-forest-50/60 border border-line hover:border-forest-700/40 transition-all text-left group min-h-[56px] cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-forest-100 text-forest-700 dark:text-forest-600">
                    <CalendarCheck2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-ink font-display">{t('dailyClassInspection')}</h4>
                    <p className="text-[11px] text-ink-muted">{t('dailyClassInspectionDesc')}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-ink-muted group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/app/reports/trends')}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-surface-soft hover:bg-forest-50/60 border border-line hover:border-forest-700/40 transition-all text-left group min-h-[56px] cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-forest-100 text-forest-700 dark:text-forest-600">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-ink font-display">{t('longitudinalTrends')}</h4>
                    <p className="text-[11px] text-ink-muted">{t('longitudinalTrendsDesc')}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-ink-muted group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/app/reports/exports')}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-surface-soft hover:bg-forest-50/60 border border-line hover:border-forest-700/40 transition-all text-left group min-h-[56px] cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-forest-100 text-forest-700 dark:text-forest-600">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-ink font-display">{t('exportCenter')}</h4>
                    <p className="text-[11px] text-ink-muted">{t('exportCenterDesc')}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-ink-muted group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportViewerDashboard;
