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
import { motion, AnimatePresence } from 'motion/react';
import { Search, UserPlus, ShieldCheck, X, RefreshCw, ShieldAlert } from 'lucide-react';
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
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals state
  const [suspendModalUser, setSuspendModalUser] = useState<MemberItem | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  const [reactivateModalUser, setReactivateModalUser] = useState<MemberItem | null>(null);
  const [reactivateReason, setReactivateReason] = useState('');

  const [roleModalUser, setRoleModalUser] = useState<MemberItem | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<UserRole>('TEACHER');
  const [roleChangeReason, setRoleChangeReason] = useState('');

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
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to add staff member');
    },
  });

  // Mutation: Suspend Member
  const suspendMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      return api(`/api/v1/schools/${activeSchoolId}/members/${userId}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'members'] });
      setSuspendModalUser(null);
      setSuspendReason('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to suspend staff member');
    },
  });

  // Mutation: Reactivate Member
  const reactivateMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      return api(`/api/v1/schools/${activeSchoolId}/members/${userId}/reactivate`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'members'] });
      setReactivateModalUser(null);
      setReactivateReason('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to reactivate staff member');
    },
  });

  // Mutation: Change Role
  const roleMutation = useMutation({
    mutationFn: async ({ userId, newRole, reason }: { userId: string; newRole: UserRole; reason?: string }) => {
      return api(`/api/v1/schools/${activeSchoolId}/members/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ newRole, reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'members'] });
      setRoleModalUser(null);
      setRoleChangeReason('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to change staff role');
    },
  });

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formData.fullName.trim()) {
      setFormError('Full name is required');
      return;
    }
    if (!formData.phoneNumber.trim()) {
      setFormError('Phone number is required');
      return;
    }
    if (!formData.temporaryPassword || formData.temporaryPassword.length < 8) {
      setFormError('Temporary password must be at least 8 characters long');
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
  const rfidCount = members.filter((m) => m.role === 'RFID_OPERATOR').length;

  return (
    <div className="space-y-8 text-left" id="user-management-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
            School User Management
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            Authorized teachers, turnstile operators, and administrators at {activeSchoolName}.
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
        >
          Add Staff Member
        </Button>
      </div>

      {isLoading ? (
        <LoadingState type="table" message="Loading staff directory…" />
      ) : error ? (
        <ErrorState message={(error as any)?.message || 'Failed to load staff roster'} onRetry={() => refetch()} />
      ) : (
        <>
          {actionError && (
            <div className="mb-4">
              <Toast kind="error" message={actionError} onDismiss={() => setActionError(null)} autoDismiss={false} />
            </div>
          )}

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard
              title="Total Staff"
              value={`${members.length} Members`}
              trend={{ value: `${members.filter((m) => m.status === 'ACTIVE').length} Active`, isPositive: true }}
              variant="hero-forest"
            />
            <StatCard
              title="Classroom Teachers"
              value={`${teacherCount} Active`}
              trend={{ value: "Class Sessions Assigned", isPositive: true }}
              variant="default"
            />
            <StatCard
              title="Gate RFID Operators"
              value={`${rfidCount} Active`}
              trend={{ value: "Turnstiles In-Charge", isPositive: true }}
              variant="default"
            />
            <StatCard
              title="School Administrators"
              value={`${adminCount} In-Charge`}
              trend={{ value: "Headmaster & Officers", isPositive: true }}
              variant="default"
            />
          </div>

          {/* Filter and Search Bar */}
          <div className="app-card p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-72">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search faculty by name or phone…"
                  className="w-full pl-11 pr-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-bold text-ink outline-none focus:border-forest-700 transition-all cursor-pointer font-display"
              >
                <option value="ALL">All Roles</option>
                <option value="SCHOOL_ADMIN">Headmaster / Admin</option>
                <option value="TEACHER">Teacher</option>
                <option value="RFID_OPERATOR">Gate Operator</option>
                <option value="REPORT_VIEWER">District Auditor / Report Viewer</option>
              </select>
            </div>
          </div>

          {/* Staff Table */}
          <div className="app-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line bg-surface-soft text-[11px] font-extrabold uppercase tracking-wider text-ink-muted font-display">
                    <th className="py-4 px-6">Faculty Member</th>
                    <th className="py-4 px-6">Role & Status</th>
                    <th className="py-4 px-6">Phone Number</th>
                    <th className="py-4 px-6">Member Since</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs">
                  {filteredUsers.map((user) => (
                    <tr key={user.userId} className="table-row-hover">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-2xl bg-success-50 text-forest-700 dark:text-forest-600 flex items-center justify-center font-extrabold font-display">
                            {user.fullName.charAt(0)}
                          </div>
                          <div>
                            <span className="font-extrabold text-ink block font-display">
                              {user.fullName}
                            </span>
                            <span className="text-[11px] text-ink-muted font-mono">
                              ID: {user.userId.slice(0, 8)}…
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 font-display">
                            {user.role.replace('_', ' ')}
                          </span>
                          <span className={`w-2 h-2 rounded-full ${user.status === 'ACTIVE' ? 'bg-success-600' : 'bg-danger-600'}`} />
                        </div>
                      </td>
                      <td className="py-4 px-6 font-mono font-bold text-ink">
                        {user.phoneNumber}
                      </td>
                      <td className="py-4 px-6 text-ink-muted">
                        {new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {user.status === 'ACTIVE' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setRoleModalUser(user);
                                  setSelectedNewRole(user.role);
                                  setRoleChangeReason('');
                                  setActionError(null);
                                }}
                                className="px-3 py-1 rounded-full text-[11px] font-bold text-ink-soft bg-surface-soft hover:bg-surface border border-line transition-all cursor-pointer font-display"
                              >
                                Change Role
                              </button>
                              <button
                                type="button"
                                disabled={suspendMutation.isPending || (user.role === 'SCHOOL_ADMIN' && adminCount <= 1)}
                                onClick={() => {
                                  setSuspendModalUser(user);
                                  setSuspendReason('');
                                  setActionError(null);
                                }}
                                className="px-3 py-1 rounded-full text-[11px] font-bold text-danger-800 bg-danger-50 hover:bg-danger-100 border border-danger-100 dark:border-danger-600/30 transition-all cursor-pointer disabled:opacity-30 font-display"
                                title={user.role === 'SCHOOL_ADMIN' && adminCount <= 1 ? 'Cannot suspend last active admin' : 'Suspend faculty member'}
                              >
                                Suspend
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setReactivateModalUser(user);
                                setReactivateReason('');
                                setActionError(null);
                              }}
                              className="px-3 py-1 rounded-full text-[11px] font-bold text-success-800 bg-success-50 hover:bg-success-100 border border-success-100 dark:border-success-600/30 transition-all cursor-pointer font-display"
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8">
                        <EmptyState
                          kind="generic"
                          title="No faculty members match your search"
                          description="Try adjusting your filter or search query."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Add Staff Modal */}
      <AnimatePresence>
        {isInviteOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-md w-full p-6 text-left"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-extrabold text-ink font-display">
                  Add Faculty / Staff
                </h3>
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
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

              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div>
                  <label className="block t-label text-ink mb-1 font-display">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Smt. Ananya Mukherjee"
                    className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none"
                  />
                </div>

                <div>
                  <label className="block t-label text-ink mb-1 font-display">
                    Mobile Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="+919830012345"
                    className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block t-label text-ink mb-1 font-display">
                    Role in School *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink focus:bg-surface focus:border-forest-700 outline-none"
                  >
                    <option value="TEACHER">Classroom Teacher</option>
                    <option value="SCHOOL_ADMIN">Headmaster / School Admin</option>
                    <option value="RFID_OPERATOR">Gate RFID Operator</option>
                    <option value="REPORT_VIEWER">District Auditor / Report Viewer</option>
                  </select>
                </div>

                <div>
                  <label className="block t-label text-ink mb-1 font-display">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Assistant Teacher (Maths)"
                    className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none"
                  />
                </div>

                <div>
                  <label className="block t-label text-ink mb-1 font-display">
                    Initial Password (min 8 chars) *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={formData.temporaryPassword}
                    onChange={(e) => setFormData({ ...formData, temporaryPassword: e.target.value })}
                    placeholder="••••••••••••"
                    className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="reactivateExisting"
                    checked={formData.reactivateExisting}
                    onChange={(e) => setFormData({ ...formData, reactivateExisting: e.target.checked })}
                    className="w-4 h-4 rounded text-forest-700 focus:ring-forest-700 border-line"
                  />
                  <label htmlFor="reactivateExisting" className="text-xs font-medium text-ink-soft cursor-pointer">
                    Explicitly reactivate if user was previously suspended in this school
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsInviteOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={inviteMutation.isPending}
                  >
                    {inviteMutation.isPending ? 'Adding Member…' : 'Add to Staff'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Change Role Modal */}
        {roleModalUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-md w-full p-6 text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-ink">
                  <ShieldCheck className="w-5 h-5 text-forest-700 dark:text-forest-600" />
                  <h3 className="text-lg font-extrabold font-display">
                    Change Faculty Role
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setRoleModalUser(null)}
                  className="w-8 h-8 rounded-full bg-surface-soft hover:bg-surface flex items-center justify-center text-ink-muted hover:text-ink transition-all cursor-pointer border border-line"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="t-body text-xs text-ink-soft mb-4">
                Update permissions and responsibilities for <strong>{roleModalUser.fullName}</strong>.
              </p>

              <div className="space-y-4 mb-5">
                <div>
                  <label className="block t-label text-ink mb-1 font-display">
                    New Role *
                  </label>
                  <select
                    value={selectedNewRole}
                    onChange={(e) => setSelectedNewRole(e.target.value as UserRole)}
                    className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink focus:bg-surface focus:border-forest-700 outline-none"
                  >
                    <option value="TEACHER">Classroom Teacher</option>
                    <option value="SCHOOL_ADMIN">Headmaster / School Admin</option>
                    <option value="RFID_OPERATOR">Gate RFID Operator</option>
                    <option value="REPORT_VIEWER">District Auditor / Report Viewer</option>
                  </select>
                </div>

                <div>
                  <label className="block t-label text-ink mb-1 font-display">
                    Reason for Role Change
                  </label>
                  <input
                    type="text"
                    value={roleChangeReason}
                    onChange={(e) => setRoleChangeReason(e.target.value)}
                    placeholder="e.g. Promoted to administrator or reassigned to gate duty"
                    className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-medium text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRoleModalUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={roleMutation.isPending}
                  onClick={() => roleMutation.mutate({ userId: roleModalUser.userId, newRole: selectedNewRole, reason: roleChangeReason.trim() })}
                >
                  {roleMutation.isPending ? 'Updating…' : 'Confirm Role Change'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Reactivate Confirmation Modal */}
        {reactivateModalUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-md w-full p-6 text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-success-800">
                  <RefreshCw className="w-5 h-5" />
                  <h3 className="text-lg font-extrabold font-display">
                    Reactivate Faculty Member
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setReactivateModalUser(null)}
                  className="w-8 h-8 rounded-full bg-surface-soft hover:bg-surface flex items-center justify-center text-ink-muted hover:text-ink transition-all cursor-pointer border border-line"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="t-body text-xs text-ink-soft mb-4">
                Reactivate attendance scanning and console access for <strong>{reactivateModalUser.fullName}</strong>.
              </p>

              <div className="mb-5">
                <label className="block t-label text-ink mb-1 font-display">
                  Reason for Reactivation
                </label>
                <input
                  type="text"
                  value={reactivateReason}
                  onChange={(e) => setReactivateReason(e.target.value)}
                  placeholder="e.g. Returned from leave or re-instated"
                  className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-medium text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setReactivateModalUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  isLoading={reactivateMutation.isPending}
                  onClick={() => reactivateMutation.mutate({ userId: reactivateModalUser.userId, reason: reactivateReason.trim() })}
                >
                  {reactivateMutation.isPending ? 'Reactivating…' : 'Confirm Reactivation'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Suspend Confirmation Modal */}
        {suspendModalUser && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-md w-full p-6 text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-danger-800">
                  <ShieldAlert className="w-5 h-5" />
                  <h3 className="text-lg font-extrabold font-display">
                    Suspend Faculty Access
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSuspendModalUser(null)}
                  className="w-8 h-8 rounded-full bg-surface-soft hover:bg-surface flex items-center justify-center text-ink-muted hover:text-ink transition-all cursor-pointer border border-line"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="t-body text-xs text-ink-soft mb-4">
                Are you sure you want to suspend attendance scanning and console access for <strong>{suspendModalUser.fullName}</strong> ({suspendModalUser.phoneNumber})?
              </p>

              <div className="mb-5">
                <label className="block t-label text-ink mb-1 font-display">
                  Reason for Suspension (Mandatory)
                </label>
                <textarea
                  required
                  rows={3}
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="e.g. Transferred to another institution, on extended medical leave, or credentials compromised…"
                  className="w-full px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-xs font-medium text-ink focus:bg-surface focus:border-danger-600 outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSuspendModalUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={suspendMutation.isPending || suspendReason.trim().length < 3}
                  isLoading={suspendMutation.isPending}
                  onClick={() => suspendMutation.mutate({ userId: suspendModalUser.userId, reason: suspendReason.trim() })}
                >
                  {suspendMutation.isPending ? 'Suspending…' : 'Confirm Suspension'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserManagement;
