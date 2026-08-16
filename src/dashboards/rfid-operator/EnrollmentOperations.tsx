import React from 'react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import CardEnrollmentWizard from '../../components/rfid/CardEnrollmentWizard';
import { StatCard } from '../../components/shared/StatCard';

export const EnrollmentOperations: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  return (
    <div className="space-y-8 text-left" id="enrollment-operations-view">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
          UHF EPC Gen2 Badge Enrollment
        </h1>
        <p className="t-body text-sm text-ink-soft mt-1">
          Assign passive UHF EPC Gen2 badges for Zebra FX9600 gate attendance at {activeSchoolName}.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Gate Integration"
          value="Zebra FX9600"
          trend={{ value: "IoT Connector Webhook", isPositive: true }}
          variant="hero-forest"
        />
        <StatCard
          title="Protocol Standard"
          value="EPC Gen 2"
          trend={{ value: "ISO 18000-63 Standard", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Credential Security"
          value="SHA-256 Vault"
          trend={{ value: "Zero Raw-EPC Storage", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Badge Availability"
          value="Ready"
          trend={{ value: "Handheld / Gate Ingest", isPositive: true }}
          variant="default"
        />
      </div>

      {/* Wizard */}
      {activeSchoolId && <CardEnrollmentWizard schoolId={activeSchoolId} />}
    </div>
  );
};

export default EnrollmentOperations;
