import React, { useState, useEffect } from 'react';
import { useOfflineStatus } from '../../app/OfflineStatusProvider';
import { offlineDb } from '../../db/offlineDb';
import { StatCard } from '../../components/shared/StatCard';
import { motion } from 'motion/react';
import { RefreshCw, CheckCircle2, AlertCircle, Database, Wifi, Smartphone, HardDrive } from 'lucide-react';

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
    <div className="space-y-8" id="offline-workspace-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-extrabold text-[#144e39] uppercase tracking-wider mb-2 font-display">
            <span>Offline Synchronization Ledger</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
            Offline Outbox & Local Storage
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Browser IndexedDB local queue for uninterrupted attendance during rural internet blackouts.
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => void syncNow()}
          disabled={!isOnline || isSyncing || outboxCount === 0}
          className="btn-forest-primary text-sm font-display disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Synchronizing…' : 'Push Local Queue Now'}</span>
        </motion.button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Internet Connectivity"
          value={isOnline ? "Online" : "Offline"}
          trend={{ value: isOnline ? "Connected to Cloud Server" : "Operating on Local Storage", isPositive: isOnline }}
          variant={isOnline ? "hero-forest" : "default"}
        />
        <StatCard
          title="Unsynced Queue"
          value={`${outboxCount} Events`}
          trend={{ value: outboxCount === 0 ? "All Records Synced" : "Waiting for Network", isPositive: outboxCount === 0 }}
          variant="default"
        />
        <StatCard
          title="Local Database"
          value="IndexedDB Active"
          trend={{ value: "Encrypted Browser Storage", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Replay Protection"
          value="Monotonic Counter"
          trend={{ value: "Strict Order Guaranteed", isPositive: true }}
          variant="default"
        />
      </div>

      {/* Outbox Table */}
      <div className="app-card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 font-display">Pending Event Sync Queue</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Events captured while offline waiting to be pushed</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
            outboxCount === 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            {outboxCount === 0 ? '✓ 0 Pending Events' : `${outboxCount} Events in Outbox`}
          </span>
        </div>

        {events.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#144e39] flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="text-base font-extrabold text-slate-800 font-display">Local Queue is Completely Synchronized</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Every student scan and finalized session from this device has been safely received and acknowledged by the central server.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase font-display">
                <tr>
                  <th className="px-6 py-4">Client Event ID</th>
                  <th className="px-6 py-4">Student ID</th>
                  <th className="px-6 py-4">Capture Source</th>
                  <th className="px-6 py-4">Local Timestamp</th>
                  <th className="px-6 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700 bg-white">
                {events.map((e) => (
                  <tr key={e.clientEventId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-700">{e.clientEventId.slice(0, 12)}…</td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">{e.studentId ? `${e.studentId.slice(0, 10)}…` : '—'}</td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold">
                        {e.source || 'CAMERA'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono">
                      {e.clientTimestamp ? new Date(e.clientTimestamp).toLocaleTimeString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        e.syncStatus === 'SYNCED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : e.syncStatus === 'SYNCING'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : e.syncStatus === 'CONFLICT'
                          ? 'bg-purple-50 text-purple-800 border-purple-200'
                          : e.syncStatus === 'FAILED' || e.syncStatus === 'PERMANENT_FAILURE'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {e.syncStatus || 'PENDING'}
                      </span>
                      {e.syncError && (
                        <span className="block text-[10px] text-rose-600 mt-0.5" title={e.syncError}>
                          {e.syncError.slice(0, 20)}…
                        </span>
                      )}
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
