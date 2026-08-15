import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Download, RefreshCw } from 'lucide-react';
import { Button } from '../shared/Button';
import { EmptyState } from '../shared/EmptyState';

export default function RfidReports({ schoolId }: { schoolId: string }) {
  const [filterMethod, setFilterMethod] = useState('ALL');

  const { data: scansData, isLoading, error, refetch } = useQuery({
    queryKey: ['schools', schoolId, 'rfid', 'reports', 'scans'],
    queryFn: async () => {
      if (!schoolId) return { recentScans: [] };
      return api<{
        success: boolean;
        readersOnline: number;
        readersOffline: number;
        activeCards: number;
        suspendedCards: number;
        recentScans: any[];
      }>(`/api/v1/schools/${schoolId}/rfid/reports/scans`);
    },
    enabled: Boolean(schoolId),
  });

  const scans = scansData?.recentScans || [];
  const filteredScans = scans.filter((s) => filterMethod === 'ALL' || s.method === filterMethod);

  const totalScans = scans.length;
  const acceptedScans = scans.filter((s) => s.decision === 'ACCEPTED').length;
  const rejectedScans = totalScans - acceptedScans;

  const handleExportCSV = () => {
    const csvContent = [
      ['Time', 'Student', 'Decision', 'Method', 'Reader', 'Location'].join(','),
      ...filteredScans.map((s) => [
        `"${s.time}"`,
        `"${s.student}"`,
        `"${s.decision}"`,
        `"${s.method}"`,
        `"${s.reader}"`,
        `"${s.location}"`,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rfid-scans-${schoolId}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-card p-6 text-left">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-ink font-display">Gate Tap & Capture Report</h2>
          <p className="t-body text-xs text-ink-soft">Real-time gate telemetry logs recorded from hardware readers.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 rounded-full bg-surface-soft hover:bg-surface text-ink-soft hover:text-ink cursor-pointer border border-line"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportCSV}
            disabled={scans.length === 0}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <select
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
          className="border border-line px-4 py-2 rounded-full text-xs font-bold text-ink bg-surface-soft outline-none focus:border-forest-700 font-display cursor-pointer"
        >
          <option value="ALL">All Methods</option>
          <option value="RFID_SECURE">RFID Secure (DESFire)</option>
          <option value="OFFLINE_BUFFER">Offline Synced Taps</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-surface-soft p-4 rounded-2xl border border-line text-center">
          <div className="text-2xl font-extrabold text-ink font-display font-mono">{totalScans}</div>
          <div className="text-[11px] text-ink-muted font-bold">Total Gate Taps</div>
        </div>
        <div className="bg-success-50 p-4 rounded-2xl border border-success-100 dark:border-success-600/30 text-center">
          <div className="text-2xl font-extrabold text-forest-700 dark:text-forest-600 font-display font-mono">{acceptedScans}</div>
          <div className="text-[11px] text-forest-700 dark:text-forest-600 font-bold">Verified & Accepted</div>
        </div>
        <div className="bg-danger-50 p-4 rounded-2xl border border-danger-100 dark:border-danger-600/30 text-center">
          <div className="text-2xl font-extrabold text-danger-800 font-display font-mono">{rejectedScans}</div>
          <div className="text-[11px] text-danger-800 font-bold">Rejected / Anomalies</div>
        </div>
      </div>

      <div className="overflow-x-auto border border-line rounded-2xl">
        <table className="w-full text-xs text-left">
          <thead className="bg-surface-soft border-b border-line text-ink-muted font-bold uppercase font-display">
            <tr>
              <th className="p-3">Time</th>
              <th className="p-3">Student</th>
              <th className="p-3">Method</th>
              <th className="p-3">Reader / Location</th>
              <th className="p-3 text-right">Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line font-medium text-ink bg-surface">
            {filteredScans.map((row: any, i: number) => (
              <tr key={i} className="table-row-hover">
                <td className="p-3 font-mono text-ink-muted">
                  {new Date(row.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td className="p-3 font-bold text-ink font-display">{row.student}</td>
                <td className="p-3">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-info-50 text-info-800 border border-info-100 dark:border-info-600/30">
                    {row.method}
                  </span>
                </td>
                <td className="p-3 text-ink-soft font-medium">
                  {row.reader} <span className="text-ink-muted font-normal">({row.location})</span>
                </td>
                <td className="p-3 text-right">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold font-display ${
                    row.decision === 'ACCEPTED'
                      ? 'bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30'
                      : 'bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30'
                  }`}>
                    {row.decision}
                  </span>
                </td>
              </tr>
            ))}

            {filteredScans.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8">
                  <EmptyState
                    kind="generic"
                    title="No gate scans found"
                    description="No gate scans found for this school."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
