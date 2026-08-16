import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useLanguage } from '../../app/LanguageProvider';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { StatCard } from '../../components/shared/StatCard';
import { Button } from '../../components/shared/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { useNavigate } from 'react-router-dom';
import { QrCode, ArrowRight } from 'lucide-react';
import { offlineDb } from '../../db/offlineDb';

export const AssignedClasses: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const { t } = useLanguage();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      if (!activeSchoolId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await api<{ success: boolean; data: any[] }>(`/api/v1/schools/${activeSchoolId}/attendance/classes`);
        if (res.data) {
          setClasses(res.data);
        } else {
          setClasses([]);
        }
      } catch (err: any) {
        // Offline fallback: load from cached roster items
        const cached = await offlineDb.rosters.toArray();
        const uniqueMap = new Map<string, any>();
        cached.forEach((r: any) => {
          if (!uniqueMap.has(r.classSectionId)) {
            uniqueMap.set(r.classSectionId, {
              classSectionId: r.classSectionId,
              className: r.className,
              sectionName: r.sectionName,
              studentCount: cached.filter((c: any) => c.classSectionId === r.classSectionId).length,
            });
          }
        });
        setClasses(Array.from(uniqueMap.values()));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [activeSchoolId]);

  const handleOpenClassScanner = (classSectionId: string) => {
    localStorage.setItem('attendance.classSectionId', classSectionId);
    navigate('/app/teacher');
  };

  if (loading) return <LoadingState type="stat-cards" message={t('loadingAssignedClasses')} />;
  if (error) return <ErrorState message={error} />;

  const totalStudents = classes.reduce((sum, c) => sum + (c.studentCount || 0), 0);

  return (
    <div className="space-y-6 sm:space-y-8 text-left max-w-6xl mx-auto" id="assigned-classes-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-3xl border border-line shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-success-50 border border-success-100 dark:border-success-600/30 text-sm font-bold text-forest-700 dark:text-forest-600 uppercase tracking-wider mb-2 font-display">
            <span>{t('navMyClasses')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
            {t('myClassroomDuty')}
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            {t('myClassroomDutyDesc')} {activeSchoolName}.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => {
            if (classes.length > 0) {
              handleOpenClassScanner(classes[0].classSectionId);
            } else {
              navigate('/app/teacher');
            }
          }}
          leftIcon={<QrCode className="w-4 h-4" />}
          className="min-h-[44px] rounded-2xl font-display text-sm font-bold"
        >
          {t('startTodaysAttendance')}
        </Button>
      </div>

      {/* 4 Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('activeClassDuty')}
          value={`${classes.length} ${t('sectionsUnit')}`}
          trend={{ 
            value: classes.length > 0 
              ? t('readyForAttendanceTrend') 
              : t('noAssignedClassesDesc'), 
            isPositive: classes.length > 0 
          }}
          variant="hero-forest"
        />
        <StatCard
          title={t('totalRosterStudents')}
          value={`${totalStudents}`}
          trend={{ value: t('inYourClasses'), isPositive: true }}
          variant="default"
        />
        <StatCard
          title={t('qrAndManual')}
          value={t('qrAndManualDesc')}
          trend={{ 
            value: t('quickMarkTrend'), 
            isPositive: true 
          }}
          variant="default"
        />
        <StatCard
          title={t('offlineReady')}
          value={t('offlineReadyDesc')}
          trend={{ 
            value: t('worksWithoutNetworkTrend'), 
            isPositive: true 
          }}
          variant="default"
        />
      </div>

      {/* Class Cards Grid */}
      {classes.length === 0 ? (
        <div className="app-card p-12 text-center bg-surface border border-line rounded-3xl">
          <EmptyState
            kind="generic"
            title={t('noAssignedClassesDesc')}
            description={t('askHeadmasterAssign')}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {classes.map((cls) => (
            <div key={cls.classSectionId} className="app-card p-6 rounded-3xl bg-surface border border-line shadow-xs space-y-4 flex flex-col justify-between hover:border-forest-700/40 transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-forest-700 text-white flex items-center justify-center font-extrabold text-sm shadow-2xs font-display">
                    {cls.className?.replace(/[^0-9]/g, '') || cls.className?.charAt(0) || 'C'}
                  </div>
                  <span className="text-sm font-bold px-3.5 py-1 rounded-full bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 uppercase tracking-wider font-display">
                    {t('activeRoll')}
                  </span>
                </div>

                <div className="mt-4">
                  <h3 className="font-extrabold text-lg text-ink font-display">
                    {cls.className} - {cls.sectionName}
                  </h3>
                  <p className="t-body text-sm text-ink-soft mt-1">
                    {t('enrolledCount')}: <span className="font-bold text-ink font-mono">{cls.studentCount || 0} {t('studentsUnit')}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-line">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleOpenClassScanner(cls.classSectionId)}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  className="w-full justify-center min-h-[44px] rounded-2xl font-display text-sm font-bold"
                >
                  {t('takeClassAttendance')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AssignedClasses;
