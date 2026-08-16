import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useLanguage } from '../../app/LanguageProvider';
import { getUserSafeError } from '../../errors/userSafeErrors';
import { LoadingState } from '../shared/LoadingState';
import { ErrorState } from '../shared/ErrorState';
import { Button } from '../shared/Button';
import { Toast } from '../shared/Toast';
import { EmptyState } from '../shared/EmptyState';
import { Plus, X, Radio, Server, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReaderItem {
  id: string;
  deviceId: string;
  name: string;
  location?: string;
  directionMode: 'IN' | 'OUT' | 'BIDIRECTIONAL' | 'NONE';
  readerModel?: string;
  firmwareVersion?: string;
  adapterType: string;
  securityCapability: string;
  status: 'PENDING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  lastSeenAt?: string;
}

export default function ReaderManagement({ schoolId }: { schoolId: string }) {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [provisionForm, setProvisionForm] = useState({
    deviceId: '',
    name: 'Main Gate Box',
    location: 'Main Entrance Gate',
    directionMode: 'IN' as const,
    adapterType: 'NETWORK' as const,
    securityCapability: 'ZEBRA_FX9600' as const,
    readerModel: 'ZEBRA_FX9600',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const getReaderLiveStatus = (lastSeenAt?: string) => {
    if (!lastSeenAt) {
      return { label: t('notSetUp'), badgeClass: 'bg-surface-soft text-ink-muted border-line' };
    }
    const diffMs = Date.now() - new Date(lastSeenAt).getTime();
    if (diffMs < 5 * 60 * 1000) {
      return { label: t('online'), badgeClass: 'bg-success-50 text-forest-700 dark:text-forest-600 border-success-100 dark:border-success-600/30' };
    }
    if (diffMs < 24 * 60 * 60 * 1000) {
      return { label: t('quiet'), badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:border-amber-600/30' };
    }
    return { label: t('notSetUp'), badgeClass: 'bg-surface-soft text-ink-muted border-line' };
  };

  // Query: Readers
  const { data: readersData, isLoading, error, refetch } = useQuery({
    queryKey: ['schools', schoolId, 'rfid', 'readers'],
    queryFn: async () => {
      const res = await api<{ success: boolean; readers?: ReaderItem[]; report?: ReaderItem[] }>(`/api/v1/schools/${schoolId}/rfid/readers`);
      return res.readers || res.report || [];
    },
    enabled: Boolean(schoolId),
  });

  // Mutation: Register / Provision Reader
  const registerMutation = useMutation({
    mutationFn: async (payload: typeof provisionForm) => {
      return api(`/api/v1/schools/${schoolId}/rfid/readers/register`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', schoolId, 'rfid', 'readers'] });
      setIsProvisionOpen(false);
      setProvisionForm({
        deviceId: '',
        name: 'Main Gate Box',
        location: 'Main Entrance Gate',
        directionMode: 'IN',
        adapterType: 'NETWORK',
        securityCapability: 'ZEBRA_FX9600',
        readerModel: 'ZEBRA_FX9600',
      });
      setFormError(null);
    },
    onError: (err: any) => {
      const safeErr = getUserSafeError(err, language);
      setFormError(safeErr.message);
    },
  });

  // Mutation: Status Change (Approve / Suspend / Revoke)
  const statusMutation = useMutation({
    mutationFn: async ({ readerId, status }: { readerId: string; status: 'APPROVED' | 'SUSPENDED' | 'REVOKED' }) => {
      const actionEndpoint = status === 'APPROVED' ? 'approve' : status === 'SUSPENDED' ? 'suspend' : 'revoke';
      return api(`/api/v1/schools/${schoolId}/rfid/readers/${readerId}/${actionEndpoint}`, {
        method: 'POST',
        body: JSON.stringify({ reason: `Status changed to ${status}` }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', schoolId, 'rfid', 'readers'] });
      setActionError(null);
    },
    onError: (err: any) => {
      const safeErr = getUserSafeError(err, language);
      setActionError(safeErr.message);
    },
  });

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!provisionForm.deviceId.trim()) {
      setFormError(language === 'bn' ? 'গেট ডিভাইস আইডি আবশ্যক' : 'Gate Device ID is required');
      return;
    }
    registerMutation.mutate(provisionForm);
  };

  const readers = readersData || [];

  if (isLoading) return <LoadingState type="table" message={language === 'bn' ? 'গেট ডিভাইস লোড হচ্ছে…' : 'Loading school gate devices…'} />;
  if (error) return <ErrorState message={(error as any)?.message || (language === 'bn' ? 'গেট ডিভাইস লোড করতে সমস্যা হয়েছে' : 'Failed to load gate devices')} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6 text-left">
      {actionError && (
        <div className="mb-4">
          <Toast kind="error" message={actionError} onDismiss={() => setActionError(null)} autoDismiss={false} />
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-ink font-display">{t('gateBoxesTitle')}</h2>
          <p className="t-body text-xs text-ink-soft">
            {language === 'bn' ? 'বিদ্যালয়ের প্রবেশ ও প্রস্থান গেটের উপস্থিতি ডিভাইস।' : 'Gate attendance boxes installed at school entrance and exit gates.'}
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsProvisionOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
          className="min-h-[44px] rounded-2xl font-display"
        >
          {t('addGateBox')}
        </Button>
      </div>

      <div className="app-card overflow-hidden bg-surface border border-line rounded-3xl shadow-xs">
        {readers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              kind="generic"
              title={language === 'bn' ? 'কোনো গেট ডিভাইস যোগ করা হয়নি' : 'No school gate devices added yet'}
              description={language === 'bn' ? 'নতুন ডিভাইস যুক্ত করতে "গেট ডিভাইস যোগ করুন" চাপুন।' : 'Click "Add Gate Device" to connect a gate attendance box.'}
            />
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line bg-surface-soft text-[11px] font-extrabold uppercase tracking-wider text-ink-muted font-display">
                    <th className="py-4 px-6">{t('gateBoxesTitle')}</th>
                    <th className="py-4 px-6">{t('source')}</th>
                    <th className="py-4 px-6">{t('status')}</th>
                    <th className="py-4 px-6">{t('internetStatus')}</th>
                    <th className="py-4 px-6 text-right">{language === 'bn' ? 'পদক্ষেপ' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-surface">
                  {readers.map((r) => {
                    const liveStatus = getReaderLiveStatus(r.lastSeenAt);
                    return (
                      <tr key={r.id} className="table-row-hover font-medium">
                        <td className="py-4 px-6">
                          <span className="font-extrabold text-ink block font-display text-sm">
                            {r.name}
                          </span>
                          <span className="text-[11px] text-ink-muted font-medium">
                            {r.location || (language === 'bn' ? 'প্রধান গেট' : 'Entrance Gate')} • ID: <span className="font-mono">{r.deviceId}</span>
                          </span>
                        </td>
                        <td className="py-4 px-6 font-semibold text-ink">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-surface-soft text-ink-soft border border-line font-display">
                            {r.directionMode === 'IN' 
                              ? (language === 'bn' ? 'প্রবেশ গেট' : 'Entry Gate') 
                              : r.directionMode === 'OUT' 
                              ? (language === 'bn' ? 'প্রস্থান গেট' : 'Exit Gate') 
                              : (language === 'bn' ? 'দ্বিমুখী' : 'Two-Way')}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase font-display border ${
                            r.status === 'APPROVED' || r.status === 'ACTIVE'
                              ? 'bg-success-50 text-forest-700 dark:text-forest-600 border-success-100 dark:border-success-600/30'
                              : r.status === 'PENDING'
                              ? 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30'
                              : 'bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30'
                          }`}>
                            {r.status === 'APPROVED' || r.status === 'ACTIVE' ? t('statusActive') : r.status === 'PENDING' ? t('statusWaiting') : t('statusStopped')}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`font-display text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${liveStatus.badgeClass}`}>
                            {liveStatus.label}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {r.status === 'PENDING' && (
                              <button
                                type="button"
                                onClick={() => statusMutation.mutate({ readerId: r.id, status: 'APPROVED' })}
                                className="px-3.5 py-2 rounded-xl text-sm font-bold text-forest-700 dark:text-forest-600 bg-success-50 hover:bg-success-100 border border-success-100 dark:border-success-600/30 font-display cursor-pointer min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                              >
                                {t('approveDevice')}
                              </button>
                            )}
                            {r.status !== 'REVOKED' ? (
                              <button
                                type="button"
                                onClick={() => statusMutation.mutate({ readerId: r.id, status: 'REVOKED' })}
                                className="px-3.5 py-2 rounded-xl text-sm font-bold text-danger-800 bg-danger-50 hover:bg-danger-100 border border-danger-100 dark:border-danger-600/30 font-display cursor-pointer min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                              >
                                {t('revokeDevice')}
                              </button>
                            ) : (
                              <span className="text-sm text-ink-muted font-bold font-display">{t('statusCancelled')}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="md:hidden divide-y divide-line">
              {readers.map((r) => {
                const liveStatus = getReaderLiveStatus(r.lastSeenAt);
                return (
                  <div key={r.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-ink text-sm font-display">{r.name}</h4>
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          {r.location || (language === 'bn' ? 'প্রধান গেট' : 'Entrance Gate')} • <span className="font-mono">{r.deviceId}</span>
                        </p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase font-display shrink-0 border ${
                        r.status === 'APPROVED' || r.status === 'ACTIVE'
                          ? 'bg-success-50 text-forest-700 dark:text-forest-600 border-success-100 dark:border-success-600/30'
                          : r.status === 'PENDING'
                          ? 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30'
                          : 'bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30'
                      }`}>
                        {r.status === 'APPROVED' || r.status === 'ACTIVE' ? t('statusActive') : r.status === 'PENDING' ? t('statusWaiting') : t('statusStopped')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-line text-ink-soft">
                      <span className={`font-display text-[11px] font-bold px-2 py-0.5 rounded-full border ${liveStatus.badgeClass}`}>
                        {liveStatus.label}
                      </span>

                      <div className="flex items-center gap-2">
                        {r.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => statusMutation.mutate({ readerId: r.id, status: 'APPROVED' })}
                            className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-forest-700 dark:text-forest-600 bg-success-50 hover:bg-success-100 border border-success-100 dark:border-success-600/30 font-display cursor-pointer min-h-[44px]"
                          >
                            {language === 'bn' ? 'অনুমোদন' : 'Approve'}
                          </button>
                        )}
                        {r.status !== 'REVOKED' && (
                          <button
                            type="button"
                            onClick={() => statusMutation.mutate({ readerId: r.id, status: 'REVOKED' })}
                            className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-danger-800 bg-danger-50 hover:bg-danger-100 border border-danger-100 dark:border-danger-600/30 font-display cursor-pointer min-h-[44px]"
                          >
                            {language === 'bn' ? 'বন্ধ করুন' : 'Revoke'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Provision Reader Modal */}
      <AnimatePresence>
        {isProvisionOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-md w-full p-6 sm:p-7 text-left bg-surface border border-line rounded-3xl"
            >
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-line">
                <h3 className="text-xl font-extrabold text-ink font-display">
                  {t('addGateBox')}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsProvisionOpen(false)}
                  className="w-8 h-8 rounded-full bg-surface-soft hover:bg-surface flex items-center justify-center text-ink-muted hover:text-ink transition-all cursor-pointer border border-line"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="mb-4">
                  <Toast kind="error" message={formError} onDismiss={() => setFormError(null)} autoDismiss={false} />
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="block t-label text-ink mb-1 font-display text-xs font-bold">
                    {language === 'bn' ? 'ডিভাইস আইডি *' : 'Gate Device ID *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={provisionForm.deviceId}
                    onChange={(e) => setProvisionForm({ ...provisionForm, deviceId: e.target.value })}
                    placeholder="e.g. GATE-BOX-01"
                    className="w-full px-4 py-3 rounded-2xl bg-surface-soft border border-line text-xs font-bold text-ink font-mono focus:bg-surface focus:border-forest-700 outline-none min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block t-label text-ink mb-1 font-display text-xs font-bold">
                    {t('gateBoxName')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={provisionForm.name}
                    onChange={(e) => setProvisionForm({ ...provisionForm, name: e.target.value })}
                    placeholder={language === 'bn' ? 'যেমন: প্রধান প্রবেশদ্বার বক্স' : 'e.g. Main Entrance Gate Box'}
                    className="w-full px-4 py-3 rounded-2xl bg-surface-soft border border-line text-xs font-bold text-ink focus:bg-surface focus:border-forest-700 outline-none min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block t-label text-ink mb-1 font-display text-xs font-bold">
                    {t('gateLocation')}
                  </label>
                  <input
                    type="text"
                    value={provisionForm.location}
                    onChange={(e) => setProvisionForm({ ...provisionForm, location: e.target.value })}
                    placeholder={language === 'bn' ? 'যেমন: উত্তর দিকের গেট' : 'e.g. North School Gate'}
                    className="w-full px-4 py-3 rounded-2xl bg-surface-soft border border-line text-xs font-bold text-ink focus:bg-surface focus:border-forest-700 outline-none min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block t-label text-ink mb-1 font-display text-xs font-bold">
                    {t('source')}
                  </label>
                  <select
                    value={provisionForm.directionMode}
                    onChange={(e) => setProvisionForm({ ...provisionForm, directionMode: e.target.value as any })}
                    className="w-full px-4 py-3 rounded-2xl bg-surface-soft border border-line text-xs font-bold text-ink focus:bg-surface focus:border-forest-700 outline-none cursor-pointer min-h-[44px]"
                  >
                    <option value="IN">{language === 'bn' ? 'প্রবেশ গেট (In)' : 'Entry Gate (In)'}</option>
                    <option value="OUT">{language === 'bn' ? 'প্রস্থান গেট (Out)' : 'Exit Gate (Out)'}</option>
                    <option value="BIDIRECTIONAL">{language === 'bn' ? 'দ্বিমুখী (In/Out)' : 'Two-Way (In/Out)'}</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => setIsProvisionOpen(false)}
                    className="min-h-[44px] rounded-2xl font-display"
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={registerMutation.isPending}
                    isLoading={registerMutation.isPending}
                    className="min-h-[44px] rounded-2xl font-display"
                  >
                    {t('saveGateBox')}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
