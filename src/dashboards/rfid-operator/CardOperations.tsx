import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { StatCard } from '../../components/shared/StatCard';
import { motion, AnimatePresence } from 'motion/react';
import { Search, AlertTriangle, ShieldAlert, X, CheckCircle2 } from 'lucide-react';

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

  if (isLoading) return <LoadingState message="Loading smartcard registry…" />;
  if (error) return <ErrorState message={(error as any)?.message || 'Failed to load credentials'} onRetry={() => refetch()} />;

  return (
    <div className="space-y-8" id="card-operations-view">
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 shadow-xl flex items-center gap-3 text-xs font-bold font-display"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
            Smartcard Directory & Lifecycle
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Search student smartcards, inspect hardware lock status, and execute instantaneous card revocations at {activeSchoolName}.
          </p>
        </div>
      </div>

      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-700 font-bold text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Issued Smartcards"
          value={`${cards.length} Cards`}
          trend={{ value: `${activeCount} Active in Circulation`, isPositive: true }}
          variant="hero-forest"
        />
        <StatCard
          title="Active Cards"
          value={`${activeCount} Active`}
          trend={{ value: "DESFire EV2/EV3 Certified", isPositive: true }}
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
        <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-64 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by student name, code, or digest…"
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#144e39] outline-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="REVOKED">Revoked</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase font-display">
              <tr>
                <th className="px-6 py-4">Card Digest</th>
                <th className="px-6 py-4">Assigned Student</th>
                <th className="px-6 py-4">Security Standard</th>
                <th className="px-6 py-4">Issue Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700 bg-white">
              {filteredCards.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-mono font-bold text-slate-900">
                    <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                      {c.credentialDigest}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-extrabold text-slate-900 text-sm font-display">
                    {c.studentName || 'Unassigned'}
                    {c.studentCode && <span className="block text-[11px] text-slate-400 font-mono">Code: {c.studentCode}</span>}
                  </td>
                  <td className="px-6 py-4 text-slate-700 font-medium font-mono">
                    {c.securityMode} (v{c.keyVersion})
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono">
                    {new Date(c.issuedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase font-display ${
                      c.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : c.status === 'SUSPENDED'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
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
                          className="px-3 py-1 rounded-full text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 font-display cursor-pointer"
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
                          className="px-3 py-1 rounded-full text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 font-display cursor-pointer"
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
                          className="px-3 py-1 rounded-full text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 font-display cursor-pointer"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredCards.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    No smartcards found in this registry matching your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Confirmation Modal */}
      <AnimatePresence>
        {selectedCard && actionType && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                  <h3 className="text-lg font-extrabold font-display text-slate-900">
                    {actionType === 'SUSPEND' ? 'Suspend Smartcard' : actionType === 'REACTIVATE' ? 'Reactivate Smartcard' : 'Revoke Smartcard'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCard(null);
                    setActionType(null);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600 mb-4">
                Are you sure you want to <strong>{actionType.toLowerCase()}</strong> card <span className="font-mono font-bold">{selectedCard.credentialDigest}</span> (Student: {selectedCard.studentName || 'Unassigned'})?
              </p>

              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                  Reason for Action (Mandatory) *
                </label>
                <textarea
                  required
                  rows={3}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="e.g. Card reported lost by guardian, replacement card issued…"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:border-[#144e39] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCard(null);
                    setActionType(null);
                  }}
                  className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 font-display cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={cardActionMutation.isPending || actionReason.trim().length < 3}
                  onClick={() => cardActionMutation.mutate({
                    credentialId: selectedCard.id,
                    action: actionType,
                    reason: actionReason.trim(),
                  })}
                  className={`px-5 py-2 rounded-full text-white font-bold text-xs font-display shadow-md cursor-pointer disabled:opacity-50 ${
                    actionType === 'REVOKE' ? 'bg-rose-600 hover:bg-rose-700' : 'btn-forest-primary'
                  }`}
                >
                  {cardActionMutation.isPending ? 'Updating…' : `Confirm ${actionType}`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CardOperations;
