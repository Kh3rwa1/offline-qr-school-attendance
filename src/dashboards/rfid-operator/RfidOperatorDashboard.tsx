import React, { useState } from 'react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import RfidDashboard from '../../components/rfid/RfidDashboard';
import CardEnrollmentWizard from '../../components/rfid/CardEnrollmentWizard';
import ReaderManagement from '../../components/rfid/ReaderManagement';
import CardStatusPanel from '../../components/rfid/CardStatusPanel';
import BulkEnrollment from '../../components/rfid/BulkEnrollment';
import RfidReports from '../../components/rfid/RfidReports';

export const RfidOperatorDashboard: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const [subView, setSubView] = useState<'dashboard' | 'readers' | 'cards' | 'enroll' | 'bulk' | 'reports'>('dashboard');

  return (
    <div className="space-y-6" id="rfid-operator-dashboard-view">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="bg-amber-500/30 text-amber-200 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-amber-400/30">
              Smartcard Operations Station
            </span>
            <h2 className="text-2xl sm:text-3xl font-black mt-2">MIFARE DESFire EV2 Operator Console</h2>
            <p className="text-xs text-amber-200 mt-1">
              Reader gateway telemetry, card provisioning, cryptographic lifecycle, and tap event diagnostics for {activeSchoolName}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20">
            {(
              [
                ['dashboard', 'Overview'],
                ['readers', 'Readers'],
                ['cards', 'Cards'],
                ['enroll', 'Enroll'],
                ['bulk', 'Bulk'],
                ['reports', 'Reports'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSubView(key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  subView === key ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
          Please select an active school to access RFID operations.
        </div>
      )}
    </div>
  );
};

export default RfidOperatorDashboard;
