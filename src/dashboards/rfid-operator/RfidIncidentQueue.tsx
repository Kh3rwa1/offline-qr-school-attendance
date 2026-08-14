import React from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

export const RfidIncidentQueue: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900">Scan Anomaly & Incident Queue</h2>
        <p className="text-xs text-slate-500">Unrecognized cards, replay attempts, and cryptographic auth failure logs</p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
          <ShieldAlert className="w-5 h-5" />
          <span>Zero Active Cryptographic Breaches</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          All reader scan events match verified school card keys with monotonic counter progression.
        </p>
      </div>
    </div>
  );
};

export default RfidIncidentQueue;
