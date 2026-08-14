import React from 'react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import CardEnrollmentWizard from '../../components/rfid/CardEnrollmentWizard';

export const EnrollmentOperations: React.FC = () => {
  const { activeSchoolId } = useActiveSchool();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900">Card Provisioning & Key Personalization</h2>
        <p className="text-xs text-slate-500">Inject application master keys (Master/App key AES-128) onto blank DESFire cards</p>
      </div>
      {activeSchoolId && <CardEnrollmentWizard schoolId={activeSchoolId} />}
    </div>
  );
};

export default EnrollmentOperations;
