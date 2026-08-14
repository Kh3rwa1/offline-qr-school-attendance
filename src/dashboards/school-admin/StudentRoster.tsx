import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { StatCard } from '../../components/shared/StatCard';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Plus, 
  Search, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
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

  if (isLoading) return <LoadingState message="Loading student enrollment roster…" />;
  if (error) return <ErrorState message={(error as any)?.message || 'Failed to load students'} onRetry={() => refetch()} />;

  return (
    <div className="space-y-8" id="student-roster-view">
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 shadow-xl flex items-center gap-3 text-xs font-bold font-display"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
            Student Enrollment Roster
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Manage student registrations, class section assignments, and staged bulk XLSX imports for {activeSchoolName}.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setIsImportOpen(true);
              setStagedJob(null);
              setImportFile(null);
              setImportError(null);
            }}
            className="btn-pill-secondary text-sm font-display cursor-pointer"
          >
            <Upload className="w-4 h-4 text-slate-600" />
            <span>Bulk XLSX Import</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setIsAddOpen(true);
              setFormError(null);
            }}
            className="btn-forest-primary text-sm font-display cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Enroll Student</span>
          </motion.button>
        </div>
      </div>

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
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, student code, roll #, or Banglar Shiksha ID…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#144e39] outline-none"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none"
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
            className="px-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none"
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase font-display">
              <tr>
                <th className="py-4 px-6">Roll #</th>
                <th className="py-4 px-6">Student</th>
                <th className="py-4 px-6">Student Code / Portal ID</th>
                <th className="py-4 px-6">Class Section</th>
                <th className="py-4 px-6 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700 bg-white">
              {filteredStudents.map((st) => (
                <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-6 font-mono font-bold text-slate-900">
                    #{st.enrollment?.rollNumber ?? '—'}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#144e39]/10 text-[#144e39] flex items-center justify-center font-extrabold text-xs">
                        {st.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-extrabold text-slate-900 text-xs font-display">{st.name}</p>
                        {st.nameBn && <p className="text-[11px] text-slate-400 font-medium">{st.nameBn}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 font-mono text-[11px] text-slate-600">
                    <div className="font-bold text-slate-800">{st.studentCode}</div>
                    {st.banglarShikshaId && (
                      <div className="text-[10px] text-emerald-700">BS: {st.banglarShikshaId}</div>
                    )}
                  </td>
                  <td className="py-4 px-6 font-bold text-slate-800">
                    {st.enrollment ? `${st.enrollment.className} (${st.enrollment.sectionName})` : 'Unassigned'}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      st.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      {st.status}
                    </span>
                  </td>
                </tr>
              ))}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400 font-medium space-y-2">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-2">
                      <Users className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 font-display">No students found</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Enroll students individually or use the bulk XLSX import to populate your classroom rosters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enroll Student Modal */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 text-left"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-extrabold text-slate-900 font-display">
                  Enroll New Student
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
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
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                      Student Code / ID *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. STU-1001"
                      value={formData.studentCode}
                      onChange={(e) => setFormData({ ...formData, studentCode: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                      Banglar Shiksha ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 19120100101"
                      value={formData.banglarShikshaId}
                      onChange={(e) => setFormData({ ...formData, banglarShikshaId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                      Full Name (English) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Subrata Soren"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                      Name (Bengali / বাংলা)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. সুব্রত সোরেন"
                      value={formData.nameBn}
                      onChange={(e) => setFormData({ ...formData, nameBn: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                      Class Section *
                    </label>
                    <select
                      required
                      value={formData.classSectionId}
                      onChange={(e) => setFormData({ ...formData, classSectionId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none"
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
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                      Roll Number *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={999}
                      value={formData.rollNumber}
                      onChange={(e) => setFormData({ ...formData, rollNumber: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                      Guardian Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Soren"
                      value={formData.guardianName}
                      onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                      Guardian Phone (for SMS)
                    </label>
                    <input
                      type="text"
                      placeholder="+919830012345"
                      value={formData.guardianPhone}
                      onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 font-display cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createStudentMutation.isPending}
                    className="btn-forest-primary text-xs font-display px-5 py-2 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {createStudentMutation.isPending ? 'Enrolling…' : 'Enroll Student'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Staged Bulk XLSX Import Modal */}
      <AnimatePresence>
        {isImportOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 sm:p-7 text-left max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-6 h-6 text-[#144e39]" />
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900 font-display">
                      Bulk Student XLSX Import
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Two-stage transactional import with row-level validation
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {importError && (
                <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {!stagedJob ? (
                <div className="space-y-5">
                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-extrabold text-[#144e39] font-display">Official Import Template</p>
                      <p className="text-[11px] text-slate-500 font-medium">Includes column headers and validation rules</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="btn-pill-secondary text-xs font-display flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Template</span>
                    </button>
                  </div>

                  <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center space-y-3 bg-slate-50/50 hover:bg-slate-50 transition-colors">
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
                      <div className="w-12 h-12 rounded-full bg-[#144e39]/10 text-[#144e39] flex items-center justify-center mx-auto">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-extrabold text-slate-800 font-display">
                        {importFile ? importFile.name : 'Select Student Excel Spreadsheet'}
                      </p>
                      <p className="text-xs text-slate-400">
                        Supports .xlsx format up to 10MB (max 1,500 rows per batch)
                      </p>
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsImportOpen(false)}
                      className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 font-display cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!importFile || uploadXlsxMutation.isPending}
                      onClick={() => importFile && uploadXlsxMutation.mutate(importFile)}
                      className="btn-forest-primary text-xs font-display px-6 py-2.5 shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {uploadXlsxMutation.isPending ? 'Validating Spreadsheet…' : 'Validate & Preview'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Stage Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Total Rows</p>
                      <p className="text-lg font-extrabold text-slate-900 font-mono">{stagedJob.totalRows}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                      <p className="text-[10px] uppercase font-bold text-emerald-700">Valid Rows</p>
                      <p className="text-lg font-extrabold text-emerald-800 font-mono">{stagedJob.validRowsCount}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-center">
                      <p className="text-[10px] uppercase font-bold text-rose-700">Invalid Rows</p>
                      <p className="text-lg font-extrabold text-rose-800 font-mono">{stagedJob.invalidRowsCount}</p>
                    </div>
                  </div>

                  {/* Errors list if any */}
                  {stagedJob.errors.length > 0 && (
                    <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-2 max-h-40 overflow-y-auto">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Validation Warnings ({stagedJob.errors.length})</span>
                      </div>
                      <div className="space-y-1">
                        {stagedJob.errors.slice(0, 10).map((err, idx) => (
                          <p key={idx} className="text-[11px] text-rose-700 font-mono">
                            Row {err.row}: {err.column} — {err.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Staged preview sample */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 max-h-48 overflow-y-auto">
                    <p className="text-xs font-bold text-slate-700 mb-2 font-display">
                      Preview of Valid Students ({stagedJob.validRows.length})
                    </p>
                    <div className="space-y-1.5">
                      {stagedJob.validRows.slice(0, 5).map((row, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs p-2 bg-white rounded-xl border border-slate-200/80">
                          <div>
                            <span className="font-bold text-slate-900">{row.name}</span>
                            <span className="text-slate-400 font-mono text-[11px] ml-2">({row.studentCode})</span>
                          </div>
                          <span className="font-mono text-slate-600 text-[11px]">
                            {row.className}-{row.sectionName} #{row.rollNumber}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setStagedJob(null)}
                      className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 font-display cursor-pointer"
                    >
                      Back to Upload
                    </button>
                    <button
                      type="button"
                      disabled={stagedJob.validRowsCount === 0 || commitImportMutation.isPending}
                      onClick={() => commitImportMutation.mutate(stagedJob.importJobId)}
                      className="btn-forest-primary text-xs font-display px-6 py-2.5 shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {commitImportMutation.isPending
                        ? 'Enrolling Students…'
                        : `Commit Import (${stagedJob.validRowsCount} Students)`}
                    </button>
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
