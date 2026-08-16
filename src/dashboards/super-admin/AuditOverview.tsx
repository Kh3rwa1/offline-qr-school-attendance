import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { StatCard } from '../../components/shared/StatCard';
import { Button } from '../../components/shared/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { Download, RefreshCw } from 'lucide-react';
import { PLAIN_TERMS, AUDIT_ACTION_PLAIN, getAuditActionPlainText } from '../../utils/superAdminPlainTermsMapper';

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

  if (isLoading) return <LoadingState type="table" message="Loading immutable audit logs…" />;
  if (error) return <ErrorState message={(error as any)?.message || 'Failed to load audit logs'} onRetry={() => refetch()} />;

  return (
    <div className="space-y-8 text-left" id="audit-overview-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
            System Audit & Governance Log
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            Immutable platform-wide audit trail of administrative actions, school provisioning, and security lifecycle transitions.
          </p>
          <p className="t-body text-xs text-ink-muted mt-1">
            {PLAIN_TERMS.auditTrail.en}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={handleExport}
            disabled={logs.length === 0}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export Audit CSV
          </Button>
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
        <div title={PLAIN_TERMS.auditRetention.en}>
          <StatCard
            title="Audit Policy"
            value="7-Year Statutory"
            trend={{ value: "Govt. of India Standard", isPositive: true }}
            variant="default"
          />
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-surface p-4 rounded-3xl border border-line shadow-2xs">
        <div className="flex items-center gap-2">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-bold text-ink outline-none focus:border-forest-700 transition-all cursor-pointer"
          >
            <option value="ALL">All Actions</option>
            <option value="USER_LOGIN">USER_LOGIN — {AUDIT_ACTION_PLAIN.USER_LOGIN}</option>
            <option value="USER_LOGOUT">USER_LOGOUT — {AUDIT_ACTION_PLAIN.USER_LOGOUT}</option>
            <option value="SCHOOL_PROVISIONED">SCHOOL_PROVISIONED — {AUDIT_ACTION_PLAIN.SCHOOL_PROVISIONED}</option>
            <option value="SCHOOL_STATUS_CHANGED">SCHOOL_STATUS_CHANGED — {AUDIT_ACTION_PLAIN.SCHOOL_STATUS_CHANGED}</option>
            <option value="MEMBER_INVITED">MEMBER_INVITED — {AUDIT_ACTION_PLAIN.MEMBER_INVITED}</option>
            <option value="SUSPEND_MEMBERSHIP">SUSPEND_MEMBERSHIP — {AUDIT_ACTION_PLAIN.SUSPEND_MEMBERSHIP}</option>
            <option value="CARD_ENROLLED">CARD_ENROLLED — {AUDIT_ACTION_PLAIN.CARD_ENROLLED}</option>
            <option value="READER_STATUS_CHANGED">READER_STATUS_CHANGED — {AUDIT_ACTION_PLAIN.READER_STATUS_CHANGED}</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          className="p-2.5 rounded-full bg-surface-soft hover:bg-surface text-ink-soft hover:text-ink transition-all cursor-pointer self-end sm:self-auto border border-line shadow-2xs"
          title="Refresh logs"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="app-card overflow-hidden">
        <div className="p-6 border-b border-line flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-ink font-display">Live Governance Stream</h3>
          <span className="text-xs font-bold text-forest-700 dark:text-forest-600 bg-success-50 px-3 py-1 rounded-full border border-success-100 dark:border-success-600/30 font-display" title={PLAIN_TERMS.walBackup.en}>
            Database WAL Backed
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              kind="generic"
              title="No audit records found"
              description="No platform audit log records match the current filter criteria."
              actionText="Reset Filter"
              onAction={() => setActionFilter('ALL')}
            />
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-soft border-b border-line text-ink-muted font-bold uppercase font-display">
                  <tr>
                    <th className="px-6 py-4">Action Taken</th>
                    <th className="px-6 py-4">Actor</th>
                    <th className="px-6 py-4">Institution</th>
                    <th className="px-6 py-4">Metadata</th>
                    <th className="px-6 py-4">IP Address</th>
                    <th className="px-6 py-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-medium text-ink bg-surface">
                  {logs.map((log) => (
                    <tr key={log.id} className="table-row-hover">
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 font-mono">
                          {log.action}
                        </span>
                        <p className="text-[11px] text-ink-muted mt-1 font-sans">
                          {getAuditActionPlainText(log.action)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-extrabold text-ink text-sm font-display">
                          {log.actorName || 'System Process'}
                        </p>
                        <p className="text-[11px] text-ink-muted font-mono">
                          {log.actorUserId ? log.actorUserId.slice(0, 8) + '…' : '—'}
                        </p>
                      </td>
                      <td className="px-6 py-4 font-bold text-ink">
                        {log.schoolName || (log.schoolId ? `School (${log.schoolId.slice(0, 8)}…)` : 'Platform HQ')}
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] text-ink-soft max-w-xs truncate">
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </td>
                      <td className="px-6 py-4 font-mono text-ink-muted">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-ink-muted">
                        {new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="md:hidden divide-y divide-line">
              {logs.map((log) => (
                <div key={log.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 font-mono">
                        {log.action}
                      </span>
                      <p className="text-[11px] text-ink-muted mt-1">
                        {getAuditActionPlainText(log.action)}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-ink-muted">
                      {new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-ink text-sm font-display">{log.actorName || 'System Process'}</h4>
                    <p className="text-xs text-ink-soft mt-0.5 font-bold">
                      {log.schoolName || (log.schoolId ? `School (${log.schoolId.slice(0, 8)}…)` : 'Platform HQ')}
                    </p>
                  </div>

                  <details className="text-xs text-ink-soft bg-surface-soft p-2 rounded-xl border border-line cursor-pointer">
                    <summary className="font-bold text-ink select-none font-display">Technical Details & Metadata</summary>
                    <div className="mt-2 space-y-1 font-mono text-[11px]">
                      <div><span className="text-ink-muted">IP:</span> {log.ipAddress || '127.0.0.1'}</div>
                      <div><span className="text-ink-muted">Actor ID:</span> {log.actorUserId || 'System'}</div>
                      {log.details && (
                        <div className="break-all pt-1 border-t border-line text-ink-muted">
                          {JSON.stringify(log.details)}
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AuditOverview;
