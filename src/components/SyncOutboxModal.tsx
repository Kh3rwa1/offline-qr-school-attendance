import React from 'react';
import { AttendanceEvent, Language, NetworkStatus } from '../types';
import { RefreshCw, CheckCircle2, Database, HardDrive } from 'lucide-react';
import { Button } from './shared/Button';
import { EmptyState } from './shared/EmptyState';

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
  onSyncNow,
  onSimulateForceClose,
}) => {
  const pendingEvents = events.filter((e) => e.syncStatus === 'PENDING');
  const syncedEvents = events.filter((e) => e.syncStatus !== 'PENDING');

  return (
    <div className="app-card p-6 flex-1 flex flex-col gap-5 text-left">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-ink font-display">
            {language === 'bn' ? 'অফলাইন আউটবক্স ও ইনডেক্সড-ডিবি স্টোরেজ' : 'Offline Outbox & IndexedDB Logs'}
          </h2>
          <p className="t-body text-xs text-ink-soft">
            {language === 'bn'
              ? 'ইন্টারনেট ড্রপ হলেও ইভেন্টগুলি নিরাপদে লোকাল স্টোরেজে থাকে'
              : 'IndexedDB durability guarantees offline scan retention across browser restarts'}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onSimulateForceClose}
            leftIcon={<HardDrive className="w-3.5 h-3.5" />}
          >
            Simulate Reboot / Restart App
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onSyncNow}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Sync Outbox Now
          </Button>
        </div>
      </div>

      {/* Health Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface-soft rounded-2xl p-4 border border-line flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning-50 text-warning-800 border border-warning-100 dark:border-warning-600/30 flex items-center justify-center font-bold font-mono shrink-0">
            {pendingEvents.length}
          </div>
          <div>
            <div className="text-xs font-bold text-ink font-display">Pending Outbox Events</div>
            <div className="text-xs text-ink-muted">Awaiting Server Acknowledgement</div>
          </div>
        </div>

        <div className="bg-surface-soft rounded-2xl p-4 border border-line flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30 flex items-center justify-center font-bold shrink-0">
            <CheckCircle2 className="w-5 h-5 text-success-600" />
          </div>
          <div>
            <div className="text-xs font-bold text-ink font-display">Synced Events</div>
            <div className="text-xs text-ink-muted">{syncedEvents.length} Ingested Idempotently</div>
          </div>
        </div>

        <div className="bg-surface-soft rounded-2xl p-4 border border-line flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-info-50 text-info-800 border border-info-100 dark:border-info-600/30 flex items-center justify-center font-bold shrink-0">
            <Database className="w-5 h-5 text-info-600" />
          </div>
          <div>
            <div className="text-xs font-bold text-ink font-display">IndexedDB Health</div>
            <div className="text-xs text-success-800 font-bold font-mono">ACTIVE & ENCRYPTED</div>
          </div>
        </div>
      </div>

      {/* Queue Items Table */}
      {events.length === 0 ? (
        <EmptyState
          kind="queue"
          title="Outbox is empty"
          description="All local attendance events have been synchronized with the cloud ledger."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line max-h-[300px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-soft text-ink-muted font-bold uppercase tracking-wider sticky top-0 z-10 font-display">
              <tr>
                <th className="p-3">Client Event ID</th>
                <th className="p-3">Type</th>
                <th className="p-3">Client Timestamp</th>
                <th className="p-3">Sync Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-mono text-ink-soft bg-surface">
              {events.map((evt) => (
                <tr key={evt.clientEventId} className="table-row-hover">
                  <td className="p-3 font-bold text-ink">{evt.clientEventId}</td>
                  <td className="p-3">
                    <span className="bg-surface-soft text-ink px-2 py-0.5 rounded-full border border-line font-bold">
                      {evt.eventType}
                    </span>
                  </td>
                  <td className="p-3 text-ink-muted">{evt.clientTimestamp}</td>
                  <td className="p-3">
                    {evt.syncStatus === 'ACCEPTED' ? (
                      <span className="text-success-800 font-bold bg-success-50 px-2 py-0.5 rounded-full border border-success-100 dark:border-success-600/30">
                        ACCEPTED (HTTP 200)
                      </span>
                    ) : (
                      <span className="text-warning-800 font-bold bg-warning-50 px-2 py-0.5 rounded-full border border-warning-100 dark:border-warning-600/30">
                        PENDING OUTBOX
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
  );
};

export default SyncOutboxModal;
