import React, { useState, useEffect } from 'react';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { Button } from '../../components/shared/Button';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useLanguage } from '../../app/LanguageProvider';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  GraduationCap, 
  FileSpreadsheet, 
  QrCode,
  CalendarCheck2,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export const SchoolAdminDashboard: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const { language, t } = useLanguage();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchSummary = async () => {
    if (!activeSchoolId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ success: boolean; data: any }>('/api/v1/dashboard/school-admin/summary');
      if (res.success && res.data) {
        setSummary(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load school administration summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSummary();
  }, [activeSchoolId]);

  if (loading) return <LoadingState type="stat-cards" message={language === 'bn' ? 'বিদ্যালয়ের তথ্য লোড হচ্ছে…' : 'Loading school operations…'} />;
  if (error) return <ErrorState message={error} onRetry={fetchSummary} />;

  const presentCount = summary?.presentCount ?? 0;
  const totalStudents = summary?.totalStudents ?? 0;
  const attendancePct = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  return (
    <div className="space-y-6 sm:space-y-8 text-left max-w-6xl mx-auto" id="school-admin-dashboard-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-3xl border border-line shadow-xs">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
            {t('navOverview')}
          </h1>
          <p className="t-body text-xs text-ink-soft mt-1">
            {activeSchoolName} • {new Date().toLocaleDateString(language === 'bn' ? 'bn-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/app/teacher')}
            leftIcon={<QrCode className="w-4 h-4" />}
            className="min-h-[44px] rounded-2xl font-display"
          >
            {t('startAttendance')}
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={() => navigate('/app/reports/exports')}
            leftIcon={<FileSpreadsheet className="w-4 h-4 text-ink-soft" />}
            className="min-h-[44px] rounded-2xl font-display"
          >
            {t('navDownloadReports')}
          </Button>
        </div>
      </div>

      {/* 3 Clean Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-6 rounded-3xl bg-success-50/70 border border-success-100 dark:border-success-600/30 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-forest-700 dark:text-forest-600">
            <span className="text-xs font-bold uppercase tracking-wider font-display">
              {t('cameIn')}
            </span>
            <CalendarCheck2 className="w-5 h-5" />
          </div>
          <div className="text-4xl font-extrabold text-forest-700 dark:text-forest-600 font-display font-mono">
            {presentCount} / {totalStudents}
          </div>
          <p className="text-xs text-forest-700/80 font-medium font-display">
            {language === 'bn' ? `মোট উপস্থিতির ${attendancePct}%` : `${attendancePct}% Present Today`}
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-bold uppercase tracking-wider font-display">
              {t('navStudents')}
            </span>
            <Users className="w-5 h-5 text-forest-700 dark:text-forest-600" />
          </div>
          <div className="text-4xl font-extrabold text-ink font-display font-mono">
            {totalStudents}
          </div>
          <p className="text-xs text-ink-soft font-display">
            {language === 'bn' ? 'নথিভুক্ত মোট শিক্ষার্থী' : 'Enrolled Students'}
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-bold uppercase tracking-wider font-display">
              {t('navClassesAndSections')}
            </span>
            <GraduationCap className="w-5 h-5 text-forest-700 dark:text-forest-600" />
          </div>
          <div className="text-4xl font-extrabold text-ink font-display font-mono">
            {summary?.classCount ?? 0}
          </div>
          <p className="text-xs text-ink-soft font-display">
            {language === 'bn' ? 'সক্রিয় ক্লাসরুম শাখা' : 'Active Class Sections'}
          </p>
        </div>
      </div>

      {/* Navigation Quick Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => navigate('/app/school-admin/users')}
          className="p-5 rounded-3xl bg-surface border border-line hover:border-forest-700/50 transition-all text-left shadow-2xs hover:shadow-xs cursor-pointer group min-h-[120px] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-2xl bg-forest-50 text-forest-700 dark:text-forest-600 border border-forest-100 dark:border-forest-600/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-ink-muted group-hover:translate-x-1 transition-transform" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-ink font-display">{t('navSchoolStaff')}</h4>
            <p className="text-[11px] text-ink-soft mt-0.5">{language === 'bn' ? 'শিক্ষক ও কর্মীদের অ্যাক্সেস পরিচালনা' : 'Manage teachers & staff'}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/app/school-admin/students')}
          className="p-5 rounded-3xl bg-surface border border-line hover:border-forest-700/50 transition-all text-left shadow-2xs hover:shadow-xs cursor-pointer group min-h-[120px] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-2xl bg-forest-50 text-forest-700 dark:text-forest-600 border border-forest-100 dark:border-forest-600/30">
              <Users className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-ink-muted group-hover:translate-x-1 transition-transform" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-ink font-display">{t('navStudents')}</h4>
            <p className="text-[11px] text-ink-soft mt-0.5">{language === 'bn' ? 'নতুন শিক্ষার্থী যোগ ও ক্লাস বিভাজন' : 'Student roster & roll numbers'}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/app/school-admin/academics')}
          className="p-5 rounded-3xl bg-surface border border-line hover:border-forest-700/50 transition-all text-left shadow-2xs hover:shadow-xs cursor-pointer group min-h-[120px] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-2xl bg-forest-50 text-forest-700 dark:text-forest-600 border border-forest-100 dark:border-forest-600/30">
              <GraduationCap className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-ink-muted group-hover:translate-x-1 transition-transform" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-ink font-display">{t('navClassesAndSections')}</h4>
            <p className="text-[11px] text-ink-soft mt-0.5">{language === 'bn' ? 'ক্লাসরুম ও শিক্ষাবর্ষ সেটআপ' : 'Class sections & academic year'}</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/app/school-admin/attendance')}
          className="p-5 rounded-3xl bg-surface border border-line hover:border-forest-700/50 transition-all text-left shadow-2xs hover:shadow-xs cursor-pointer group min-h-[120px] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-2xl bg-forest-50 text-forest-700 dark:text-forest-600 border border-forest-100 dark:border-forest-600/30">
              <CalendarCheck2 className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-ink-muted group-hover:translate-x-1 transition-transform" />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-ink font-display">{t('navDailyAttendance')}</h4>
            <p className="text-[11px] text-ink-soft mt-0.5">{language === 'bn' ? 'উপস্থিতি সংশোধন ও অডিট' : 'Review & correct roll sheets'}</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default SchoolAdminDashboard;
