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
import { Plus, GraduationCap, X, AlertCircle, Calendar, UserPlus, Users } from 'lucide-react';

interface ClassSectionItem {
  id: string;
  className: string;
  sectionName: string;
  academicYearId: string;
  academicYearName?: string;
  studentCount?: number;
  assignedTeachers?: { teacherId: string; teacherName: string; isPrimary: boolean }[];
}

interface AcademicYearItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

interface TeacherItem {
  id: string;
  userId: string;
  fullName: string;
  employeeId?: string;
  designation?: string;
}

export const AcademicManagement: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();

  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [isAddYearOpen, setIsAddYearOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassSectionItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [yearFormError, setYearFormError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form states
  const [classForm, setClassForm] = useState({
    className: 'Class 5',
    sectionName: 'A',
    academicYearId: '',
  });

  const [yearForm, setYearForm] = useState({
    name: '2026-2027',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    isCurrent: true,
  });

  const [selectedTeacherId, setSelectedTeacherId] = useState('');

  // Query: Academic Years
  const { data: yearsData } = useQuery({
    queryKey: ['schools', activeSchoolId, 'academic-years'],
    queryFn: async () => {
      if (!activeSchoolId) return [];
      const res = await api<{ academicYears: AcademicYearItem[] }>(`/api/v1/schools/${activeSchoolId}/academic-years`);
      return res.academicYears || [];
    },
    enabled: Boolean(activeSchoolId),
  });

  // Query: Class Sections
  const { data: classesData, isLoading, error, refetch } = useQuery({
    queryKey: ['schools', activeSchoolId, 'class-sections'],
    queryFn: async () => {
      if (!activeSchoolId) return [];
      const res = await api<{ classSections: ClassSectionItem[] }>(`/api/v1/schools/${activeSchoolId}/class-sections`);
      return res.classSections || [];
    },
    enabled: Boolean(activeSchoolId),
  });

  // Query: Teachers
  const { data: teachersData } = useQuery({
    queryKey: ['schools', activeSchoolId, 'teachers'],
    queryFn: async () => {
      if (!activeSchoolId) return [];
      const res = await api<{ teachers: TeacherItem[] }>(`/api/v1/schools/${activeSchoolId}/teachers`);
      return res.teachers || [];
    },
    enabled: Boolean(activeSchoolId),
  });

  // Mutation: Create Class Section
  const createClassMutation = useMutation({
    mutationFn: async (payload: { className: string; sectionName: string; academicYearId: string }) => {
      return api(`/api/v1/schools/${activeSchoolId}/class-sections`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'class-sections'] });
      setIsAddClassOpen(false);
      setSuccessToast(t('classSectionCreated'));
      setClassForm({ className: 'Class 5', sectionName: 'A', academicYearId: '' });
    },
    onError: (err: any) => {
      const safeErr = getUserSafeError(err, language);
      setFormError(safeErr.message);
    },
  });

  // Mutation: Create Academic Year
  const createYearMutation = useMutation({
    mutationFn: async (payload: { name: string; startDate: string; endDate: string; isCurrent: boolean }) => {
      return api(`/api/v1/schools/${activeSchoolId}/academic-years`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'academic-years'] });
      setIsAddYearOpen(false);
      setSuccessToast(t('academicYearCreated'));
    },
    onError: (err: any) => {
      const safeErr = getUserSafeError(err, language);
      setYearFormError(safeErr.message);
    },
  });

  // Mutation: Assign Teacher to Class Section
  const assignMutation = useMutation({
    mutationFn: async (payload: { teacherId: string; classSectionId: string }) => {
      return api(`/api/v1/schools/${activeSchoolId}/class-sections/${payload.classSectionId}/assign-teacher`, {
        method: 'POST',
        body: JSON.stringify({ teacherId: payload.teacherId, isPrimary: true }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'class-sections'] });
      setIsAssignOpen(false);
      setSuccessToast(t('teacherAssignedSuccess'));
      setSelectedTeacherId('');
    },
    onError: (err: any) => {
      const safeErr = getUserSafeError(err, language);
      setAssignError(safeErr.message);
    },
  });

  // Mutation: Unassign Teacher
  const unassignMutation = useMutation({
    mutationFn: async (payload: { teacherId: string; classSectionId: string }) => {
      return api(`/api/v1/schools/${activeSchoolId}/class-sections/${payload.classSectionId}/unassign-teacher`, {
        method: 'POST',
        body: JSON.stringify({ teacherId: payload.teacherId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'class-sections'] });
      setSuccessToast(t('teacherUnassignedSuccess'));
    },
  });

  const academicYears = yearsData || [];
  const classSections = classesData || [];
  const teachers = teachersData || [];
  const currentYear = academicYears.find((y) => y.isCurrent) || academicYears[0];

  const handleAddClassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const targetYearId = classForm.academicYearId || currentYear?.id;
    if (!targetYearId) {
      setFormError(t('selectOrCreateYearFirst'));
      return;
    }
    createClassMutation.mutate({
      className: classForm.className.trim(),
      sectionName: classForm.sectionName.trim(),
      academicYearId: targetYearId,
    });
  };

  const handleAddYearSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setYearFormError(null);
    if (!yearForm.name.trim()) {
      setYearFormError(t('yearNameRequired'));
      return;
    }
    createYearMutation.mutate(yearForm);
  };

  return (
    <div className="space-y-6 sm:space-y-8 text-left max-w-6xl mx-auto" id="academic-management-view">
      {/* Toast Feedback */}
      {successToast && (
        <div className="fixed top-6 right-6 z-50">
          <Toast
            kind="success"
            message={successToast}
            onDismiss={() => setSuccessToast(null)}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-3xl border border-line shadow-xs">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
            {t('navClassesAndSections')}
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            {t('academicSetupSubtitle', { schoolName: activeSchoolName })}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              setIsAddYearOpen(true);
              setYearFormError(null);
            }}
            leftIcon={<Calendar className="w-4 h-4 text-forest-700 dark:text-forest-600" />}
            className="min-h-[44px] rounded-2xl font-display text-sm font-bold"
          >
            {t('schoolYearTitle')} ({academicYears.length})
          </Button>

          <Button
            variant="primary"
            size="md"
            disabled={academicYears.length === 0}
            onClick={() => {
              setClassForm({ className: 'Class 5', sectionName: 'A', academicYearId: currentYear?.id || '' });
              setIsAddClassOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
            className="min-h-[44px] rounded-2xl font-display text-sm font-bold"
          >
            {t('addClassSection')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState type="table" message={t('loadingClassSections')} />
      ) : error ? (
        <ErrorState message={getUserSafeError(error, language).message} onRetry={() => refetch()} />
      ) : (
        <>
          {academicYears.length === 0 && (
            <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-800 shrink-0" />
                <div>
                  <h4 className="font-extrabold text-sm font-display">
                    {t('noYearConfigured')}
                  </h4>
                  <p className="t-body text-sm text-amber-800 mt-0.5">
                    {t('createYearFirst')}
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsAddYearOpen(true)}
                className="min-h-[44px] rounded-2xl font-display text-sm font-bold"
              >
                {t('addSchoolYear')}
              </Button>
            </div>
          )}

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <span className="text-sm font-bold uppercase font-display">{t('classTeacher')}</span>
                <Users className="w-4 h-4 text-forest-700 dark:text-forest-600" />
              </div>
              <div className="text-3xl font-extrabold text-ink font-display font-mono">
                {teachers.length}
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
              <div className="flex items-center justify-between text-ink-muted">
                <span className="text-sm font-bold uppercase font-display">{t('schoolYearTitle')}</span>
                <Calendar className="w-4 h-4 text-forest-700 dark:text-forest-600" />
              </div>
              <div className="text-3xl font-extrabold text-ink font-display font-mono">
                {currentYear?.name || '—'}
              </div>
            </div>
          </div>

          {/* Class List */}
          <div className="app-card overflow-hidden">
            {classSections.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  kind="generic"
                  title={t('noClassesFound')}
                  description={t('noClassesFoundDesc')}
                  actionText={t('addClassSection')}
                  onAction={() => setIsAddClassOpen(true)}
                />
              </div>
            ) : (
              <div className="divide-y divide-line">
                {classSections.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface hover:bg-surface-soft transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-forest-700 text-white flex items-center justify-center font-extrabold text-sm font-display shadow-2xs shrink-0">
                        {c.sectionName}
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold text-ink font-display">
                          {c.className} — {c.sectionName}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-ink-muted font-display">
                            {t('classTeacherLabel')}
                          </span>
                          {c.assignedTeachers && c.assignedTeachers.length > 0 ? (
                            c.assignedTeachers.map((tItem) => (
                              <span
                                key={tItem.teacherId}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-bold bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30"
                              >
                                {tItem.teacherName}
                                <button
                                  type="button"
                                  onClick={() => unassignMutation.mutate({ teacherId: tItem.teacherId, classSectionId: c.id })}
                                  className="p-0.5 hover:text-danger-700 cursor-pointer min-h-[24px] min-w-[24px] inline-flex items-center justify-center"
                                  title={t('unassign')}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-amber-800 font-bold bg-amber-50 px-2.5 py-0.5 rounded-full">
                              {t('noTeacherAssigned')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedClass(c);
                          setIsAssignOpen(true);
                          setAssignError(null);
                        }}
                        leftIcon={<UserPlus className="w-4 h-4" />}
                        className="min-h-[44px] rounded-2xl font-display text-sm font-bold"
                      >
                        {t('assignTeacher')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Class Modal */}
      <AnimatePresence>
        {isAddClassOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-class-modal-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-md w-full p-6 text-left max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
                <h3 id="add-class-modal-title" className="text-xl font-extrabold text-ink font-display">
                  {t('addClassSection')}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddClassOpen(false)}
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

              <form onSubmit={handleAddClassSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-ink mb-1 font-display">
                    {t('classNamePrompt')} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('classNamePlaceholder')}
                    value={classForm.className}
                    onChange={(e) => setClassForm({ ...classForm, className: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-semibold text-ink outline-none focus:border-forest-700 min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-ink mb-1 font-display">
                    {t('sectionNamePrompt')} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('sectionNamePlaceholder')}
                    value={classForm.sectionName}
                    onChange={(e) => setClassForm({ ...classForm, sectionName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-semibold text-ink outline-none focus:border-forest-700 min-h-[44px]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddClassOpen(false)}
                    className="min-h-[44px] font-display text-sm"
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={createClassMutation.isPending}
                    className="min-h-[44px] font-display text-sm font-bold"
                  >
                    {t('addClassSection')}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add School Year Modal */}
      <AnimatePresence>
        {isAddYearOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-year-modal-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-md w-full p-6 text-left max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
                <h3 id="add-year-modal-title" className="text-xl font-extrabold text-ink font-display">
                  {t('addSchoolYear')}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddYearOpen(false)}
                  className="p-2 rounded-full hover:bg-surface-soft text-ink-muted cursor-pointer min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                  aria-label={t('close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {yearFormError && (
                <div className="mb-4 p-3 rounded-2xl bg-danger-50 text-danger-800 border border-danger-200 text-sm font-semibold">
                  {yearFormError}
                </div>
              )}

              <form onSubmit={handleAddYearSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-ink mb-1 font-display">
                    {t('schoolYearNamePrompt')} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="2026-2027"
                    value={yearForm.name}
                    onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-semibold text-ink outline-none focus:border-forest-700 min-h-[44px]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddYearOpen(false)}
                    className="min-h-[44px] font-display text-sm"
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={createYearMutation.isPending}
                    className="min-h-[44px] font-display text-sm font-bold"
                  >
                    {t('save')}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Assign Teacher Modal */}
      <AnimatePresence>
        {isAssignOpen && selectedClass && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-teacher-modal-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-md w-full p-6 text-left max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
                <h3 id="assign-teacher-modal-title" className="text-xl font-extrabold text-ink font-display">
                  {t('assignTeacherToClass', { className: selectedClass.className, sectionName: selectedClass.sectionName })}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAssignOpen(false)}
                  className="p-2 rounded-full hover:bg-surface-soft text-ink-muted cursor-pointer min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                  aria-label={t('close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {assignError && (
                <div className="mb-4 p-3 rounded-2xl bg-danger-50 text-danger-800 border border-danger-200 text-sm font-semibold">
                  {assignError}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!selectedTeacherId) {
                    setAssignError(t('chooseTeacherPrompt'));
                    return;
                  }
                  assignMutation.mutate({ teacherId: selectedTeacherId, classSectionId: selectedClass.id });
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-bold text-ink mb-1 font-display">
                    {t('classTeacher')} *
                  </label>
                  <select
                    required
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-sm font-bold text-ink outline-none focus:border-forest-700 cursor-pointer font-display min-h-[44px]"
                  >
                    <option value="">{t('selectTeacherPlaceholder')}</option>
                    {teachers.map((tItem) => (
                      <option key={tItem.id} value={tItem.id}>
                        {tItem.fullName} {tItem.designation ? `(${tItem.designation})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAssignOpen(false)}
                    className="min-h-[44px] font-display text-sm"
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={assignMutation.isPending}
                    className="min-h-[44px] font-display text-sm font-bold"
                  >
                    {t('save')}
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

export default AcademicManagement;
