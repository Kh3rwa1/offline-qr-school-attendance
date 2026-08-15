import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { Toast } from '../shared/Toast';
import { EmptyState } from '../shared/EmptyState';

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

  if (isLoading) return <div className="p-8 text-center text-xs text-ink-muted">Loading card credentials…</div>;
  if (error) return <div className="p-4 text-xs text-danger-800 font-bold">Failed to load credentials.</div>;

  return (
    <div className="app-card p-6 text-left">
      {actionError && (
        <div className="mb-4">
          <Toast kind="error" message={actionError} onDismiss={() => setActionError(null)} autoDismiss={false} />
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-extrabold text-ink font-display">Card Status & History</h2>
        <span className="text-xs font-bold text-ink-muted font-mono">{cards.length} Cards Enrolled</span>
      </div>

      <div className="space-y-3">
        {cards.map((card: any) => (
          <div key={card.id} className="border border-line p-4 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-surface hover:bg-surface-soft transition-colors">
            <div>
              <div className="font-mono text-xs font-bold text-ink flex items-center gap-2">
                <span>{card.credentialDigest}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-soft border border-line text-ink-soft font-sans font-bold">
                  {card.securityMode || 'SECURE'}
                </span>
                {card.studentName && (
                  <span className="text-ink-muted font-sans font-normal">({card.studentName})</span>
                )}
              </div>
              <div className="text-[11px] text-ink-muted mt-0.5 font-mono">
                Issued: {card.issuedAt || card.createdAt ? new Date(card.issuedAt || card.createdAt).toLocaleDateString() : '—'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold font-display ${
                card.status === 'ACTIVE' ? 'bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30' :
                card.status === 'SUSPENDED' ? 'bg-warning-50 text-warning-800 border border-warning-100 dark:border-warning-600/30' :
                'bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30'
              }`}>
                {card.status}
              </span>

              {card.status === 'ACTIVE' && (
                <button
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate({ id: card.id, newStatus: 'SUSPENDED' })}
                  className="text-[11px] bg-warning-50 hover:bg-warning-100 text-warning-800 border border-warning-100 dark:border-warning-600/30 px-3 py-1 rounded-full font-bold font-display cursor-pointer"
                >
                  Suspend
                </button>
              )}
              {card.status === 'SUSPENDED' && (
                <button
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate({ id: card.id, newStatus: 'ACTIVE' })}
                  className="text-[11px] bg-success-50 hover:bg-success-100 text-success-800 border border-success-100 dark:border-success-600/30 px-3 py-1 rounded-full font-bold font-display cursor-pointer"
                >
                  Reactivate
                </button>
              )}
              {card.status !== 'REVOKED' && (
                <button
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate({ id: card.id, newStatus: 'REVOKED' })}
                  className="text-[11px] bg-danger-50 hover:bg-danger-100 text-danger-800 border border-danger-100 dark:border-danger-600/30 px-3 py-1 rounded-full font-bold font-display cursor-pointer"
                >
                  Revoke
                </button>
              )}
            </div>
          </div>
        ))}

        {cards.length === 0 && (
          <div className="py-8">
            <EmptyState
              kind="generic"
              title="No smartcard credentials found"
              description="Cards will appear here once enrolled."
            />
          </div>
        )}
      </div>
    </div>
  );
}
