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
import { RefreshCw, Languages, Play } from 'lucide-react';

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
  const queryClient = useQueryClient();
  const [selectedLang, setSelectedLang] = useState<'EN' | 'BN' | 'HI'>('EN');

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
      setSuccessToast('Queue batch processed by background worker.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      setActionError(err.message || 'Worker execution failed');
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
      setSuccessToast('Job re-queued for delivery.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      setActionError(err.message || 'Job retry failed');
    },
  });

  const jobs = data?.jobs || [];
  const summary = data?.summary || { total: 0, delivered: 0, failed: 0, queued: 0 };

  if (isLoading) return <LoadingState type="table" message="Loading guardian notification queue…" />;
  if (error) return <ErrorState message={(error as any)?.message || 'Failed to load notification queue'} onRetry={() => refetch()} />;

  return (
    <div className="space-y-8 text-left" id="notification-operations-view">
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
            Guardian SMS Dispatch Console
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            Automated, CDAC DLT-compliant SMS notifications dispatched to parents for {activeSchoolName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            disabled={processMutation.isPending}
            isLoading={processMutation.isPending}
            onClick={() => processMutation.mutate()}
            leftIcon={<Play className="w-4 h-4" />}
          >
            {processMutation.isPending ? 'Processing Queue…' : 'Run Worker Now'}
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Dispatched"
          value={`${summary.total} Alerts`}
          trend={{ value: `${summary.delivered} Delivered`, isPositive: true }}
          variant="hero-forest"
        />
        <StatCard
          title="Delivered Successfully"
          value={`${summary.delivered} SMS`}
          trend={{ value: "Telecom ACK Received", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Queued in Dispatch"
          value={`${summary.queued} Pending`}
          trend={{ value: "Rate-limited Queue", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Delivery Failures"
          value={`${summary.failed} Failed`}
          trend={{ value: summary.failed === 0 ? "Zero Errors" : "Retry Available", isPositive: summary.failed === 0 }}
          variant="default"
        />
      </div>

      {/* Template Preview and Language Selector */}
      <div className="app-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-forest-700 dark:text-forest-600" />
            <h3 className="font-extrabold text-sm text-ink font-display">Multi-lingual DLT Message Templates (Preview)</h3>
          </div>
          <p className="t-body text-xs text-ink-soft mt-1">
            Preview standard CDAC templates. Live SMS notifications are automatically dispatched in each student's preferred language configured in school registry.
          </p>
          <p className="text-xs text-ink font-medium mt-2 bg-surface-soft p-2.5 rounded-2xl border border-line">
            {selectedLang === 'EN' && 'English: "Dear Parent, [Student Name] (Roll: [Roll]) was marked ABSENT today at [School Name]. Please contact school if unexpected."'}
            {selectedLang === 'BN' && 'বাংলা: "প্রিয় অভিভাবক, [ছাত্র/ছাত্রীর নাম] আজ বিদ্যালয়ে অনুপস্থিত রয়েছে। প্রয়োজনে প্রধান শিক্ষকের সাথে যোগাযোগ করুন।"'}
            {selectedLang === 'HI' && 'हिन्दी: "प्रिय अभिभावक, आपका बच्चा [छात्र का नाम] আজ विद्यालय में अनुपस्थित है।"'}
          </p>
        </div>

        <div className="flex gap-1.5 p-1 bg-surface-soft rounded-full border border-line">
          {(['EN', 'BN', 'HI'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setSelectedLang(lang)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold font-display transition-all cursor-pointer ${
                selectedLang === lang ? 'bg-forest-700 text-white shadow-2xs' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {lang === 'EN' ? 'English' : lang === 'BN' ? 'বাংলা' : 'हिन्दी'}
            </button>
          ))}
        </div>
      </div>

      {/* SMS Queue Table */}
      <div className="app-card overflow-hidden">
        <div className="p-6 border-b border-line flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-ink font-display">Live SMS Dispatch Queue</h3>
          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 rounded-full bg-surface-soft hover:bg-surface text-ink-soft hover:text-ink transition-all cursor-pointer border border-line"
            title="Refresh queue"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              kind="notifications"
              title="No SMS jobs in queue"
              description="When absence rolls are submitted, parent notifications are queued here automatically."
            />
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-soft border-b border-line text-ink-muted font-bold uppercase font-display">
                  <tr>
                    <th className="px-6 py-4">Student & Guardian</th>
                    <th className="px-6 py-4">Language</th>
                    <th className="px-6 py-4">Message Content</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Queued At / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-medium text-ink bg-surface">
                  {jobs.map((sms) => (
                    <tr key={sms.id} className="table-row-hover">
                      <td className="px-6 py-4">
                        <p className="font-extrabold text-ink text-sm font-display">
                          {sms.studentName || 'Student'}
                        </p>
                        <p className="text-[11px] font-mono text-ink-muted font-bold">{sms.recipientPhone}</p>
                      </td>
                      <td className="px-6 py-4 font-bold text-ink-soft uppercase font-mono">
                        {sms.language}
                      </td>
                      <td className="px-6 py-4 max-w-sm text-ink-soft truncate">
                        {sms.messageText}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase font-display ${
                          sms.status === 'DELIVERED'
                            ? 'bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30'
                            : sms.status === 'QUEUED' || sms.status === 'PROCESSING'
                            ? 'bg-warning-50 text-warning-800 border border-warning-100 dark:border-warning-600/30'
                            : 'bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30'
                        }`}>
                          {sms.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {sms.status === 'PERMANENT_FAILURE' || sms.status === 'FAILED' ? (
                          <button
                            type="button"
                            onClick={() => retryMutation.mutate(sms.id)}
                            className="px-3 py-1 rounded-full text-[11px] font-bold text-forest-700 dark:text-forest-600 bg-success-50 hover:bg-success-100 border border-success-100 dark:border-success-600/30 font-display cursor-pointer"
                          >
                            Retry Job
                          </button>
                        ) : (
                          <span className="font-mono text-ink-muted text-[11px]">
                            {new Date(sms.queuedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="md:hidden divide-y divide-line">
              {jobs.map((sms) => (
                <div key={sms.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-extrabold text-ink text-sm font-display">{sms.studentName || 'Student'}</h4>
                      <span className="text-xs font-mono font-bold text-ink-muted block mt-0.5">{sms.recipientPhone}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase font-display shrink-0 ${
                      sms.status === 'DELIVERED'
                        ? 'bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30'
                        : sms.status === 'QUEUED' || sms.status === 'PROCESSING'
                        ? 'bg-warning-50 text-warning-800 border border-warning-100 dark:border-warning-600/30'
                        : 'bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30'
                    }`}>
                      {sms.status}
                    </span>
                  </div>

                  <p className="text-xs text-ink-soft line-clamp-2 bg-surface-soft p-2.5 rounded-xl border border-line">
                    {sms.messageText}
                  </p>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-line text-ink-soft">
                    <span className="font-mono text-[11px] text-ink-muted uppercase">Lang: {sms.language}</span>
                    {sms.status === 'PERMANENT_FAILURE' || sms.status === 'FAILED' ? (
                      <button
                        type="button"
                        onClick={() => retryMutation.mutate(sms.id)}
                        className="min-h-[44px] px-4 py-1.5 rounded-xl text-xs font-bold text-forest-700 dark:text-forest-600 bg-success-50 hover:bg-success-100 border border-success-100 dark:border-success-600/30 font-display cursor-pointer flex items-center"
                      >
                        Retry Job
                      </button>
                    ) : (
                      <span className="font-mono text-ink-muted text-[11px]">
                        Queued: {new Date(sms.queuedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationOperations;
