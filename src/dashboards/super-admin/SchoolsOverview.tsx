import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { StatCard } from '../../components/shared/StatCard';
import { Button } from '../../components/shared/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { Toast } from '../../components/shared/Toast';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Building2, MapPin, CheckCircle2, X, ShieldAlert, ExternalLink, Archive, RefreshCw } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PLAIN_TERMS } from '../../utils/superAdminPlainTermsMapper';

interface SchoolItem {
  id: string;
  name: string;
  udiseCode: string;
  district: string;
  block?: string;
  preferredLanguage?: string;
  timezone?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  createdAt: string;
  totalStudents?: number;
  attendanceRate?: number;
}

export const SchoolsOverview: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { switchSchool } = useActiveSchool();
  const [searchTerm, setSearchTerm] = useState('');
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [statusModalSchool, setStatusModalSchool] = useState<SchoolItem | null>(null);
  const [targetStatus, setTargetStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'>('SUSPENDED');
  const [statusReason, setStatusReason] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    if ((location.state as any)?.openRegister) {
      setIsRegisterOpen(true);
    }
  }, [location.state]);

  // Edit School State
  const [editingSchool, setEditingSchool] = useState<SchoolItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    udiseCode: '',
    district: 'Murshidabad',
    block: '',
    preferredLanguage: 'bn',
    timezone: 'Asia/Kolkata',
  });
  const [editError, setEditError] = useState<string | null>(null);

  // Form State for School Registration
  const [formData, setFormData] = useState({
    name: '',
    udiseCode: '',
    district: 'Murshidabad',
    block: '',
    adminName: '',
    adminPhone: '',
    adminPassword: '',
    linkExistingUser: false,
    academicYearName: '2026-2027',
  });

  // Query: Server-filtered school list
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['schools', 'list', districtFilter, statusFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (districtFilter !== 'ALL') params.append('district', districtFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      
      const res = await api<{ success: boolean; schools: SchoolItem[] }>(`/api/v1/schools?${params.toString()}`);
      return res.schools || [];
    },
  });

  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Mutation: Register School
  const registerMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      return api('/api/v1/schools', {
        method: 'POST',
        body: JSON.stringify({
          name: payload.name.trim(),
          udiseCode: payload.udiseCode.trim(),
          district: payload.district.trim(),
          block: payload.block?.trim() || undefined,
          admin: {
            fullName: payload.adminName.trim(),
            phoneNumber: payload.adminPhone.trim(),
            password: payload.adminPassword,
            linkExistingUser: payload.linkExistingUser,
          },
          academicYear: {
            name: payload.academicYearName.trim(),
            startDate: '2026-04-01',
            endDate: '2027-03-31',
          },
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-summary'] });
      setIsRegisterOpen(false);
      setSuccessToast('School Provisioned Successfully!');
      setFormData({
        name: '',
        udiseCode: '',
        district: 'Murshidabad',
        block: '',
        adminName: '',
        adminPhone: '',
        adminPassword: '',
        linkExistingUser: false,
        academicYearName: '2026-2027',
      });
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to register school. Ensure UDISE code is unique.');
    },
  });

  // Mutation: Status Change
  const statusMutation = useMutation({
    mutationFn: async ({ schoolId, status, reason }: { schoolId: string; status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'; reason: string }) => {
      return api(`/api/v1/schools/${schoolId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      setStatusModalSchool(null);
      setStatusReason('');
      setConfirmName('');
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingSchool) return;
      return api(`/api/v1/schools/${editingSchool.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editFormData.name.trim(),
          district: editFormData.district.trim(),
          block: editFormData.block.trim() || undefined,
          preferredLanguage: editFormData.preferredLanguage,
          timezone: editFormData.timezone,
          udiseCode: editFormData.udiseCode.trim() || undefined,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      setEditingSchool(null);
      setEditError(null);
    },
    onError: (err: any) => {
      setEditError(err.message || 'Failed to update school metadata');
    },
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    if (!editFormData.name.trim()) {
      setEditError('School name is required');
      return;
    }
    if (editFormData.udiseCode && !/^\d{11}$/.test(editFormData.udiseCode.trim())) {
      setEditError('UDISE code must be exactly 11 digits');
      return;
    }
    editMutation.mutate();
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!/^\d{11}$/.test(formData.udiseCode.trim())) {
      setFormError('UDISE code must be exactly 11 digits');
      return;
    }
    if (!formData.adminPhone.trim()) {
      setFormError('Administrator phone number is required');
      return;
    }
    if (!formData.adminPassword || formData.adminPassword.length < 8) {
      setFormError('Administrator password must be at least 8 characters long');
      return;
    }
    registerMutation.mutate(formData);
  };

  const handleOpenSchool = async (school: SchoolItem) => {
    setSwitchingId(school.id);
    try {
      await switchSchool(school.id);
      navigate('/app/school-admin');
    } catch (err: any) {
      console.error('Failed to switch school:', err);
    } finally {
      setSwitchingId(null);
    }
  };

  const schools = data || [];
  const activeCount = schools.filter((s) => s.status === 'ACTIVE').length;
  const suspendedCount = schools.filter((s) => s.status === 'SUSPENDED').length;
  const archivedCount = schools.filter((s) => s.status === 'ARCHIVED').length;

  if (isLoading && !data) return <LoadingState type="table" message="Loading registered school tenants…" />;
  if (error) return <ErrorState message={(error as any)?.message || 'Failed to load school directory'} onRetry={() => refetch()} />;

  return (
    <div className="space-y-8 text-left" id="schools-overview-view">
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <div className="fixed top-6 right-6 z-50">
            <Toast kind="success" message={successToast} onDismiss={() => setSuccessToast(null)} />
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
            Affiliated Schools Directory
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1" title={PLAIN_TERMS.tenantIsolation.en}>
            Official government institutions with verified UDISE+ codes and dedicated database tenant contexts.
          </p>
          <p className="t-body text-xs text-ink-muted mt-1">
            Schools registered with the government (UDISE+), each with attendance data kept fully separate from other schools.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsRegisterOpen(true)}
          aria-label="Register School"
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Register School
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Schools"
          value={schools.length}
          trend={{ value: `${activeCount} active, ${suspendedCount} suspended`, isPositive: activeCount > 0 }}
          variant="hero-forest"
        />
        <StatCard
          title="West Bengal Districts"
          value={Array.from(new Set(schools.map((s) => s.district))).length || 1}
          trend={{ value: "District Coverage", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="UDISE+ Verified"
          value={schools.filter((s) => s.udiseCode).length}
          trend={{ value: "National Portal Synced", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="System Status"
          value={archivedCount > 0 ? `${archivedCount} Archived` : "Healthy"}
          trend={{ value: "All Tenants Isolated", isPositive: true }}
          variant="default"
        />
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-surface p-4 rounded-3xl border border-line shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by school name or 11-digit UDISE…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-bold text-ink outline-none focus:border-forest-700 transition-all cursor-pointer font-display"
          >
            <option value="ALL">All Districts</option>
            <option value="Murshidabad">Murshidabad</option>
            <option value="Nadia">Nadia</option>
            <option value="North 24 Parganas">North 24 Parganas</option>
            <option value="South 24 Parganas">South 24 Parganas</option>
            <option value="Kolkata">Kolkata</option>
            <option value="Howrah">Howrah</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-bold text-ink outline-none focus:border-forest-700 transition-all cursor-pointer font-display"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      {/* Schools Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {schools.map((school, idx) => (
          <motion.div
            key={school.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className="app-card p-6 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-2xl bg-success-50 text-forest-700 dark:text-forest-600 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase font-display ${
                  school.status === 'ACTIVE'
                    ? 'bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30'
                    : school.status === 'SUSPENDED'
                    ? 'bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30'
                    : 'bg-surface-soft text-ink-soft border border-line'
                }`}>
                  {school.status}
                </span>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-ink font-display">
                  {school.name}
                </h3>
                <p className="text-xs text-ink-muted font-mono mt-0.5">
                  UDISE: {school.udiseCode || 'Unassigned'}
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-line text-xs text-ink-soft">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-ink-muted" />
                  <span>{school.district}{school.block ? `, ${school.block}` : ''}</span>
                </div>
                <div className="flex items-center gap-2" title={PLAIN_TERMS.tenantIdTooltip.en}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-success-600" />
                  <span>Tenant ID: <span className="font-mono text-[11px]">{school.id.slice(0, 8)}…</span></span>
                </div>
              </div>
            </div>

            <div className="pt-5 mt-4 border-t border-line flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={school.status !== 'ACTIVE' || switchingId === school.id}
                onClick={() => handleOpenSchool(school)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-bold text-forest-700 dark:text-forest-600 bg-success-50 hover:bg-success-100 border border-success-100 dark:border-success-600/30 transition-all cursor-pointer font-display disabled:opacity-40"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{switchingId === school.id ? 'Opening…' : 'Open School'}</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditingSchool(school);
                    setEditFormData({
                      name: school.name,
                      udiseCode: school.udiseCode || '',
                      district: school.district,
                      block: school.block || '',
                      preferredLanguage: school.preferredLanguage || 'bn',
                      timezone: school.timezone || 'Asia/Kolkata',
                    });
                    setEditError(null);
                  }}
                  className="px-3 py-1.5 rounded-full text-[11px] font-bold text-ink-soft bg-surface-soft hover:bg-surface border border-line transition-all cursor-pointer font-display"
                >
                  Edit
                </button>

                {school.status === 'ACTIVE' && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusModalSchool(school);
                      setTargetStatus('SUSPENDED');
                      setStatusReason('');
                      setConfirmName('');
                    }}
                    className="px-3 py-1.5 rounded-full text-[11px] font-bold text-danger-800 bg-danger-50 hover:bg-danger-100 border border-danger-100 dark:border-danger-600/30 transition-all cursor-pointer font-display"
                  >
                    Suspend
                  </button>
                )}

                {school.status === 'SUSPENDED' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusModalSchool(school);
                        setTargetStatus('ACTIVE');
                        setStatusReason('');
                        setConfirmName('');
                      }}
                      className="px-3 py-1.5 rounded-full text-[11px] font-bold text-success-800 bg-success-50 hover:bg-success-100 border border-success-100 dark:border-success-600/30 transition-all cursor-pointer font-display"
                    >
                      Reactivate
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusModalSchool(school);
                        setTargetStatus('ARCHIVED');
                        setStatusReason('');
                        setConfirmName('');
                      }}
                      className="px-3 py-1.5 rounded-full text-[11px] font-bold text-ink-soft bg-surface-soft hover:bg-surface border border-line transition-all cursor-pointer font-display"
                    >
                      Archive
                    </button>
                  </>
                )}

                {school.status === 'ARCHIVED' && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusModalSchool(school);
                      setTargetStatus('ACTIVE');
                      setStatusReason('');
                      setConfirmName('');
                    }}
                    className="px-3 py-1.5 rounded-full text-[11px] font-bold text-success-800 bg-success-50 hover:bg-success-100 border border-success-100 dark:border-success-600/30 transition-all cursor-pointer font-display"
                  >
                    Reactivate
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}

        {schools.length === 0 && (
          <div className="col-span-full py-8">
            <EmptyState
              kind="schools"
              title="No schools match your search"
              description="Try adjusting your search filters or register a new institution."
              actionText="Register School"
              onAction={() => setIsRegisterOpen(true)}
            />
          </div>
        )}
      </div>

      {/* Register New School Modal */}
      <AnimatePresence>
        {isRegisterOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-ink font-display">
                    Register New School Tenant
                  </h2>
                  <p className="t-body text-xs text-ink-soft mt-0.5">
                    Provisions school record, headmaster credentials, and academic year.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="w-8 h-8 rounded-full bg-surface-soft hover:bg-surface flex items-center justify-center text-ink-muted hover:text-ink transition-all cursor-pointer border border-line"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="mb-5">
                  <Toast kind="error" message={formError} onDismiss={() => setFormError(null)} autoDismiss={false} />
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-4 text-left">
                <div>
                  <label className="block t-label text-ink mb-1.5 font-display">
                    School Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Bishnupur High School"
                    className="w-full px-4 py-3 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block t-label text-ink mb-1.5 font-display">
                      11-Digit UDISE+ Code *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={11}
                      value={formData.udiseCode}
                      onChange={(e) => setFormData({ ...formData, udiseCode: e.target.value })}
                      placeholder="e.g. 19010100101"
                      className="w-full px-4 py-3 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink font-mono placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block t-label text-ink mb-1.5 font-display">
                      District *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      placeholder="e.g. Bankura"
                      className="w-full px-4 py-3 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink focus:bg-surface focus:border-forest-700 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block t-label text-ink mb-1.5 font-display">
                    Block / Sub-Division
                  </label>
                  <input
                    type="text"
                    value={formData.block}
                    onChange={(e) => setFormData({ ...formData, block: e.target.value })}
                    placeholder="e.g. Raninagar-I"
                    className="w-full px-4 py-3 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none transition-all"
                  />
                </div>

                <div className="pt-2 border-t border-line">
                  <h4 className="t-label text-ink mb-3 font-display">
                    Initial Headmaster / Administrator Account
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <label className="block t-label text-ink mb-1 font-display">
                        Administrator Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.adminName}
                        onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                        placeholder="e.g. Dr. A. Banerjee"
                        className="w-full px-4 py-3 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block t-label text-ink mb-1 font-display">
                          Mobile Number *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.adminPhone}
                          onChange={(e) => setFormData({ ...formData, adminPhone: e.target.value })}
                          placeholder="e.g. +91 98765 43210"
                          className="w-full px-4 py-3 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none transition-all"
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
                          value={formData.adminPassword}
                          onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                          placeholder="Minimum 12 characters"
                          className="w-full px-4 py-3 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="linkExistingUser"
                        checked={formData.linkExistingUser}
                        onChange={(e) => setFormData({ ...formData, linkExistingUser: e.target.checked })}
                        className="w-4 h-4 rounded text-forest-700 focus:ring-forest-700 border-line"
                      />
                      <label htmlFor="linkExistingUser" className="text-xs font-medium text-ink-soft cursor-pointer">
                        Link existing user if this phone number is already registered in the platform
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={() => setIsRegisterOpen(false)}
                  >
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={registerMutation.isPending}
                    aria-label="Register & Provision School"
                  >
                    {registerMutation.isPending ? 'Provisioning School…' : 'Register & Provision School'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Status Transition Dialog (Suspend / Archive / Reactivate) */}
      <AnimatePresence>
        {statusModalSchool && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-md w-full p-6 text-left"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                targetStatus === 'ACTIVE'
                  ? 'bg-success-50 text-success-800'
                  : targetStatus === 'ARCHIVED'
                  ? 'bg-surface-soft text-ink'
                  : 'bg-danger-50 text-danger-800'
              }`}>
                {targetStatus === 'ACTIVE' ? <RefreshCw className="w-6 h-6" /> : targetStatus === 'ARCHIVED' ? <Archive className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
              </div>

              <h3 className="text-lg font-extrabold text-ink font-display">
                {targetStatus === 'ACTIVE' ? 'Reactivate' : targetStatus === 'ARCHIVED' ? 'Archive' : 'Suspend'} School: {statusModalSchool.name}
              </h3>
              <p className="t-body text-xs text-ink-soft mt-1">
                {targetStatus === 'ACTIVE'
                  ? 'Reactivating will restore operational status and enable attendance scanning.'
                  : targetStatus === 'ARCHIVED'
                  ? 'Archiving locks the school permanently until explicit administrative reactivation.'
                  : 'Suspending will immediately lock all school memberships and reject incoming device scans.'}
              </p>

              <div className="space-y-4 my-5">
                <div>
                  <label className="block t-label text-ink mb-1 font-display">
                    Mandatory Reason (min 5 chars) *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Provide compliance or administrative reason…"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-surface-soft border border-line text-xs font-semibold text-ink outline-none focus:bg-surface focus:border-forest-700"
                  />
                </div>

                {(targetStatus === 'SUSPENDED' || targetStatus === 'ARCHIVED') && (
                  <div>
                    <label className="block t-label text-ink mb-1 font-display">
                      Type <span className="font-mono text-danger-600">{statusModalSchool.name}</span> to confirm:
                    </label>
                    <input
                      type="text"
                      value={confirmName}
                      onChange={(e) => setConfirmName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink outline-none focus:bg-surface focus:border-danger-600"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatusModalSchool(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant={targetStatus === 'ACTIVE' ? 'primary' : targetStatus === 'ARCHIVED' ? 'secondary' : 'danger'}
                  size="sm"
                  disabled={
                    statusMutation.isPending ||
                    statusReason.trim().length < 5 ||
                    ((targetStatus === 'SUSPENDED' || targetStatus === 'ARCHIVED') && confirmName !== statusModalSchool.name)
                  }
                  isLoading={statusMutation.isPending}
                  onClick={() => statusMutation.mutate({
                    schoolId: statusModalSchool.id,
                    status: targetStatus,
                    reason: statusReason.trim(),
                  })}
                >
                  {statusMutation.isPending
                    ? 'Updating…'
                    : targetStatus === 'ACTIVE'
                    ? 'Confirm Reactivation'
                    : targetStatus === 'ARCHIVED'
                    ? 'Confirm Archive'
                    : 'Confirm Suspension'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Edit School Modal */}
        {editingSchool && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-lg w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-extrabold text-ink font-display">
                    Edit School Institution
                  </h2>
                  <p className="t-body text-xs text-ink-soft mt-0.5">
                    Update school institutional parameters and national portal synchronization.
                  </p>
                  <p className="t-body text-[11px] text-ink-muted mt-0.5">
                    {PLAIN_TERMS.nationalPortalSync.en}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingSchool(null)}
                  className="w-8 h-8 rounded-full bg-surface-soft hover:bg-surface flex items-center justify-center text-ink-muted hover:text-ink transition-all cursor-pointer border border-line"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {editError && (
                <div className="mb-5">
                  <Toast kind="error" message={editError} onDismiss={() => setEditError(null)} autoDismiss={false} />
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block t-label text-ink mb-1 font-display">
                    School Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink outline-none focus:bg-surface focus:border-forest-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block t-label text-ink mb-1 font-display">
                      UDISE+ Code (11 digits)
                    </label>
                    <input
                      type="text"
                      maxLength={11}
                      value={editFormData.udiseCode}
                      onChange={(e) => setEditFormData({ ...editFormData, udiseCode: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-mono font-semibold text-ink outline-none focus:bg-surface focus:border-forest-700"
                    />
                  </div>
                  <div>
                    <label className="block t-label text-ink mb-1 font-display">
                      District *
                    </label>
                    <select
                      value={editFormData.district}
                      onChange={(e) => setEditFormData({ ...editFormData, district: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink outline-none focus:bg-surface focus:border-forest-700"
                    >
                      <option value="Murshidabad">Murshidabad</option>
                      <option value="Nadia">Nadia</option>
                      <option value="North 24 Parganas">North 24 Parganas</option>
                      <option value="South 24 Parganas">South 24 Parganas</option>
                      <option value="Kolkata">Kolkata</option>
                      <option value="Howrah">Howrah</option>
                      <option value="Hooghly">Hooghly</option>
                      <option value="Birbhum">Birbhum</option>
                      <option value="Malda">Malda</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block t-label text-ink mb-1 font-display">
                      Block
                    </label>
                    <input
                      type="text"
                      value={editFormData.block}
                      onChange={(e) => setEditFormData({ ...editFormData, block: e.target.value })}
                      placeholder="e.g. Domkal"
                      className="w-full px-3.5 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink outline-none focus:bg-surface focus:border-forest-700"
                    />
                  </div>
                  <div>
                    <label className="block t-label text-ink mb-1 font-display">
                      Language
                    </label>
                    <select
                      value={editFormData.preferredLanguage}
                      onChange={(e) => setEditFormData({ ...editFormData, preferredLanguage: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink outline-none focus:bg-surface focus:border-forest-700"
                    >
                      <option value="bn">Bengali (বাংলা)</option>
                      <option value="en">English</option>
                      <option value="hi">Hindi (हिन्दी)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block t-label text-ink mb-1 font-display">
                      Timezone
                    </label>
                    <input
                      type="text"
                      value={editFormData.timezone}
                      onChange={(e) => setEditFormData({ ...editFormData, timezone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-mono font-semibold text-ink outline-none focus:bg-surface focus:border-forest-700"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingSchool(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={editMutation.isPending}
                  >
                    {editMutation.isPending ? 'Saving…' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SchoolsOverview;
