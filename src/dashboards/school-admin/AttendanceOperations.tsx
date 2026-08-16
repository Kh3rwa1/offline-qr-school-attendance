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
import { QrCode, RefreshCw, X, CalendarCheck2, CheckCircle2, Clock, Edit3, ShieldAlert } from 'lucide-react';
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
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [inspectSessionId, setInspectSessionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

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
      setSuccessToast(language === 'bn' ? 'উপস্থিতি সংশোধন সম্পন্ন হয়েছে।' : 'Attendance record corrected and audited.');
      setTimeout(() => setSuccessToast(null), 4000);
    },
    onError: (err: any) => {
      const safe = getUserSafeError(err, language);
      setActionError(safe.message);
    },
  });

  const sessions = sessionsData || [];
  const finalizedCount = sessions.filter((s) => s.status === 'FINALIZED').length;
  const inProgressCount = sessions.filter((s) => s.status === 'IN_PROGRESS' || s.status === 'SUBMITTED').length;

  if (isLoading) return <LoadingState type="table" message={language === 'bn' ? 'উপস্থিতি বিবরণ লোড হচ্ছে…' : 'Loading daily attendance…'} />;
  if (error) return <ErrorState message={(error as any)?.message || 'Failed to load attendance'} onRetry={() => refetch()} />;

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return t('statusPresent');
      case 'LATE':
        return t('statusLate');
      case 'ABSENT':
        return t('statusAbsent');
      case 'LEAVE':
      case 'EXCUSED':
        return t('statusOnLeave');
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 text-left max-w-6xl mx-auto" id="attendance-operations-view">
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
            {t('navDailyAttendance')}
          </h1>
          <p className="t-body text-xs text-ink-soft mt-1">
            {language === 'bn' ? `${activeSchoolName}-এর দৈনিক উপস্থিতি খাতা পর্যবেক্ষণ ও সংশোধন।` : `Review and correct daily classroom attendance rolls for ${activeSchoolName}.`}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-4 py-2.5 rounded-2xl bg-surface-soft border border-line text-xs font-bold text-ink outline-none focus:border-forest-700 font-mono min-h-[44px]"
          />
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/app/teacher')}
            leftIcon={<QrCode className="w-4 h-4" />}
            className="min-h-[44px] rounded-2xl font-display text-xs"
          >
            {t('startAttendance')}
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="mb-4">
          <Toast kind="error" message={actionError} onDismiss={() => setActionError(null)} autoDismiss={false} />
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-bold uppercase font-display">{language === 'bn' ? 'আজকের মোট ক্লাস' : 'Total Sessions'}</span>
            <CalendarCheck2 className="w-4 h-4 text-forest-700 dark:text-forest-600" />
          </div>
          <div className="text-3xl font-extrabold text-ink font-display font-mono">
            {sessions.length}
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-bold uppercase font-display">{language === 'bn' ? 'সম্পন্ন ও লক' : 'Finalized & Locked'}</span>
            <CheckCircle2 className="w-4 h-4 text-forest-700 dark:text-forest-600" />
          </div>
          <div className="text-3xl font-extrabold text-forest-700 dark:text-forest-600 font-display font-mono">
            {finalizedCount}
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-surface border border-line shadow-xs space-y-2">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-bold uppercase font-display">{language === 'bn' ? 'চলমান উপস্থিতি' : 'In Progress'}</span>
            <Clock className="w-4 h-4 text-amber-700" />
          </div>
          <div className="text-3xl font-extrabold text-amber-800 font-display font-mono">
            {inProgressCount}
          </div>
        </div>
      </div>

      {/* Sessions List */}
      <div className="app-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-line flex items-center justify-between">
          <h3 className="text-base font-extrabold text-ink font-display">
            {language === 'bn' ? `${selectedDate} তারিখের ক্লাসরুম উপস্থিতি` : `Classroom Rolls for ${selectedDate}`}
          </h3>
          <button
            type="button"
            onClick={() => refetch()}
            className="p-2 rounded-full hover:bg-surface-soft text-ink-muted cursor-pointer"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {sessions.length === 0 ? (
          <div className="p-12">
            <EmptyState
              kind="generic"
              title={language === 'bn' ? 'এই তারিখে কোনো উপস্থিতি গৃহীত হয়নি' : 'No attendance sessions found for this date'}
              description={language === 'bn' ? 'উপস্থিতি গ্রহণ শুরু করতে "উপস্থিতি গ্রহণ করুন" বোতামে চাপ দিন।' : 'Start taking attendance from the Attendance Station.'}
            />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface hover:bg-surface-soft transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-forest-700 text-white flex items-center justify-center font-extrabold text-sm font-display shadow-2xs shrink-0">
                    {session.sectionName}
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-ink font-display">
                      {session.className} — {language === 'bn' ? 'শাখা' : 'Section'} {session.sectionName}
                    </h4>
                    <p className="text-xs text-ink-muted mt-0.5 font-display">
                      {session.status === 'FINALIZED' ? (
                        <span className="text-forest-700 dark:text-forest-600 font-bold">
                          ✓ {language === 'bn' ? 'উপস্থিতি সমাপ্ত ও লক' : 'Attendance Finished & Locked'}
                        </span>
                      ) : (
                        <span className="text-amber-800 font-bold">
                          ⏳ {language === 'bn' ? 'উপস্থিতি গ্রহণ চলছে' : 'Attendance in progress'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInspectSessionId(session.id)}
                    leftIcon={<Edit3 className="w-4 h-4" />}
                    className="min-h-[44px] rounded-2xl font-display text-xs"
                  >
                    {language === 'bn' ? 'উপস্থিতি দেখুন ও সংশোধন করুন' : 'View Roll & Correct'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inspect and Correction Modal */}
      <AnimatePresence>
        {inspectSessionId && inspectData && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspect-session-modal-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-2xl w-full p-6 sm:p-7 text-left max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
                <div>
                  <h3 id="inspect-session-modal-title" className="text-xl font-extrabold text-ink font-display">
                    {inspectData.session.className} ({inspectData.session.sectionName})
                  </h3>
                  <p className="text-xs text-ink-soft">
                    {language === 'bn' ? 'মোট উপস্থিতির হার:' : 'Turnout Rate:'} {inspectData.summary.attendanceRate}% ({inspectData.summary.presentCount} / {inspectData.summary.totalStudents})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInspectSessionId(null);
                    setCorrectingStudent(null);
                  }}
                  className="p-2 rounded-full hover:bg-surface-soft text-ink-muted cursor-pointer"
                  aria-label={t('close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Roster Table */}
              <div className="divide-y divide-line max-h-96 overflow-y-auto border border-line rounded-2xl">
                {inspectData.roster.map((st) => (
                  <div
                    key={st.studentId}
                    className="p-3.5 flex items-center justify-between gap-3 bg-surface hover:bg-surface-soft"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-soft text-ink flex items-center justify-center font-bold text-xs">
                        #{st.rollNumber}
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-ink font-display">{st.fullName}</h5>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold font-display ${
                          st.status === 'PRESENT'
                            ? 'bg-success-50 text-forest-700 dark:text-forest-600'
                            : st.status === 'LATE'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-danger-50 text-danger-800'
                        }`}>
                          {getStatusLabel(st.status)}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCorrectingStudent({
                          studentId: st.studentId,
                          fullName: st.fullName,
                          currentStatus: st.status,
                        });
                        setCorrectionNewStatus(st.status === 'PRESENT' ? 'ABSENT' : 'PRESENT');
                        setCorrectionReason('');
                      }}
                      className="min-h-[44px] rounded-2xl text-xs font-display text-forest-700 dark:text-forest-600"
                    >
                      {language === 'bn' ? 'সংশোধন' : 'Edit'}
                    </Button>
                  </div>
                ))}
              </div>

              {/* Edit Modal / Box */}
              {correctingStudent && (
                <div className="mt-4 p-4 rounded-2xl bg-surface-soft border border-line space-y-3">
                  <div className="flex items-center gap-2 text-forest-700 font-bold text-xs font-display">
                    <ShieldAlert className="w-4 h-4" />
                    <span>
                      {language === 'bn'
                        ? `${correctingStudent.fullName}-এর উপস্থিতি সংশোধন`
                        : `Correcting attendance for ${correctingStudent.fullName}`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-ink-muted mb-1">
                        {language === 'bn' ? 'পূর্বের অবস্থা' : 'Previous Status'}
                      </label>
                      <input
                        type="text"
                        disabled
                        value={getStatusLabel(correctingStudent.currentStatus)}
                        className="w-full px-3 py-2 rounded-xl bg-surface border border-line text-xs font-bold text-ink-muted"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-ink mb-1 font-display">
                        {language === 'bn' ? 'নতুন অবস্থা' : 'New Status'} *
                      </label>
                      <select
                        value={correctionNewStatus}
                        onChange={(e) => setCorrectionNewStatus(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-surface border border-line text-xs font-bold text-ink outline-none focus:border-forest-700 min-h-[44px]"
                      >
                        <option value="PRESENT">{t('statusPresent')}</option>
                        <option value="LATE">{t('statusLate')}</option>
                        <option value="ABSENT">{t('statusAbsent')}</option>
                        <option value="EXCUSED">{t('statusOnLeave')}</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-ink mb-1 font-display">
                      {language === 'bn' ? 'সংশোধনের কারণ' : 'Reason for Correction'} *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={language === 'bn' ? 'যেমন: দেরিতে আগমন, অভিভাবকের চিঠি' : 'e.g. Arrived late with doctor slip'}
                      value={correctionReason}
                      onChange={(e) => setCorrectionReason(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-surface border border-line text-xs font-semibold text-ink outline-none focus:border-forest-700 min-h-[44px]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCorrectingStudent(null)}
                      className="min-h-[44px] font-display"
                    >
                      {t('cancel')}
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={!correctionReason.trim() || correctionMutation.isPending}
                      isLoading={correctionMutation.isPending}
                      onClick={() => {
                        correctionMutation.mutate({
                          sessionId: inspectSessionId,
                          studentId: correctingStudent.studentId,
                          newStatus: correctionNewStatus,
                          reason: correctionReason.trim(),
                        });
                      }}
                      className="min-h-[44px] font-display text-xs"
                    >
                      {language === 'bn' ? 'সংশোধন সংরক্ষণ করুন' : 'Save Attendance Change'}
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

export default AttendanceOperations;
