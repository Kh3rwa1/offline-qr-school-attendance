import React, { useState, useEffect } from 'react';
import { useOfflineStatus } from '../../app/OfflineStatusProvider';
import { offlineDb } from '../../db/offlineDb';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export const OfflineWorkspace: React.FC = () => {
  const { isOnline, outboxCount, isSyncing, syncNow, refreshOutbox } = useOfflineStatus();
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const outbox = await offlineDb.syncOutbox.toArray();
      setEvents(outbox);
    }
    void load();
  }, [outboxCount]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900">Offline Outbox & Reconciliation Queue</h2>
          <p className="text-xs text-slate-500">Local IndexedDB event queue holding uncommitted attendance events</p>
        </div>
        <button
          onClick={() => void syncNow()}
          disabled={!isOnline || isSyncing || outboxCount === 0}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
        >
          <RefreshCw className={`inline w-3.5 h-3.5 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Synchronizing…' : 'Sync All Events'}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {events.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-xs font-bold text-slate-600">Outbox is completely clear</p>
            <p className="text-[11px]">All recorded scan events are synchronized with the central PostgreSQL backend.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                <tr>
                  <th className="px-4 py-3">Event ID</th>
                  <th className="px-4 py-3">Student ID</th>
                  <th className="px-4 py-3">Scan Source</th>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Sync Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {events.map((e) => (
                  <tr key={e.eventId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-500">{e.eventId.slice(0, 8)}…</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{e.studentId.slice(0, 8)}…</td>
                    <td className="px-4 py-3">{e.scanSource}</td>
                    <td className="px-4 py-3 text-slate-400">{new Date(e.timestamp).toLocaleTimeString()}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        PENDING_SYNC
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OfflineWorkspace;
