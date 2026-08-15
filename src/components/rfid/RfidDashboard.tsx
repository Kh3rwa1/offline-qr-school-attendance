import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Server, Activity, ShieldAlert, CloudOff } from 'lucide-react';
import { EmptyState } from '../shared/EmptyState';

export default function RfidDashboard({ schoolId }: { schoolId: string }) {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await api<any>(`/api/v1/schools/${schoolId}/rfid/reports/summary`);
        setStats(res);
      } catch (e) {
        console.error(e);
      }
    }
    loadStats();
  }, [schoolId]);

  return (
    <div className="space-y-6 text-left">
      <div className="bg-warning-50 text-warning-800 p-4 rounded-2xl border border-warning-100 dark:border-warning-600/30">
        <h3 className="font-bold flex items-center gap-2 font-display"><ShieldAlert className="w-5 h-5" /> UID_LEGACY Warning</h3>
        <p className="t-body text-xs mt-1">ALLOW_LEGACY_RFID_UID_MODE is enabled. Legacy UID mode is highly susceptible to card cloning attacks. Upgrade to SECURE mode immediately.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="app-card p-5">
          <h3 className="text-xs text-ink-muted font-bold mb-2 flex items-center gap-2 font-display"><Server className="w-4 h-4" /> Reader Status</h3>
          <div className="text-2xl font-black text-ink font-display font-mono">{stats?.readersOnline || 0} Online</div>
          <div className="t-body text-xs text-ink-muted mt-1">{stats?.readersOffline || 0} Offline, {stats?.readersPending || 0} Pending</div>
        </div>
        <div className="app-card p-5">
          <h3 className="text-xs text-ink-muted font-bold mb-2 flex items-center gap-2 font-display"><Activity className="w-4 h-4" /> Card Statistics</h3>
          <div className="text-2xl font-black text-ink font-display font-mono">{stats?.activeCards || 0} Active</div>
          <div className="t-body text-xs text-ink-muted mt-1">{stats?.suspendedCards || 0} Suspended, {stats?.revokedCards || 0} Revoked</div>
        </div>
        <div className="app-card p-5">
          <h3 className="text-xs text-ink-muted font-bold mb-2 flex items-center gap-2 font-display"><CloudOff className="w-4 h-4" /> Edge Sync Telemetry</h3>
          <div className="text-2xl font-black text-ink font-display font-mono">{stats?.queueDepth !== null && stats?.queueDepth !== undefined ? `${stats.queueDepth} Events` : 'Local Buffer Active'}</div>
          <div className="t-body text-xs text-ink-muted mt-1">Autonomous Gate Readers · Replay-Protected</div>
        </div>
      </div>

      <div className="app-card overflow-hidden">
        <div className="p-5 border-b border-line">
          <h3 className="font-extrabold text-ink font-display text-base">Recent Scans</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface-soft border-b border-line text-ink-muted font-bold uppercase font-display">
              <tr>
                <th className="py-3 px-5">Time</th>
                <th className="py-3 px-5">Reader</th>
                <th className="py-3 px-5 text-right">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {(stats?.recentScans || []).slice(0, 10).map((scan: any, i: number) => (
                <tr key={i} className="table-row-hover">
                  <td className="py-3 px-5 font-mono text-ink-muted">{new Date(scan.time).toLocaleString()}</td>
                  <td className="py-3 px-5 font-semibold text-ink">{scan.reader}</td>
                  <td className="py-3 px-5 text-right">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold font-display ${scan.decision === 'ACCEPTED' ? 'bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30' : 'bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30'}`}>
                      {scan.decision}
                    </span>
                  </td>
                </tr>
              ))}
              {!stats?.recentScans?.length && (
                <tr>
                  <td colSpan={3} className="py-8">
                    <EmptyState
                      kind="generic"
                      title="No recent scans"
                      description="Recent RFID scans will appear here in real time."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
