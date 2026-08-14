import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { StatCard } from '../../components/shared/StatCard';
import { ShieldCheck, UserCheck, Calendar, Filter, Search, Download, RefreshCw, Eye } from 'lucide-react';
import { motion } from 'motion/react';

interface AuditLogItem {
  id: string;
  schoolId?: string;
  schoolName?: string;
  actorUserId?: string;
  actorName?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  createdAt: string;
}

export const AuditOverview: React.FC = () => {
  const [actionFilter, setActionFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['audit', 'platform', actionFilter, page],
    queryFn: async () => {
      const url = `/api/v1/audit/platform?page=${page}&limit=25${actionFilter !== 'ALL' ? `&action=${actionFilter}` : ''}`;
      const res = await api<{ success: boolean; logs: AuditLogItem[]; total: number }>(url);
      return res;
    },
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;

  const handleExport = () => {
    const csvContent = [
      ['Timestamp', 'Action', 'Actor Name', 'School Name', 'Resource Type', 'IP Address', 'Details'].join(','),
      ...logs.map((l) => [
        `"${l.createdAt}"`,
        `"${l.action}"`,
        `"${l.actorName || l.actorUserId || 'System'}"`,
        `"${l.schoolName || 'Platform HQ'}"`,
        `"${l.resourceType || ''}"`,
        `"${l.ipAddress || ''}"`,
        `"${JSON.stringify(l.details || {}).replace(/"/g, '""')}"`,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `platform-audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <LoadingState message="Loading immutable audit logs…" />;
  if (error) return <ErrorState message={(error as any)?.message || 'Failed to load audit logs'} onRetry={() => refetch()} />;

  return (
    <div className="space-y-8" id="audit-overview-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
            System Audit & Governance Log
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Immutable platform-wide audit trail of administrative actions, school provisioning, and security lifecycle transitions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExport}
            disabled={logs.length === 0}
            className="btn-forest-primary text-sm font-display shadow-md cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export Audit CSV</span>
          </motion.button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Events Logged"
          value={`${total} Events`}
          trend={{ value: "Immutable Ledger", isPositive: true }}
          variant="hero-forest"
        />
        <StatCard
          title="Security Actions"
          value={logs.filter(l => l.action.includes('LOGIN') || l.action.includes('STATUS')).length}
          trend={{ value: "Auth & Privileged Operations", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="School Lifecycle"
          value={logs.filter(l => l.action.includes('SCHOOL')).length}
          trend={{ value: "Tenants Provisioned/Updated", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Audit Policy"
          value="7-Year Statutory"
          trend={{ value: "Govt. of India Standard", isPositive: true }}
          variant="default"
        />
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:border-[#144e39] transition-all cursor-pointer"
          >
            <option value="ALL">All Actions</option>
            <option value="USER_LOGIN">USER_LOGIN</option>
            <option value="USER_LOGOUT">USER_LOGOUT</option>
            <option value="SCHOOL_PROVISIONED">SCHOOL_PROVISIONED</option>
            <option value="SCHOOL_STATUS_CHANGED">SCHOOL_STATUS_CHANGED</option>
            <option value="MEMBER_INVITED">MEMBER_INVITED</option>
            <option value="SUSPEND_MEMBERSHIP">SUSPEND_MEMBERSHIP</option>
            <option value="CARD_ENROLLED">CARD_ENROLLED</option>
            <option value="READER_STATUS_CHANGED">READER_STATUS_CHANGED</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          className="p-2.5 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer self-end sm:self-auto"
          title="Refresh logs"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="app-card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-slate-900 font-display">Live Governance Stream</h3>
          <span className="text-xs font-bold text-[#144e39] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            Database WAL Backed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase font-display">
              <tr>
                <th className="px-6 py-4">Action Taken</th>
                <th className="px-6 py-4">Actor</th>
                <th className="px-6 py-4">Institution</th>
                <th className="px-6 py-4">Metadata</th>
                <th className="px-6 py-4">IP Address</th>
                <th className="px-6 py-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700 bg-white">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-[#144e39]/10 text-[#144e39] border border-[#144e39]/20 font-mono">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-extrabold text-slate-900 text-sm font-display">
                      {log.actorName || 'System Process'}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {log.actorUserId ? log.actorUserId.slice(0, 8) + '…' : '—'}
                    </p>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800">
                    {log.schoolName || (log.schoolId ? `School (${log.schoolId.slice(0, 8)}…)` : 'Platform HQ')}
                  </td>
                  <td className="px-6 py-4 font-mono text-[11px] text-slate-600 max-w-xs truncate">
                    {log.details ? JSON.stringify(log.details) : '—'}
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-500">
                    {log.ipAddress || '127.0.0.1'}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-slate-500">
                    {new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                </tr>
              ))}

              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    No audit records match the selected action filter.
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

export default AuditOverview;
