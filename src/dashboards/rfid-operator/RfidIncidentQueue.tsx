import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useLanguage } from '../../app/LanguageProvider';
import { mapRfidRejectionCode } from '../../utils/rfidRejectionMapper';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { Button } from '../../components/shared/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { RefreshCw, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface IncidentItem {
  id: string;
  readerId: string;
  credentialDigest?: string;
  decision: string;
  rejectionCode?: string;
  scanTimestamp: string;
  direction?: string;
}

export const RfidIncidentQueue: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const { language, t } = useLanguage();
  const navigate = useNavigate();

  const { data: incidentsData, isLoading, error, refetch } = useQuery({
    queryKey: ['schools', activeSchoolId, 'rfid', 'incidents'],
    queryFn: async () => {
      if (!activeSchoolId) return [];
      const res = await api<{ success: boolean; report: IncidentItem[] }>(
        `/api/v1/schools/${activeSchoolId}/rfid/reports/rejections`
      );
      return res.report || [];
    },
    enabled: Boolean(activeSchoolId),
  });

  const incidents = incidentsData || [];

  if (isLoading) return <LoadingState type="table" message={language === 'bn' ? 'গেটের তথ্য লোড হচ্ছে…' : 'Loading gate issues…'} />;
  if (error) return <ErrorState message={(error as any)?.message || 'Failed to load gate incidents'} onRetry={() => refetch()} />;

  const unknownCount = incidents.filter(i => (i.rejectionCode || '').includes('NOT_FOUND') || (i.rejectionCode || '').includes('UNREGISTERED')).length;
  const duplicateCount = incidents.filter(i => (i.rejectionCode || '').includes('NONCE') || (i.rejectionCode || '').includes('REPLAY') || (i.rejectionCode || '').includes('DUPLICATE')).length;

  return (
    <div className="space-y-6 sm:space-y-8 text-left max-w-6xl mx-auto" id="rfid-incident-queue-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-3xl border border-line shadow-xs">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
            {t('navGateProblems')}
          </h1>
          <p className="t-body text-xs text-ink-soft mt-1">
            {language === 'bn' ? `${activeSchoolName}-এর গেটে স্ক্যান না হওয়া কার্ডের তালিকা ও সমাধানের উপায়।` : `List of cards that could not be verified at the gate and what to do next for ${activeSchoolName}.`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={() => refetch()}
            leftIcon={<RefreshCw className="w-4 h-4" />}
            className="min-h-[44px] rounded-2xl font-display text-xs"
          >
            {language === 'bn' ? 'রিফ্রেশ করুন' : 'Refresh List'}
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/app/rfid-operator/enrollment')}
            className="min-h-[44px] rounded-2xl font-display text-xs"
          >
            {t('navGiveBadge')}
          </Button>
        </div>
      </div>

      {/* 3 Clean Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-bold uppercase font-display">{language === 'bn' ? 'মোট সমস্যা' : 'Total Issues'}</span>
            <AlertCircle className="w-4 h-4 text-warning-600" />
          </div>
          <div className="text-3xl font-extrabold text-ink font-display font-mono">
            {incidents.length}
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-bold uppercase font-display">{language === 'bn' ? 'অচেনা ব্যাজ' : 'Unregistered Badges'}</span>
            <ShieldAlert className="w-4 h-4 text-danger-600" />
          </div>
          <div className="text-3xl font-extrabold text-danger-700 font-display font-mono">
            {unknownCount}
          </div>
          <p className="text-xs text-ink-soft font-display">
            {language === 'bn' ? 'শিক্ষার্থীকে নতুন ব্যাজ দিতে হবে' : 'Need to give badge to student'}
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-bold uppercase font-display">{language === 'bn' ? 'পুনরায় স্ক্যান' : 'Repeated Scans'}</span>
            <CheckCircle2 className="w-4 h-4 text-forest-700 dark:text-forest-600" />
          </div>
          <div className="text-3xl font-extrabold text-forest-700 dark:text-forest-600 font-display font-mono">
            {duplicateCount}
          </div>
          <p className="text-xs text-ink-soft font-display">
            {language === 'bn' ? 'ইতিমধ্যে উপস্থিত হিসেবে চিহ্নিত' : 'Already marked present'}
          </p>
        </div>
      </div>

      {/* Incidents List */}
      <div className="app-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between">
          <h3 className="text-base font-extrabold text-ink font-display">
            {language === 'bn' ? 'সাম্প্রতিক গেটের সমস্যা ও করণীয়' : 'Recent Gate Issues & What To Do'}
          </h3>
        </div>

        {incidents.length === 0 ? (
          <div className="p-12">
            <EmptyState
              kind="generic"
              title={language === 'bn' ? 'গেটে কোনো সমস্যা পাওয়া যায়নি' : 'All gate scans are working smoothly'}
              description={language === 'bn' ? 'সকল কার্ড সঠিকভাবে কাজ করছে এবং উপস্থিতির তথ্য সঠিকভাবে নথিভুক্ত হচ্ছে।' : 'All badges presented at the gate are verified with zero unhandled errors.'}
            />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {incidents.map((incident) => {
              const detail = mapRfidRejectionCode(incident.rejectionCode, language);
              return (
                <div
                  key={incident.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface hover:bg-surface-soft transition-colors"
                >
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-ink font-display">
                        {detail.title}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold font-display ${
                        detail.severity === 'danger'
                          ? 'bg-danger-50 text-danger-700 border border-danger-200'
                          : detail.severity === 'warning'
                          ? 'bg-warning-50 text-warning-800 border border-warning-200'
                          : 'bg-info-50 text-info-700 border border-info-200'
                      }`}>
                        {incident.scanTimestamp ? new Date(incident.scanTimestamp).toLocaleTimeString(language === 'bn' ? 'bn-IN' : 'en-IN') : '—'}
                      </span>
                    </div>

                    <p className="text-xs text-ink-soft">
                      {detail.explanation}
                    </p>

                    <p className="text-xs font-bold text-forest-700 dark:text-forest-600 bg-surface-soft p-2.5 rounded-xl border border-line mt-1">
                      👉 {language === 'bn' ? 'করণীয়:' : 'What to do:'} {detail.recommendedAction}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {(detail.code.includes('NOT_FOUND') || detail.code.includes('UNREGISTERED')) && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate('/app/rfid-operator/enrollment')}
                        className="min-h-[44px] rounded-2xl font-display text-xs"
                      >
                        {t('navGiveBadge')}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RfidIncidentQueue;
