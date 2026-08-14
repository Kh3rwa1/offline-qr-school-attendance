import React, { useState } from 'react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import RfidDashboard from '../../components/rfid/RfidDashboard';
import CardEnrollmentWizard from '../../components/rfid/CardEnrollmentWizard';
import ReaderManagement from '../../components/rfid/ReaderManagement';
import CardStatusPanel from '../../components/rfid/CardStatusPanel';
import BulkEnrollment from '../../components/rfid/BulkEnrollment';
import RfidReports from '../../components/rfid/RfidReports';
import { StatCard } from '../../components/shared/StatCard';
import { motion } from 'motion/react';
import { Radio, Plus, ShieldCheck, Download, RefreshCw, Cpu } from 'lucide-react';

export const RfidOperatorDashboard: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const [subView, setSubView] = useState<'dashboard' | 'readers' | 'cards' | 'enroll' | 'bulk' | 'reports'>('dashboard');

  return (
    <div className="space-y-8" id="rfid-operator-dashboard-view">
      {/* Top Header Row with Big Buttons (Reference Image match) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-extrabold text-[#144e39] uppercase tracking-wider mb-2 font-display">
            <span>MIFARE DESFire EV2 Operator Console</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
            Smartcard Operations
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Plan, provision, and monitor MIFARE DESFire EV3 hardware readers for {activeSchoolName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSubView('enroll')}
            className="btn-forest-primary text-sm font-display"
          >
            <Plus className="w-4 h-4" />
            <span>Enroll Smartcard</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSubView('bulk')}
            className="btn-pill-secondary text-sm font-display shadow-2xs"
          >
            <span>Bulk Provision</span>
          </motion.button>
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
              className={`px-4 py-2 rounded-full text-xs font-bold font-display transition-all ${
                subView === key
                  ? 'bg-[#144e39] text-white shadow-sm'
                  : 'bg-transparent text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="px-3 text-xs font-bold text-slate-400">
          PC/SC Subsystem: <span className="text-emerald-700 font-bold">READY</span>
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
        <div className="p-12 text-center app-card text-sm text-slate-500 font-medium">
          Please select an active school to access RFID operations.
        </div>
      )}
    </div>
  );
};

export default RfidOperatorDashboard;
