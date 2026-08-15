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
import { Plus } from 'lucide-react';

export const RfidOperatorDashboard: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const [subView, setSubView] = useState<'dashboard' | 'readers' | 'cards' | 'enroll' | 'bulk' | 'reports'>('dashboard');

  return (
    <div className="space-y-8 text-left" id="rfid-operator-dashboard-view">
      {/* Top Header Row with Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success-50 border border-success-100 dark:border-success-600/30 text-[11px] font-bold text-forest-700 dark:text-forest-600 uppercase tracking-wider mb-2 font-display">
            <span>MIFARE DESFire EV2 Operator Console</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
            Smartcard Operations
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            Plan, provision, and monitor MIFARE DESFire EV3 hardware readers for {activeSchoolName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={() => setSubView('enroll')}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Enroll Smartcard
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={() => setSubView('bulk')}
          >
            Bulk Provision
          </Button>
        </div>
      </div>

      {/* 4 Stat Cards Row (Hero Forest + 3 White Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Gate Terminals"
          value="4 Online"
          trend={{ value: "DESFire EV3 Verified", isPositive: true }}
          variant="hero-forest"
          onClick={() => setSubView('readers')}
        />
        <StatCard
          title="Active Cards"
          value={1005}
          trend={{ value: "Diversification Keys Active", isPositive: true }}
          variant="default"
          onClick={() => setSubView('cards')}
        />
        <StatCard
          title="Tap Velocity"
          value="4.2 /s"
          trend={{ value: "Zero Replay Collisions", isPositive: true }}
          variant="default"
          onClick={() => setSubView('reports')}
        />
        <StatCard
          title="Cryptographic Suite"
          value="AES-128"
          trend={{ value: "CMAC Authentication", isPositive: true }}
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
              ['readers', 'Gate Readers'],
              ['cards', 'Card Status'],
              ['enroll', 'NFC Enroll'],
              ['bulk', 'Bulk Provision'],
              ['reports', 'Tap Logs'],
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

        <div className="px-3 text-xs font-bold text-ink-muted font-mono">
          PC/SC Subsystem: <span className="text-forest-700 dark:text-forest-600 font-bold">READY</span>
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
            description="Please select an active school to access RFID operations."
          />
        </div>
      )}
    </div>
  );
};

export default RfidOperatorDashboard;
