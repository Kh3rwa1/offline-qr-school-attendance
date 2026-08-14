import React from 'react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import ReaderManagement from '../../components/rfid/ReaderManagement';

export const ReaderOperations: React.FC = () => {
  const { activeSchoolId } = useActiveSchool();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900">RFID Gateway Reader Management</h2>
        <p className="text-xs text-slate-500">Configure ESP32/PN532 physical gateways, monitor heartbeat status, and approve keys</p>
      </div>
      {activeSchoolId && <ReaderManagement schoolId={activeSchoolId} />}
    </div>
  );
};

export default ReaderOperations;
