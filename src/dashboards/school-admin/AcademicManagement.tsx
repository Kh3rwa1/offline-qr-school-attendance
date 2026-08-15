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
import { Plus, GraduationCap, CheckCircle2, X, AlertCircle, Calendar, UserCheck } from 'lucide-react';

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
  const queryClient = useQueryClient();

  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [isAddYearOpen, setIsAddYearOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassSectionItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [yearFormError, setYearFormError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Form states
  const [classForm, setClassForm] = useState({
    className: 'Class X',
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

  // Mutation: Create Academic Year
  const createYearMutation = useMutation({
    mutationFn: async (payload: typeof yearForm) => {
      return api(`/api/v1/schools/${activeSchoolId}/academic-years`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'academic-years'] });
      setIsAddYearOpen(false);
      setYearFormError(null);
    },
    onError: (err: any) => {
      setYearFormError(err.message || 'Failed to create academic year');
    },
  });

  // Mutation: Set Current Academic Year
  const setCurrentYearMutation = useMutation({
    mutationFn: async (yearId: string) => {
      return api(`/api/v1/schools/${activeSchoolId}/academic-years/${yearId}/set-current`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'academic-years'] });
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'class-sections'] });
    },
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
      setClassForm({ className: 'Class X', sectionName: 'A', academicYearId: '' });
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to create class section');
    },
  });

  // Mutation: Assign Teacher
  const assignMutation = useMutation({
    mutationFn: async ({ teacherId, classSectionId }: { teacherId: string; classSectionId: string }) => {
      return api(`/api/v1/schools/${activeSchoolId}/teachers/assign`, {
        method: 'POST',
        body: JSON.stringify({ teacherId, classSectionId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'class-sections'] });
      setIsAssignOpen(false);
      setSelectedClass(null);
      setSelectedTeacherId('');
      setAssignError(null);
    },
    onError: (err: any) => {
      setAssignError(err.message || 'Failed to assign teacher');
    },
  });

  // Mutation: Unassign Teacher
  const unassignMutation = useMutation({
    mutationFn: async ({ teacherId, classSectionId }: { teacherId: string; classSectionId: string }) => {
      return api(`/api/v1/schools/${activeSchoolId}/teachers/assign`, {
        method: 'DELETE',
        body: JSON.stringify({ teacherId, classSectionId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'class-sections'] });
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
      setFormError('Please select or create an active academic year first');
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
      setYearFormError('Academic year name is required');
      return;
    }
    createYearMutation.mutate(yearForm);
  };

  return (
    <div className="space-y-8 text-left" id="academic-management-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
            Academic Structure & Class Sections
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            Active grades, assigned class teachers, and session configurations at {activeSchoolName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              setIsAddYearOpen(true);
              setYearFormError(null);
            }}
            leftIcon={<Calendar className="w-4 h-4 text-forest-700 dark:text-forest-600" />}
          >
            Academic Years ({academicYears.length})
          </Button>

          <Button
            variant="primary"
            size="md"
            disabled={academicYears.length === 0}
            onClick={() => {
              setClassForm({ className: 'Class X', sectionName: 'A', academicYearId: currentYear?.id || '' });
              setIsAddClassOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Class Section
          </Button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState type="table" message="Loading academic classes & sections…" />
      ) : error ? (
        <ErrorState message={(error as any)?.message || 'Failed to load academic classes'} onRetry={() => refetch()} />
      ) : (
        <>
          {academicYears.length === 0 && (
            <div className="p-5 rounded-3xl bg-warning-50 border border-warning-100 dark:border-warning-600/30 text-warning-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-warning-800 shrink-0" />
                <div>
                  <h4 className="font-extrabold text-sm font-display">No Academic Year Configured</h4>
                  <p className="t-body text-xs text-warning-800 mt-0.5">Please create an academic year session before adding classes or assigning teachers.</p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsAddYearOpen(true)}
              >
                Create Academic Year
              </Button>
            </div>
          )}

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard
              title="Class Sections"
              value={`${classSections.length} Sections`}
              trend={{ value: `Academic Year ${currentYear?.name || '2026-2027'}`, isPositive: true }}
              variant="hero-forest"
            />
            <StatCard
              title="Assigned Teachers"
              value={`${teachers.length} Faculty`}
              trend={{ value: "Classroom Educators", isPositive: true }}
              variant="default"
            />
            <StatCard
              title="Active Academic Year"
              value={currentYear?.name || 'None'}
              trend={{ value: currentYear?.isCurrent ? 'Current Session' : 'Configured', isPositive: true }}
              variant="default"
            />
            <StatCard
              title="Attendance Mode"
              value="Hybrid QR & RFID"
              trend={{ value: "Offline-First Sync", isPositive: true }}
              variant="default"
            />
          </div>

          {/* Classes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classSections.map((cs, idx) => {
              const assignedTeacher = cs.assignedTeachers?.[0];
              return (
                <motion.div
                  key={cs.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className="app-card p-6 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-success-50 text-forest-700 dark:text-forest-600 flex items-center justify-center font-bold">
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30 font-display">
                        Active Section
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl font-extrabold text-ink font-display">
                        {cs.className} – {cs.sectionName}
                      </h3>
                      <p className="t-body text-xs text-ink-muted mt-0.5">
                        Academic Year: {cs.academicYearName || currentYear?.name || '2026-2027'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-line space-y-2 text-xs text-ink-soft">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-ink-muted" />
                          <span>
                            Teacher:{' '}
                            <strong className="text-ink">
                              {assignedTeacher?.teacherName || 'Not Assigned'}
                            </strong>
                          </span>
                        </div>
                        {assignedTeacher && (
                          <button
                            type="button"
                            onClick={() => unassignMutation.mutate({ teacherId: assignedTeacher.teacherId, classSectionId: cs.id })}
                            className="text-danger-600 hover:text-danger-800 text-[11px] font-bold cursor-pointer"
                            title="Unassign teacher"
                          >
                            Unassign
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-success-600" />
                        <span>Ready for Daily Attendance</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-5 mt-4 border-t border-line flex items-center justify-between gap-2">
                    <span className="text-[11px] text-ink-muted font-mono">
                      ID: {cs.id.slice(0, 8)}…
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClass(cs);
                        setSelectedTeacherId(assignedTeacher?.teacherId || '');
                        setIsAssignOpen(true);
                        setAssignError(null);
                      }}
                      className="px-3.5 py-1.5 rounded-full text-[11px] font-bold text-forest-700 dark:text-forest-600 bg-success-50 hover:bg-success-100 border border-success-100 dark:border-success-600/30 transition-all font-display cursor-pointer"
                    >
                      {assignedTeacher ? 'Change Teacher' : 'Assign Teacher'}
                    </button>
                  </div>
                </motion.div>
              );
            })}

            {classSections.length === 0 && (
              <div className="col-span-full py-8">
                <EmptyState
                  kind="roster"
                  title="No Class Sections Created"
                  description="Get started by creating your first grade or division."
                  actionText="Add Class Section"
                  onAction={() => setIsAddClassOpen(true)}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Class Section Modal */}
      <AnimatePresence>
        {isAddClassOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-md w-full p-6 text-left"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-extrabold text-ink font-display">
                  Add Class Section
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddClassOpen(false)}
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

              <form onSubmit={handleAddClassSubmit} className="space-y-4">
                <div>
                  <label className="block t-label text-ink mb-1 font-display">
                    Academic Year *
                  </label>
                  <select
                    value={classForm.academicYearId || currentYear?.id || ''}
                    onChange={(e) => setClassForm({ ...classForm, academicYearId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink focus:bg-surface focus:border-forest-700 outline-none"
                  >
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name} {y.isCurrent ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block t-label text-ink mb-1 font-display">
                      Class / Grade *
                    </label>
                    <input
                      type="text"
                      required
                      value={classForm.className}
                      onChange={(e) => setClassForm({ ...classForm, className: e.target.value })}
                      placeholder="e.g. Class IX"
                      className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block t-label text-ink mb-1 font-display">
                      Section *
                    </label>
                    <input
                      type="text"
                      required
                      value={classForm.sectionName}
                      onChange={(e) => setClassForm({ ...classForm, sectionName: e.target.value })}
                      placeholder="e.g. A"
                      className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddClassOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={createClassMutation.isPending}
                  >
                    {createClassMutation.isPending ? 'Creating…' : 'Create Section'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Academic Years Modal */}
        {isAddYearOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-lg w-full p-6 text-left"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-extrabold text-ink font-display">
                  Manage Academic Years
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddYearOpen(false)}
                  className="w-8 h-8 rounded-full bg-surface-soft hover:bg-surface flex items-center justify-center text-ink-muted hover:text-ink transition-all cursor-pointer border border-line"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {yearFormError && (
                <div className="mb-4">
                  <Toast kind="error" message={yearFormError} onDismiss={() => setYearFormError(null)} autoDismiss={false} />
                </div>
              )}

              <div className="mb-6 space-y-2">
                <h4 className="t-label text-ink uppercase tracking-wider font-display">
                  Configured Sessions
                </h4>
                <div className="divide-y divide-line border border-line rounded-2xl overflow-hidden bg-surface-soft">
                  {academicYears.map((y) => (
                    <div key={y.id} className="p-3 bg-surface flex items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-extrabold text-ink font-display block">{y.name}</span>
                        <span className="text-[11px] text-ink-muted font-mono">{y.startDate} to {y.endDate}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {y.isCurrent ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30 font-display">
                            Current
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCurrentYearMutation.mutate(y.id)}
                            className="px-2.5 py-1 rounded-full text-[11px] font-bold text-ink-soft hover:bg-surface-soft border border-line cursor-pointer font-display"
                          >
                            Set Current
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleAddYearSubmit} className="space-y-3 pt-4 border-t border-line">
                <h4 className="t-label text-ink uppercase tracking-wider font-display">
                  Create New Academic Year
                </h4>

                <div>
                  <label className="block t-label text-ink mb-1 font-display">
                    Session Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={yearForm.name}
                    onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })}
                    placeholder="e.g. 2026-2027"
                    className="w-full px-4 py-2 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block t-label text-ink mb-1 font-display">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={yearForm.startDate}
                      onChange={(e) => setYearForm({ ...yearForm, startDate: e.target.value })}
                      className="w-full px-4 py-2 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink focus:bg-surface focus:border-forest-700 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block t-label text-ink mb-1 font-display">
                      End Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={yearForm.endDate}
                      onChange={(e) => setYearForm({ ...yearForm, endDate: e.target.value })}
                      className="w-full px-4 py-2 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink focus:bg-surface focus:border-forest-700 outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddYearOpen(false)}
                  >
                    Close
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={createYearMutation.isPending}
                  >
                    {createYearMutation.isPending ? 'Saving…' : 'Add Session Year'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Assign Teacher Modal */}
        {isAssignOpen && selectedClass && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-md w-full p-6 text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-extrabold text-ink font-display">
                  Assign Class Teacher
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAssignOpen(false)}
                  className="w-8 h-8 rounded-full bg-surface-soft hover:bg-surface flex items-center justify-center text-ink-muted hover:text-ink transition-all cursor-pointer border border-line"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="t-body text-xs text-ink-soft mb-4">
                Assign an educator to lead daily attendance for <strong>{selectedClass.className} – {selectedClass.sectionName}</strong>.
              </p>

              {assignError && (
                <div className="mb-4">
                  <Toast kind="error" message={assignError} onDismiss={() => setAssignError(null)} autoDismiss={false} />
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block t-label text-ink mb-1 font-display">
                    Select Classroom Educator *
                  </label>
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink focus:bg-surface focus:border-forest-700 outline-none"
                  >
                    <option value="">-- Choose from registered faculty --</option>
                    {teachers.map((t) => (
                      <option key={t.userId} value={t.userId}>
                        {t.fullName} ({t.designation || 'Teacher'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAssignOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={assignMutation.isPending || !selectedTeacherId}
                    isLoading={assignMutation.isPending}
                    onClick={() => assignMutation.mutate({ teacherId: selectedTeacherId, classSectionId: selectedClass.id })}
                  >
                    {assignMutation.isPending ? 'Assigning…' : 'Save Assignment'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AcademicManagement;
