import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { LoadingState } from '../shared/LoadingState';
import { ErrorState } from '../shared/ErrorState';
import { Radio, CheckCircle2, AlertTriangle, ShieldCheck, Plus, X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReaderItem {
  id: string;
  deviceId: string;
  name: string;
  location?: string;
  directionMode: 'IN' | 'OUT' | 'BIDIRECTIONAL' | 'NONE';
  readerModel?: string;
  firmwareVersion?: string;
  adapterType: string;
  securityCapability: string;
  status: 'PENDING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  lastSeenAt?: string;
  lastSequenceNumber?: number;
  clockDriftMs?: number;
}

export default function ReaderManagement({ schoolId }: { schoolId: string }) {
  const queryClient = useQueryClient();
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [provisionForm, setProvisionForm] = useState({
    deviceId: '',
    name: 'Gate 1 Turnstile A',
    location: 'Main Entrance',
    directionMode: 'IN' as const,
    adapterType: 'GATEWAY' as const,
    securityCapability: 'DESFIRE_EV2_EV3' as const,
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Query: Readers
  const { data: readersData, isLoading, error, refetch } = useQuery({
    queryKey: ['schools', schoolId, 'rfid', 'readers'],
    queryFn: async () => {
      const res = await api<{ success: boolean; readers?: ReaderItem[]; report?: ReaderItem[] }>(`/api/v1/schools/${schoolId}/rfid/readers`);
      return res.readers || res.report || [];
    },
    enabled: Boolean(schoolId),
  });

  // Mutation: Register / Provision Reader
  const registerMutation = useMutation({
    mutationFn: async (payload: typeof provisionForm) => {
      return api(`/api/v1/schools/${schoolId}/rfid/readers/register`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', schoolId, 'rfid', 'readers'] });
      setIsProvisionOpen(false);
      setProvisionForm({
        deviceId: '',
        name: 'Gate 1 Turnstile A',
        location: 'Main Entrance',
        directionMode: 'IN',
        adapterType: 'GATEWAY',
        securityCapability: 'DESFIRE_EV2_EV3',
      });
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to register gate reader terminal');
    },
  });

  const [actionError, setActionError] = useState<string | null>(null);

  // Mutation: Status Change (Approve / Suspend / Revoke)
  const statusMutation = useMutation({
    mutationFn: async ({ readerId, status }: { readerId: string; status: 'APPROVED' | 'SUSPENDED' | 'REVOKED' }) => {
      const actionEndpoint = status === 'APPROVED' ? 'approve' : status === 'SUSPENDED' ? 'suspend' : 'revoke';
      return api(`/api/v1/schools/${schoolId}/rfid/readers/${readerId}/${actionEndpoint}`, {
        method: 'POST',
        body: JSON.stringify({ reason: `Status changed to ${status} by administrator` }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', schoolId, 'rfid', 'readers'] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to update reader status');
    },
  });

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!provisionForm.deviceId.trim()) {
      setFormError('Device Hardware ID is required');
      return;
    }
    registerMutation.mutate(provisionForm);
  };

  const readers = readersData || [];

  if (isLoading) return <LoadingState message="Loading gate reader terminals…" />;
  if (error) return <ErrorState message={(error as any)?.message || 'Failed to load readers'} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-700 font-bold text-xs">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 font-display">Gate Reader Terminals</h2>
          <p className="text-xs text-slate-500 font-medium">Physical hardware terminals bound by mTLS certificates and sequence counters.</p>
        </div>

        <button
          type="button"
          onClick={() => setIsProvisionOpen(true)}
          className="btn-forest-primary text-xs font-display flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Reader Terminal</span>
        </button>
      </div>

      <div className="app-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 font-display">
                <th className="py-4 px-6">Terminal / Location</th>
                <th className="py-4 px-6">Direction Mode</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Hardware Security</th>
                <th className="py-4 px-6">Sequence Counter</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {readers.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-6">
                    <span className="font-extrabold text-slate-900 block font-display text-sm">
                      {r.name}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {r.location || 'Entrance Turnstile'} • Device ID: <span className="font-mono">{r.deviceId}</span>
                    </span>
                  </td>
                  <td className="py-4 px-6 font-semibold text-slate-700">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {r.directionMode}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase font-display ${
                      r.status === 'APPROVED' || r.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : r.status === 'PENDING'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-slate-600">
                    <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                      {r.securityCapability || 'DESFIRE_EV2_EV3'}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-mono text-slate-700 font-bold">
                    #{r.lastSequenceNumber || 0}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {r.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => statusMutation.mutate({ readerId: r.id, status: 'APPROVED' })}
                          className="px-3 py-1 rounded-full text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 font-display cursor-pointer"
                        >
                          Approve
                        </button>
                      )}
                      {r.status !== 'REVOKED' ? (
                        <button
                          type="button"
                          onClick={() => statusMutation.mutate({ readerId: r.id, status: 'REVOKED' })}
                          className="px-3 py-1 rounded-full text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 font-display cursor-pointer"
                        >
                          Revoke
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-bold">Revoked</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {readers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    No physical gate readers registered. Click "Add Reader Terminal" to provision an ESP32 or Raspberry Pi terminal.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision Reader Modal */}
      <AnimatePresence>
        {isProvisionOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-left"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-extrabold text-slate-900 font-display">
                  Provision Gate Reader Terminal
                </h3>
                <button
                  type="button"
                  onClick={() => setIsProvisionOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                    Hardware Device ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={provisionForm.deviceId}
                    onChange={(e) => setProvisionForm({ ...provisionForm, deviceId: e.target.value })}
                    placeholder="e.g. ESP32-GATE-01-A"
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 font-mono focus:bg-white focus:border-[#144e39] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                    Terminal Friendly Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={provisionForm.name}
                    onChange={(e) => setProvisionForm({ ...provisionForm, name: e.target.value })}
                    placeholder="e.g. Main Gate Turnstile 1"
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                    Physical Location
                  </label>
                  <input
                    type="text"
                    value={provisionForm.location}
                    onChange={(e) => setProvisionForm({ ...provisionForm, location: e.target.value })}
                    placeholder="e.g. North Gate Entrance"
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsProvisionOpen(false)}
                    className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 font-display cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={registerMutation.isPending}
                    className="btn-forest-primary text-xs font-display px-5 py-2 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {registerMutation.isPending ? 'Registering…' : 'Register Terminal'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
