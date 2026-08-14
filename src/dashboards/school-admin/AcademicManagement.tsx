import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { StatCard } from '../../components/shared/StatCard';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, BookOpen, Users, GraduationCap, CheckCircle2, X, AlertCircle, Calendar, UserCheck, UserMinus, Star } from 'lucide-react';

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
    <div className="space-y-8" id="academic-management-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
            Academic Structure & Class Sections
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Active grades, assigned class teachers, and session configurations at {activeSchoolName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setIsAddYearOpen(true);
              setYearFormError(null);
            }}
            className="px-4 py-2.5 rounded-full text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-all font-display shadow-2xs cursor-pointer flex items-center gap-2"
          >
            <Calendar className="w-4 h-4 text-emerald-700" />
            <span>Academic Years ({academicYears.length})</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={academicYears.length === 0}
            onClick={() => {
              setClassForm({ className: 'Class X', sectionName: 'A', academicYearId: currentYear?.id || '' });
              setIsAddClassOpen(true);
            }}
            className="btn-forest-primary text-sm font-display shadow-md cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Add Class Section</span>
          </motion.button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Loading academic classes & sections…" />
      ) : error ? (
        <ErrorState message={(error as any)?.message || 'Failed to load academic classes'} onRetry={() => refetch()} />
      ) : (
        <>

      {academicYears.length === 0 && (
        <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" />
            <div>
              <h4 className="font-extrabold text-sm font-display">No Academic Year Configured</h4>
              <p className="text-xs text-amber-700 mt-0.5">Please create an academic year session before adding classes or assigning teachers.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAddYearOpen(true)}
            className="btn-forest-primary text-xs font-display px-4 py-2 shrink-0 cursor-pointer shadow-md"
          >
            Create Academic Year
          </button>
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
              className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#144e39]/10 text-[#144e39] flex items-center justify-center font-bold">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 font-display">
                    Active Section
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 font-display">
                    {cs.className} – {cs.sectionName}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Academic Year: {cs.academicYearName || currentYear?.name || '2026-2027'}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-slate-400" />
                      <span>
                        Teacher:{' '}
                        <strong className="text-slate-800">
                          {assignedTeacher?.teacherName || 'Not Assigned'}
                        </strong>
                      </span>
                    </div>
                    {assignedTeacher && (
                      <button
                        type="button"
                        onClick={() => unassignMutation.mutate({ teacherId: assignedTeacher.teacherId, classSectionId: cs.id })}
                        className="text-rose-600 hover:text-rose-800 text-[10px] font-bold cursor-pointer"
                        title="Unassign teacher"
                      >
                        Unassign
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Ready for Daily Attendance</span>
                  </div>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400 font-mono">
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
                  className="px-3.5 py-1.5 rounded-full text-xs font-bold text-[#144e39] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all font-display cursor-pointer"
                >
                  {assignedTeacher ? 'Change Teacher' : 'Assign Teacher'}
                </button>
              </div>
            </motion.div>
          );
        })}

        {classSections.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-slate-200">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 font-display">No Class Sections Created</h3>
            <p className="text-xs text-slate-500 mt-1">Get started by creating your first grade or division.</p>
          </div>
        )}
      </div>
    </>
  )}

      {/* Add Class Section Modal */}
      <AnimatePresence>
        {isAddClassOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-left"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-extrabold text-slate-900 font-display">
                  Add Class Section
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddClassOpen(false)}
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

              <form onSubmit={handleAddClassSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                    Academic Year *
                  </label>
                  <select
                    value={classForm.academicYearId || currentYear?.id || ''}
                    onChange={(e) => setClassForm({ ...classForm, academicYearId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none"
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
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                      Class / Grade *
                    </label>
                    <input
                      type="text"
                      required
                      value={classForm.className}
                      onChange={(e) => setClassForm({ ...classForm, className: e.target.value })}
                      placeholder="e.g. Class IX"
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                      Section *
                    </label>
                    <input
                      type="text"
                      required
                      value={classForm.sectionName}
                      onChange={(e) => setClassForm({ ...classForm, sectionName: e.target.value })}
                      placeholder="e.g. A"
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddClassOpen(false)}
                    className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 font-display cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createClassMutation.isPending}
                    className="btn-forest-primary text-xs font-display px-5 py-2 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {createClassMutation.isPending ? 'Creating…' : 'Create Section'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Academic Years Modal */}
        {isAddYearOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 text-left"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-extrabold text-slate-900 font-display">
                  Manage Academic Years
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddYearOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {yearFormError && (
                <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {yearFormError}
                </div>
              )}

              <div className="mb-6 space-y-2">
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider font-display">
                  Configured Sessions
                </h4>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
                  {academicYears.map((y) => (
                    <div key={y.id} className="p-3 bg-white flex items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-extrabold text-slate-900 font-display block">{y.name}</span>
                        <span className="text-[11px] text-slate-500 font-mono">{y.startDate} to {y.endDate}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {y.isCurrent ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Current
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCurrentYearMutation.mutate(y.id)}
                            className="px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer font-display"
                          >
                            Set Current
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleAddYearSubmit} className="space-y-3 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider font-display">
                  Create New Academic Year
                </h4>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                    Session Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={yearForm.name}
                    onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })}
                    placeholder="e.g. 2026-2027"
                    className="w-full px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={yearForm.startDate}
                      onChange={(e) => setYearForm({ ...yearForm, startDate: e.target.value })}
                      className="w-full px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                      End Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={yearForm.endDate}
                      onChange={(e) => setYearForm({ ...yearForm, endDate: e.target.value })}
                      className="w-full px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsAddYearOpen(false)}
                    className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 font-display cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={createYearMutation.isPending}
                    className="btn-forest-primary text-xs font-display px-5 py-2 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {createYearMutation.isPending ? 'Saving…' : 'Add Session Year'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Assign Teacher Modal */}
        {isAssignOpen && selectedClass && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-extrabold text-slate-900 font-display">
                  Assign Class Teacher
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAssignOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500 mb-4">
                Assign an educator to lead daily attendance for <strong>{selectedClass.className} – {selectedClass.sectionName}</strong>.
              </p>

              {assignError && (
                <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{assignError}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 font-display">
                    Select Classroom Educator *
                  </label>
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none"
                  >
                    <option value="">-- Choose from registered faculty --</option>
                    {teachers.map((t) => (
                      <option key={t.userId} value={t.userId}>
                        {t.fullName} ({t.designation || 'Teacher'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAssignOpen(false)}
                    className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 font-display cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={assignMutation.isPending || !selectedTeacherId}
                    onClick={() => assignMutation.mutate({ teacherId: selectedTeacherId, classSectionId: selectedClass.id })}
                    className="btn-forest-primary text-xs font-display px-5 py-2 shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {assignMutation.isPending ? 'Assigning…' : 'Save Assignment'}
                  </button>
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
