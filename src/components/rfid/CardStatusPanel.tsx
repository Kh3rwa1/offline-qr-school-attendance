import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { Shield, ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function CardStatusPanel({ studentId }: { studentId?: string }) {
  const { activeSchoolId } = useActiveSchool();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: credentialsData, isLoading, error } = useQuery({
    queryKey: ['schools', activeSchoolId, 'rfid', 'credentials', studentId || 'all'],
    queryFn: async () => {
      if (!activeSchoolId) return [];
      const query = studentId ? `?studentId=${studentId}` : '';
      const res = await api<{ success: boolean; credentials: any[] }>(
        `/api/v1/schools/${activeSchoolId}/rfid/credentials${query}`
      );
      return res.credentials || [];
    },
    enabled: Boolean(activeSchoolId),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' }) => {
      const endpoint = newStatus === 'SUSPENDED' ? 'suspend' : newStatus === 'ACTIVE' ? 'reactivate' : 'revoke';
      return api(`/api/v1/schools/${activeSchoolId}/rfid/credentials/${id}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ reason: `Status changed to ${newStatus} via CardStatusPanel` }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'rfid'] });
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to update card status');
    },
  });

  const cards = credentialsData || [];

  if (isLoading) return <div className="p-8 text-center text-xs text-slate-400">Loading card credentials…</div>;
  if (error) return <div className="p-4 text-xs text-rose-600 font-bold">Failed to load credentials.</div>;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 text-left">
      {actionError && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-700 font-bold">Dismiss</button>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-slate-900 font-display">Card Status & History</h2>
        <span className="text-xs font-bold text-slate-400 font-mono">{cards.length} Cards Enrolled</span>
      </div>

      <div className="space-y-3">
        {cards.map((card: any) => (
          <div key={card.id} className="border border-slate-100 p-4 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:bg-slate-50 transition-colors">
            <div>
              <div className="font-mono text-xs font-bold text-slate-900 flex items-center gap-2">
                <span>{card.credentialDigest}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-sans font-bold">
                  {card.securityMode || 'SECURE'}
                </span>
                {card.studentName && (
                  <span className="text-slate-500 font-sans font-normal">({card.studentName})</span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Issued: {card.issuedAt || card.createdAt ? new Date(card.issuedAt || card.createdAt).toLocaleDateString() : '—'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-display ${
                card.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                card.status === 'SUSPENDED' ? 'bg-amber-100 text-amber-800' :
                'bg-rose-100 text-rose-800'
              }`}>
                {card.status}
              </span>

              {card.status === 'ACTIVE' && (
                <button
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate({ id: card.id, newStatus: 'SUSPENDED' })}
                  className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full font-bold cursor-pointer"
                >
                  Suspend
                </button>
              )}
              {card.status === 'SUSPENDED' && (
                <button
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate({ id: card.id, newStatus: 'ACTIVE' })}
                  className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full font-bold cursor-pointer"
                >
                  Reactivate
                </button>
              )}
              {card.status !== 'REVOKED' && (
                <button
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate({ id: card.id, newStatus: 'REVOKED' })}
                  className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full font-bold cursor-pointer"
                >
                  Revoke
                </button>
              )}
            </div>
          </div>
        ))}

        {cards.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-400">
            No smartcard credentials found.
          </div>
        )}
      </div>
    </div>
  );
}
