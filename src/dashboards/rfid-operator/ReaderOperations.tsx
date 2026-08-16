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
            School Gate Boxes
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            Manage attendance gate boxes installed at {activeSchoolName}.
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Gate Boxes"
          value="Connected"
          trend={{ value: "Entrance & Exit", isPositive: true }}
          variant="hero-forest"
        />
        <StatCard
          title="Doorway Speed"
          value="Instant"
          trend={{ value: "Walk-Through Entry", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Badge Type"
          value="Student Badges"
          trend={{ value: "Standard Cards", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Connection"
          value="Protected"
          trend={{ value: "Verified School Gate", isPositive: true }}
          variant="default"
        />
      </div>

      {/* Embedded Component */}
      {activeSchoolId && <ReaderManagement schoolId={activeSchoolId} />}
    </div>
  );
};

export default ReaderOperations;
