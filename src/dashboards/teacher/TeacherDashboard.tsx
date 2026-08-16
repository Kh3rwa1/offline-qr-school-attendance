import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  UserX,
  UserMinus,
  ChevronDown,
  CameraOff,
  Check,
  Usb,
  Building2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../../components/shared/Button';
import { Toast } from '../../components/shared/Toast';
import { EmptyState } from '../../components/shared/EmptyState';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useOfflineStatus } from '../../app/OfflineStatusProvider';
import { useSession } from '../../app/SessionProvider';
import { useLanguage } from '../../app/LanguageProvider';
import {
  createOfflineSession,
  downloadAndStoreRosterPackage,
  processOfflineQRCode,
  syncOutboxEvents,
} from '../../services/offlineSyncService';
import {
  offlineDb,
  OfflineSessionItem,
  OutboxEventItem,
} from '../../db/offlineDb';
import { CameraScannerService, setupUSBScannerListener } from '../../services/scannerService';
import {
  playScanSuccessFeedback,
  playScanDuplicateFeedback,
  playScanErrorFeedback,
} from '../../utils/feedback';
import { api } from '../../services/api';

interface GateArrival {
  studentId: string;
  name: string;
  nameBn?: string;
  rollNumber: string | number;
  time: string;
  status: string;
  captureMethod?: string;
}

interface StudentStatusRow {
  studentId: string;
  name: string;
  nameBn?: string;
  studentCode?: string;
  rollNumber: string | number;
  status: 'UNMARKED' | 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | 'LEAVE';
  captureMethod?: string | null;
  updatedAt?: string | null;
}

