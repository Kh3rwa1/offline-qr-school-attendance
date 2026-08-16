import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useLanguage } from '../../app/LanguageProvider';
import { Download, RefreshCw, Users, CalendarCheck2 } from 'lucide-react';
import { Button } from '../shared/Button';
import { EmptyState } from '../shared/EmptyState';

export default function RfidReports({ schoolId }: { schoolId: string }) {
  const { language, t } = useLanguage();
  const [filterMethod, setFilterMethod] = useState('ALL');

  const { data: scansData, isLoading, error, refetch } = useQuery({
    queryKey: ['schools', schoolId, 'rfid', 'reports', 'scans'],
    queryFn: async () => {
      if (!schoolId) return { recentScans: [], report: [] };
      return api<{
        success: boolean;
        readersOnline?: number;
        readersOffline?: number;
        activeCards?: number;
        suspendedCards?: number;
        recentScans?: any[];
        report?: any[];
      }>(`/api/v1/schools/${schoolId}/rfid/reports/scans`);
    },
    enabled: Boolean(schoolId),
  });

  const scans = scansData?.recentScans || scansData?.report || [];
  const filteredScans = scans.filter((s: any) => filterMethod === 'ALL' || s.method === filterMethod || (filterMethod === 'GATE' && (s.method === 'Gate attendance' || s.method === 'RFID_GATE')));

  const totalScans = scans.length;
  const acceptedScans = scans.filter((s: any) => s.decision === 'ACCEPTED').length;
  const rejectedScans = totalScans - acceptedScans;

  const handleExportCSV = () => {
    const csvContent = [
      ['Time', 'Student', 'Decision', 'Method', 'Reader', 'Location'].join(','),
      ...filteredScans.map((s: any) => [
        `"${s.time}"`,
        `"${s.student || s.studentName || ''}"`,
        `"${s.decision}"`,
        `"${s.method || 'Gate attendance'}"`,
        `"${s.reader || s.readerName || ''}"`,
        `"${s.location || s.readerLocation || ''}"`,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gate-arrivals-${schoolId}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-card p-6 sm:p-7 text-left bg-surface border border-line rounded-3xl shadow-xs">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-ink font-display">{t('whoWalkedInToday')}</h2>
          <p className="t-body text-xs text-ink-soft">
            {language === 'bn' ? 'বিদ্যালয়ের গেটে শিক্ষার্থীদের উপস্থিতির লাইভ রেকর্ড।' : 'Real-time gate attendance arrivals recorded at school gates.'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => refetch()}
            className="p-3 rounded-2xl bg-surface-soft hover:bg-surface text-ink-soft hover:text-ink cursor-pointer border border-line min-h-[44px] min-w-[44px] flex items-center justify-center"
            title={language === 'bn' ? 'রিফ্রেশ করুন' : 'Refresh'}
            aria-label={language === 'bn' ? 'রিফ্রেশ করুন' : 'Refresh'}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Button
            variant="primary"
            size="md"
            onClick={handleExportCSV}
            disabled={scans.length === 0}
            leftIcon={<Download className="w-4 h-4" />}
            className="min-h-[44px] rounded-2xl font-display"
          >
            {t('downloadCsv')}
          </Button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <select
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
          className="border border-line px-4 py-2.5 rounded-2xl text-xs font-bold text-ink bg-surface-soft outline-none focus:border-forest-700 font-display cursor-pointer min-h-[44px]"
        >
          <option value="ALL">{language === 'bn' ? 'সকল রেকর্ড' : 'All Entries'}</option>
          <option value="GATE">{language === 'bn' ? 'গেট উপস্থিতি' : 'Gate Attendance'}</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-surface-soft p-5 rounded-2xl border border-line text-center">
          <div className="text-3xl font-extrabold text-ink font-display font-mono">{totalScans}</div>
          <div className="text-[11px] text-ink-muted font-bold uppercase tracking-wider mt-1">
            {language === 'bn' ? 'মোট গেট উপস্থিতি' : 'Total Gate Entries'}
          </div>
        </div>
        <div className="bg-success-50 p-5 rounded-2xl border border-success-100 dark:border-success-600/30 text-center">
          <div className="text-3xl font-extrabold text-forest-700 dark:text-forest-600 font-display font-mono">{acceptedScans}</div>
          <div className="text-[11px] text-forest-700/80 font-bold uppercase tracking-wider mt-1">
            {t('cameIn')}
          </div>
        </div>
        <div className="bg-danger-50 p-5 rounded-2xl border border-danger-100 dark:border-danger-600/30 text-center">
          <div className="text-3xl font-extrabold text-danger-800 font-display font-mono">{rejectedScans}</div>
          <div className="text-[11px] text-danger-800/80 font-bold uppercase tracking-wider mt-1">
            {language === 'bn' ? 'প্রত্যাখ্যাত' : 'Rejected'}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-surface-soft border-b border-line text-ink-muted font-bold uppercase font-display">
            <tr>
              <th className="py-4 px-6">{t('timeRecorded')}</th>
              <th className="py-4 px-6">{t('student')}</th>
              <th className="py-4 px-6">{t('source')}</th>
              <th className="py-4 px-6">{language === 'bn' ? 'গেট ডিভাইস' : 'Gate Device'}</th>
              <th className="py-4 px-6 text-right">{t('status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-surface font-medium">
            {filteredScans.map((s: any, i: number) => (
              <tr key={i} className="table-row-hover">
                <td className="py-4 px-6 font-mono text-ink-muted">
                  {new Date(s.time).toLocaleTimeString(language === 'bn' ? 'bn-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td className="py-4 px-6 font-bold text-ink">{s.student || s.studentName || (language === 'bn' ? 'শিক্ষার্থী' : 'Student')}</td>
                <td className="py-4 px-6 text-ink-soft">{s.method || (language === 'bn' ? 'গেট উপস্থিতি' : 'Gate attendance')}</td>
                <td className="py-4 px-6 text-ink-soft">{s.reader || s.readerName || '—'}</td>
                <td className="py-4 px-6 text-right">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold border font-display ${
                    s.decision === 'ACCEPTED'
                      ? 'bg-success-50 text-forest-700 dark:text-forest-600 border-success-100 dark:border-success-600/30'
                      : 'bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30'
                  }`}>
                    {s.decision === 'ACCEPTED' ? t('cameIn') : s.decision}
                  </span>
                </td>
              </tr>
            ))}
            {filteredScans.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12">
                  <EmptyState
                    kind="generic"
                    title={t('noArrivalsToday')}
                    description={language === 'bn' ? 'আজকে এখনও কোনো শিক্ষার্থী গেট দিয়ে প্রবেশ করেনি।' : 'No arrivals have been recorded through the school gate yet today.'}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
