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
import { RefreshCw, Send, CheckCircle2, Clock, AlertTriangle, RotateCcw } from 'lucide-react';

interface NotificationJobItem {
  id: string;
  studentId: string;
  studentName?: string;
  recipientPhone: string;
  language: string;
  messageText: string;
  status: 'QUEUED' | 'PROCESSING' | 'DELIVERED' | 'FAILED' | 'PERMANENT_FAILURE';
  attemptCount: number;
  failureReason?: string;
  queuedAt: string;
  deliveredAt?: string;
}

export const NotificationOperations: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();

  // Query: Real Queue
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['schools', activeSchoolId, 'notifications', 'queue'],
    queryFn: async () => {
      if (!activeSchoolId) return null;
      const res = await api<{
        success: boolean;
        summary: { total: number; delivered: number; failed: number; queued: number };
        jobs: NotificationJobItem[];
      }>(`/api/v1/notifications/queue?schoolId=${activeSchoolId}`);
      return res;
    },
    enabled: Boolean(activeSchoolId),
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Mutation: Process Queue Now
  const processMutation = useMutation({
    mutationFn: async () => {
      return api('/api/v1/notifications/process-queue', {
        method: 'POST',
        body: JSON.stringify({ limit: 50 }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'notifications'] });
      setActionError(null);
      setSuccessToast(language === 'bn' ? 'বার্তা পাঠানোর কাজ শুরু হয়েছে।' : 'Sending messages in progress.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      const safe = getUserSafeError(err, language);
      setActionError(safe.message);
    },
  });

  // Mutation: Retry Failed Job
  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return api(`/api/v1/notifications/jobs/${jobId}/retry?schoolId=${activeSchoolId}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'notifications'] });
      setActionError(null);
      setSuccessToast(language === 'bn' ? 'বার্তাটি পুনরায় পাঠানোর জন্য যোগ করা হয়েছে।' : 'Message re-queued for sending.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      const safe = getUserSafeError(err, language);
      setActionError(safe.message);
    },
  });

  const jobs = data?.jobs || [];
  const summary = data?.summary || { total: 0, delivered: 0, failed: 0, queued: 0 };

  if (isLoading) return <LoadingState type="table" message={language === 'bn' ? 'বার্তার বিবরণ লোড হচ্ছে…' : 'Loading parent messages…'} />;
  if (error) return <ErrorState message={(error as any)?.message || 'Failed to load notifications'} onRetry={() => refetch()} />;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 font-display">
            ✓ {t('statusSent')}
          </span>
        );
      case 'QUEUED':
      case 'PROCESSING':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 font-display">
            ⏳ {t('statusWaiting')}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-danger-50 text-danger-800 border border-danger-200 font-display">
            ⚠ {t('statusCouldNotSend')}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 text-left max-w-6xl mx-auto" id="notification-operations-view">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50">
          <Toast kind="success" message={successToast} onDismiss={() => setSuccessToast(null)} />
        </div>
      )}

      {actionError && (
        <div className="mb-4">
          <Toast kind="error" message={actionError} onDismiss={() => setActionError(null)} autoDismiss={false} />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-3xl border border-line shadow-xs">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
            {t('navParentMessages')}
          </h1>
          <p className="t-body text-xs text-ink-soft mt-1">
            {language === 'bn' ? `${activeSchoolName}-এর অনুপস্থিত শিক্ষার্থীদের অভিভাবকদের এসএমএস বার্তা প্রেরণ।` : `Automated attendance SMS notifications to parents for ${activeSchoolName}.`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            disabled={processMutation.isPending || summary.queued === 0}
            isLoading={processMutation.isPending}
            onClick={() => processMutation.mutate()}
            leftIcon={<Send className="w-4 h-4" />}
            className="min-h-[44px] rounded-2xl font-display text-xs"
          >
            {language === 'bn' ? 'অপেক্ষমাণ বার্তা এখনই পাঠান' : 'Send Waiting Messages Now'}
          </Button>
        </div>
      </div>

      {/* 3 Clean Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-bold uppercase font-display">{t('statusSent')}</span>
            <CheckCircle2 className="w-4 h-4 text-forest-700 dark:text-forest-600" />
          </div>
          <div className="text-3xl font-extrabold text-forest-700 dark:text-forest-600 font-display font-mono">
            {summary.delivered}
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-bold uppercase font-display">{t('statusWaiting')}</span>
            <Clock className="w-4 h-4 text-amber-700" />
          </div>
          <div className="text-3xl font-extrabold text-amber-800 font-display font-mono">
            {summary.queued}
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-bold uppercase font-display">{t('statusCouldNotSend')}</span>
            <AlertTriangle className="w-4 h-4 text-danger-700" />
          </div>
          <div className="text-3xl font-extrabold text-danger-800 font-display font-mono">
            {summary.failed}
          </div>
        </div>
      </div>

      {/* SMS Queue Table */}
      <div className="app-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between">
          <h3 className="text-base font-extrabold text-ink font-display">
            {language === 'bn' ? 'অভিভাবকদের বার্তার তালিকা' : 'Parent Messages Log'}
          </h3>
          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 rounded-full hover:bg-surface-soft text-ink-muted cursor-pointer"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="p-12">
            <EmptyState
              kind="generic"
              title={language === 'bn' ? 'কোনো বার্তা অপেক্ষমাণ নেই' : 'No messages waiting'}
              description={language === 'bn' ? 'উপস্থিতি গ্রহণ সমাপ্ত হলে স্বয়ংক্রিয়ভাবে অনুপস্থিত শিক্ষার্থীদের অভিভাবকদের বার্তা তৈরি হবে।' : 'Absent student notifications are queued automatically when attendance is finalized.'}
            />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface hover:bg-surface-soft transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-extrabold text-ink font-display">
                      {job.studentName || (language === 'bn' ? 'শিক্ষার্থী' : 'Student')}
                    </h4>
                    {getStatusBadge(job.status)}
                  </div>
                  <p className="text-xs text-ink-muted font-mono">
                    {language === 'bn' ? 'মোবাইল নং:' : 'Mobile:'} {job.recipientPhone} • {job.queuedAt ? new Date(job.queuedAt).toLocaleTimeString(language === 'bn' ? 'bn-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                  <p className="text-xs text-ink-soft bg-surface-soft p-2.5 rounded-xl border border-line mt-1 max-w-xl">
                    {job.messageText}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {(job.status === 'FAILED' || job.status === 'PERMANENT_FAILURE') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => retryMutation.mutate(job.id)}
                      isLoading={retryMutation.isPending}
                      leftIcon={<RotateCcw className="w-4 h-4" />}
                      className="min-h-[44px] rounded-2xl font-display text-xs"
                    >
                      {t('statusTryAgain')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationOperations;
