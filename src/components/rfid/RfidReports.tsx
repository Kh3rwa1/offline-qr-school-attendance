import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Download, RefreshCw, Radio } from 'lucide-react';

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
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-left">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 font-display">Gate Tap & Capture Report</h2>
          <p className="text-xs text-slate-500 font-medium">Real-time gate telemetry logs recorded from hardware readers.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={scans.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[#144e39] text-white rounded-full font-bold text-xs font-display hover:bg-[#0f3d2c] transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <select
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
          className="border border-slate-200 px-4 py-2 rounded-full text-xs font-bold text-slate-700 bg-slate-50 outline-none"
        >
          <option value="ALL">All Methods</option>
          <option value="RFID_SECURE">RFID Secure (DESFire)</option>
          <option value="OFFLINE_BUFFER">Offline Synced Taps</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
          <div className="text-2xl font-extrabold text-slate-900 font-display">{totalScans}</div>
          <div className="text-[11px] text-slate-500 font-bold">Total Gate Taps</div>
        </div>
        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 text-center">
          <div className="text-2xl font-extrabold text-[#144e39] font-display">{acceptedScans}</div>
          <div className="text-[11px] text-emerald-700 font-bold">Verified & Accepted</div>
        </div>
        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 text-center">
          <div className="text-2xl font-extrabold text-rose-700 font-display">{rejectedScans}</div>
          <div className="text-[11px] text-rose-600 font-bold">Rejected / Anomalies</div>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-2xl">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase font-display">
            <tr>
              <th className="p-3">Time</th>
              <th className="p-3">Student</th>
              <th className="p-3">Method</th>
              <th className="p-3">Reader / Location</th>
              <th className="p-3 text-right">Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {filteredScans.map((row: any, i: number) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="p-3 font-mono text-slate-500">
                  {new Date(row.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td className="p-3 font-bold text-slate-900">{row.student}</td>
                <td className="p-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-blue-50 text-blue-700 border border-blue-200">
                    {row.method}
                  </span>
                </td>
                <td className="p-3 text-slate-600 font-medium">
                  {row.reader} <span className="text-slate-400 font-normal">({row.location})</span>
                </td>
                <td className="p-3 text-right">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-display ${
                    row.decision === 'ACCEPTED'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {row.decision}
                  </span>
                </td>
              </tr>
            ))}

            {filteredScans.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                  No gate scans found for this school.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
