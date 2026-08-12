import React from 'react';
import { AttendanceEvent, Language, NetworkStatus } from '../types';
import { RefreshCw, CheckCircle2, ShieldCheck, Database, HardDrive, Wifi, WifiOff } from 'lucide-react';

interface SyncOutboxModalProps {
  events: AttendanceEvent[];
  language: Language;
  networkStatus: NetworkStatus;
  onSyncNow: () => void;
  onSimulateForceClose: () => void;
}

export const SyncOutboxModal: React.FC<SyncOutboxModalProps> = ({
  events,
  language,
  networkStatus,
  onSyncNow,
  onSimulateForceClose,
}) => {
  const pendingEvents = events.filter((e) => e.syncStatus === 'PENDING');
  const syncedEvents = events.filter((e) => e.syncStatus !== 'PENDING');

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex-1 flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {language === 'bn' ? 'অফলাইন আউটবক্স ও ইনডেক্সড-ডিবি স্টোরেজ' : 'Offline Outbox & IndexedDB Logs'}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            {language === 'bn'
              ? 'ইন্টারনেট ড্রপ হলেও ইভেন্টগুলি নিরাপদে লোকাল স্টোরেজে থাকে'
              : 'IndexedDB durability guarantees offline scan retention across browser restarts'}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onSimulateForceClose}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Simulate Reboot / Restart App</span>
          </button>

          <button
            onClick={onSyncNow}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Outbox Now</span>
          </button>
        </div>
      </div>

      {/* Health Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold shrink-0">
            {pendingEvents.length}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-700">Pending Outbox Events</div>
            <div className="text-[11px] text-slate-400">Awaiting Server Acknowledgement</div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-700">Synced Events</div>
            <div className="text-[11px] text-slate-400">{syncedEvents.length} Ingested Idempotently</div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-700">IndexedDB Health</div>
            <div className="text-[11px] text-emerald-600 font-bold">ACTIVE & ENCRYPTED</div>
          </div>
        </div>
      </div>

      {/* Queue Items Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-100 max-h-[300px] overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider sticky top-0 z-10">
            <tr>
              <th className="p-3">Client Event ID</th>
              <th className="p-3">Type</th>
              <th className="p-3">Client Timestamp</th>
              <th className="p-3">Sync Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-slate-600">
            {events.map((evt) => (
              <tr key={evt.clientEventId} className="hover:bg-slate-50">
                <td className="p-3 font-bold text-slate-900">{evt.clientEventId}</td>
                <td className="p-3">
                  <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold">
                    {evt.eventType}
                  </span>
                </td>
                <td className="p-3 text-slate-500">{evt.clientTimestamp}</td>
                <td className="p-3">
                  {evt.syncStatus === 'ACCEPTED' ? (
                    <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      ACCEPTED (HTTP 200)
                    </span>
                  ) : (
                    <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      PENDING OUTBOX
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
