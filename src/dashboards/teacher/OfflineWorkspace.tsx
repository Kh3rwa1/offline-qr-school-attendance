import React, { useState, useEffect } from 'react';
import { useOfflineStatus } from '../../app/OfflineStatusProvider';
import { offlineDb } from '../../db/offlineDb';
import { StatCard } from '../../components/shared/StatCard';
import { Button } from '../../components/shared/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { RefreshCw, CheckCircle2 } from 'lucide-react';

export const OfflineWorkspace: React.FC = () => {
  const { isOnline, outboxCount, isSyncing, syncNow } = useOfflineStatus();
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const outbox = await offlineDb.syncOutbox.toArray();
      setEvents(outbox);
    }
    void load();
  }, [outboxCount]);

  return (
    <div className="space-y-8 text-left" id="offline-workspace-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success-50 border border-success-100 dark:border-success-600/30 text-[11px] font-bold text-forest-700 dark:text-forest-600 uppercase tracking-wider mb-2 font-display">
            <span>Offline Synchronization Ledger</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
            Offline Outbox & Local Storage
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            Browser IndexedDB local queue for uninterrupted attendance during rural internet blackouts.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => void syncNow()}
          disabled={!isOnline || isSyncing || outboxCount === 0}
          isLoading={isSyncing}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          {isSyncing ? 'Synchronizing…' : 'Push Local Queue Now'}
        </Button>
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
        <div className="p-6 border-b border-line flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-ink font-display">Pending Event Sync Queue</h3>
            <p className="t-body text-xs text-ink-soft mt-0.5">Events captured while offline waiting to be pushed</p>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full border font-display ${
            outboxCount === 0 ? 'bg-success-50 text-success-800 border-success-100 dark:border-success-600/30' : 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30'
          }`}>
            {outboxCount === 0 ? '✓ 0 Pending Events' : `${outboxCount} Events in Outbox`}
          </span>
        </div>

        {events.length === 0 ? (
          <div className="p-16 text-center text-ink-soft space-y-3">
            <div className="w-16 h-16 rounded-full bg-success-50 text-forest-700 dark:text-forest-600 flex items-center justify-center mx-auto border border-success-100 dark:border-success-600/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="text-base font-extrabold text-ink font-display">Local Queue is Completely Synchronized</p>
            <p className="t-body text-xs text-ink-soft max-w-md mx-auto">
              Every student scan and finalized session from this device has been safely received and acknowledged by the central server.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-soft border-b border-line text-ink-muted font-bold uppercase font-display">
                  <tr>
                    <th className="px-6 py-4">Client Event ID</th>
                    <th className="px-6 py-4">Student ID</th>
                    <th className="px-6 py-4">Capture Source</th>
                    <th className="px-6 py-4">Local Timestamp</th>
                    <th className="px-6 py-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-medium text-ink bg-surface">
                  {events.map((e) => (
                    <tr key={e.clientEventId} className="table-row-hover">
                      <td className="px-6 py-4 font-mono font-bold text-ink">{e.clientEventId.slice(0, 12)}…</td>
                      <td className="px-6 py-4 font-mono font-bold text-ink">{e.studentId ? `${e.studentId.slice(0, 10)}…` : '—'}</td>
                      <td className="px-6 py-4">
                        <span className="bg-surface-soft px-2.5 py-1 rounded-lg border border-line text-[11px] font-bold">
                          {e.source || 'CAMERA'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-ink-muted font-mono">
                        {e.clientTimestamp ? new Date(e.clientTimestamp).toLocaleTimeString() : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border font-display ${
                          e.syncStatus === 'SYNCED'
                            ? 'bg-success-50 text-success-800 border-success-100 dark:border-success-600/30'
                            : e.syncStatus === 'SYNCING'
                            ? 'bg-info-50 text-info-800 border-info-100 dark:border-info-600/30'
                            : e.syncStatus === 'CONFLICT'
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : e.syncStatus === 'FAILED' || e.syncStatus === 'PERMANENT_FAILURE'
                            ? 'bg-danger-50 text-danger-800 border-danger-100 dark:border-danger-600/30'
                            : 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30'
                        }`}>
                          {e.syncStatus || 'PENDING'}
                        </span>
                        {e.syncError && (
                          <span className="block text-[11px] text-danger-600 mt-0.5 font-mono" title={e.syncError}>
                            {e.syncError.slice(0, 20)}…
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="md:hidden divide-y divide-line">
              {events.map((e) => (
                <div key={e.clientEventId} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-ink block">{e.clientEventId.slice(0, 12)}…</span>
                      <span className="text-[11px] text-ink-muted font-mono mt-0.5 block">
                        Student: {e.studentId ? `${e.studentId.slice(0, 10)}…` : '—'}
                      </span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border font-display shrink-0 ${
                      e.syncStatus === 'SYNCED'
                        ? 'bg-success-50 text-success-800 border-success-100 dark:border-success-600/30'
                        : e.syncStatus === 'SYNCING'
                        ? 'bg-info-50 text-info-800 border-info-100 dark:border-info-600/30'
                        : e.syncStatus === 'CONFLICT'
                        ? 'bg-purple-50 text-purple-800 border-purple-200'
                        : e.syncStatus === 'FAILED' || e.syncStatus === 'PERMANENT_FAILURE'
                        ? 'bg-danger-50 text-danger-800 border-danger-100 dark:border-danger-600/30'
                        : 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30'
                    }`}>
                      {e.syncStatus || 'PENDING'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-line text-ink-soft">
                    <span className="font-mono text-[11px]">Source: {e.source || 'CAMERA'}</span>
                    <span className="font-mono text-[11px] text-ink-muted">
                      {e.clientTimestamp ? new Date(e.clientTimestamp).toLocaleTimeString() : '—'}
                    </span>
                  </div>

                  {e.syncError && (
                    <p className="text-[11px] text-danger-600 font-mono bg-danger-50 p-2 rounded-lg border border-danger-100 dark:border-danger-600/30">
                      Error: {e.syncError}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OfflineWorkspace;
