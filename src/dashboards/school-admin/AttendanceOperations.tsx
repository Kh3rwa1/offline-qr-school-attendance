import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { StatCard } from '../../components/shared/StatCard';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Clock, Calendar, QrCode, FileSpreadsheet, Eye, RefreshCw, Printer, AlertTriangle, X, Check, Lock, Unlock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SessionItem {
  id: string;
  className: string;
  sectionName: string;
  teacherId: string;
  sessionDate: string;
  sessionType: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'FINALIZED' | 'LOCKED';
  finalizedAt?: string;
}

interface SessionDetails {
  session: SessionItem;
  roster: {
    studentId: string;
    fullName: string;
    rollNumber: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    recordedAt?: string;
  }[];
  summary: {
    totalStudents: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    excusedCount: number;
    attendanceRate: number;
  };
}

export const AttendanceOperations: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [inspectSessionId, setInspectSessionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [isReopenOpen, setIsReopenOpen] = useState(false);

  // Correction state
  const [correctingStudent, setCorrectingStudent] = useState<{
    studentId: string;
    fullName: string;
    currentStatus: string;
  } | null>(null);
  const [correctionNewStatus, setCorrectionNewStatus] = useState<string>('PRESENT');
  const [correctionReason, setCorrectionReason] = useState('');

  // Query: Sessions for date
  const { data: sessionsData, isLoading, error, refetch } = useQuery({
    queryKey: ['schools', activeSchoolId, 'attendance', 'sessions', selectedDate],
    queryFn: async () => {
      if (!activeSchoolId) return [];
      const res = await api<{ success: boolean; data: SessionItem[] }>(
        `/api/v1/schools/${activeSchoolId}/attendance/sessions?sessionDate=${selectedDate}`
      );
      return res.data || [];
    },
    enabled: Boolean(activeSchoolId),
  });

  // Query: Detailed Session Inspect
  const { data: inspectData, isLoading: isInspectLoading } = useQuery({
    queryKey: ['schools', activeSchoolId, 'attendance', 'session', inspectSessionId],
    queryFn: async () => {
      if (!activeSchoolId || !inspectSessionId) return null;
      const res = await api<{ success: boolean; data: SessionDetails }>(
        `/api/v1/schools/${activeSchoolId}/attendance/sessions/${inspectSessionId}`
      );
      return res.data;
    },
    enabled: Boolean(activeSchoolId && inspectSessionId),
  });

  // Mutation: Reopen / Finalize Status
  const statusMutation = useMutation({
    mutationFn: async ({ sessionId, status, reason }: { sessionId: string; status: string; reason?: string }) => {
      return api(`/api/v1/schools/${activeSchoolId}/attendance/sessions/${sessionId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason, autoMarkAbsentForUnmarked: true }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'attendance'] });
      setIsReopenOpen(false);
      setReopenReason('');
      setActionError(null);
      setSuccessToast('Session status updated successfully.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      setActionError(err.message || 'Status change failed');
    },
  });

  // Mutation: Manual Record Correction
  const correctionMutation = useMutation({
    mutationFn: async ({
      sessionId,
      studentId,
      newStatus,
      reason,
    }: {
      sessionId: string;
      studentId: string;
      newStatus: string;
      reason: string;
    }) => {
      return api(`/api/v1/schools/${activeSchoolId}/attendance/sessions/${sessionId}/manual`, {
        method: 'POST',
        body: JSON.stringify({
          studentId,
          newStatus,
          reason,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schools', activeSchoolId, 'attendance'] });
      setCorrectingStudent(null);
      setCorrectionReason('');
      setActionError(null);
      setSuccessToast('Attendance record corrected and audited.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      setActionError(err.message || 'Manual correction failed');
    },
  });

  const sessions = sessionsData || [];
  const finalizedCount = sessions.filter((s) => s.status === 'FINALIZED').length;
  const inProgressCount = sessions.filter((s) => s.status === 'IN_PROGRESS' || s.status === 'SUBMITTED').length;

  if (isLoading) return <LoadingState message="Loading daily attendance sessions…" />;
  if (error) return <ErrorState message={(error as any)?.message || 'Failed to load attendance'} onRetry={() => refetch()} />;

  return (
    <div className="space-y-8" id="attendance-operations-view">
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
            Attendance Operations & Oversight
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Review daily classroom roll submissions, audit corrections, and manage session locks for {activeSchoolName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 rounded-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:bg-white focus:border-[#144e39] outline-none font-mono"
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/app/teacher')}
            className="btn-forest-primary text-sm font-display cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>Open Attendance Station</span>
          </motion.button>
        </div>
      </div>

      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-700 font-bold text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Sessions Today"
          value={sessions.length.toString()}
          trend={{ value: `${finalizedCount} Finalized & Locked`, isPositive: true }}
          variant="hero-forest"
        />
        <StatCard
          title="Open Sessions"
          value={inProgressCount.toString()}
          trend={{ value: "Teacher Submissions", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Attendance Mode"
          value="Hybrid QR & RFID"
          trend={{ value: "Offline-First Sync", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Selected Date"
          value={new Date(selectedDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
          trend={{ value: "Official Roll Date", isPositive: true }}
          variant="default"
        />
      </div>

      {/* Sessions Table */}
      <div className="app-card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 font-display">
              Roll Sessions for {selectedDate}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase font-display">
              <tr>
                <th className="py-4 px-6">Class & Section</th>
                <th className="py-4 px-6">Session Type</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Finalized At</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700 bg-white">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-6">
                    <span className="font-extrabold text-slate-900 block font-display text-sm">
                      {session.className} – {session.sectionName}
                    </span>
                  </td>
                  <td className="py-4 px-6">{session.sessionType}</td>
                  <td className="py-4 px-6">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase font-display ${
                      session.status === 'FINALIZED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : session.status === 'IN_PROGRESS' || session.status === 'SUBMITTED'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-50 text-slate-700 border border-slate-200'
                    }`}>
                      {session.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-mono text-slate-500">
                    {session.finalizedAt ? new Date(session.finalizedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setInspectSessionId(session.id)}
                        className="px-3 py-1 rounded-full text-[11px] font-bold text-[#144e39] bg-[#144e39]/10 hover:bg-[#144e39]/20 transition-all font-display cursor-pointer"
                      >
                        Inspect
                      </button>
                      {session.status === 'FINALIZED' && (
                        <button
                          type="button"
                          onClick={() => {
                            setInspectSessionId(session.id);
                            setIsReopenOpen(true);
                            setReopenReason('');
                            setActionError(null);
                          }}
                          className="px-3 py-1 rounded-full text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-all font-display cursor-pointer"
                        >
                          Re-open
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                    No attendance sessions recorded for {selectedDate}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Roll Modal */}
      <AnimatePresence>
        {inspectSessionId && inspectData && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 text-left max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 font-display">
                    {inspectData.session.className} – {inspectData.session.sectionName} Roll Sheet
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectSessionId(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-3 my-4">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Total</span>
                  <p className="text-base font-extrabold text-slate-900 font-display">{inspectData.summary.totalStudents}</p>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">Present</span>
                  <p className="text-base font-extrabold text-emerald-800 font-display">{inspectData.summary.presentCount}</p>
                </div>
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-center">
                  <span className="text-[10px] font-bold text-rose-600 uppercase">Absent</span>
                  <p className="text-base font-extrabold text-rose-800 font-display">{inspectData.summary.absentCount}</p>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-center">
                  <span className="text-[10px] font-bold text-amber-600 uppercase">Rate</span>
                  <p className="text-base font-extrabold text-amber-800 font-display">{inspectData.summary.attendanceRate}%</p>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 divide-y divide-slate-100 border border-slate-100 rounded-2xl">
                {inspectData.roster.map((student) => (
                  <div key={student.studentId} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                    <div>
                      <span className="font-bold text-slate-900 block">{student.fullName}</span>
                      <span className="text-[11px] text-slate-400 font-mono">Roll: #{student.rollNumber || '—'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase ${
                        student.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {student.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCorrectingStudent({
                            studentId: student.studentId,
                            fullName: student.fullName,
                            currentStatus: student.status,
                          });
                          setCorrectionNewStatus(student.status === 'PRESENT' ? 'ABSENT' : 'PRESENT');
                          setCorrectionReason('');
                          setActionError(null);
                        }}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
                      >
                        Correct
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Correction Modal */}
      <AnimatePresence>
        {correctingStudent && inspectSessionId && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-60 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-extrabold text-slate-900 font-display">Manual Status Correction</h3>
                <button type="button" onClick={() => setCorrectingStudent(null)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-xs text-slate-600 mb-4">Updating <strong>{correctingStudent.fullName}</strong> (Current: {correctingStudent.currentStatus}).</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 font-display">New Status *</label>
                  <select value={correctionNewStatus} onChange={(e) => setCorrectionNewStatus(e.target.value)} className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:border-[#144e39] outline-none">
                    <option value="PRESENT">PRESENT</option>
                    <option value="ABSENT">ABSENT</option>
                    <option value="LATE">LATE</option>
                    <option value="EXCUSED">EXCUSED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 font-display">Mandatory Reason for Audit *</label>
                  <textarea required rows={3} value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:border-[#144e39] outline-none" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-100">
                <button type="button" onClick={() => setCorrectingStudent(null)} className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button type="button" disabled={correctionMutation.isPending || correctionReason.trim().length < 3} onClick={() => correctionMutation.mutate({ sessionId: inspectSessionId, studentId: correctingStudent.studentId, newStatus: correctionNewStatus, reason: correctionReason.trim() })} className="btn-forest-primary text-xs font-display px-5 py-2 shadow-md disabled:opacity-50">
                  {correctionMutation.isPending ? 'Saving…' : 'Apply Correction'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reopen Session Modal */}
      <AnimatePresence>
        {isReopenOpen && inspectSessionId && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-60 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-amber-700"><Unlock className="w-5 h-5" /><h3 className="text-lg font-extrabold font-display">Re-open Session</h3></div>
                <button type="button" onClick={() => setIsReopenOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-xs text-slate-600 mb-4">Re-opening unlocks the roll sheet for amendments.</p>
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-1 font-display">Reason for Re-opening *</label>
                <textarea required rows={3} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:bg-white focus:border-amber-600 outline-none" />
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsReopenOpen(false)} className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button type="button" disabled={statusMutation.isPending || reopenReason.trim().length < 3} onClick={() => statusMutation.mutate({ sessionId: inspectSessionId, status: 'REOPENED', reason: reopenReason.trim() })} className="px-5 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs font-display shadow-md disabled:opacity-50">
                  {statusMutation.isPending ? 'Unlocking…' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AttendanceOperations;
