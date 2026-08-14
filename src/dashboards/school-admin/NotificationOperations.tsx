import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { StatCard } from '../../components/shared/StatCard';
import { motion } from 'motion/react';
import { MessageSquare, CheckCircle2, Phone, RefreshCw, Send, AlertTriangle, Languages, Play } from 'lucide-react';

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

  if (isLoading) return <LoadingState message="Loading guardian notification queue…" />;
  if (error) return <ErrorState message={(error as any)?.message || 'Failed to load notification queue'} onRetry={() => refetch()} />;

  return (
    <div className="space-y-8" id="notification-operations-view">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 shadow-xl flex items-center gap-3 text-xs font-bold font-display">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

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

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
            Guardian SMS Dispatch Console
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Automated, CDAC DLT-compliant SMS notifications dispatched to parents for {activeSchoolName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={processMutation.isPending}
            onClick={() => processMutation.mutate()}
            className="btn-forest-primary text-sm font-display flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            <span>{processMutation.isPending ? 'Processing Queue…' : 'Run Worker Now'}</span>
          </motion.button>
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
            <Languages className="w-4 h-4 text-[#144e39]" />
            <h3 className="font-extrabold text-sm text-slate-900 font-display">Multi-lingual DLT Message Templates</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {selectedLang === 'EN' && 'English: "Dear Parent, [Student Name] (Roll: [Roll]) was marked ABSENT today at [School Name]. Please contact school if unexpected."'}
            {selectedLang === 'BN' && 'বাংলা: "প্রিয় অভিভাবক, [ছাত্র/ছাত্রীর নাম] আজ বিদ্যালয়ে অনুপস্থিত রয়েছে। প্রয়োজনে প্রধান শিক্ষকের সাথে যোগাযোগ করুন।"'}
            {selectedLang === 'HI' && 'हिन्दी: "प्रिय अभिभावक, आपका बच्चा [छात्र का नाम] आज विद्यालय में अनुपस्थित है।"'}
          </p>
        </div>

        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-full border border-slate-200">
          {(['EN', 'BN', 'HI'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setSelectedLang(lang)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold font-display transition-all cursor-pointer ${
                selectedLang === lang ? 'bg-[#144e39] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {lang === 'EN' ? 'English' : lang === 'BN' ? 'বাংলা' : 'हिन्दी'}
            </button>
          ))}
        </div>
      </div>

      {/* SMS Queue Table */}
      <div className="app-card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-slate-900 font-display">Live SMS Dispatch Queue</h3>
          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
            title="Refresh queue"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase font-display">
              <tr>
                <th className="px-6 py-4">Student & Guardian</th>
                <th className="px-6 py-4">Language</th>
                <th className="px-6 py-4">Message Content</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Queued At / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700 bg-white">
              {jobs.map((sms) => (
                <tr key={sms.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-extrabold text-slate-900 text-sm font-display">
                      {sms.studentName || 'Student'}
                    </p>
                    <p className="text-[11px] font-mono text-slate-400 font-bold">{sms.recipientPhone}</p>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-600 uppercase font-mono">
                    {sms.language}
                  </td>
                  <td className="px-6 py-4 max-w-sm text-slate-600 truncate">
                    {sms.messageText}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase font-display ${
                      sms.status === 'DELIVERED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : sms.status === 'QUEUED' || sms.status === 'PROCESSING'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {sms.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {sms.status === 'PERMANENT_FAILURE' || sms.status === 'FAILED' ? (
                      <button
                        type="button"
                        onClick={() => retryMutation.mutate(sms.id)}
                        className="px-3 py-1 rounded-full text-[11px] font-bold text-[#144e39] bg-[#144e39]/10 hover:bg-[#144e39]/20 font-display cursor-pointer"
                      >
                        Retry Job
                      </button>
                    ) : (
                      <span className="font-mono text-slate-400 text-[11px]">
                        {new Date(sms.queuedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {jobs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                    No SMS jobs in queue. When absence rolls are submitted, parent notifications are queued here automatically.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NotificationOperations;
