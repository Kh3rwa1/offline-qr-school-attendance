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
          Give Student Badge
        </h1>
        <p className="t-body text-sm text-ink-soft mt-1">
          Link attendance cards to students at {activeSchoolName}.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Gate Attendance"
          value="Ready"
          trend={{ value: "School Gate Ready", isPositive: true }}
          variant="hero-forest"
        />
        <StatCard
          title="Badge Type"
          value="Standard Badge"
          trend={{ value: "Walk-Through Entry", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Student Protection"
          value="Safe & Private"
          trend={{ value: "Secure Records", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Badge Setup"
          value="Instant"
          trend={{ value: "Takes 5 Seconds", isPositive: true }}
          variant="default"
        />
      </div>

      {/* Wizard */}
      {activeSchoolId && <CardEnrollmentWizard schoolId={activeSchoolId} />}
    </div>
  );
};

export default EnrollmentOperations;
