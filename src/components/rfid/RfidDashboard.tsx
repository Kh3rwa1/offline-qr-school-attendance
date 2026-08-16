import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Server, Activity, ShieldAlert, Users } from 'lucide-react';
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
      {/* UID_LEGACY Banner: ONLY if explicitly enabled in config */}
      {stats?.allowLegacyUidMode === true && (
        <div className="bg-warning-50 text-warning-800 p-4 rounded-2xl border border-warning-100 dark:border-warning-600/30">
          <h3 className="font-bold flex items-center gap-2 font-display"><ShieldAlert className="w-5 h-5" /> UID_LEGACY Warning</h3>
          <p className="t-body text-xs mt-1">ALLOW_LEGACY_RFID_UID_MODE is enabled. Legacy UID mode is highly susceptible to card cloning attacks. Upgrade to SECURE mode immediately.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="app-card p-5">
          <h3 className="text-xs text-ink-muted font-bold mb-2 flex items-center gap-2 font-display"><Server className="w-4 h-4" /> Gates Online</h3>
          <div className="text-2xl font-black text-ink font-display font-mono">{stats?.readersOnline || 0} Online</div>
          <div className="t-body text-xs text-ink-muted mt-1">{stats?.readersOffline || 0} Quiet, {stats?.readersPending || 0} Not set up</div>
        </div>
        <div className="app-card p-5">
          <h3 className="text-xs text-ink-muted font-bold mb-2 flex items-center gap-2 font-display"><Activity className="w-4 h-4" /> Student Badges</h3>
          <div className="text-2xl font-black text-ink font-display font-mono">{stats?.activeCards || 0} Active</div>
          <div className="t-body text-xs text-ink-muted mt-1">{stats?.suspendedCards || 0} Stopped, {stats?.revokedCards || 0} Cancelled</div>
        </div>
        <div className="app-card p-5">
          <h3 className="text-xs text-ink-muted font-bold mb-2 flex items-center gap-2 font-display"><Users className="w-4 h-4" /> Who Walked In Today</h3>
          <div className="text-2xl font-black text-ink font-display font-mono">{stats?.todayScans ?? stats?.recentScans?.length ?? 0} Came in</div>
          <div className="t-body text-xs text-ink-muted mt-1">Doorway attendance active</div>
        </div>
      </div>

      <div className="app-card overflow-hidden">
        <div className="p-5 border-b border-line">
          <h3 className="font-extrabold text-ink font-display text-base">Who Walked In Today</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface-soft border-b border-line text-ink-muted font-bold uppercase font-display">
              <tr>
                <th className="py-3 px-5">Time</th>
                <th className="py-3 px-5">Gate Box</th>
                <th className="py-3 px-5 text-right">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {(stats?.recentScans || []).slice(0, 10).map((scan: any, i: number) => (
                <tr key={i} className="table-row-hover">
                  <td className="py-3 px-5 font-mono text-ink-muted">{new Date(scan.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                  <td className="py-3 px-5 font-semibold text-ink">{scan.reader}</td>
                  <td className="py-3 px-5 text-right">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold font-display ${scan.decision === 'ACCEPTED' ? 'bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30' : 'bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30'}`}>
                      {scan.decision === 'ACCEPTED' ? 'Came in' : scan.decision}
                    </span>
                  </td>
                </tr>
              ))}
              {!stats?.recentScans?.length && (
                <tr>
                  <td colSpan={3} className="py-8">
                    <EmptyState
                      kind="generic"
                      title="No one has walked in yet today"
                      description="When students walk through the gate with their badges, they appear here."
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
