import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Server, Activity, ShieldAlert, Wifi, CloudOff } from 'lucide-react';

export default function RfidDashboard({ schoolId }: { schoolId: string }) {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await api<any>(`/api/v1/schools/${schoolId}/rfid/reports/scans`);
        setStats(res);
      } catch (e) {
        console.error(e);
      }
    }
    loadStats();
  }, [schoolId]);

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-200">
        <h3 className="font-bold flex items-center gap-2"><ShieldAlert className="w-5 h-5" /> UID_LEGACY Warning</h3>
        <p className="text-sm">ALLOW_LEGACY_RFID_UID_MODE is enabled. Legacy UID mode is highly susceptible to card cloning attacks. Upgrade to SECURE mode immediately.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm">
          <h3 className="text-sm text-slate-500 font-bold mb-2 flex items-center gap-2"><Server className="w-4 h-4" /> Reader Status</h3>
          <div className="text-2xl font-black">{stats?.readersOnline || 0} Online</div>
          <div className="text-sm text-slate-500">{stats?.readersOffline || 0} Offline, {stats?.readersPending || 0} Pending</div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm">
          <h3 className="text-sm text-slate-500 font-bold mb-2 flex items-center gap-2"><Activity className="w-4 h-4" /> Card Statistics</h3>
          <div className="text-2xl font-black">{stats?.activeCards || 0} Active</div>
          <div className="text-sm text-slate-500">{stats?.suspendedCards || 0} Suspended, {stats?.revokedCards || 0} Revoked</div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm">
          <h3 className="text-sm text-slate-500 font-bold mb-2 flex items-center gap-2"><CloudOff className="w-4 h-4" /> Offline Queue Health</h3>
          <div className="text-2xl font-black">{stats?.queueDepth || 0} Events</div>
          <div className="text-sm text-slate-500">Last sync: {stats?.lastSync || 'Never'} · Oldest: {stats?.queueAge || '0s'}</div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">Recent Scans</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="pb-2">Time</th>
              <th className="pb-2">Reader</th>
              <th className="pb-2">Decision</th>
            </tr>
          </thead>
          <tbody>
            {(stats?.recentScans || []).slice(0, 10).map((scan: any, i: number) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-3">{new Date(scan.time).toLocaleString()}</td>
                <td className="py-3">{scan.reader}</td>
                <td className="py-3 font-bold">
                  <span className={`px-2 py-1 rounded-lg text-xs ${scan.decision === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {scan.decision}
                  </span>
                </td>
              </tr>
            ))}
            {!stats?.recentScans?.length && <tr><td colSpan={3} className="py-4 text-center text-slate-500">No recent scans</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
