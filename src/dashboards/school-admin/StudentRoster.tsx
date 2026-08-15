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
import { 
  Plus, 
  Search, 
  Upload, 
  Download, 
  X, 
  FileSpreadsheet, 
  AlertTriangle
} from 'lucide-react';

interface StudentItem {
  id: string;
  studentCode: string;
  name: string;
  nameBn?: string;
  banglarShikshaId?: string;
  dateOfBirth?: string;
  gender?: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'TRANSFERRED';
  enrollment?: {
    id: string;
    classSectionId: string;
    className: string;
    sectionName: string;
    rollNumber: number;
  };
}

interface ClassSectionItem {
  id: string;
  className: string;
  sectionName: string;
}

interface AcademicYearItem {
  id: string;
  name: string;
  isCurrent: boolean;
}

interface StagedImportJob {
  importJobId: string;
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  errors: { row: number; column: string; message: string; value?: any }[];
  validRows: any[];
}

export const StudentRoster: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [stagedJob, setStagedJob] = useState<StagedImportJob | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Add Form
  const [formData, setFormData] = useState({
    studentCode: '',
    name: '',
    nameBn: '',
    banglarShikshaId: '',
    gender: 'MALE',
    classSectionId: '',
    academicYearId: '',
    rollNumber: 1,
    guardianName: '',
    guardianPhone: '',
  });

  // Queries
  const { data: studentsData, isLoading, error, refetch } = useQuery({
    queryKey: ['schools', activeSchoolId, 'students', selectedClassId, statusFilter],
    queryFn: async () => {
      if (!activeSchoolId) return [];
      const params = new URLSearchParams();
      if (selectedClassId !== 'ALL') params.append('classSectionId', selectedClassId);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      const res = await api<{ students: StudentItem[] }>(`/api/v1/schools/${activeSchoolId}/students?${params.toString()}`);
      return res.students || [];
    },
    enabled: Boolean(activeSchoolId),
  });

  const { data: classesData } = useQuery({
    queryKey: ['schools', activeSchoolId, 'class-sections'],
    queryFn: async () => {
      if (!activeSchoolId) return [];
      const res = await api<{ success: boolean; classes: ClassSectionItem[] }>(`/api/v1/schools/${activeSchoolId}/academics/classes`);
      return res.classes || [];
    },
    enabled: Boolean(activeSchoolId),
  });

  const { data: yearsData } = useQuery({
    queryKey: ['schools', activeSchoolId, 'academic-years'],
    queryFn: async () => {
      if (!activeSchoolId) return [];
      const res = await api<{ success: boolean; academicYears: AcademicYearItem[] }>(`/api/v1/schools/${activeSchoolId}/academic-years`);
      return res.academicYears || [];
    },
    enabled: Boolean(activeSchoolId),
  });

  const currentYear = yearsData?.find((y) => y.isCurrent) || yearsData?.[0];

  // Mutation: Create Student
  const createStudentMutation = useMutation({
    mutationFn: async (payload: typeof formData) => {
      return api(`/api/v1/schools/${activeSchoolId}/students`, {
        method: 'POST',
        body: JSON.stringify({
          studentCode: payload.studentCode.trim(),
          name: payload.name.trim(),
          nameBn: payload.nameBn.trim() || undefined,
          banglarShikshaId: payload.banglarShikshaId.trim() || undefined,
          gender: payload.gender,
          classSectionId: payload.classSectionId,
          academicYearId: payload.academicYearId || currentYear?.id,
          rollNumber: Number(payload.rollNumber),
          guardian: payload.guardianPhone.trim() ? {
            name: payload.guardianName.trim() || `${payload.name.trim()} Guardian`,
            phoneNumber: payload.guardianPhone.trim(),
            relationship: 'PARENT',
          } : undefined,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'students'] });
      setIsAddOpen(false);
      setFormData({
        studentCode: '',
        name: '',
        nameBn: '',
        banglarShikshaId: '',
        gender: 'MALE',
        classSectionId: '',
        academicYearId: '',
        rollNumber: 1,
        guardianName: '',
        guardianPhone: '',
      });
      setFormError(null);
      setSuccessToast('Student successfully enrolled in roster.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to enroll student');
    },
  });

  // Mutation: Upload XLSX for Stage Preview
  const uploadXlsxMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/v1/schools/${activeSchoolId}/students/import-xlsx`, {
        method: 'POST',
        body: form,
        headers: {
          'x-csrf-token': (window as any).__CSRF_TOKEN__ || '',
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'XLSX validation failed');
      }
      return res.json() as Promise<StagedImportJob>;
    },
    onSuccess: (data) => {
      setStagedJob(data);
      setImportError(null);
    },
    onError: (err: any) => {
      setImportError(err.message || 'Failed to parse and validate XLSX file');
    },
  });

  // Mutation: Commit Staged Import
  const commitImportMutation = useMutation({
    mutationFn: async (importJobId: string) => {
      return api(`/api/v1/schools/${activeSchoolId}/students/import-confirm`, {
        method: 'POST',
        body: JSON.stringify({ importJobId }),
      });
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'students'] });
      setIsImportOpen(false);
      setStagedJob(null);
      setImportFile(null);
      setSuccessToast(`Successfully imported ${res.enrolledCount || stagedJob?.validRowsCount || 'all'} students!`);
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      setImportError(err.message || 'Transaction commit failed');
    },
  });

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch(`/api/v1/schools/${activeSchoolId}/students/import-template`);
      if (!res.ok) throw new Error('Failed to download template');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Student_Import_Template_${activeSchoolName || 'School'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setImportError(err.message || 'Template download failed');
    }
  };

  const students = studentsData || [];
  const classSections = classesData || [];

  const filteredStudents = students.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      s.studentCode.toLowerCase().includes(term) ||
      (s.banglarShikshaId || '').toLowerCase().includes(term) ||
      (s.enrollment?.rollNumber?.toString() || '').includes(term)
    );
  });

  return (
    <div className="space-y-8 text-left" id="student-roster-view">
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
            Student Roster Directory
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            Manage student registrations, class section assignments, and staged bulk XLSX imports for {activeSchoolName}.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              setIsImportOpen(true);
              setStagedJob(null);
              setImportFile(null);
              setImportError(null);
            }}
            leftIcon={<Upload className="w-4 h-4 text-ink-soft" />}
          >
            Bulk XLSX Import
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setIsAddOpen(true);
              setFormError(null);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Enroll Student
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState type="table" message="Loading student enrollment roster…" />
      ) : error ? (
        <ErrorState message={(error as any)?.message || 'Failed to load students'} onRetry={() => refetch()} />
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard
              title="Enrolled Students"
              value={students.length}
              trend={{ value: `${students.filter(s => s.status === 'ACTIVE').length} Active Enrolled`, isPositive: true }}
              variant="hero-forest"
            />
            <StatCard
              title="Active Class Sections"
              value={`${classSections.length} Sections`}
              trend={{ value: "Class 5 to 12 Roster", isPositive: true }}
              variant="default"
            />
            <StatCard
              title="Current Academic Year"
              value={currentYear?.name || '2026-27'}
              trend={{ value: "Academic Session", isPositive: true }}
              variant="default"
            />
            <StatCard
              title="Banglar Shiksha Synced"
              value={students.filter(s => s.banglarShikshaId).length}
              trend={{ value: "Govt ID Linked", isPositive: true }}
              variant="default"
            />
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-surface p-4 rounded-3xl border border-line shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, student code, roll #, or Banglar Shiksha ID…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none transition-all"
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-4 py-2 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink outline-none focus:border-forest-700 font-display"
              >
                <option value="ALL">All Class Sections</option>
                {classSections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.className} - {c.sectionName}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink outline-none focus:border-forest-700 font-display"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
                <option value="TRANSFERRED">Transferred</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="app-card overflow-hidden">
            {filteredStudents.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  kind="roster"
                  title="No students found"
                  description="Enroll students individually or use the bulk XLSX import to populate your classroom rosters."
                  actionText="Enroll Student"
                  onAction={() => setIsAddOpen(true)}
                />
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-soft border-b border-line text-ink-muted font-bold uppercase font-display">
                      <tr>
                        <th className="py-4 px-6">Roll #</th>
                        <th className="py-4 px-6">Student</th>
                        <th className="py-4 px-6">Student Code / Portal ID</th>
                        <th className="py-4 px-6">Class Section</th>
                        <th className="py-4 px-6 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line font-medium text-ink bg-surface">
                      {filteredStudents.map((st) => (
                        <tr key={st.id} className="table-row-hover">
                          <td className="py-4 px-6 font-mono font-bold text-ink">
                            #{st.enrollment?.rollNumber ?? '—'}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-success-50 text-forest-700 dark:text-forest-600 flex items-center justify-center font-extrabold text-xs font-display">
                                {st.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-extrabold text-ink text-xs font-display">{st.name}</p>
                                {st.nameBn && <p className="text-[11px] text-ink-muted">{st.nameBn}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 font-mono text-[11px] text-ink-soft">
                            <div className="font-bold text-ink">{st.studentCode}</div>
                            {st.banglarShikshaId && (
                              <div className="text-[11px] text-forest-700 dark:text-forest-600">BS: {st.banglarShikshaId}</div>
                            )}
                          </td>
                          <td className="py-4 px-6 font-bold text-ink">
                            {st.enrollment ? `${st.enrollment.className} (${st.enrollment.sectionName})` : 'Unassigned'}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border font-display ${
                              st.status === 'ACTIVE'
                                ? 'bg-success-50 text-success-800 border-success-100 dark:border-success-600/30'
                                : 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30'
                            }`}>
                              {st.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Stacked Cards */}
                <div className="md:hidden divide-y divide-line">
                  {filteredStudents.map((st) => (
                    <div key={st.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-success-50 text-forest-700 dark:text-forest-600 flex items-center justify-center font-extrabold text-xs font-display shrink-0">
                            {st.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-ink-muted">#{st.enrollment?.rollNumber ?? '—'}</span>
                              <h4 className="font-extrabold text-ink text-sm font-display">{st.name}</h4>
                            </div>
                            {st.nameBn && <p className="text-[11px] text-ink-muted">{st.nameBn}</p>}
                          </div>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border font-display shrink-0 ${
                          st.status === 'ACTIVE'
                            ? 'bg-success-50 text-success-800 border-success-100 dark:border-success-600/30'
                            : 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30'
                        }`}>
                          {st.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-line text-ink-soft">
                        <span className="font-bold text-ink">
                          {st.enrollment ? `${st.enrollment.className} (${st.enrollment.sectionName})` : 'Unassigned'}
                        </span>
                        <span className="font-mono text-[11px] text-ink-muted">
                          {st.studentCode}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Enroll Student Modal */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-lg w-full p-6 sm:p-7 text-left"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-extrabold text-ink font-display">
                  Enroll New Student
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
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

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setFormError(null);
                  if (!formData.studentCode.trim()) return setFormError('Student code is required');
                  if (!formData.name.trim()) return setFormError('Student full name is required');
                  if (!formData.classSectionId) return setFormError('Please select a class section');
                  createStudentMutation.mutate(formData);
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block t-label text-ink mb-1 font-display">
                      Student Code / ID *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. STU-1001"
                      value={formData.studentCode}
                      onChange={(e) => setFormData({ ...formData, studentCode: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block t-label text-ink mb-1 font-display">
                      Banglar Shiksha ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 19120100101"
                      value={formData.banglarShikshaId}
                      onChange={(e) => setFormData({ ...formData, banglarShikshaId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block t-label text-ink mb-1 font-display">
                      Full Name (English) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Subrata Soren"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block t-label text-ink mb-1 font-display">
                      Name (Bengali / বাংলা)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. সুব্রত সোরেন"
                      value={formData.nameBn}
                      onChange={(e) => setFormData({ ...formData, nameBn: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block t-label text-ink mb-1 font-display">
                      Class Section *
                    </label>
                    <select
                      required
                      value={formData.classSectionId}
                      onChange={(e) => setFormData({ ...formData, classSectionId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink focus:bg-surface focus:border-forest-700 outline-none"
                    >
                      <option value="">Choose class section…</option>
                      {classSections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.className} - {c.sectionName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block t-label text-ink mb-1 font-display">
                      Roll Number *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={999}
                      value={formData.rollNumber}
                      onChange={(e) => setFormData({ ...formData, rollNumber: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block t-label text-ink mb-1 font-display">
                      Guardian Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Soren"
                      value={formData.guardianName}
                      onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block t-label text-ink mb-1 font-display">
                      Guardian Phone (for SMS)
                    </label>
                    <input
                      type="text"
                      placeholder="+919830012345"
                      value={formData.guardianPhone}
                      onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={createStudentMutation.isPending}
                  >
                    {createStudentMutation.isPending ? 'Enrolling…' : 'Enroll Student'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Staged Bulk XLSX Import Modal */}
      <AnimatePresence>
        {isImportOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-2xl w-full p-6 sm:p-7 text-left max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-6 h-6 text-forest-700 dark:text-forest-600" />
                  <div>
                    <h3 className="text-xl font-extrabold text-ink font-display">
                      Bulk Student XLSX Import
                    </h3>
                    <p className="t-body text-xs text-ink-muted">
                      Two-stage transactional import with row-level validation
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="w-8 h-8 rounded-full bg-surface-soft hover:bg-surface flex items-center justify-center text-ink-muted hover:text-ink transition-all cursor-pointer border border-line"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {importError && (
                <div className="mb-4">
                  <Toast kind="error" message={importError} onDismiss={() => setImportError(null)} autoDismiss={false} />
                </div>
              )}

              {!stagedJob ? (
                <div className="space-y-5">
                  <div className="p-4 rounded-2xl bg-success-50 border border-success-100 dark:border-success-600/30 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-extrabold text-forest-700 dark:text-forest-600 font-display">Official Import Template</p>
                      <p className="text-[11px] text-ink-soft">Includes column headers and validation rules</p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleDownloadTemplate}
                      leftIcon={<Download className="w-3.5 h-3.5" />}
                    >
                      Download Template
                    </Button>
                  </div>

                  <div className="border-2 border-dashed border-line rounded-3xl p-8 text-center space-y-3 bg-surface-soft hover:bg-surface transition-colors">
                    <input
                      type="file"
                      id="xlsx-upload-input"
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setImportFile(file);
                      }}
                      className="hidden"
                    />
                    <label htmlFor="xlsx-upload-input" className="cursor-pointer block space-y-2">
                      <div className="w-12 h-12 rounded-full bg-success-50 text-forest-700 dark:text-forest-600 flex items-center justify-center mx-auto">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-extrabold text-ink font-display">
                        {importFile ? importFile.name : 'Select Student Excel Spreadsheet'}
                      </p>
                      <p className="t-body text-xs text-ink-muted">
                        Supports .xlsx format up to 10MB (max 1,500 rows per batch)
                      </p>
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsImportOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={!importFile || uploadXlsxMutation.isPending}
                      isLoading={uploadXlsxMutation.isPending}
                      onClick={() => importFile && uploadXlsxMutation.mutate(importFile)}
                    >
                      {uploadXlsxMutation.isPending ? 'Validating Spreadsheet…' : 'Validate & Preview'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Stage Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-2xl bg-surface-soft border border-line text-center">
                      <p className="t-label text-ink-muted">Total Rows</p>
                      <p className="text-lg font-extrabold text-ink font-mono">{stagedJob.totalRows}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-success-50 border border-success-100 dark:border-success-600/30 text-center">
                      <p className="t-label text-forest-700 dark:text-forest-600">Valid Rows</p>
                      <p className="text-lg font-extrabold text-success-800 font-mono">{stagedJob.validRowsCount}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-danger-50 border border-danger-100 dark:border-danger-600/30 text-center">
                      <p className="t-label text-danger-800">Invalid Rows</p>
                      <p className="text-lg font-extrabold text-danger-800 font-mono">{stagedJob.invalidRowsCount}</p>
                    </div>
                  </div>

                  {/* Errors list if any */}
                  {stagedJob.errors.length > 0 && (
                    <div className="p-3.5 bg-danger-50 border border-danger-100 dark:border-danger-600/30 rounded-2xl space-y-2 max-h-40 overflow-y-auto">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-danger-800">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Validation Warnings ({stagedJob.errors.length})</span>
                      </div>
                      <div className="space-y-1">
                        {stagedJob.errors.slice(0, 10).map((err, idx) => (
                          <p key={idx} className="text-[11px] text-danger-800 font-mono">
                            Row {err.row}: {err.column} — {err.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Staged preview sample */}
                  <div className="p-3 bg-surface-soft rounded-2xl border border-line max-h-48 overflow-y-auto">
                    <p className="text-xs font-bold text-ink mb-2 font-display">
                      Preview of Valid Students ({stagedJob.validRows.length})
                    </p>
                    <div className="space-y-1.5">
                      {stagedJob.validRows.slice(0, 5).map((row, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs p-2 bg-surface rounded-xl border border-line">
                          <div>
                            <span className="font-bold text-ink">{row.name}</span>
                            <span className="text-ink-muted font-mono text-[11px] ml-2">({row.studentCode})</span>
                          </div>
                          <span className="font-mono text-ink-soft text-[11px]">
                            {row.className}-{row.sectionName} #{row.rollNumber}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-line">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setStagedJob(null)}
                    >
                      Back to Upload
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={stagedJob.validRowsCount === 0 || commitImportMutation.isPending}
                      isLoading={commitImportMutation.isPending}
                      onClick={() => commitImportMutation.mutate(stagedJob.importJobId)}
                    >
                      {commitImportMutation.isPending
                        ? 'Enrolling Students…'
                        : `Commit Import (${stagedJob.validRowsCount} Students)`}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudentRoster;
