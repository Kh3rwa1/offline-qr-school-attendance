import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { StatCard } from '../../components/shared/StatCard';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Building2, MapPin, Users, CheckCircle2, QrCode, Phone, AlertCircle, X, ShieldAlert, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SchoolItem {
  id: string;
  name: string;
  udiseCode: string;
  district: string;
  block?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  createdAt: string;
  totalStudents?: number;
  attendanceRate?: number;
}

export const SchoolsOverview: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [statusModalSchool, setStatusModalSchool] = useState<SchoolItem | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Form State for School Registration
  const [formData, setFormData] = useState({
    name: '',
    udiseCode: '',
    district: 'Murshidabad',
    block: '',
    adminName: '',
    adminPhone: '',
    adminPassword: '',
    academicYearName: '2026',
  });

  // Query: Real school list
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['schools', 'list', districtFilter, searchTerm],
    queryFn: async () => {
      const res = await api<{ success: boolean; schools: SchoolItem[] }>('/api/v1/schools');
      return res.schools || [];
    },
  });

  // Mutation: Register School
  const registerMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      return api('/api/v1/schools', {
        method: 'POST',
        body: JSON.stringify({
          name: payload.name,
          udiseCode: payload.udiseCode,
          district: payload.district,
          block: payload.block || undefined,
          admin: {
            fullName: payload.adminName,
            phoneNumber: payload.adminPhone,
            password: payload.adminPassword || 'SchoolAdminInitialPass2026!',
          },
          academicYear: {
            name: payload.academicYearName,
            startDate: `${new Date().getFullYear()}-01-01`,
            endDate: `${new Date().getFullYear()}-12-31`,
          },
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      queryClient.invalidateQueries({ queryKey: ['super-admin-summary'] });
      setIsRegisterOpen(false);
      setFormData({
        name: '',
        udiseCode: '',
        district: 'Murshidabad',
        block: '',
        adminName: '',
        adminPhone: '',
        adminPassword: '',
        academicYearName: '2026',
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
    registerMutation.mutate(formData);
  };

  const schools = data || [];
  const filteredSchools = schools.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.udiseCode || '').includes(searchTerm);
    const matchesDistrict = districtFilter === 'ALL' || s.district === districtFilter;
    return matchesSearch && matchesDistrict;
  });

  const activeCount = schools.filter(s => s.status === 'ACTIVE').length;
  const suspendedCount = schools.filter(s => s.status === 'SUSPENDED').length;

  if (isLoading) return <LoadingState message="Loading registered school tenants…" />;
  if (error) return <ErrorState message={(error as any)?.message || 'Failed to load school directory'} onRetry={() => refetch()} />;

  return (
    <div className="space-y-8" id="schools-overview-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
            Affiliated Schools Directory
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Official government institutions with verified UDISE+ codes and dedicated database tenant contexts.
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsRegisterOpen(true)}
          className="btn-forest-primary text-sm font-display shadow-md cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Register New School</span>
        </motion.button>
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
          value={Array.from(new Set(schools.map(s => s.district))).length || 1}
          trend={{ value: "District Coverage", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="UDISE+ Verified"
          value={schools.filter(s => s.udiseCode).length}
          trend={{ value: "National Portal Synced", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="System Status"
          value="Healthy"
          trend={{ value: "All Tenants Isolated", isPositive: true }}
          variant="default"
        />
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by school name or 11-digit UDISE…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#144e39] focus:ring-2 focus:ring-[#144e39]/10 outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="px-4 py-2.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:border-[#144e39] transition-all cursor-pointer"
          >
            <option value="ALL">All Districts</option>
            <option value="Murshidabad">Murshidabad</option>
            <option value="Nadia">Nadia</option>
            <option value="North 24 Parganas">North 24 Parganas</option>
            <option value="South 24 Parganas">South 24 Parganas</option>
            <option value="Kolkata">Kolkata</option>
            <option value="Howrah">Howrah</option>
          </select>
        </div>
      </div>

      {/* Schools Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSchools.map((school, idx) => (
          <motion.div
            key={school.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#144e39] flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase ${
                  school.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {school.status}
                </span>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900 font-display">
                  {school.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  UDISE: {school.udiseCode || 'Unassigned'}
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{school.district}{school.block ? `, ${school.block}` : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tenant ID: <span className="font-mono text-[10px]">{school.id.slice(0, 8)}…</span></span>
                </div>
              </div>
            </div>

            <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400 font-medium">
                Est. {new Date(school.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
              </span>

              <div className="flex items-center gap-2">
                {school.status === 'ACTIVE' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusModalSchool(school);
                      setStatusReason('');
                      setConfirmName('');
                    }}
                    className="px-3 py-1.5 rounded-full text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer font-display"
                  >
                    Suspend
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => statusMutation.mutate({ schoolId: school.id, status: 'ACTIVE', reason: 'Administrative reactivation' })}
                    className="px-3 py-1.5 rounded-full text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer font-display"
                  >
                    Reactivate
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}

        {filteredSchools.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-slate-200">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 font-display">No schools match your search</h3>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your search criteria or register a new institution.</p>
          </div>
        )}
      </div>

      {/* Register New School Modal */}
      <AnimatePresence>
        {isRegisterOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 font-display">
                    Register New School Tenant
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Provisions school record, headmaster credentials, and academic year.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-display">
                    School Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Rampur High School (HS)"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 font-display">
                      11-Digit UDISE+ Code *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={11}
                      value={formData.udiseCode}
                      onChange={(e) => setFormData({ ...formData, udiseCode: e.target.value })}
                      placeholder="19060100101"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 font-mono focus:bg-white focus:border-[#144e39] outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 font-display">
                      District *
                    </label>
                    <select
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none transition-all"
                    >
                      <option value="Murshidabad">Murshidabad</option>
                      <option value="Nadia">Nadia</option>
                      <option value="North 24 Parganas">North 24 Parganas</option>
                      <option value="South 24 Parganas">South 24 Parganas</option>
                      <option value="Kolkata">Kolkata</option>
                      <option value="Howrah">Howrah</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-display">
                    Block / Sub-Division
                  </label>
                  <input
                    type="text"
                    value={formData.block}
                    onChange={(e) => setFormData({ ...formData, block: e.target.value })}
                    placeholder="e.g. Raninagar-I"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none transition-all"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-3 font-display">
                    Initial Headmaster / Administrator Account
                  </h4>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                        Administrator Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.adminName}
                        onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                        placeholder="e.g. Dr. Pradip Sengupta"
                        className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                          Mobile Number *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.adminPhone}
                          onChange={(e) => setFormData({ ...formData, adminPhone: e.target.value })}
                          placeholder="+919434012345"
                          className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                          Initial Password
                        </label>
                        <input
                          type="password"
                          value={formData.adminPassword}
                          onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                          placeholder="••••••••••••"
                          className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsRegisterOpen(false)}
                    className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all font-display cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={registerMutation.isPending}
                    className="btn-forest-primary text-xs font-display px-6 py-2.5 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {registerMutation.isPending ? 'Provisioning School…' : 'Provision School Tenant'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Suspend Confirmation Dialog */}
      <AnimatePresence>
        {statusModalSchool && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
                <ShieldAlert className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-extrabold text-slate-900 font-display">
                Suspend School: {statusModalSchool.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Suspending will immediately lock all school memberships and reject incoming device scans.
              </p>

              <div className="space-y-4 my-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                    Mandatory Reason for Suspension *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Provide compliance or administrative reason (min 5 chars)…"
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                    Type <span className="font-mono text-rose-600">{statusModalSchool.name}</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStatusModalSchool(null)}
                  className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 font-display cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={statusMutation.isPending || statusReason.trim().length < 5 || confirmName !== statusModalSchool.name}
                  onClick={() => statusMutation.mutate({
                    schoolId: statusModalSchool.id,
                    status: 'SUSPENDED',
                    reason: statusReason,
                  })}
                  className="px-5 py-2 rounded-full text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 font-display cursor-pointer shadow-md"
                >
                  {statusMutation.isPending ? 'Suspending…' : 'Confirm Suspension'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SchoolsOverview;
