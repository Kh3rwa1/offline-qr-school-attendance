import React, { useState } from 'react';
import RfidDashboard from '../rfid/RfidDashboard';
import CardEnrollmentWizard from '../rfid/CardEnrollmentWizard';
import ReaderManagement from '../rfid/ReaderManagement';
import BulkEnrollment from '../rfid/BulkEnrollment';
import RfidReports from '../rfid/RfidReports';
import { Student } from '../../types';

export interface RfidOperatorDashboardProps {
  students: Student[];
  schoolId?: string;
  onEnrollCard?: (studentId: string, uid: string) => void;
}

export const RfidOperatorDashboard: React.FC<RfidOperatorDashboardProps> = ({
  students: _students,
  schoolId = 'default-school',
}) => {
  const [activeTab, setActiveTab] = useState<'station' | 'enroll' | 'bulk' | 'readers' | 'reports'>('station');

  return (
    <div className="space-y-6" id="rfid-operator-dashboard">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-900 via-orange-900 to-slate-900 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="bg-amber-500/30 text-amber-200 text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border border-amber-400/30">
              Hardware Station & Terminal
            </span>
            <h2 className="text-2xl font-black mt-2">RFID Smartcard Workstation</h2>
            <p className="text-amber-200 text-xs mt-1">
              MIFARE DESFire EV2/EV3 card issuance, reader telemetry, and offline tap buffer reconciliation
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-bold rounded-lg border border-amber-400/30">
              ⚡ Live Gateway Active
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mt-6 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('station')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'station' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            id="rfid-tab-station"
          >
            📊 Station Telemetry
          </button>
          <button
            onClick={() => setActiveTab('enroll')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'enroll' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            id="rfid-tab-enroll"
          >
            💳 Card Enrollment Wizard
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'bulk' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            id="rfid-tab-bulk"
          >
            📦 Bulk Batch Enrolment
          </button>
          <button
            onClick={() => setActiveTab('readers')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'readers' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            id="rfid-tab-readers"
          >
            📡 Reader Management
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'reports' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            id="rfid-tab-reports"
          >
            📈 Scan Event Logs
          </button>
        </div>
      </div>

      {/* Active Tab View Content */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        {activeTab === 'station' && <RfidDashboard schoolId={schoolId} />}
        {activeTab === 'enroll' && <CardEnrollmentWizard schoolId={schoolId} />}
        {activeTab === 'bulk' && <BulkEnrollment />}
        {activeTab === 'readers' && <ReaderManagement schoolId={schoolId} />}
        {activeTab === 'reports' && <RfidReports schoolId={schoolId} />}
      </div>
    </div>
  );
};
