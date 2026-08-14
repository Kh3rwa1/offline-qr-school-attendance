import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { StatCard } from '../../components/shared/StatCard';
import { ShieldAlert, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface IncidentItem {
  id: string;
  readerId: string;
  credentialDigest?: string;
  decision: string;
  rejectionCode?: string;
  scanTimestamp: string;
  direction?: string;
}

export const RfidIncidentQueue: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();

  const { data: incidentsData, isLoading, error, refetch } = useQuery({
    queryKey: ['schools', activeSchoolId, 'rfid', 'incidents'],
    queryFn: async () => {
      if (!activeSchoolId) return [];
      const res = await api<{ success: boolean; report: IncidentItem[] }>(
        `/api/v1/schools/${activeSchoolId}/rfid/reports/rejections`
      );
      return res.report || [];
    },
    enabled: Boolean(activeSchoolId),
  });

  const incidents = incidentsData || [];

  if (isLoading) return <LoadingState message="Loading gate anomaly stream…" />;
  if (error) return <ErrorState message={(error as any)?.message || 'Failed to load gate incidents'} onRetry={() => refetch()} />;

  return (
    <div className="space-y-8" id="rfid-incident-queue-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
            Gate Anomaly & Incident Queue
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Real-time rejection telemetry, unverified smartcard taps, and security events for {activeSchoolName}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          className="btn-forest-primary text-sm font-display flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Incidents</span>
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Rejections"
          value={`${incidents.length} Events`}
          trend={{ value: "Hardware Gate Telemetry", isPositive: incidents.length === 0 }}
          variant="hero-forest"
        />
        <StatCard
          title="Replay / Out-of-Order"
          value={incidents.filter(i => i.rejectionCode?.includes('REPLAY') || i.rejectionCode?.includes('SEQUENCE')).length}
          trend={{ value: "Sequence Enforced", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Unregistered Taps"
          value={incidents.filter(i => i.rejectionCode?.includes('NOT_FOUND') || i.rejectionCode?.includes('UNREGISTERED')).length}
          trend={{ value: "Safely Refused Entry", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Tamper / Invalid Proof"
          value={incidents.filter(i => i.rejectionCode?.includes('PROOF') || i.rejectionCode?.includes('CRYPTO')).length}
          trend={{ value: "AES-CMAC Guard", isPositive: true }}
          variant="default"
        />
      </div>

      {/* Incidents Table */}
      <div className="app-card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-slate-900 font-display">Recent Gate Anomalies</h3>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            Database WAL Stream
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase font-display">
              <tr>
                <th className="px-6 py-4">Rejection Code</th>
                <th className="px-6 py-4">Reader Terminal</th>
                <th className="px-6 py-4">Card Digest</th>
                <th className="px-6 py-4">Direction</th>
                <th className="px-6 py-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700 bg-white">
              {incidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200 font-mono">
                      {inc.rejectionCode || inc.decision}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-slate-800">
                    {inc.readerId ? inc.readerId.slice(0, 8) + '…' : 'Gate 1'}
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-700">
                    {inc.credentialDigest ? inc.credentialDigest.slice(0, 12) + '…' : '—'}
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-700">
                    {inc.direction || 'IN'}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-slate-500">
                    {new Date(inc.scanTimestamp).toLocaleString('en-IN', { timeStyle: 'medium', dateStyle: 'short' })}
                  </td>
                </tr>
              ))}

              {incidents.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                    No rejected scans or gate anomalies recorded. Gate terminals are operating cleanly.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RfidIncidentQueue;
