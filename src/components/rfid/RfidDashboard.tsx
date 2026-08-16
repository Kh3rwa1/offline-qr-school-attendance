import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useLanguage } from '../../app/LanguageProvider';
import { Server, Activity, ShieldAlert, Users } from 'lucide-react';
import { EmptyState } from '../shared/EmptyState';

export default function RfidDashboard({ schoolId }: { schoolId: string }) {
  const { language, t } = useLanguage();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await api<any>(`/api/v1/schools/${schoolId}/rfid/reports/summary`);
        setStats(res);
      } catch (e) {
        console.error(e);
      }
    }
    loadStats();
  }, [schoolId]);

  return (
    <div className="space-y-6 text-left">
      {/* UID_LEGACY Banner: ONLY if explicitly enabled in config */}
      {stats?.allowLegacyUidMode === true && (
        <div className="bg-warning-50 text-warning-800 p-5 rounded-3xl border border-warning-100 dark:border-warning-600/30">
          <h3 className="font-bold flex items-center gap-2 font-display text-sm">
            <ShieldAlert className="w-5 h-5 text-warning-800" />
            {language === 'bn' ? 'পুরানো নিরাপত্তা মোড সতর্কতা' : 'Legacy Security Mode Notice'}
          </h3>
          <p className="t-body text-xs mt-1 text-warning-800/90">
            {language === 'bn' 
              ? 'বিদ্যালয়ের কার্ড রিডারে পুরানো মোড সক্রিয় রয়েছে। উন্নত নিরাপত্তার জন্য নতুন মোডে রূপান্তর করুন।' 
              : 'Legacy card reading mode is currently active. For enhanced gate security, upgrade to secure badge mode.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="app-card p-6 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-bold uppercase tracking-wider font-display">{t('gatesOnline')}</span>
            <Server className="w-5 h-5 text-forest-700 dark:text-forest-600" />
          </div>
          <div className="text-3xl font-extrabold text-ink font-display font-mono">
            {stats?.readersOnline || 0} {t('online')}
          </div>
          <div className="t-body text-xs text-ink-soft">
            {stats?.readersOffline || 0} {t('quiet')}, {stats?.readersPending || 0} {t('notSetUp')}
          </div>
        </div>

        <div className="app-card p-6 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-bold uppercase tracking-wider font-display">{t('studentBadges')}</span>
            <Activity className="w-5 h-5 text-forest-700 dark:text-forest-600" />
          </div>
          <div className="text-3xl font-extrabold text-ink font-display font-mono">
            {stats?.activeCards || 0} {t('badgeStatusActive')}
          </div>
          <div className="t-body text-xs text-ink-soft">
            {stats?.suspendedCards || 0} {t('badgeStatusSuspended')}, {stats?.revokedCards || 0} {t('badgeStatusRevoked')}
          </div>
        </div>

        <div className="app-card p-6 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-bold uppercase tracking-wider font-display">{t('whoWalkedInToday')}</span>
            <Users className="w-5 h-5 text-forest-700 dark:text-forest-600" />
          </div>
          <div className="text-3xl font-extrabold text-ink font-display font-mono">
            {stats?.todayScans ?? stats?.recentScans?.length ?? 0} {t('cameIn')}
          </div>
          <div className="t-body text-xs text-ink-soft">
            {language === 'bn' ? 'প্রবেশদ্বারের উপস্থিতি সক্রিয়' : 'Doorway attendance active'}
          </div>
        </div>
      </div>

      <div className="app-card overflow-hidden bg-surface border border-line rounded-3xl shadow-xs">
        <div className="p-6 border-b border-line flex items-center justify-between">
          <h3 className="font-extrabold text-ink font-display text-base">
            {t('whoWalkedInToday')}
          </h3>
          <span className="text-xs font-bold text-ink-muted bg-surface-soft px-3 py-1 rounded-full border border-line font-display font-mono">
            {(stats?.recentScans || []).length} {language === 'bn' ? 'টি আগমন' : 'Arrivals'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface-soft border-b border-line text-ink-muted font-bold uppercase font-display">
              <tr>
                <th className="py-4 px-6">{t('timeRecorded')}</th>
                <th className="py-4 px-6">{language === 'bn' ? 'গেট ডিভাইস' : 'Gate Device'}</th>
                <th className="py-4 px-6 text-right">{t('status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface font-medium">
              {(stats?.recentScans || []).slice(0, 10).map((scan: any, i: number) => (
                <tr key={i} className="table-row-hover">
                  <td className="py-4 px-6 font-mono text-ink-muted">
                    {new Date(scan.time).toLocaleTimeString(language === 'bn' ? 'bn-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="py-4 px-6 font-bold text-ink">{scan.reader}</td>
                  <td className="py-4 px-6 text-right">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-bold border font-display ${
                      scan.decision === 'ACCEPTED' 
                        ? 'bg-success-50 text-forest-700 dark:text-forest-600 border-success-100 dark:border-success-600/30' 
                        : 'bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30'
                    }`}>
                      {scan.decision === 'ACCEPTED' ? t('cameIn') : scan.decision}
                    </span>
                  </td>
                </tr>
              ))}
              {!stats?.recentScans?.length && (
                <tr>
                  <td colSpan={3} className="py-12">
                    <EmptyState
                      kind="generic"
                      title={t('noArrivalsToday')}
                      description={language === 'bn' ? 'শিক্ষার্থীরা তাদের ব্যাজ নিয়ে গেট দিয়ে প্রবেশ করলে এখানে প্রদর্শিত হবে।' : 'When students walk through the gate with their badges, they will appear here.'}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
