import React, { useState } from 'react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useLanguage } from '../../app/LanguageProvider';
import RfidDashboard from '../../components/rfid/RfidDashboard';
import CardEnrollmentWizard from '../../components/rfid/CardEnrollmentWizard';
import ReaderManagement from '../../components/rfid/ReaderManagement';
import CardStatusPanel from '../../components/rfid/CardStatusPanel';
import BulkEnrollment from '../../components/rfid/BulkEnrollment';
import RfidReports from '../../components/rfid/RfidReports';
import { StatCard } from '../../components/shared/StatCard';
import { Button } from '../../components/shared/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { Plus, Users } from 'lucide-react';

export const RfidOperatorDashboard: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const { t } = useLanguage();
  const [subView, setSubView] = useState<'dashboard' | 'readers' | 'cards' | 'enroll' | 'bulk' | 'reports'>('dashboard');

  return (
    <div className="space-y-6 sm:space-y-8 text-left max-w-6xl mx-auto" id="rfid-operator-dashboard-view">
      {/* Top Header Row with Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-3xl border border-line shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-success-50 border border-success-100 dark:border-success-600/30 text-sm font-bold text-forest-700 dark:text-forest-600 uppercase tracking-wider mb-2 font-display">
            <span>{t('schoolGateOps')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
            {t('schoolGate')}
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            {t('schoolGateDesc')} {activeSchoolName}.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="primary"
            size="md"
            onClick={() => setSubView('enroll')}
            leftIcon={<Plus className="w-4 h-4" />}
            className="min-h-[44px] rounded-2xl font-display text-sm font-bold"
          >
            {t('giveStudentBadge')}
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={() => setSubView('bulk')}
            leftIcon={<Users className="w-4 h-4 text-ink-soft" />}
            className="min-h-[44px] rounded-2xl font-display text-sm font-bold"
          >
            {t('giveManyBadges')}
          </Button>
        </div>
      </div>

      {/* 4 Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('gatesOnline')}
          value={t('statusOnline')}
          trend={{ value: t('doorwayAttendanceActive'), isPositive: true }}
          variant="hero-forest"
          onClick={() => setSubView('readers')}
        />
        <StatCard
          title={t('studentBadges')}
          value={t('badgeStatusActive')}
          trend={{ value: t('protectedRecords'), isPositive: true }}
          variant="default"
          onClick={() => setSubView('cards')}
        />
        <StatCard
          title={t('whoWalkedInToday')}
          value={t('navOverview')}
          trend={{ value: t('gateArrivalsActive'), isPositive: true }}
          variant="default"
          onClick={() => setSubView('reports')}
        />
        <StatCard
          title={t('status')}
          value={t('statusActive')}
          trend={{ value: t('attendanceReady'), isPositive: true }}
          variant="default"
          onClick={() => setSubView('dashboard')}
        />
      </div>

      {/* Subview Selector Pill Tabs */}
      <div className="app-card p-3 flex flex-wrap gap-2 items-center justify-between bg-surface border border-line rounded-2xl shadow-xs">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['dashboard', t('navOverview')],
              ['readers', t('navSchoolGates')],
              ['cards', t('navStudentBadges')],
              ['enroll', t('giveStudentBadge')],
              ['bulk', t('giveManyBadges')],
              ['reports', t('whoWalkedInToday')],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSubView(key)}
              className={`px-4 py-2.5 rounded-2xl text-sm font-bold font-display transition-all cursor-pointer min-h-[44px] ${
                subView === key
                  ? 'bg-forest-700 text-white shadow-xs'
                  : 'bg-surface-soft text-ink-soft hover:bg-surface hover:text-ink border border-line'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Subview Rendering */}
      {activeSchoolId ? (
        <div className="space-y-6">
          {subView === 'dashboard' && <RfidDashboard schoolId={activeSchoolId} />}
          {subView === 'readers' && <ReaderManagement schoolId={activeSchoolId} />}
          {subView === 'cards' && <CardStatusPanel studentId="" />}
          {subView === 'enroll' && <CardEnrollmentWizard schoolId={activeSchoolId} />}
          {subView === 'bulk' && <BulkEnrollment />}
          {subView === 'reports' && <RfidReports schoolId={activeSchoolId} />}
        </div>
      ) : (
        <div className="py-8">
          <EmptyState
            kind="generic"
            title={t('noActiveSchoolSelected')}
            description={t('selectSchoolGateOps')}
          />
        </div>
      )}
    </div>
  );
};

export default RfidOperatorDashboard;
