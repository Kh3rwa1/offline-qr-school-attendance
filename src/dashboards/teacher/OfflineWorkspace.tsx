import React, { useState, useEffect } from 'react';
import { useOfflineStatus } from '../../app/OfflineStatusProvider';
import { useLanguage } from '../../app/LanguageProvider';
import { getUserSafeError } from '../../errors/userSafeErrors';
import { offlineDb } from '../../db/offlineDb';
import { StatCard } from '../../components/shared/StatCard';
import { Button } from '../../components/shared/Button';
import { RefreshCw, CheckCircle2, Wifi, WifiOff, HardDrive, ShieldCheck, AlertCircle } from 'lucide-react';

export const OfflineWorkspace: React.FC = () => {
  const { isOnline, outboxCount, isSyncing, syncNow } = useOfflineStatus();
  const { language, t } = useLanguage();
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const outbox = await offlineDb.syncOutbox.toArray();
      setEvents(outbox);
    }
    void load();
  }, [outboxCount]);

  const mapStatusPill = (status?: string) => {
    switch (status) {
      case 'SYNCED':
        return {
          label: t('syncStatusSynced'),
          className: 'bg-success-50 text-forest-700 dark:text-forest-600 border-success-100 dark:border-success-600/30',
        };
      case 'SYNCING':
        return {
          label: t('syncStatusSyncing'),
          className: 'bg-info-50 text-info-800 border-info-100 dark:border-info-600/30',
        };
      case 'CONFLICT':
        return {
          label: t('syncStatusNeedsReview'),
          className: 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30',
        };
      case 'FAILED':
      case 'PERMANENT_FAILURE':
        return {
          label: t('syncStatusFailed'),
          className: 'bg-danger-50 text-danger-800 border-danger-100 dark:border-danger-600/30',
        };
      case 'PENDING':
      default:
        return {
          label: t('syncStatusWaiting'),
          className: 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30',
        };
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 text-left max-w-6xl mx-auto" id="offline-workspace-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-3xl border border-line shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success-50 border border-success-100 dark:border-success-600/30 text-[11px] font-bold text-forest-700 dark:text-forest-600 uppercase tracking-wider mb-2 font-display">
            <span>{t('navOfflineAttendance')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
            {t('savedAttendanceTitle')}
          </h1>
          <p className="t-body text-xs text-ink-soft mt-1">
            {t('savedAttendanceSubtitle')}
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => void syncNow()}
          disabled={!isOnline || isSyncing || outboxCount === 0}
          isLoading={isSyncing}
          leftIcon={<RefreshCw className="w-4 h-4" />}
          className="min-h-[44px] rounded-2xl font-display"
        >
          {isSyncing ? t('sendingAttendance') : t('sendSavedAttendance')}
        </Button>
      </div>

      {/* 4 Plain-Language Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('internetStatus')}
          value={isOnline ? t('statusOnline') : t('statusOffline')}
          trend={{ 
            value: isOnline ? t('connectedToServer') : t('operatingLocally'), 
            isPositive: isOnline 
          }}
          variant={isOnline ? "hero-forest" : "default"}
        />
        <StatCard
          title={t('savedRecordsWaiting')}
          value={outboxCount}
          trend={{ 
            value: outboxCount === 0 ? t('allRecordsSynced') : t('waitingForNetwork'), 
            isPositive: outboxCount === 0 
          }}
          variant="default"
        />
        <StatCard
          title={t('phoneStorage')}
          value={t('phoneStorageSafe')}
          trend={{ 
            value: language === 'bn' ? 'Offline use-এর জন্য Save আছে' : 'Saved for offline use', 
            isPositive: true 
          }}
          variant="default"
        />
        <StatCard
          title={t('syncSafe')}
          value={t('syncSafeDesc')}
          trend={{ 
            value: language === 'bn' ? 'Student Records Safe আছে' : 'Protected student records', 
            isPositive: true 
          }}
          variant="default"
        />
      </div>

      {/* Outbox List Card */}
      <div className="app-card overflow-hidden bg-surface border border-line rounded-3xl shadow-xs">
        <div className="p-6 border-b border-line flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-base font-extrabold text-ink font-display">
              {t('pendingQueueTitle')}
            </h3>
            <p className="t-body text-xs text-ink-soft mt-0.5">
              {t('pendingQueueSubtitle')}
            </p>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full border font-display ${
            outboxCount === 0 
              ? 'bg-success-50 text-forest-700 dark:text-forest-600 border-success-100 dark:border-success-600/30' 
              : 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30'
          }`}>
            {outboxCount === 0 ? t('zeroPendingRecords') : `${outboxCount} ${t('recordsInOutbox')}`}
          </span>
        </div>

        {events.length === 0 ? (
          <div className="p-12 text-center text-ink-soft space-y-3">
            <div className="w-14 h-14 rounded-full bg-success-50 text-forest-700 dark:text-forest-600 flex items-center justify-center mx-auto border border-success-100 dark:border-success-600/30">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-extrabold text-ink font-display">
              {t('syncedConfirmationTitle')}
            </h4>
            <p className="t-body text-xs text-ink-soft max-w-md mx-auto">
              {t('syncedConfirmationDesc')}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-soft border-b border-line text-ink-muted font-bold uppercase font-display">
                  <tr>
                    <th className="px-6 py-4">{t('student')}</th>
                    <th className="px-6 py-4">{t('source')}</th>
                    <th className="px-6 py-4">{t('timeRecorded')}</th>
                    <th className="px-6 py-4 text-right">{t('status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line font-medium text-ink bg-surface">
                  {events.map((e) => {
                    const pill = mapStatusPill(e.syncStatus);
                    const safeErr = e.syncError ? getUserSafeError(e.syncError, language) : null;
                    return (
                      <tr key={e.clientEventId} className="table-row-hover">
                        <td className="px-6 py-4 font-bold text-ink">
                          {e.studentName || e.studentId || t('student')}
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-surface-soft px-2.5 py-1 rounded-lg border border-line text-[11px] font-bold">
                            {e.source === 'CAMERA' ? 'Camera Scan' : 'Manual Mark'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-ink-muted font-mono">
                          {e.clientTimestamp 
                            ? new Date(e.clientTimestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) 
                            : '—'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border font-display ${pill.className}`}>
                            {pill.label}
                          </span>
                          {safeErr && (
                            <span className="block text-[11px] text-danger-600 mt-0.5 font-sans" title={safeErr.message}>
                              {safeErr.message}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards View */}
            <div className="md:hidden divide-y divide-line">
              {events.map((e) => {
                const pill = mapStatusPill(e.syncStatus);
                const safeErr = e.syncError ? getUserSafeError(e.syncError, language) : null;
                return (
                  <div key={e.clientEventId} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-ink block">
                          {e.studentName || e.studentId || t('student')}
                        </span>
                        <span className="text-[11px] text-ink-muted mt-0.5 block">
                          {e.source === 'CAMERA' ? 'Camera Scan' : 'Manual Mark'}
                        </span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border font-display shrink-0 ${pill.className}`}>
                        {pill.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-line text-ink-soft">
                      <span className="text-[11px] text-ink-muted font-mono">
                        {e.clientTimestamp 
                          ? new Date(e.clientTimestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) 
                          : '—'}
                      </span>
                    </div>

                    {safeErr && (
                      <p className="text-[11px] text-danger-600 bg-danger-50 p-2.5 rounded-xl border border-danger-100 dark:border-danger-600/30">
                        {safeErr.message}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OfflineWorkspace;