export const TeacherDashboard: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const { user } = useSession();
  const { outboxCount, syncNow, refreshOutbox } = useOfflineStatus();
  const { language, t } = useLanguage();

  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    try {
      return localStorage.getItem('attendance.classSectionId') || '';
    } catch {
      return '';
    }
  });

  const [session, setSession] = useState<OfflineSessionItem | null>(null);
  const [stats, setStats] = useState({
    cameIn: 0,
    missing: 0,
    late: 0,
    leave: 0,
    total: 0,
  });
  const [arrivals, setArrivals] = useState<GateArrival[]>([]);
  const [allStudents, setAllStudents] = useState<StudentStatusRow[]>([]);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showConfirmFinish, setShowConfirmFinish] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Camera State
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'starting' | 'live' | 'permission_denied' | 'error'>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraScannerRef = useRef<CameraScannerService | null>(null);

  const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setVideoEl(node);
  }, []);

  const showFeedback = useCallback((msg: { kind: 'success' | 'warning' | 'error'; text: string }) => {
    setFeedback(msg);
  }, []);

  function getDeviceIdentifier() {
    const existing = localStorage.getItem('attendance.deviceIdentifier');
    if (existing) return existing;
    const generated = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem('attendance.deviceIdentifier', generated);
    return generated;
  }

  // Load Classes
  const loadClasses = useCallback(async () => {
    if (!activeSchoolId) return;
    try {
      const res = await api<{ success: boolean; data?: any[]; classes?: any[] }>(
        `/api/v1/schools/${activeSchoolId}/attendance/classes`
      );
      const classList = res.data || res.classes || [];
      setClasses(classList);

      if (classList.length > 0) {
        if (!selectedClassId || !classList.some((c) => (c.classSectionId || c.id) === selectedClassId)) {
          const firstId = classList[0].classSectionId || classList[0].id;
          setSelectedClassId(firstId);
          try {
            localStorage.setItem('attendance.classSectionId', firstId);
          } catch {}
        }
      }
    } catch {
      const cached = await offlineDb.rosters.toArray();
      const uniqueMap = new Map<string, any>();
      cached.forEach((r) => {
        if (!uniqueMap.has(r.classSectionId)) {
          uniqueMap.set(r.classSectionId, {
            classSectionId: r.classSectionId,
            className: 'Class',
            sectionName: 'Section',
          });
        }
      });
      const localClasses = Array.from(uniqueMap.values());
      setClasses(localClasses);
      if (localClasses.length > 0 && !selectedClassId) {
        setSelectedClassId(localClasses[0].classSectionId);
      }
    }
  }, [activeSchoolId, selectedClassId]);

  useEffect(() => {
    void loadClasses();
    void refreshOutbox();
  }, [loadClasses, refreshOutbox]);

  // Fetch Live Today Gate Attendance & Poll every 4 seconds
  const fetchTodayGateData = useCallback(async () => {
    if (!activeSchoolId || !selectedClassId) return;
    const todayStr = new Date().toISOString().slice(0, 10);

    if (navigator.onLine) {
      try {
        const res = await api<{
          success: boolean;
          isAssigned?: boolean;
          session?: any;
          stats?: { cameIn: number; missing: number; late: number; leave: number; total: number };
          arrivals?: GateArrival[];
          allStudents?: StudentStatusRow[];
          message?: string;
        }>(`/api/v1/schools/${activeSchoolId}/attendance/today-gate?classSectionId=${selectedClassId}`);

        if (res.success) {
          if (res.stats) setStats(res.stats);
          if (res.arrivals) setArrivals(res.arrivals);
          if (res.allStudents) setAllStudents(res.allStudents);

          const localSession = await offlineDb.sessions
            .where('classSectionId')
            .equals(selectedClassId)
            .and((s) => s.sessionDate === todayStr)
            .first();

          if (localSession) {
            if (res.session?.id && localSession.serverSessionId !== res.session.id) {
              await offlineDb.sessions.update(localSession.id, { serverSessionId: res.session.id });
              localSession.serverSessionId = res.session.id;
            }
            setSession(localSession);
          } else if (res.session) {
            try {
              const newLocal = await createOfflineSession({
                schoolId: activeSchoolId,
                classSectionId: selectedClassId,
                teacherId: user?.id || 'teacher',
                sessionDate: todayStr,
              });
              newLocal.serverSessionId = res.session.id;
              await offlineDb.sessions.update(newLocal.id, { serverSessionId: res.session.id });
              setSession(newLocal);
            } catch {
              setSession({ ...res.session, serverSessionId: res.session.id });
            }
          }
          return;
        }
      } catch (err: any) {
        console.warn('Today-gate fetch fallback to offline:', err);
      }
    }

    // Offline fallback from IndexedDB
    const localSession = await offlineDb.sessions
      .where('classSectionId')
      .equals(selectedClassId)
      .and((s) => s.sessionDate === todayStr)
      .first();

    if (localSession) {
      setSession(localSession);
      const sessionRoster = await offlineDb.sessionRosters.where('sessionId').equals(localSession.id).toArray();
      const studentRows: StudentStatusRow[] = sessionRoster.map((r) => ({
        studentId: r.studentId,
        name: r.studentName,
        nameBn: r.studentNameBn || undefined,
        rollNumber: r.rollNumber,
        status: (r.status as any) || 'UNMARKED',
      }));

      const cameIn = studentRows.filter((s) => s.status === 'PRESENT').length;
      const late = studentRows.filter((s) => s.status === 'LATE').length;
      const leave = studentRows.filter((s) => s.status === 'EXCUSED' || s.status === 'LEAVE').length;
      const missing = studentRows.filter((s) => s.status === 'UNMARKED' || s.status === 'ABSENT').length;

      setStats({
        cameIn,
        missing,
        late,
        leave,
        total: studentRows.length,
      });
      setAllStudents(studentRows);
      setArrivals(
        studentRows
          .filter((s) => s.status === 'PRESENT' || s.status === 'LATE')
          .map((s) => ({
            studentId: s.studentId,
            name: s.name,
            nameBn: s.nameBn,
            rollNumber: s.rollNumber,
            status: s.status,
            time: new Date().toISOString(),
          }))
      );
    }
  }, [activeSchoolId, selectedClassId, user]);

  useEffect(() => {
    void fetchTodayGateData();
    const interval = setInterval(() => {
      void fetchTodayGateData();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchTodayGateData]);

  // Handle Scan Action
  const handleScan = useCallback(
    async (rawToken: string, source: 'CAMERA' | 'USB') => {
      if (!activeSchoolId || !selectedClassId || !user) {
        playScanErrorFeedback();
        showFeedback({ kind: 'error', text: t('sessionRequired') });
        return;
      }

      let activeSessionId = session?.id;
      if (!activeSessionId) {
        const todayStr = new Date().toISOString().slice(0, 10);
        let localSession = await offlineDb.sessions
          .where('classSectionId')
          .equals(selectedClassId)
          .and((s) => s.sessionDate === todayStr)
          .first();

        if (!localSession) {
          const newSession = await createOfflineSession({
            schoolId: activeSchoolId,
            classSectionId: selectedClassId,
            teacherId: user.id,
            sessionDate: todayStr,
          });
          activeSessionId = newSession.id;
          setSession(newSession);
        } else {
          activeSessionId = localSession.id;
          setSession(localSession);
        }
      }

      try {
        const result = await processOfflineQRCode({
          schoolId: activeSchoolId,
          sessionId: activeSessionId,
          rawToken,
          actorId: user.id,
          source,
        });

        if (result.success && result.student) {
          if (result.duplicateScan) {
            playScanDuplicateFeedback();
            showFeedback({
              kind: 'warning',
              text: `${result.student.name} ${t('alreadyMarked')}`,
            });
          } else {
            playScanSuccessFeedback();
            showFeedback({
              kind: 'success',
              text: `${result.student.name} (#${result.student.rollNumber}) ${t('markedPresent')}`,
            });
            void fetchTodayGateData();
          }
        } else {
          playScanErrorFeedback();
          showFeedback({ kind: 'warning', text: result.message || t('unrecognizedQr') });
        }
      } catch (err: any) {
        playScanErrorFeedback();
        showFeedback({ kind: 'error', text: err.message || 'Error processing scan' });
      }
    },
    [activeSchoolId, selectedClassId, session, user, t, showFeedback, fetchTodayGateData]
  );

  const handleScanRef = useRef(handleScan);
  useEffect(() => {
    handleScanRef.current = handleScan;
  }, [handleScan]);

  // Start & Stop Camera
  const startCamera = useCallback(async (targetEl?: HTMLVideoElement | null) => {
    const el = targetEl || videoRef.current || videoEl;
    if (!el) return;
    setCameraError(null);
    setCameraStatus('starting');

    if (!cameraScannerRef.current) {
      cameraScannerRef.current = new CameraScannerService();
    }

    try {
      await cameraScannerRef.current.startScanning(el, (token) => {
        void handleScanRef.current(token, 'CAMERA');
      });
      setIsCameraActive(true);
      setCameraStatus('live');
    } catch (err: any) {
      setIsCameraActive(false);
      const isDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        err?.message?.includes('Permission');
      setCameraStatus(isDenied ? 'permission_denied' : 'error');
      setCameraError(isDenied ? t('cameraDenied') : (err?.message || t('cameraDenied')));
    }
  }, [videoEl, t]);

  const stopCamera = useCallback(() => {
    if (cameraScannerRef.current) {
      cameraScannerRef.current.stopScanning();
    }
    setIsCameraActive(false);
    setCameraStatus('idle');
  }, []);

  const isSessionActive = Boolean(session && (session.status as string) !== 'FINALIZED');
  useEffect(() => {
    if (isSessionActive && videoEl) {
      void startCamera(videoEl);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isSessionActive, videoEl, startCamera, stopCamera]);

  // USB listener
  useEffect(() => {
    const cleanupUsb = setupUSBScannerListener((scannedText) => {
      void handleScan(scannedText, 'USB');
    });
    return () => {
      cleanupUsb();
    };
  }, [handleScan]);

  // Push Outbox
  const handlePushOutbox = async () => {
    setIsSyncing(true);
    try {
      const deviceIdentifier = getDeviceIdentifier();
      let sid = activeSchoolId;
      if (!sid) {
        const first = await offlineDb.syncOutbox.toCollection().first();
        if (first) sid = first.schoolId;
      }
      if (sid) {
        await syncOutboxEvents({ schoolId: sid, deviceIdentifier });
      }
      await syncNow().catch(() => {});
      await refreshOutbox();
      showFeedback({ kind: 'success', text: t('syncSuccess') });
    } catch (err: any) {
      showFeedback({ kind: 'error', text: err.message || 'Sync failed' });
    } finally {
      setIsSyncing(false);
      await refreshOutbox();
    }
  };

  // Finalize Attendance for Today
  const handleFinalizeAttendance = async () => {
    if (!activeSchoolId || !selectedClassId) return;
    setIsFinishing(true);
    try {
      let serverSessionId = session?.serverSessionId;
      if (!serverSessionId && session?.id && /^[0-9a-fA-F-]{36}$/.test(session.id) && !session.id.startsWith('sess-')) {
        serverSessionId = session.id;
      }

      if (navigator.onLine) {
        if (!serverSessionId) {
          const todayStr = new Date().toISOString().slice(0, 10);
          try {
            const createRes = await api<{ success: boolean; data: any }>(
              `/api/v1/schools/${activeSchoolId}/attendance/sessions`,
              {
                method: 'POST',
                body: JSON.stringify({
                  classSectionId: selectedClassId,
                  sessionDate: todayStr,
                  sessionType: 'DAILY',
                }),
              }
            );
            if (createRes?.data?.id) {
              serverSessionId = createRes.data.id;
            }
          } catch (createErr) {
            console.warn('Could not resolve server session:', createErr);
          }
        }

        if (serverSessionId) {
          await api(`/api/v1/schools/${activeSchoolId}/attendance/sessions/${serverSessionId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({
              status: 'FINALIZED',
              autoMarkAbsentForUnmarked: true,
              reason: 'Class teacher finalized daily attendance',
            }),
          });
        }
      }

      if (session?.id) {
        await offlineDb.sessions.update(session.id, { status: 'FINALIZED' });
      }
      setSession((prev: any) => (prev ? { ...prev, status: 'FINALIZED' } : null));
      setShowConfirmFinish(false);
      showFeedback({ kind: 'success', text: t('finalizedSuccess') });
      void fetchTodayGateData();
    } catch (err: any) {
      showFeedback({ kind: 'error', text: err.message || 'Error finishing attendance' });
    } finally {
      setIsFinishing(false);
    }
  };

  const missingStudents = allStudents.filter(
    (s) => s.status === 'UNMARKED' || s.status === 'ABSENT'
  );

  const selectedClassObj = classes.find(
    (c) => (c.classSectionId || c.id) === selectedClassId
  );
  const selectedClassName = selectedClassObj
    ? `${selectedClassObj.className} – ${selectedClassObj.sectionName}`
    : 'Class';

  return (
    <div className="space-y-6 text-left max-w-6xl mx-auto" id="teacher-dashboard-view">
      {/* Toast Feedback */}
      {feedback && (
        <div className="fixed top-6 right-6 z-50">
          <Toast
            kind={feedback.kind}
            message={feedback.text}
            onDismiss={() => setFeedback(null)}
          />
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-surface p-6 sm:p-7 rounded-3xl border border-line shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-forest-700 dark:text-forest-600 font-bold text-sm font-display mb-1">
            <Building2 className="w-4 h-4" />
            <span>{activeSchoolName}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
            {t('navAttendanceRegister')}
          </h1>
          <p className="text-sm text-ink-soft mt-1">
            {t('gateAttendanceRecords')} • {new Date().toLocaleDateString(language === 'bn' ? 'bn-IN' : 'en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Class Picker */}
          <div className="flex items-center gap-2 bg-surface-soft p-1.5 rounded-2xl border border-line">
            <span className="text-sm font-bold text-ink-soft px-2 font-display">{t('classLabel')}</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-surface border border-line text-sm font-bold text-ink outline-none focus:border-forest-700 cursor-pointer font-display min-h-[44px]"
            >
              {classes.map((c) => {
                const idVal = c.classSectionId || c.id;
                return (
                  <option key={idVal} value={idVal}>
                    {c.className} – {c.sectionName}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Sync Outbox Button */}
          {outboxCount > 0 && (
            <Button
              variant="secondary"
              size="md"
              onClick={handlePushOutbox}
              disabled={isSyncing}
              isLoading={isSyncing}
              leftIcon={<RefreshCw className="w-4 h-4" />}
              className="min-h-[44px] rounded-2xl font-display text-sm font-bold"
            >
              {t('sendRecordsNow')} ({outboxCount})
            </Button>
          )}
        </div>
      </div>

      {/* Big Numbers (Stat Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Came In */}
        <div className="p-6 rounded-3xl bg-success-50/70 border border-success-100 dark:border-success-600/30 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-forest-700 dark:text-forest-600 uppercase tracking-wider font-display">
              {t('cameIn')}
            </span>
            <span className="p-2 rounded-full bg-forest-700 text-white">
              <UserCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-4xl sm:text-5xl font-extrabold text-forest-700 dark:text-forest-600 font-display mt-3 font-mono">
            {stats.cameIn}
          </div>
          <p className="text-sm text-forest-700/80 font-medium mt-1">
            {stats.total > 0
              ? `${Math.round((stats.cameIn / stats.total) * 100)}% (${stats.cameIn} / ${stats.total})`
              : t('whoCameIn')}
          </p>
        </div>

        {/* Still Missing */}
        <div className="p-6 rounded-3xl bg-danger-50/60 border border-danger-100 dark:border-danger-600/30 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-danger-800 uppercase tracking-wider font-display">
              {t('stillMissing')}
            </span>
            <span className="p-2 rounded-full bg-danger-800 text-white">
              <UserX className="w-4 h-4" />
            </span>
          </div>
          <div className="text-4xl sm:text-5xl font-extrabold text-danger-800 font-display mt-3 font-mono">
            {stats.missing}
          </div>
          <p className="text-sm text-danger-800/80 font-medium mt-1">
            {t('statusNotMarkedYet')}
          </p>
        </div>

        {/* Late */}
        <div className="p-6 rounded-3xl bg-amber-50/60 border border-amber-100 dark:border-amber-600/30 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-amber-800 uppercase tracking-wider font-display">
              {t('statusLate')}
            </span>
            <span className="p-2 rounded-full bg-amber-700 text-white">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-4xl sm:text-5xl font-extrabold text-amber-800 font-display mt-3 font-mono">
            {stats.late}
          </div>
          <p className="text-sm text-amber-800/80 font-medium mt-1">
            {t('statusLate')}
          </p>
        </div>

        {/* Leave */}
        <div className="p-6 rounded-3xl bg-surface-soft border border-line shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-ink-muted uppercase tracking-wider font-display">
              {t('statusOnLeave')}
            </span>
            <span className="p-2 rounded-full bg-ink-muted text-white">
              <UserMinus className="w-4 h-4" />
            </span>
          </div>
          <div className="text-4xl sm:text-5xl font-extrabold text-ink font-display mt-3 font-mono">
            {stats.leave}
          </div>
          <p className="text-sm text-ink-muted font-medium mt-1">
            {t('statusOnLeave')}
          </p>
        </div>
      </div>

      {/* Action Bar: Finish Attendance Button */}
      <div className="flex items-center justify-between bg-surface p-4 rounded-3xl border border-line">
        <div className="text-sm font-bold text-ink font-display pl-2">
          <span>{selectedClassName}</span> • <span className="text-forest-700 dark:text-forest-600 font-bold">{stats.cameIn} / {stats.total} {t('statusPresent')}</span>
        </div>

        <Button
          variant="primary"
          size="lg"
          onClick={() => setShowConfirmFinish(true)}
          className="px-6 py-3 rounded-full text-sm font-extrabold shadow-xs min-h-[44px]"
          disabled={stats.total === 0 || session?.status === 'FINALIZED'}
          leftIcon={<Check className="w-5 h-5" />}
        >
          {session?.status === 'FINALIZED' ? t('finalizedSuccess') : t('finishAttendance')}
        </Button>
      </div>

      {/* Main 2-Column Split: Who Came In (Left) vs Still Missing (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Who Came In */}
        <div className="app-card p-6 flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-4 border-b border-line mb-4">
            <div>
              <h3 className="text-lg font-extrabold text-ink font-display flex items-center gap-2">
                <span>{t('whoCameIn')}</span>
                <span className="text-sm px-2.5 py-0.5 rounded-full bg-success-50 text-forest-700 dark:text-forest-600 font-bold font-mono">
                  {arrivals.length}
                </span>
              </h3>
              <p className="text-sm text-ink-soft mt-0.5">
                {t('gateAttendanceRecords')}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {arrivals.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <EmptyState
                  kind="generic"
                  title={t('noArrivalsYet')}
                  description={t('gateAttendanceRecords')}
                />
              </div>
            ) : (
              arrivals.map((st) => (
                <div
                  key={st.studentId}
                  className="p-3.5 rounded-2xl bg-surface border border-line hover:border-forest-700/40 transition-colors flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-success-50 text-forest-700 dark:text-forest-600 flex items-center justify-center font-bold text-sm font-display">
                      #{st.rollNumber}
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-ink font-display">
                        {language === 'bn' && st.nameBn ? st.nameBn : st.name}
                      </h4>
                      <span className="text-sm text-ink-muted font-mono">
                        {new Date(st.time).toLocaleTimeString(language === 'bn' ? 'bn-IN' : 'en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full text-sm font-bold bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 font-display">
                    {t('statusPresent')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Still Missing */}
        <div className="app-card p-6 flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-4 border-b border-line mb-4">
            <div>
              <h3 className="text-lg font-extrabold text-ink font-display flex items-center gap-2">
                <span>{t('stillMissing')}</span>
                <span className="text-sm px-2.5 py-0.5 rounded-full bg-danger-50 text-danger-800 font-bold font-mono">
                  {missingStudents.length}
                </span>
              </h3>
              <p className="text-sm text-ink-soft mt-0.5">
                {t('statusNotMarkedYet')}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {missingStudents.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center p-6">
                <CheckCircle2 className="w-12 h-12 text-forest-700 dark:text-forest-600 mx-auto mb-2" />
                <h4 className="text-base font-extrabold text-ink font-display">{t('statusPresent')}</h4>
                <p className="text-sm text-ink-soft mt-1">{t('statusPresent')}</p>
              </div>
            ) : (
              missingStudents.map((st) => (
                <div
                  key={st.studentId}
                  className="p-3.5 rounded-2xl bg-surface border border-line hover:border-danger-300 transition-colors flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-danger-50 text-danger-800 flex items-center justify-center font-bold text-sm font-display">
                      #{st.rollNumber}
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-ink font-display">
                        {language === 'bn' && st.nameBn ? st.nameBn : st.name}
                      </h4>
                      <span className="text-sm text-ink-muted font-display">
                        {t('statusNotMarkedYet')}
                      </span>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full text-sm font-bold bg-danger-50 text-danger-800 border border-danger-200 font-display">
                    {t('statusAbsent')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Phone Backup QR / USB Scanner Accordion */}
      <details className="app-card overflow-hidden group">
        <summary className="p-4 sm:p-5 flex items-center justify-between cursor-pointer list-none select-none hover:bg-surface-soft transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-forest-50 text-forest-700 dark:text-forest-600">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-ink font-display">{t('phoneBackup')}</h3>
              <p className="text-sm text-ink-muted">{t('phoneBackupDesc')}</p>
            </div>
          </div>
          <ChevronDown className="w-5 h-5 text-ink-muted group-open:rotate-180 transition-transform" />
        </summary>

        <div className="p-6 pt-2 space-y-4 border-t border-line" data-testid="camera-hud">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-forest-700 dark:text-forest-600" />
              <h3 className="text-sm font-extrabold text-ink font-display">{t('cameraHud')}</h3>
            </div>
            <div className="flex items-center gap-2">
              {isCameraActive ? (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-full cursor-pointer hover:bg-amber-100 font-display min-h-[44px]"
                >
                  <CameraOff className="w-4 h-4" />
                  <span>{t('stopCamera')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void startCamera(videoEl)}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-forest-700 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-full cursor-pointer hover:bg-emerald-100 font-display min-h-[44px]"
                >
                  <Camera className="w-4 h-4" />
                  <span>{t('startCamera')}</span>
                </button>
              )}
            </div>
          </div>

          <div
            className="relative aspect-video max-h-[36vh] rounded-3xl bg-slate-950 overflow-hidden flex items-center justify-center border border-line"
            data-testid="camera-viewfinder"
          >
            <video
              ref={videoCallbackRef}
              className="w-full h-full object-cover"
              muted
              playsInline
            />

            {cameraError && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center text-white space-y-3">
                <AlertCircle className="w-10 h-10 text-amber-400" />
                <p className="text-sm font-semibold max-w-xs">
                  {cameraStatus === 'permission_denied' ? t('cameraDenied') : cameraError}
                </p>
                <Button variant="secondary" size="sm" onClick={() => void startCamera(videoEl)} className="min-h-[44px]">
                  {t('retryCamera')}
                </Button>
              </div>
            )}

            {!cameraError && (
              <div className="absolute inset-0 border-2 border-emerald-400/30 rounded-3xl pointer-events-none flex flex-col justify-between p-4">
                <div className="flex justify-between items-center text-sm font-mono text-emerald-400 font-bold">
                  <span>
                    {cameraStatus === 'starting'
                      ? t('cameraStarting')
                      : isCameraActive
                      ? t('cameraActive')
                      : t('cameraStopped')}
                  </span>
                </div>
                {isCameraActive && (
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-scan-line shadow-[0_0_15px_rgba(52,211,153,0.8)]" />
                )}
                <div className="text-center text-sm font-bold text-white bg-slate-900/80 py-1.5 px-4 rounded-full mx-auto backdrop-blur-sm border border-emerald-400/30 font-display">
                  {t('alignQrCode')}
                </div>
              </div>
            )}
          </div>

          {/* USB Token input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const value = scanInput.trim();
              setScanInput('');
              if (value) void handleScan(value, 'USB');
            }}
            className="flex flex-col sm:flex-row gap-3 pt-2"
          >
            <div className="relative flex-1">
              <Usb className="w-5 h-5 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder={t('usbScannerPlaceholder')}
                className="w-full pl-12 pr-4 py-3 bg-surface-soft border border-line rounded-full text-sm font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none min-h-[44px]"
              />
            </div>
            <Button type="submit" variant="primary" size="md" className="min-h-[44px] w-full sm:w-auto justify-center rounded-full font-display text-sm font-bold">
              {t('scanToken')}
            </Button>
          </form>
        </div>
      </details>

      {/* Finish Attendance Confirmation Modal */}
      <AnimatePresence>
        {showConfirmFinish && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="app-card shadow-2xl max-w-md w-full p-6 text-left rounded-3xl"
            >
              <h3 className="text-xl font-extrabold text-ink font-display mb-2">
                {t('confirmFinishTitle')}
              </h3>
              <p className="text-sm text-ink-soft mb-6">
                {t('confirmFinishDesc')}
              </p>

              <div className="p-4 rounded-2xl bg-surface-soft border border-line mb-6 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-muted">{t('classLabel')}:</span>
                  <strong className="text-ink font-display">{selectedClassName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">{t('cameIn')}:</span>
                  <strong className="text-forest-700 dark:text-forest-600 font-display">{stats.cameIn} {t('studentsUnit')}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">{t('statusAbsent')}:</span>
                  <strong className="text-danger-800 font-display">{stats.missing} {t('studentsUnit')}</strong>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setShowConfirmFinish(false)}
                  className="min-h-[44px] rounded-2xl font-display text-sm"
                >
                  {t('cancel')}
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  disabled={isFinishing}
                  isLoading={isFinishing}
                  onClick={handleFinalizeAttendance}
                  className="min-h-[44px] rounded-2xl font-display text-sm font-bold"
                >
                  {isFinishing ? 'Saving…' : t('confirmFinishBtn')}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeacherDashboard;
