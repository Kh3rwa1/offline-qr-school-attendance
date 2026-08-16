import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useLanguage } from '../../app/LanguageProvider';
import { getUserSafeError } from '../../errors/userSafeErrors';
import { Toast } from '../shared/Toast';
import { EmptyState } from '../shared/EmptyState';
import { Button } from '../shared/Button';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X, ShieldAlert, ShieldCheck } from 'lucide-react';

export default function CardStatusPanel({ studentId }: { studentId?: string }) {
  const { activeSchoolId } = useActiveSchool();
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Confirmation modal state
  const [pendingAction, setPendingAction] = useState<{
    cardId: string;
    studentName: string;
    action: 'SUSPEND' | 'REVOKE' | 'ACTIVATE';
  } | null>(null);

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
        body: JSON.stringify({ reason: `Status changed to ${newStatus}` }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'rfid'] });
      setActionError(null);
      setPendingAction(null);
      setSuccessToast(t('badgeUpdatedSuccess'));
    },
    onError: (err: any) => {
      const safeErr = getUserSafeError(err, language);
      setActionError(safeErr.message);
      setPendingAction(null);
    },
  });

  const cards = credentialsData || [];

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs text-ink-muted">
        {language === 'bn' ? 'শিক্ষার্থীর ব্যাজ তালিকা লোড হচ্ছে…' : 'Loading student badges…'}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-xs text-danger-800 font-bold bg-danger-50 rounded-2xl border border-danger-100 dark:border-danger-600/30">
        {language === 'bn' ? 'ব্যাজ লোড করতে সমস্যা হয়েছে।' : 'Failed to load badges.'}
      </div>
    );
  }

  return (
    <div className="app-card p-6 sm:p-7 text-left bg-surface border border-line rounded-3xl shadow-xs">
      {actionError && (
        <div className="mb-4">
          <Toast kind="error" message={actionError} onDismiss={() => setActionError(null)} autoDismiss={false} />
        </div>
      )}

      {successToast && (
        <div className="mb-4">
          <Toast kind="success" message={successToast} onDismiss={() => setSuccessToast(null)} autoDismiss={true} />
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-extrabold text-ink font-display">{t('studentBadges')}</h2>
          <p className="t-body text-xs text-ink-soft mt-0.5">
            {language === 'bn' ? 'বিদ্যালয়ের সকল ছাত্র-ছাত্রীর কার্ডের স্থিতি' : 'All issued student badges and active status'}
          </p>
        </div>
        <span className="text-xs font-bold text-ink-muted font-mono bg-surface-soft px-3 py-1 rounded-full border border-line">
          {cards.length} {language === 'bn' ? 'টি ব্যাজ' : 'Badges'}
        </span>
      </div>

      {cards.length === 0 ? (
        <div className="py-8">
          <EmptyState
            kind="generic"
            title={language === 'bn' ? 'কোনো ব্যাজ ইস্যু করা হয়নি' : 'No badges issued yet'}
            description={language === 'bn' ? 'শিক্ষার্থীদের গেট ব্যাজ দিতে "ব্যাজ দিন" বাটন ব্যবহার করুন।' : 'Use the Give Badge action to issue gate cards to enrolled students.'}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card: any) => {
            const badgeLast4 = card.epcLastFour || (card.credentialDigest ? card.credentialDigest.slice(-4) : '****');
            const displayStatus = 
              card.status === 'ACTIVE' ? t('badgeStatusActive') : 
              card.status === 'SUSPENDED' ? t('badgeStatusSuspended') : 
              t('badgeStatusRevoked');

            return (
              <div
                key={card.id}
                className="border border-line p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-surface hover:bg-surface-soft/60 transition-colors"
              >
                <div>
                  <div className="text-sm font-bold text-ink font-display flex items-center gap-2 flex-wrap">
                    <span>{card.studentName || card.fullName || (language === 'bn' ? 'শিক্ষার্থী' : 'Student')}</span>
                    <span className="text-xs font-mono font-bold text-ink-muted bg-surface-soft px-2.5 py-0.5 rounded-full border border-line">
                      •••• {badgeLast4}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-muted mt-1">
                    {language === 'bn' ? 'ইস্যুর তারিখ' : 'Issued'}: {card.issuedAt || card.createdAt ? new Date(card.issuedAt || card.createdAt).toLocaleDateString(language === 'bn' ? 'bn-IN' : 'en-IN') : '—'}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold font-display border ${
                    card.status === 'ACTIVE' ? 'bg-success-50 text-forest-700 dark:text-forest-600 border-success-100 dark:border-success-600/30' :
                    card.status === 'SUSPENDED' ? 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30' :
                    'bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30'
                  }`}>
                    {displayStatus}
                  </span>

                  {card.status === 'ACTIVE' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPendingAction({
                        cardId: card.id,
                        studentName: card.studentName || card.fullName || 'Student',
                        action: 'SUSPEND',
                      })}
                      className="min-h-[44px] rounded-xl text-xs font-display text-warning-800 border-warning-200 hover:bg-warning-50"
                    >
                      {t('stopStudentBadge')}
                    </Button>
                  )}

                  {card.status === 'SUSPENDED' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setPendingAction({
                        cardId: card.id,
                        studentName: card.studentName || card.fullName || 'Student',
                        action: 'ACTIVATE',
                      })}
                      className="min-h-[44px] rounded-xl text-xs font-display"
                    >
                      {t('activateBadgeAgain')}
                    </Button>
                  )}

                  {card.status !== 'REVOKED' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPendingAction({
                        cardId: card.id,
                        studentName: card.studentName || card.fullName || 'Student',
                        action: 'REVOKE',
                      })}
                      className="min-h-[44px] rounded-xl text-xs font-display text-danger-800 border-danger-200 hover:bg-danger-50"
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

      {/* Confirmation Dialog Modal */}
      <AnimatePresence>
        {pendingAction && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-line rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-lg space-y-4 text-left"
            >
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <h3 className="text-base font-extrabold text-ink font-display flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-warning-700" />
                  {pendingAction.action === 'SUSPEND' && t('confirmStopBadgeTitle')}
                  {pendingAction.action === 'ACTIVATE' && t('activateBadgeModalTitle')}
                  {pendingAction.action === 'REVOKE' && t('confirmCancelBadgeTitle')}
                </h3>
                <button
                  type="button"
                  onClick={() => setPendingAction(null)}
                  className="p-1 rounded-lg text-ink-muted hover:text-ink cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-ink-soft">
                {pendingAction.action === 'SUSPEND' && t('confirmStopBadgeDesc')}
                {pendingAction.action === 'ACTIVATE' && t('activateBadgeExplanation')}
                {pendingAction.action === 'REVOKE' && t('confirmCancelBadgeDesc')}
              </p>

              <div className="p-3.5 rounded-2xl bg-surface-soft border border-line text-xs font-bold text-ink">
                {t('student')}: {pendingAction.studentName}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setPendingAction(null)}
                  className="min-h-[44px] rounded-2xl font-display"
                >
                  {t('cancel')}
                </Button>

                <Button
                  variant={pendingAction.action === 'REVOKE' ? 'secondary' : 'primary'}
                  size="md"
                  isLoading={statusMutation.isPending}
                  onClick={() => {
                    const nextStatus = 
                      pendingAction.action === 'SUSPEND' ? 'SUSPENDED' :
                      pendingAction.action === 'ACTIVATE' ? 'ACTIVE' : 'REVOKED';
                    statusMutation.mutate({ id: pendingAction.cardId, newStatus: nextStatus });
                  }}
                  className={`min-h-[44px] rounded-2xl font-display ${pendingAction.action === 'REVOKE' ? 'bg-danger-600 text-white hover:bg-danger-700' : ''}`}
                >
                  {language === 'bn' ? 'নিশ্চিত করুন' : 'Confirm'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
