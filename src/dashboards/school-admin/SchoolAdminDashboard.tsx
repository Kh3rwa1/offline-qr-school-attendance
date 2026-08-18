import React, { useState, useEffect } from 'react';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { Button } from '../../components/shared/Button';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useLanguage } from '../../app/LanguageProvider';
import { getUserSafeError } from '../../errors/userSafeErrors';
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
      setError(getUserSafeError(err, language).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSummary();
  }, [activeSchoolId, language]);

  if (loading) return <LoadingState type="stat-cards" message={t('loadingSchoolOps')} />;
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
          <p className="t-body text-sm text-ink-soft mt-1">
            {activeSchoolName} • {new Date().toLocaleDateString(language === 'bn' ? 'bn-IN' : language === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/app/teacher')}
            leftIcon={<QrCode className="w-4 h-4" />}
            className="min-h-[44px] rounded-2xl font-display text-sm font-bold"
          >
            {t('startAttendance')}
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={() => navigate('/app/reports/exports')}
            leftIcon={<FileSpreadsheet className="w-4 h-4 text-ink-soft" />}
            className="min-h-[44px] rounded-2xl font-display text-sm font-bold"
          >
            {t('navDownloadReports')}
          </Button>
        </div>
      </div>

      {/* 3 Clean Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-6 rounded-3xl bg-success-50/70 border border-success-100 dark:border-success-600/30 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-forest-700 dark:text-forest-600">
            <span className="text-sm font-bold uppercase tracking-wider font-display">
              {t('cameIn')}
            </span>
            <CalendarCheck2 className="w-5 h-5" />
          </div>
          <div className="text-4xl font-extrabold text-forest-700 dark:text-forest-600 font-display font-mono">
            {presentCount} / {totalStudents}
          </div>
          <p className="text-sm text-forest-700/80 font-medium font-display">
            {t('presentTodayPct', { pct: attendancePct })}
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-sm font-bold uppercase tracking-wider font-display">
              {t('navStudents')}
            </span>
            <Users className="w-5 h-5 text-forest-700 dark:text-forest-600" />
          </div>
          <div className="text-4xl font-extrabold text-ink font-display font-mono">
            {totalStudents}
          </div>
          <p className="text-sm text-ink-soft font-display">
            {t('enrolledStudentsCount')}
          </p>
        </div>

        <div className="p-6 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-sm font-bold uppercase tracking-wider font-display">
              {t('navClassesAndSections')}
            </span>
            <GraduationCap className="w-5 h-5 text-forest-700 dark:text-forest-600" />
          </div>
          <div className="text-4xl font-extrabold text-ink font-display font-mono">
            {summary?.classCount ?? 0}
          </div>
          <p className="text-sm text-ink-soft font-display">
            {t('activeClassSectionsCount')}
          </p>
        </div>
      </div>

      {/* First-run guidance — shown only when no students have been imported yet */}
      {totalStudents === 0 && (
        <div className="p-6 rounded-3xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center shadow-xs shrink-0">
            <Users className="w-6 h-6 text-[#15803d]" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="font-extrabold text-[#0f172a] font-display text-base">
              {language === 'bn' ? 'প্রথমে ছাত্রতালিকা যুক্ত করুন' : language === 'hi' ? 'पहले students import करें' : 'Import your students to get started'}
            </h3>
            <p className="text-sm text-slate-600">
              {language === 'bn'
                ? 'Excel ফাইল থেকে ছাত্রতালিকা আপলোড করুন — তারপর শিক্ষকরা সঙ্গে সঙ্গে হাজিরা নিতে পারবেন।'
                : language === 'hi'
                ? 'Excel file से student list upload करें — फिर teachers तुरंत attendance ले सकते हैं।'
                : 'Upload your student list from Excel — teachers can start taking attendance right away.'}
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/app/school-admin/students')}
            leftIcon={<ArrowRight className="w-4 h-4" />}
            className="min-h-[44px] rounded-2xl font-display text-sm font-bold shrink-0"
          >
            {language === 'bn' ? 'ছাত্র যুক্ত করুন' : language === 'hi' ? 'Students Add करें' : 'Add Students'}
          </Button>
        </div>
      )}

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
            <p className="text-sm text-ink-soft mt-0.5">{t('manageStaffSub')}</p>
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
            <p className="text-sm text-ink-soft mt-0.5">{t('manageStudentsSub')}</p>
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
            <p className="text-sm text-ink-soft mt-0.5">{t('manageAcademicsSub')}</p>
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
            <p className="text-sm text-ink-soft mt-0.5">{t('manageAttendanceSub')}</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default SchoolAdminDashboard;
