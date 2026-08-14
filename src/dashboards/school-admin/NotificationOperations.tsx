import React from 'react';
import { MessageSquare, CheckCircle } from 'lucide-react';

export const NotificationOperations: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900">SMS Notification Dispatch Queue</h2>
        <p className="text-xs text-slate-500">Automated parent/guardian absence notification dispatch telemetry</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
            <MessageSquare className="w-5 h-5" />
            <span>SMS Queue Engine</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Absence notifications are queued automatically upon attendance session finalization and dispatched by background SMS worker.
          </p>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
            <CheckCircle className="w-3 h-3" /> Worker Active
          </span>
        </div>
      </div>
    </div>
  );
};

export default NotificationOperations;
