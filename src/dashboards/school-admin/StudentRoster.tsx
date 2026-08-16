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
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Upload, 
  Download, 
  X, 
  FileSpreadsheet, 
  GraduationCap,
  Users
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
  const { language, t } = useLanguage();
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
      setSuccessToast(t('studentSavedSuccess'));
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      const safe = getUserSafeError(err, language);
      setFormError(safe.message);
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
      const safe = getUserSafeError(err, language);
      setImportError(safe.message);
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
      const count = res.enrolledCount || stagedJob?.validRowsCount || 0;
      setSuccessToast(t('importedStudentsSuccess', { count }));
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      const safe = getUserSafeError(err, language);
      setImportError(safe.message);
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
      setImportError(getUserSafeError(err, language).message);
    }
  };

  const students = studentsData || [];
  const classSections = classesData || [];

  const filteredStudents = students.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      (s.nameBn && s.nameBn.toLowerCase().includes(term)) ||
      s.studentCode.toLowerCase().includes(term) ||
      (s.banglarShikshaId || '').toLowerCase().includes(term) ||
      (s.enrollment?.rollNumber?.toString() || '').includes(term)
    );
  });

  return (
    <div className="space-y-6 sm:space-y-8 text-left max-w-6xl mx-auto" id="student-roster-view">
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
            {t('navStudents')}
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            {t('studentRosterSubtitle', { schoolName: activeSchoolName })}
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
            className="min-h-[44px] rounded-2xl font-display text-sm font-bold"
          >
            {t('importStudents')}
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setIsAddOpen(true);
              setFormError(null);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
            className="min-h-[44px] rounded-2xl font-display text-sm font-bold"
          >
            {t('addStudent')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState type="table" message={t('loadingRoster')} />
      ) : error ? (
        <ErrorState message={getUserSafeError(error, language).message} onRetry={() => refetch()} />
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
              <div className="flex items-center justify-between text-ink-muted">
                <span className="text-sm font-bold uppercase font-display">{t('navStudents')}</span>
                <Users className="w-4 h-4 text-forest-700 dark:text-forest-600" />
              </div>
              <div className="text-3xl font-extrabold text-ink font-display font-mono">
                {students.length}
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
              <div className="flex items-center justify-between text-ink-muted">
                <span className="text-sm font-bold uppercase font-display">{t('navClassesAndSections')}</span>
                <GraduationCap className="w-4 h-4 text-forest-700 dark:text-forest-600" />
              </div>
              <div className="text-3xl font-extrabold text-forest-700 dark:text-forest-600 font-display font-mono">
                {classSections.length}
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
              <div className="flex items-center justify-between text-ink-muted">
                <span className="text-sm font-bold uppercase font-display">{t('schoolYearTitle')}</span>
                <GraduationCap className="w-4 h-4 text-forest-700 dark:text-forest-600" />
              </div>
              <div className="text-3xl font-extrabold text-ink font-display font-mono">
                {currentYear?.name || '2026-27'}
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-surface p-4 rounded-3xl border border-line shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t('searchStudentsPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-semibold text-ink placeholder:text-ink-muted outline-none focus:border-forest-700 min-h-[44px]"
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-bold text-ink outline-none focus:border-forest-700 font-display cursor-pointer min-h-[44px]"
              >
                <option value="ALL">{t('allClasses')}</option>
                {classSections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.className} - {c.sectionName}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-bold text-ink outline-none focus:border-forest-700 font-display cursor-pointer min-h-[44px]"
              >
                <option value="ALL">{t('allStatuses')}</option>
                <option value="ACTIVE">{t('statusActive')}</option>
                <option value="ARCHIVED">{t('archived')}</option>
                <option value="TRANSFERRED">{t('transferred')}</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="app-card overflow-hidden">
            {filteredStudents.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  kind="roster"
                  title={t('noStudentsFound')}
                  description={t('noStudentsFoundDesc')}
                  actionText={t('addStudent')}
                  onAction={() => setIsAddOpen(true)}
                />
              </div>
            ) : (
              <div className="divide-y divide-line">
                {filteredStudents.map((st) => (
                  <div
                    key={st.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface hover:bg-surface-soft transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-forest-700 text-white flex items-center justify-center font-extrabold text-sm font-display shadow-2xs shrink-0">
                        #{st.enrollment?.rollNumber ?? '—'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-extrabold text-ink font-display">
                            {language === 'bn' && st.nameBn ? st.nameBn : st.name}
                          </h4>
                          {st.nameBn && language !== 'bn' && (
                            <span className="text-sm text-ink-muted">({st.nameBn})</span>
                          )}
                          <span className="px-2.5 py-0.5 rounded-full text-sm font-bold bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 font-display">
                            {st.enrollment ? `${st.enrollment.className} (${st.enrollment.sectionName})` : t('unassigned')}
                          </span>
                        </div>
                        <p className="text-sm text-ink-muted mt-0.5 font-mono">
                          ID: {st.studentCode} {st.banglarShikshaId && `• ${t('banglarShikshaId')}: ${st.banglarShikshaId}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <span className={`px-2.5 py-1 rounded-full text-sm font-bold font-display ${
                        st.status === 'ACTIVE'
                          ? 'bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {st.status === 'ACTIVE' ? t('statusActive') : st.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Enroll Student Modal */}
      <AnimatePresence>
        {isAddOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-student-modal-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-lg w-full p-6 sm:p-7 text-left max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
                <h3 id="add-student-modal-title" className="text-xl font-extrabold text-ink font-display">
                  {t('addStudentTitle')}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
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

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setFormError(null);
                  if (!formData.studentCode.trim()) return setFormError(t('studentCodeRequired'));
                  if (!formData.name.trim()) return setFormError(t('studentNameRequired'));
                  if (!formData.classSectionId) return setFormError(t('chooseClassPrompt'));
                  createStudentMutation.mutate(formData);
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-ink mb-1 font-display">
                      {t('studentCode')} *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. STU-1001"
                      value={formData.studentCode}
                      onChange={(e) => setFormData({ ...formData, studentCode: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-semibold text-ink outline-none focus:border-forest-700 font-mono min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-ink mb-1 font-display">
                      {t('banglarShikshaId')}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 19120100101"
                      value={formData.banglarShikshaId}
                      onChange={(e) => setFormData({ ...formData, banglarShikshaId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-semibold text-ink outline-none focus:border-forest-700 font-mono min-h-[44px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-ink mb-1 font-display">
                      {t('fullNameLabel')} (English) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Subrata Soren"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-semibold text-ink outline-none focus:border-forest-700 min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-ink mb-1 font-display">
                      {t('fullNameBengali')}
                    </label>
                    <input
                      type="text"
                      placeholder="যেমন: সুব্রত সোরেন"
                      value={formData.nameBn}
                      onChange={(e) => setFormData({ ...formData, nameBn: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-semibold text-ink outline-none focus:border-forest-700 min-h-[44px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-ink mb-1 font-display">
                      {t('navClassesAndSections')} *
                    </label>
                    <select
                      required
                      value={formData.classSectionId}
                      onChange={(e) => setFormData({ ...formData, classSectionId: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-bold text-ink outline-none focus:border-forest-700 cursor-pointer font-display min-h-[44px]"
                    >
                      <option value="">{t('chooseClassPrompt')}</option>
                      {classSections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.className} - {c.sectionName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-ink mb-1 font-display">
                      {t('rollNumberLabel')} *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={formData.rollNumber}
                      onChange={(e) => setFormData({ ...formData, rollNumber: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-semibold text-ink outline-none focus:border-forest-700 font-mono min-h-[44px]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddOpen(false)}
                    className="min-h-[44px] font-display text-sm"
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={createStudentMutation.isPending}
                    className="min-h-[44px] font-display text-sm font-bold"
                  >
                    {t('addStudent')}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk XLSX Import Modal */}
      <AnimatePresence>
        {isImportOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-import-modal-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-xl w-full p-6 sm:p-7 text-left max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
                <h3 id="bulk-import-modal-title" className="text-xl font-extrabold text-ink font-display">
                  {t('importStudents')} (Excel / CSV)
                </h3>
                <button
                  type="button"
                  onClick={() => setIsImportOpen(false)}
                  className="p-2 rounded-full hover:bg-surface-soft text-ink-muted cursor-pointer min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                  aria-label={t('close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {importError && (
                <div className="mb-4 p-3 rounded-2xl bg-danger-50 text-danger-800 border border-danger-200 text-sm font-semibold">
                  {importError}
                </div>
              )}

              {!stagedJob ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-surface-soft border border-line flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-ink font-display">
                        {t('excelTemplate')}
                      </h4>
                      <p className="text-sm text-ink-soft">
                        {t('excelTemplateDesc')}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadTemplate}
                      leftIcon={<Download className="w-4 h-4" />}
                      className="min-h-[44px] rounded-2xl font-display text-sm font-bold"
                    >
                      {t('downloadSample')}
                    </Button>
                  </div>

                  <div className="border-2 border-dashed border-line rounded-3xl p-8 text-center hover:border-forest-700 transition-colors">
                    <FileSpreadsheet className="w-10 h-10 text-forest-700 dark:text-forest-600 mx-auto mb-2" />
                    <p className="text-sm font-bold text-ink font-display">
                      {t('selectSpreadsheetPrompt')}
                    </p>
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setImportFile(f);
                          uploadXlsxMutation.mutate(f);
                        }
                      }}
                      className="mt-4 block mx-auto text-sm text-ink-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-forest-700 file:text-white hover:file:bg-forest-800 cursor-pointer min-h-[44px]"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-success-50 text-forest-700 border border-success-200">
                    <p className="text-sm font-bold">
                      {t('stagedRowsReady', { count: stagedJob.validRowsCount })}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setStagedJob(null)}
                      className="min-h-[44px] font-display text-sm"
                    >
                      {t('uploadDifferentFile')}
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      isLoading={commitImportMutation.isPending}
                      onClick={() => commitImportMutation.mutate(stagedJob.importJobId)}
                      className="min-h-[44px] font-display text-sm font-bold"
                    >
                      {t('confirmAndSaveAll')}
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
