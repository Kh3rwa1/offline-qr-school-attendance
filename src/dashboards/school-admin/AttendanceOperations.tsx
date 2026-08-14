import React from 'react';

export const AttendanceOperations: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900">Attendance Session Oversight</h2>
        <p className="text-xs text-slate-500">Monitor active daily attendance collection across all classes</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-slate-800">Attendance Policy Guidelines</h3>
        <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside leading-relaxed">
          <li>Teachers capture offline optical and USB scanner events directly into IndexedDB.</li>
          <li>All attendance sessions require explicit confirmation before finalization.</li>
          <li>Manual corrections and administrative overrides are logged in the school audit log.</li>
        </ul>
      </div>
    </div>
  );
};

export default AttendanceOperations;
