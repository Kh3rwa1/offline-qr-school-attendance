import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useLanguage } from '../../app/LanguageProvider';
import { getUserSafeError } from '../../errors/userSafeErrors';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { Button } from '../../components/shared/Button';
import { Toast } from '../../components/shared/Toast';
import { EmptyState } from '../../components/shared/EmptyState';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { Search, CreditCard, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface CredentialItem {
  id: string;
  studentId: string;
  studentName?: string;
  studentCode?: string;
  credentialDigest: string;
  epcLastFour?: string;
  securityMode: string;
  keyVersion: number;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';
  issuedAt: string;
  expiresAt?: string;
}

export const CardOperations: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedCard, setSelectedCard] = useState<CredentialItem | null>(null);
  const [actionType, setActionType] = useState<'SUSPEND' | 'REACTIVATE' | 'REVOKE' | null>(null);
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
    }: {
      credentialId: string;
      action: 'SUSPEND' | 'REACTIVATE' | 'REVOKE';
    }) => {
      const endpoint = action === 'SUSPEND' ? 'suspend' : action === 'REACTIVATE' ? 'reactivate' : 'revoke';
      return api(`/api/v1/schools/${activeSchoolId}/rfid/credentials/${credentialId}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ reason: `Action ${action} by operator` }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'rfid'] });
      setSelectedCard(null);
      setActionType(null);
      setActionError(null);
      setSuccessToast(t('badgeUpdatedSuccess'));
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      const safe = getUserSafeError(err, language);
      setActionError(safe.message);
    },
  });

  const cards = credentialsData || [];
  const filteredCards = cards.filter((c) => {
    const term = searchTerm.toLowerCase();
    const last4 = (c.epcLastFour || c.credentialDigest.slice(-4)).toLowerCase();
    const matchesSearch =
      (c.studentName || '').toLowerCase().includes(term) ||
      (c.studentCode || '').toLowerCase().includes(term) ||
      last4.includes(term);
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = cards.filter((c) => c.status === 'ACTIVE').length;
  const suspendedCount = cards.filter((c) => c.status === 'SUSPENDED').length;
  const revokedCount = cards.filter((c) => c.status === 'REVOKED').length;

  if (isLoading) return <LoadingState type="table" message={t('loadingBadges')} />;
  if (error) return <ErrorState message={getUserSafeError(error, language).message} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6 sm:space-y-8 text-left max-w-6xl mx-auto" id="card-operations-view">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50">
          <Toast kind="success" message={successToast} onDismiss={() => setSuccessToast(null)} />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-3xl border border-line shadow-xs">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
            {t('navStudentBadges')}
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            {t('searchBadgesSubtitle', { schoolName: activeSchoolName })}
          </p>
        </div>
      </div>

      {actionError && (
        <div className="mb-4">
          <Toast kind="error" message={actionError} onDismiss={() => setActionError(null)} autoDismiss={false} />
        </div>
      )}

      {/* Live Badge Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-sm font-bold uppercase font-display">{t('statusActive')}</span>
            <CheckCircle2 className="w-4 h-4 text-forest-700 dark:text-forest-600" />
          </div>
          <div className="text-3xl font-extrabold text-forest-700 dark:text-forest-600 font-display font-mono">
            {activeCount}
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-sm font-bold uppercase font-display">{t('statusStopped')}</span>
            <AlertTriangle className="w-4 h-4 text-amber-700" />
          </div>
          <div className="text-3xl font-extrabold text-amber-800 font-display font-mono">
            {suspendedCount}
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-sm font-bold uppercase font-display">{t('statusCancelled')}</span>
            <XCircle className="w-4 h-4 text-danger-700" />
          </div>
          <div className="text-3xl font-extrabold text-danger-800 font-display font-mono">
            {revokedCount}
          </div>
        </div>
      </div>

      {/* Search and Card List */}
      <div className="app-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-line flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-64 max-w-md">
            <Search className="w-4 h-4 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('searchStudentsPlaceholder')}
              className="w-full pl-11 pr-4 py-2.5 bg-surface-soft border border-line rounded-2xl text-sm font-semibold text-ink placeholder:text-ink-muted outline-none focus:border-forest-700 min-h-[44px]"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-bold text-ink outline-none cursor-pointer font-display min-h-[44px]"
            >
              <option value="ALL">{t('allBadges')}</option>
              <option value="ACTIVE">{t('statusActive')}</option>
              <option value="SUSPENDED">{t('statusStopped')}</option>
              <option value="REVOKED">{t('statusCancelled')}</option>
            </select>
          </div>
        </div>

        {filteredCards.length === 0 ? (
          <div className="p-12">
            <EmptyState
              kind="generic"
              title={t('noBadgesFound')}
              description={t('noBadgesFoundDesc')}
            />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {filteredCards.map((c) => {
              const badgeLast4 = c.epcLastFour || (c.credentialDigest ? c.credentialDigest.slice(-4) : '••••');
              return (
                <div
                  key={c.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface hover:bg-surface-soft transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-forest-700 text-white flex items-center justify-center font-extrabold text-sm font-display shrink-0">
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-extrabold text-ink font-display">
                          {c.studentName || t('unassignedStudent')}
                        </h4>
                        <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold font-display ${
                          c.status === 'ACTIVE'
                            ? 'bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30'
                            : c.status === 'SUSPENDED'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-danger-50 text-danger-800 border border-danger-200'
                        }`}>
                          {c.status === 'ACTIVE' ? t('statusActive') : c.status === 'SUSPENDED' ? t('statusStopped') : t('statusCancelled')}
                        </span>
                      </div>
                      <p className="text-sm text-ink-muted mt-0.5 font-mono">
                        {t('badgeNumberLabel')} •••• {badgeLast4} {c.studentCode && `• ID: ${c.studentCode}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {c.status === 'ACTIVE' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCard(c);
                          setActionType('SUSPEND');
                        }}
                        className="min-h-[44px] rounded-2xl font-display text-sm font-bold text-amber-800 hover:bg-amber-50"
                      >
                        {t('stopStudentBadge')}
                      </Button>
                    )}

                    {c.status === 'SUSPENDED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCard(c);
                          setActionType('REACTIVATE');
                        }}
                        className="min-h-[44px] rounded-2xl font-display text-sm font-bold text-forest-700 dark:text-forest-600"
                      >
                        {t('activateBadgeAgain')}
                      </Button>
                    )}

                    {c.status !== 'REVOKED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedCard(c);
                          setActionType('REVOKE');
                        }}
                        className="min-h-[44px] rounded-2xl font-display text-sm font-bold text-danger-700 hover:bg-danger-50"
                      >
                        {t('cancelBadgeForever')}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Dialogs */}
      <ConfirmationDialog
        isOpen={Boolean(selectedCard && actionType === 'SUSPEND')}
        onClose={() => {
          setSelectedCard(null);
          setActionType(null);
        }}
        onConfirm={() => {
          if (selectedCard) {
            cardActionMutation.mutate({ credentialId: selectedCard.id, action: 'SUSPEND' });
          }
        }}
        title={t('stopBadgeModalTitle')}
        description={t('stopBadgeExplanation')}
        confirmText={t('stopStudentBadge')}
        cancelText={t('cancel')}
        intent="warning"
      />

      <ConfirmationDialog
        isOpen={Boolean(selectedCard && actionType === 'REACTIVATE')}
        onClose={() => {
          setSelectedCard(null);
          setActionType(null);
        }}
        onConfirm={() => {
          if (selectedCard) {
            cardActionMutation.mutate({ credentialId: selectedCard.id, action: 'REACTIVATE' });
          }
        }}
        title={t('activateBadgeModalTitle')}
        description={t('activateBadgeExplanation')}
        confirmText={t('activateBadgeAgain')}
        cancelText={t('cancel')}
        intent="success"
      />

      <ConfirmationDialog
        isOpen={Boolean(selectedCard && actionType === 'REVOKE')}
        onClose={() => {
          setSelectedCard(null);
          setActionType(null);
        }}
        onConfirm={() => {
          if (selectedCard) {
            cardActionMutation.mutate({ credentialId: selectedCard.id, action: 'REVOKE' });
          }
        }}
        title={t('cancelBadgeModalTitle')}
        description={t('cancelBadgeExplanation')}
        confirmText={t('cancelBadgeForever')}
        cancelText={t('cancel')}
        intent="danger"
      />
    </div>
  );
};

export default CardOperations;
