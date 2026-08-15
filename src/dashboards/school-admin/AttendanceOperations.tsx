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
import { QrCode, RefreshCw, X, Unlock } from 'lucide-react';
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
  const { data: inspectData } = useQuery({
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

  if (isLoading) return <LoadingState type="table" message="Loading daily attendance sessions…" />;
  if (error) return <ErrorState message={(error as any)?.message || 'Failed to load attendance'} onRetry={() => refetch()} />;

  return (
    <div className="space-y-8 text-left" id="attendance-operations-view">
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
            Attendance Operations & Oversight
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            Review daily classroom roll submissions, audit corrections, and manage session locks for {activeSchoolName}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink focus:bg-surface focus:border-forest-700 outline-none font-mono"
          />
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/app/teacher')}
            leftIcon={<QrCode className="w-4 h-4" />}
          >
            Open Attendance Station
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="mb-4">
          <Toast kind="error" message={actionError} onDismiss={() => setActionError(null)} autoDismiss={false} />
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
        <div className="p-6 border-b border-line flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-ink font-display">
              Roll Sessions for {selectedDate}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 rounded-full bg-surface-soft hover:bg-surface text-ink-soft hover:text-ink transition-all cursor-pointer border border-line"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-soft border-b border-line text-ink-muted font-bold uppercase font-display">
              <tr>
                <th className="py-4 px-6">Class & Section</th>
                <th className="py-4 px-6">Session Type</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Finalized At</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-medium text-ink bg-surface">
              {sessions.map((session) => (
                <tr key={session.id} className="table-row-hover">
                  <td className="py-4 px-6">
                    <span className="font-extrabold text-ink block font-display text-sm">
                      {session.className} – {session.sectionName}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-ink-soft">{session.sessionType}</td>
                  <td className="py-4 px-6">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase font-display ${
                      session.status === 'FINALIZED'
                        ? 'bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30'
                        : session.status === 'IN_PROGRESS' || session.status === 'SUBMITTED'
                        ? 'bg-warning-50 text-warning-800 border border-warning-100 dark:border-warning-600/30'
                        : 'bg-surface-soft text-ink-soft border border-line'
                    }`}>
                      {session.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-mono text-ink-muted">
                    {session.finalizedAt ? new Date(session.finalizedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setInspectSessionId(session.id)}
                        className="px-3 py-1 rounded-full text-[11px] font-bold text-forest-700 dark:text-forest-600 bg-success-50 hover:bg-success-100 border border-success-100 dark:border-success-600/30 transition-all font-display cursor-pointer"
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
                          className="px-3 py-1 rounded-full text-[11px] font-bold text-warning-800 bg-warning-50 hover:bg-warning-100 border border-warning-100 dark:border-warning-600/30 transition-all font-display cursor-pointer"
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
                  <td colSpan={5} className="py-8">
                    <EmptyState
                      kind="generic"
                      title="No attendance sessions recorded"
                      description={`No attendance sessions have been created for ${selectedDate}.`}
                      actionText="Open Attendance Station"
                      onAction={() => navigate('/app/teacher')}
                    />
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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-2xl w-full p-6 text-left max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-4 border-b border-line">
                <div>
                  <h3 className="text-xl font-extrabold text-ink font-display">
                    {inspectData.session.className} – {inspectData.session.sectionName} Roll Sheet
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectSessionId(null)}
                  className="w-8 h-8 rounded-full bg-surface-soft hover:bg-surface flex items-center justify-center text-ink-muted hover:text-ink transition-all cursor-pointer border border-line"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-3 my-4">
                <div className="p-3 rounded-2xl bg-surface-soft border border-line text-center">
                  <span className="t-label text-ink-muted">Total</span>
                  <p className="text-base font-extrabold text-ink font-display">{inspectData.summary.totalStudents}</p>
                </div>
                <div className="p-3 rounded-2xl bg-success-50 border border-success-100 dark:border-success-600/30 text-center">
                  <span className="t-label text-forest-700 dark:text-forest-600">Present</span>
                  <p className="text-base font-extrabold text-success-800 font-display">{inspectData.summary.presentCount}</p>
                </div>
                <div className="p-3 rounded-2xl bg-danger-50 border border-danger-100 dark:border-danger-600/30 text-center">
                  <span className="t-label text-danger-800">Absent</span>
                  <p className="text-base font-extrabold text-danger-800 font-display">{inspectData.summary.absentCount}</p>
                </div>
                <div className="p-3 rounded-2xl bg-warning-50 border border-warning-100 dark:border-warning-600/30 text-center">
                  <span className="t-label text-warning-800">Rate</span>
                  <p className="text-base font-extrabold text-warning-800 font-display">{inspectData.summary.attendanceRate}%</p>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 divide-y divide-line border border-line rounded-2xl">
                {inspectData.roster.map((student) => (
                  <div key={student.studentId} className="p-3 flex items-center justify-between text-xs hover:bg-surface-soft transition-colors">
                    <div>
                      <span className="font-bold text-ink block">{student.fullName}</span>
                      <span className="text-[11px] text-ink-muted font-mono">Roll: #{student.rollNumber || '—'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase font-display ${
                        student.status === 'PRESENT' ? 'bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30' : 'bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30'
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
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-ink-soft bg-surface-soft hover:bg-surface border border-line transition-colors cursor-pointer"
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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-60 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-md w-full p-6 text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-extrabold text-ink font-display">Manual Status Correction</h3>
                <button type="button" onClick={() => setCorrectingStudent(null)} className="w-8 h-8 rounded-full bg-surface-soft hover:bg-surface flex items-center justify-center text-ink-muted border border-line"><X className="w-4 h-4" /></button>
              </div>
              <p className="t-body text-xs text-ink-soft mb-4">Updating <strong>{correctingStudent.fullName}</strong> (Current: {correctingStudent.currentStatus}).</p>
              <div className="space-y-4">
                <div>
                  <label className="block t-label text-ink mb-1 font-display">New Status *</label>
                  <select value={correctionNewStatus} onChange={(e) => setCorrectionNewStatus(e.target.value)} className="w-full px-4 py-2.5 rounded-full bg-surface-soft border border-line text-xs font-semibold text-ink focus:bg-surface focus:border-forest-700 outline-none">
                    <option value="PRESENT">PRESENT</option>
                    <option value="ABSENT">ABSENT</option>
                    <option value="LATE">LATE</option>
                    <option value="EXCUSED">EXCUSED</option>
                  </select>
                </div>
                <div>
                  <label className="block t-label text-ink mb-1 font-display">Mandatory Reason for Audit *</label>
                  <textarea required rows={3} value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} className="w-full px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-xs font-medium text-ink focus:bg-surface focus:border-forest-700 outline-none" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-line">
                <Button variant="ghost" size="sm" type="button" onClick={() => setCorrectingStudent(null)}>Cancel</Button>
                <Button variant="primary" size="sm" type="button" disabled={correctionMutation.isPending || correctionReason.trim().length < 3} isLoading={correctionMutation.isPending} onClick={() => correctionMutation.mutate({ sessionId: inspectSessionId, studentId: correctingStudent.studentId, newStatus: correctionNewStatus, reason: correctionReason.trim() })}>
                  Apply Correction
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reopen Session Modal */}
      <AnimatePresence>
        {isReopenOpen && inspectSessionId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-60 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-md w-full p-6 text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-warning-800"><Unlock className="w-5 h-5" /><h3 className="text-lg font-extrabold font-display">Re-open Session</h3></div>
                <button type="button" onClick={() => setIsReopenOpen(false)} className="w-8 h-8 rounded-full bg-surface-soft hover:bg-surface flex items-center justify-center text-ink-muted border border-line"><X className="w-4 h-4" /></button>
              </div>
              <p className="t-body text-xs text-ink-soft mb-4">Re-opening unlocks the roll sheet for amendments.</p>
              <div className="mb-4">
                <label className="block t-label text-ink mb-1 font-display">Reason for Re-opening *</label>
                <textarea required rows={3} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} className="w-full px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-xs font-medium text-ink focus:bg-surface focus:border-warning-600 outline-none" />
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <Button variant="ghost" size="sm" type="button" onClick={() => setIsReopenOpen(false)}>Cancel</Button>
                <Button variant="secondary" size="sm" type="button" disabled={statusMutation.isPending || reopenReason.trim().length < 3} isLoading={statusMutation.isPending} onClick={() => statusMutation.mutate({ sessionId: inspectSessionId, status: 'REOPENED', reason: reopenReason.trim() })}>
                  Confirm
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AttendanceOperations;
