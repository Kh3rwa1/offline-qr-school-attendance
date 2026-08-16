import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { StatCard } from '../../components/shared/StatCard';
import { Button } from '../../components/shared/Button';
import { Toast } from '../../components/shared/Toast';
import { EmptyState } from '../../components/shared/EmptyState';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ShieldAlert, X } from 'lucide-react';

interface CredentialItem {
  id: string;
  studentId: string;
  studentName?: string;
  studentCode?: string;
  credentialDigest: string;
  securityMode: string;
  keyVersion: number;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';
  issuedAt: string;
  expiresAt?: string;
}

export const CardOperations: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedCard, setSelectedCard] = useState<CredentialItem | null>(null);
  const [actionType, setActionType] = useState<'SUSPEND' | 'REACTIVATE' | 'REVOKE' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Query: Live Credentials
  const { data: credentialsData, isLoading, error, refetch } = useQuery({
    queryKey: ['schools', activeSchoolId, 'rfid', 'credentials'],
    queryFn: async () => {
      if (!activeSchoolId) return [];
      const res = await api<{ success: boolean; credentials: CredentialItem[] }>(
        `/api/v1/schools/${activeSchoolId}/rfid/credentials`
      );
      return res.credentials || [];
    },
    enabled: Boolean(activeSchoolId),
  });

  // Mutation: Card Action
  const cardActionMutation = useMutation({
    mutationFn: async ({
      credentialId,
      action,
      reason,
    }: {
      credentialId: string;
      action: 'SUSPEND' | 'REACTIVATE' | 'REVOKE';
      reason: string;
    }) => {
      const endpoint = action === 'SUSPEND' ? 'suspend' : action === 'REACTIVATE' ? 'reactivate' : 'revoke';
      return api(`/api/v1/schools/${activeSchoolId}/rfid/credentials/${credentialId}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'rfid'] });
      setSelectedCard(null);
      setActionType(null);
      setActionReason('');
      setActionError(null);
      setSuccessToast('Card status updated successfully.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      setActionError(err.message || 'Operation failed');
    },
  });

  const cards = credentialsData || [];
  const filteredCards = cards.filter((c) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (c.studentName || '').toLowerCase().includes(term) ||
      (c.studentCode || '').toLowerCase().includes(term) ||
      c.credentialDigest.toLowerCase().includes(term);
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = cards.filter((c) => c.status === 'ACTIVE').length;
  const suspendedCount = cards.filter((c) => c.status === 'SUSPENDED').length;
  const revokedCount = cards.filter((c) => c.status === 'REVOKED').length;

  if (isLoading) return <LoadingState type="table" message="Loading smartcard registry…" />;
  if (error) return <ErrorState message={(error as any)?.message || 'Failed to load credentials'} onRetry={() => refetch()} />;

  return (
    <div className="space-y-8 text-left" id="card-operations-view">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50">
          <Toast kind="success" message={successToast} onDismiss={() => setSuccessToast(null)} />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
            Smartcard Directory & Lifecycle
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            Search student smartcards, inspect hardware lock status, and execute instantaneous card revocations at {activeSchoolName}.
          </p>
        </div>
      </div>

      {actionError && (
        <div className="mb-4">
          <Toast kind="error" message={actionError} onDismiss={() => setActionError(null)} autoDismiss={false} />
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Issued UHF Badges"
          value={`${cards.length} Badges`}
          trend={{ value: `${activeCount} Active in Circulation`, isPositive: true }}
          variant="hero-forest"
        />
        <StatCard
          title="Active Badges"
          value={`${activeCount} Active`}
          trend={{ value: "EPC Gen 2 / ISO 18000-63", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Suspended / Temp Lock"
          value={`${suspendedCount} Cards`}
          trend={{ value: "Temporarily Inactive", isPositive: false }}
          variant="default"
        />
        <StatCard
          title="Permanently Revoked"
          value={`${revokedCount} Cards`}
          trend={{ value: "Blacklisted from Gates", isPositive: false }}
          variant="default"
        />
      </div>

      {/* Search and Card List */}
      <div className="app-card overflow-hidden">
        <div className="p-6 border-b border-line flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-64 max-w-md">
            <Search className="w-4 h-4 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student name, code, or digest…"
              className="w-full pl-11 pr-4 py-2.5 bg-surface-soft border border-line rounded-full text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-full bg-surface-soft border border-line text-xs font-bold text-ink outline-none cursor-pointer font-display"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="REVOKED">Revoked</option>
            </select>
          </div>
        </div>

        {filteredCards.length === 0 ? (
          <div className="p-8">
            <EmptyState
              kind="generic"
              title="No smartcards found"
              description="Enroll new smartcards or adjust your search filter."
            />
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-soft border-b border-line text-ink-muted font-bold uppercase font-display">
                  <tr>
                    <th className="px-6 py-4">Card Digest</th>
                    <th className="px-6 py-4">Assigned Student</th>
                    <th className="px-6 py-4">Security Standard</th>
                    <th className="px-6 py-4">Issue Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-medium text-ink bg-surface">
                  {filteredCards.map((c) => (
                    <tr key={c.id} className="table-row-hover">
                      <td className="px-6 py-4 font-mono font-bold text-ink">
                        <span className="bg-surface-soft px-2.5 py-1 rounded-lg border border-line">
                          {c.credentialDigest}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-extrabold text-ink text-sm font-display">
                        {c.studentName || 'Unassigned'}
                        {c.studentCode && <span className="block text-[11px] text-ink-muted font-mono">Code: {c.studentCode}</span>}
                      </td>
                      <td className="px-6 py-4 text-ink-soft font-medium font-mono">
                        {c.securityMode} (v{c.keyVersion})
                      </td>
                      <td className="px-6 py-4 text-ink-muted font-mono">
                        {new Date(c.issuedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase font-display ${
                          c.status === 'ACTIVE'
                            ? 'bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30'
                            : c.status === 'SUSPENDED'
                            ? 'bg-warning-50 text-warning-800 border border-warning-100 dark:border-warning-600/30'
                            : 'bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {c.status === 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCard(c);
                                setActionType('SUSPEND');
                                setActionReason('');
                                setActionError(null);
                              }}
                              className="px-3 py-1 rounded-full text-[11px] font-bold text-warning-800 bg-warning-50 hover:bg-warning-100 border border-warning-100 dark:border-warning-600/30 font-display cursor-pointer"
                            >
                              Suspend
                            </button>
                          )}

                          {c.status === 'SUSPENDED' && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCard(c);
                                setActionType('REACTIVATE');
                                setActionReason('');
                                setActionError(null);
                              }}
                              className="px-3 py-1 rounded-full text-[11px] font-bold text-success-800 bg-success-50 hover:bg-success-100 border border-success-100 dark:border-success-600/30 font-display cursor-pointer"
                            >
                              Reactivate
                            </button>
                          )}

                          {c.status !== 'REVOKED' && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCard(c);
                                setActionType('REVOKE');
                                setActionReason('');
                                setActionError(null);
                              }}
                              className="px-3 py-1 rounded-full text-[11px] font-bold text-danger-800 bg-danger-50 hover:bg-danger-100 border border-danger-100 dark:border-danger-600/30 font-display cursor-pointer"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="md:hidden divide-y divide-line">
              {filteredCards.map((c) => (
                <div key={c.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-extrabold text-ink text-sm font-display">{c.studentName || 'Unassigned Student'}</h4>
                      <span className="text-[11px] text-ink-muted font-mono block mt-0.5">{c.studentCode ? `Code: ${c.studentCode}` : c.credentialDigest}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase font-display shrink-0 ${
                      c.status === 'ACTIVE'
                        ? 'bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30'
                        : c.status === 'SUSPENDED'
                        ? 'bg-warning-50 text-warning-800 border border-warning-100 dark:border-warning-600/30'
                        : 'bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30'
                    }`}>
                      {c.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 text-ink-soft">
                    <span className="font-mono text-[11px]">{c.securityMode} (v{c.keyVersion})</span>
                    <span className="font-mono text-[11px] text-ink-muted">
                      {new Date(c.issuedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                    {c.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCard(c);
                          setActionType('SUSPEND');
                          setActionReason('');
                          setActionError(null);
                        }}
                        className="min-h-[44px] px-4 py-1.5 rounded-xl text-xs font-bold text-warning-800 bg-warning-50 hover:bg-warning-100 border border-warning-100 dark:border-warning-600/30 font-display cursor-pointer flex items-center"
                      >
                        Suspend
                      </button>
                    )}

                    {c.status === 'SUSPENDED' && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCard(c);
                          setActionType('REACTIVATE');
                          setActionReason('');
                          setActionError(null);
                        }}
                        className="min-h-[44px] px-4 py-1.5 rounded-xl text-xs font-bold text-success-800 bg-success-50 hover:bg-success-100 border border-success-100 dark:border-success-600/30 font-display cursor-pointer flex items-center"
                      >
                        Reactivate
                      </button>
                    )}

                    {c.status !== 'REVOKED' && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCard(c);
                          setActionType('REVOKE');
                          setActionReason('');
                          setActionError(null);
                        }}
                        className="min-h-[44px] px-4 py-1.5 rounded-xl text-xs font-bold text-danger-800 bg-danger-50 hover:bg-danger-100 border border-danger-100 dark:border-danger-600/30 font-display cursor-pointer flex items-center"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Action Confirmation Modal */}
      <AnimatePresence>
        {selectedCard && actionType && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-md w-full p-6 text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-warning-600" />
                  <h3 className="text-lg font-extrabold font-display text-ink">
                    {actionType === 'SUSPEND' ? 'Suspend Smartcard' : actionType === 'REACTIVATE' ? 'Reactivate Smartcard' : 'Revoke Smartcard'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCard(null);
                    setActionType(null);
                  }}
                  className="w-8 h-8 rounded-full bg-surface-soft hover:bg-surface flex items-center justify-center text-ink-muted hover:text-ink transition-all cursor-pointer border border-line"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="t-body text-xs text-ink-soft mb-4">
                Are you sure you want to <strong>{actionType.toLowerCase()}</strong> card <span className="font-mono font-bold">{selectedCard.credentialDigest}</span> (Student: {selectedCard.studentName || 'Unassigned'})?
              </p>

              <div className="mb-4">
                <label className="block t-label text-ink mb-1 font-display">
                  Reason for Action (Mandatory) *
                </label>
                <textarea
                  required
                  rows={3}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="e.g. Card reported lost by guardian, replacement card issued…"
                  className="w-full px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-xs font-medium text-ink focus:bg-surface focus:border-forest-700 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedCard(null);
                    setActionType(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant={actionType === 'REVOKE' ? 'danger' : 'primary'}
                  size="sm"
                  disabled={cardActionMutation.isPending || actionReason.trim().length < 3}
                  isLoading={cardActionMutation.isPending}
                  onClick={() => cardActionMutation.mutate({
                    credentialId: selectedCard.id,
                    action: actionType,
                    reason: actionReason.trim(),
                  })}
                >
                  {cardActionMutation.isPending ? 'Updating…' : `Confirm ${actionType}`}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CardOperations;
