import React from 'react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import ReaderManagement from '../../components/rfid/ReaderManagement';
import { StatCard } from '../../components/shared/StatCard';
import { motion } from 'motion/react';
import { Radio, Plus, CheckCircle2, ShieldCheck } from 'lucide-react';

export const ReaderOperations: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  return (
    <div className="space-y-8" id="reader-operations-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
            Physical Gate Readers
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Configure ESP32 / PN532 and Raspberry Pi smartcard gate terminals at {activeSchoolName}.
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Online Gate Terminals"
          value="4 of 4 Online"
          trend={{ value: "Gate 1, Gate 2, Lab, Admin", isPositive: true }}
          variant="hero-forest"
        />
        <StatCard
          title="Avg Tap-to-Turnout Latency"
          value="42 ms"
          trend={{ value: "Hardware Accelerated AES", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="DESFire EV3 Proofs"
          value="100% Valid"
          trend={{ value: "Cryptographic CMAC Verified", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Firmware Version"
          value="v2.4.1 Secure"
          trend={{ value: "mTLS Certificate Bound", isPositive: true }}
          variant="default"
        />
      </div>

      {/* Embedded Component */}
      {activeSchoolId && <ReaderManagement schoolId={activeSchoolId} />}
    </div>
  );
};

export default ReaderOperations;
