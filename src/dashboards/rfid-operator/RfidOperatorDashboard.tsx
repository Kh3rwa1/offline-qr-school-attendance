import React, { useState } from 'react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
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
  const [subView, setSubView] = useState<'dashboard' | 'readers' | 'cards' | 'enroll' | 'bulk' | 'reports'>('dashboard');

  return (
    <div className="space-y-8 text-left" id="rfid-operator-dashboard-view">
      {/* Top Header Row with Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success-50 border border-success-100 dark:border-success-600/30 text-[11px] font-bold text-forest-700 dark:text-forest-600 uppercase tracking-wider mb-2 font-display">
            <span>School Gate Operations</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
            School gate
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            Manage gate attendance, student badges, and daily arrivals for {activeSchoolName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={() => setSubView('enroll')}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Give a student a badge
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={() => setSubView('bulk')}
            leftIcon={<Users className="w-4 h-4" />}
          >
            Give many badges
          </Button>
        </div>
      </div>

      {/* 4 Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Gates online"
          value="Gate Boxes"
          trend={{ value: "Doorway attendance active", isPositive: true }}
          variant="hero-forest"
          onClick={() => setSubView('readers')}
        />
        <StatCard
          title="Student badges"
          value="Active Badges"
          trend={{ value: "Protected records", isPositive: true }}
          variant="default"
          onClick={() => setSubView('cards')}
        />
        <StatCard
          title="Who walked in today"
          value="Gate Arrivals"
          trend={{ value: "Live stream active", isPositive: true }}
          variant="default"
          onClick={() => setSubView('reports')}
        />
        <StatCard
          title="Gate Status"
          value="Ready"
          trend={{ value: "Attendance operational", isPositive: true }}
          variant="default"
          onClick={() => setSubView('dashboard')}
        />
      </div>

      {/* Subview Selector Pill Tabs */}
      <div className="app-card p-2.5 flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['dashboard', 'Overview'],
              ['readers', 'Gates'],
              ['cards', 'Student badges'],
              ['enroll', 'Give badge'],
              ['bulk', 'Give many badges'],
              ['reports', 'Who walked in'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSubView(key)}
              className={`px-4 py-2 rounded-full text-xs font-bold font-display transition-all cursor-pointer ${
                subView === key
                  ? 'bg-forest-700 text-white shadow-2xs'
                  : 'bg-transparent text-ink-soft hover:bg-surface-soft hover:text-ink'
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
            title="No active school selected"
            description="Please select an active school to access gate operations."
          />
        </div>
      )}
    </div>
  );
};

export default RfidOperatorDashboard;
