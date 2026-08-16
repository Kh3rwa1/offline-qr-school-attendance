import React from 'react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import ReaderManagement from '../../components/rfid/ReaderManagement';
import { StatCard } from '../../components/shared/StatCard';

export const ReaderOperations: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  return (
    <div className="space-y-8 text-left" id="reader-operations-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
            Zebra FX9600 Gate Readers
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            Configure Zebra FX9600 fixed UHF RFID readers and IoT Connector webhooks at {activeSchoolName}.
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Zebra FX9600 Readers"
          value="Fixed UHF"
          trend={{ value: "4/8 Antenna Ports", isPositive: true }}
          variant="hero-forest"
        />
        <StatCard
          title="Ingest Latency"
          value="< 50 ms"
          trend={{ value: "IoT Webhook Ingest", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Tag Protocol"
          value="EPC Gen 2"
          trend={{ value: "ISO 18000-63 Standard", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Security Ingest"
          value="HMAC-SHA256"
          trend={{ value: "Webhook Signature Verified", isPositive: true }}
          variant="default"
        />
      </div>

      {/* Embedded Component */}
      {activeSchoolId && <ReaderManagement schoolId={activeSchoolId} />}
    </div>
  );
};

export default ReaderOperations;
