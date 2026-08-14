import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';

export const UserManagement: React.FC = () => {
  const { activeSchoolId } = useActiveSchool();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load staff memberships
    setUsers([
      { id: 'usr-1', fullName: 'Headmaster Roy', phoneNumber: '+919100000001', role: 'SCHOOL_ADMIN', status: 'ACTIVE' },
      { id: 'usr-2', fullName: 'Ananya Sharma (Teacher)', phoneNumber: '+919100000002', role: 'TEACHER', status: 'ACTIVE' },
      { id: 'usr-3', fullName: 'Pradeep Das (RFID Op)', phoneNumber: '+919100000003', role: 'RFID_OPERATOR', status: 'ACTIVE' },
      { id: 'usr-4', fullName: 'District Inspector (Viewer)', phoneNumber: '+919100000004', role: 'REPORT_VIEWER', status: 'ACTIVE' },
    ]);
    setLoading(false);
  }, [activeSchoolId]);

  if (loading) return <LoadingState message="Loading staff directory…" />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900">Staff Memberships & Roles</h2>
          <p className="text-xs text-slate-500">Authorized personnel and role assignments within this school</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
              <tr>
                <th className="px-4 py-3">Full Name</th>
                <th className="px-4 py-3">Phone Number</th>
                <th className="px-4 py-3">Assigned Role</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-900">{u.fullName}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{u.phoneNumber}</td>
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {u.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
