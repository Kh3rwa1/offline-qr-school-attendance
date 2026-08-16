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
import { motion, AnimatePresence } from 'motion/react';
import { Search, UserPlus, X, Users, Eye, EyeOff, Shield } from 'lucide-react';
import { UserRole } from '../../auth/permissions';

interface MemberItem {
  membershipId: string;
  userId: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
}

export const UserManagement: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Modals state
  const [suspendModalUser, setSuspendModalUser] = useState<MemberItem | null>(null);
  const [reactivateModalUser, setReactivateModalUser] = useState<MemberItem | null>(null);

  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    role: 'TEACHER' as UserRole,
    designation: 'Assistant Teacher',
    temporaryPassword: '',
    reactivateExisting: false,
  });

  // Query: Real members
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['schools', activeSchoolId, 'members'],
    queryFn: async () => {
      if (!activeSchoolId) return [];
      const res = await api<{ success: boolean; members: MemberItem[] }>(`/api/v1/schools/${activeSchoolId}/members`);
      return res.members || [];
    },
    enabled: Boolean(activeSchoolId),
  });

  // Mutation: Invite Member
  const inviteMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      return api(`/api/v1/schools/${activeSchoolId}/members`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'members'] });
      setIsInviteOpen(false);
      setFormData({
        fullName: '',
        phoneNumber: '',
        role: 'TEACHER',
        designation: 'Assistant Teacher',
        temporaryPassword: '',
        reactivateExisting: false,
      });
      setFormError(null);
      setSuccessToast(t('staffMemberAdded'));
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      const safe = getUserSafeError(err, language);
      setFormError(safe.message);
    },
  });

  // Mutation: Suspend Member (Stop Access)
  const suspendMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      return api(`/api/v1/schools/${activeSchoolId}/members/${userId}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Access stopped by administrator' }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'members'] });
      setSuspendModalUser(null);
      setActionError(null);
      setSuccessToast(t('staffAccessSuspended'));
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      const safe = getUserSafeError(err, language);
      setActionError(safe.message);
    },
  });

  // Mutation: Reactivate Member (Restore Access)
  const reactivateMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      return api(`/api/v1/schools/${activeSchoolId}/members/${userId}/reactivate`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Access restored by administrator' }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'members'] });
      setReactivateModalUser(null);
      setActionError(null);
      setSuccessToast(t('staffAccessRestored'));
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      const safe = getUserSafeError(err, language);
      setActionError(safe.message);
    },
  });

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.fullName.trim()) {
      setFormError(t('fullNameRequired'));
      return;
    }
    if (!formData.phoneNumber.trim()) {
      setFormError(t('phoneFormatRequired'));
      return;
    }
    if (!formData.temporaryPassword || formData.temporaryPassword.length < 8) {
      setFormError(t('passwordRequirementText'));
      return;
    }
    inviteMutation.mutate(formData);
  };

  const members = data || [];
  const filteredUsers = members.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.phoneNumber.includes(searchTerm);
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const teacherCount = members.filter((m) => m.role === 'TEACHER').length;
  const adminCount = members.filter((m) => m.role === 'SCHOOL_ADMIN' && m.status === 'ACTIVE').length;

  const getRoleBadgeLabel = (role: UserRole) => {
    switch (role) {
      case 'TEACHER':
        return t('roleTeacher');
      case 'SCHOOL_ADMIN':
        return t('roleSchoolAdmin');
      case 'RFID_OPERATOR':
        return t('roleRfidOperator');
      case 'REPORT_VIEWER':
        return t('roleReportViewer');
      default:
        return role;
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 text-left max-w-6xl mx-auto" id="user-management-view">
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <div className="fixed top-6 right-6 z-50">
            <Toast kind="success" message={successToast} onDismiss={() => setSuccessToast(null)} />
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-3xl border border-line shadow-xs">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
            {t('staffDirectoryTitle')}
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            {t('staffManagementSubtitle', { schoolName: activeSchoolName })}
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setIsInviteOpen(true);
            setFormError(null);
          }}
          leftIcon={<UserPlus className="w-4 h-4" />}
          className="min-h-[44px] rounded-2xl font-display text-sm font-bold"
        >
          {t('addStaffMember')}
        </Button>
      </div>

      {isLoading ? (
        <LoadingState type="table" message={t('loadingStaff')} />
      ) : error ? (
        <ErrorState message={getUserSafeError(error, language).message} onRetry={() => refetch()} />
      ) : (
        <>
          {actionError && (
            <div className="mb-4">
              <Toast kind="error" message={actionError} onDismiss={() => setActionError(null)} autoDismiss={false} />
            </div>
          )}

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
              <div className="flex items-center justify-between text-ink-muted">
                <span className="text-sm font-bold uppercase font-display">{t('staffDirectoryTitle')}</span>
                <Users className="w-4 h-4 text-forest-700 dark:text-forest-600" />
              </div>
              <div className="text-3xl font-extrabold text-ink font-display font-mono">
                {members.length}
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
              <div className="flex items-center justify-between text-ink-muted">
                <span className="text-sm font-bold uppercase font-display">{t('roleTeacher')}</span>
                <Users className="w-4 h-4 text-forest-700 dark:text-forest-600" />
              </div>
              <div className="text-3xl font-extrabold text-forest-700 dark:text-forest-600 font-display font-mono">
                {teacherCount}
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
              <div className="flex items-center justify-between text-ink-muted">
                <span className="text-sm font-bold uppercase font-display">{t('roleSchoolAdmin')}</span>
                <Shield className="w-4 h-4 text-forest-700 dark:text-forest-600" />
              </div>
              <div className="text-3xl font-extrabold text-ink font-display font-mono">
                {adminCount}
              </div>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="app-card p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 min-w-64 max-w-md">
              <Search className="w-4 h-4 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('searchStaffPlaceholder')}
                className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-semibold text-ink placeholder:text-ink-muted outline-none focus:border-forest-700 min-h-[44px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-bold text-ink outline-none focus:border-forest-700 cursor-pointer font-display min-h-[44px]"
              >
                <option value="ALL">{t('allRoles')}</option>
                <option value="SCHOOL_ADMIN">{t('roleSchoolAdmin')}</option>
                <option value="TEACHER">{t('roleTeacher')}</option>
                <option value="RFID_OPERATOR">{t('roleRfidOperator')}</option>
                <option value="REPORT_VIEWER">{t('roleReportViewer')}</option>
              </select>
            </div>
          </div>

          {/* Staff List */}
          <div className="app-card overflow-hidden">
            {filteredUsers.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  kind="generic"
                  title={t('noStaffFound')}
                  description={t('noStaffFoundDesc')}
                />
              </div>
            ) : (
              <div className="divide-y divide-line">
                {filteredUsers.map((user) => (
                  <div
                    key={user.userId}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface hover:bg-surface-soft transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-forest-700 text-white flex items-center justify-center font-extrabold text-sm font-display shadow-2xs shrink-0">
                        {user.fullName.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-extrabold text-ink font-display">
                            {user.fullName}
                          </h4>
                          <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 font-display">
                            {getRoleBadgeLabel(user.role)}
                          </span>
                          {user.status === 'SUSPENDED' && (
                            <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-danger-50 text-danger-800 border border-danger-200 font-display">
                              {t('statusStopped')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-ink-muted mt-0.5 font-mono font-semibold">
                          {user.phoneNumber}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {user.status === 'ACTIVE' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={user.role === 'SCHOOL_ADMIN' && adminCount <= 1}
                          onClick={() => {
                            if (user.role === 'SCHOOL_ADMIN' && adminCount <= 1) {
                              setActionError(t('protectLastAdminError'));
                              return;
                            }
                            setSuspendModalUser(user);
                          }}
                          className="min-h-[44px] rounded-2xl font-display text-sm text-amber-800 hover:bg-amber-50 font-bold"
                        >
                          {t('stopStaffAccess')}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReactivateModalUser(user)}
                          className="min-h-[44px] rounded-2xl font-display text-sm text-forest-700 dark:text-forest-600 font-bold"
                        >
                          {t('restoreStaffAccess')}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Staff Modal */}
      <AnimatePresence>
        {isInviteOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-staff-modal-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-md w-full p-6 text-left max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
                <h3 id="add-staff-modal-title" className="text-xl font-extrabold text-ink font-display">
                  {t('addStaffMember')}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="p-2 rounded-full hover:bg-surface-soft text-ink-muted cursor-pointer min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                  aria-label={t('close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded-2xl bg-danger-50 text-danger-800 border border-danger-200 text-sm font-semibold">
                  {formError}
                </div>
              )}

              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-ink mb-1 font-display">
                    {t('fullNameLabel')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Subhash Bose"
                    className="w-full px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-semibold text-ink outline-none focus:border-forest-700 min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-ink mb-1 font-display">
                    {t('phoneNumberLabel')} *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="9830012345"
                    className="w-full px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-semibold text-ink outline-none focus:border-forest-700 font-mono min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-ink mb-1 font-display">
                    {t('staffRoleLabel')} *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-bold text-ink outline-none focus:border-forest-700 cursor-pointer font-display min-h-[44px]"
                  >
                    <option value="TEACHER">{t('roleTeacher')}</option>
                    <option value="SCHOOL_ADMIN">{t('roleSchoolAdmin')}</option>
                    <option value="RFID_OPERATOR">{t('roleRfidOperator')}</option>
                    <option value="REPORT_VIEWER">{t('roleReportViewer')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-ink mb-1 font-display">
                    {t('temporaryPasswordLabel')} *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.temporaryPassword}
                      onChange={(e) => setFormData({ ...formData, temporaryPassword: e.target.value })}
                      placeholder="••••••••"
                      className="w-full pl-4 pr-12 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-semibold text-ink outline-none focus:border-forest-700 min-h-[44px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2.5 text-ink-muted hover:text-ink cursor-pointer min-h-[44px] min-w-[44px] rounded-xl inline-flex items-center justify-center"
                      aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-sm text-ink-muted mt-1">
                    {t('passwordRequirementText')}
                  </p>
                </div>

                {/* Role Explainer Box */}
                <div className="p-3 rounded-2xl bg-surface-soft border border-line text-sm text-ink-soft space-y-1">
                  <p className="font-bold text-ink">{t('rolePermissionsExplanation')}</p>
                  <p>
                    {formData.role === 'TEACHER' && t('roleTeacherDesc')}
                    {formData.role === 'SCHOOL_ADMIN' && t('roleSchoolAdminDesc')}
                    {formData.role === 'RFID_OPERATOR' && t('roleRfidOperatorDesc')}
                    {formData.role === 'REPORT_VIEWER' && t('roleReportViewerDesc')}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsInviteOpen(false)}
                    className="min-h-[44px] font-display text-sm"
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={inviteMutation.isPending}
                    className="min-h-[44px] font-display text-sm font-bold"
                  >
                    {t('addStaffMember')}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stop Access Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(suspendModalUser)}
        onClose={() => setSuspendModalUser(null)}
        onConfirm={() => {
          if (suspendModalUser) {
            suspendMutation.mutate({ userId: suspendModalUser.userId });
          }
        }}
        title={t('stopAccessModalTitle')}
        description={t('stopAccessExplanation')}
        confirmText={t('stopStaffAccess')}
        cancelText={t('cancel')}
        intent="warning"
      />

      {/* Restore Access Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={Boolean(reactivateModalUser)}
        onClose={() => setReactivateModalUser(null)}
        onConfirm={() => {
          if (reactivateModalUser) {
            reactivateMutation.mutate({ userId: reactivateModalUser.userId });
          }
        }}
        title={t('restoreAccessModalTitle')}
        description={t('restoreAccessExplanation')}
        confirmText={t('restoreStaffAccess')}
        cancelText={t('cancel')}
        intent="success"
      />
    </div>
  );
};

export default UserManagement;
