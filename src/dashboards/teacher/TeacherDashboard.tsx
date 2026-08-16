import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  Download,
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
  ClipboardCheck,
  ScanLine,
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
  OfflineRosterItem,
  OfflineSessionItem,
  OfflineSessionRosterItem,
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
  const { isOnline, outboxCount, syncNow, refreshOutbox } = useOfflineStatus();
  const { language, setLanguage, t } = useLanguage();

  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    try {
      return localStorage.getItem('attendance.classSectionId') || '';
    } catch {
      return '';
    }
  });

  const [session, setSession] = useState<any | null>(null);
  const [isAssigned, setIsAssigned] = useState<boolean>(true);
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
    const created = `browser-${globalThis.crypto.randomUUID()}`;
    localStorage.setItem('attendance.deviceIdentifier', created);
    return created;
  }

  // Load teacher assigned classes
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
          localStorage.setItem('attendance.classSectionId', firstId);
        }
      } else {
        setIsAssigned(false);
      }
    } catch (err: any) {
      console.warn('Could not load online classes, checking local:', err);
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

  // Fetch Live Today Gate Attendance & Poll every 3 seconds
  const fetchTodayGateData = useCallback(async () => {
    if (!activeSchoolId || !selectedClassId) return;

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
          setIsAssigned(res.isAssigned !== false);
          if (res.stats) setStats(res.stats);
          if (res.arrivals) setArrivals(res.arrivals);
          if (res.allStudents) setAllStudents(res.allStudents);

          const todayStr = new Date().toISOString().slice(0, 10);
          const localSession = await offlineDb.sessions
            .where('[schoolId+classSectionId]')
            .equals([activeSchoolId, selectedClassId])
            .filter((s) => s.sessionDate === todayStr)
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
    const todayStr = new Date().toISOString().slice(0, 10);
    const localSession = await offlineDb.sessions
      .where('[schoolId+classSectionId]')
      .equals([activeSchoolId, selectedClassId])
      .filter((s) => s.sessionDate === todayStr)
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
  }, [activeSchoolId, selectedClassId]);

  useEffect(() => {
    void fetchTodayGateData();
    const interval = setInterval(() => {
      void fetchTodayGateData();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchTodayGateData]);

  // Handle Download Class Roster
  const handleDownloadRoster = async () => {
    if (!activeSchoolId || !selectedClassId) return;
    try {
      showFeedback({ kind: 'success', text: t('downloadingRoster') });
      const deviceId = getDeviceIdentifier();
      try {
        await downloadAndStoreRosterPackage(activeSchoolId, selectedClassId, deviceId);
      } catch (dlErr: any) {
        try {
          await api(`/api/v1/schools/${activeSchoolId}/devices/register`, {
            method: 'POST',
            body: JSON.stringify({ deviceIdentifier: deviceId, label: 'Teacher Browser Device' }),
          });
          await downloadAndStoreRosterPackage(activeSchoolId, selectedClassId, deviceId);
        } catch {
          throw dlErr;
        }
      }
      showFeedback({ kind: 'success', text: t('rosterDownloaded') });
      void fetchTodayGateData();
    } catch (err: any) {
      showFeedback({ kind: 'error', text: err.message || 'Failed to download roster' });
    }
  };

  // Handle Start Session
  const handleStartSession = async () => {
    if (!activeSchoolId || !selectedClassId) return;
    if (!user?.id) {
      showFeedback({ kind: 'error', text: t('sessionRequired') });
      return;
    }
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      let serverSessionId: string | undefined = undefined;

      if (navigator.onLine) {
        try {
          const res = await api<{ success: boolean; data: any }>(
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
          if (res?.data?.id) {
            serverSessionId = res.data.id;
          }
        } catch (serverErr: any) {
          console.warn('Network unavailable, creating local session:', serverErr);
        }
      }

      const s = await createOfflineSession({
        schoolId: activeSchoolId,
        classSectionId: selectedClassId,
        teacherId: user.id,
        sessionDate: todayStr,
      });

      if (serverSessionId) {
        s.serverSessionId = serverSessionId;
        await offlineDb.sessions.update(s.id, { serverSessionId });
      }

      setSession(s);
      showFeedback({ kind: 'success', text: t('sessionOpen') });
      void fetchTodayGateData();
    } catch (err: any) {
      showFeedback({ kind: 'error', text: err.message || 'Failed to start session' });
    }
  };

  // Handle Manual Status Change for a Student (Present, Absent, Late, Leave)
  const handleUpdateStatus = async (
    studentId: string,
    newStatus: 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE' | 'EXCUSED'
  ) => {
    if (!activeSchoolId || !selectedClassId) return;

    setAllStudents((prev) =>
      prev.map((st) => (st.studentId === studentId ? { ...st, status: newStatus } : st))
    );

    setStats((prev) => {
      const current = allStudents.find((s) => s.studentId === studentId)?.status || 'UNMARKED';
      let cameIn = prev.cameIn;
      let missing = prev.missing;
      let late = prev.late;
      let leave = prev.leave;

      if (current === 'PRESENT') cameIn--;
      if (current === 'UNMARKED' || current === 'ABSENT') missing--;
      if (current === 'LATE') late--;
      if (current === 'LEAVE' || current === 'EXCUSED') leave--;

      if (newStatus === 'PRESENT') cameIn++;
      if (newStatus === 'ABSENT') missing++;
      if (newStatus === 'LATE') late++;
      if (newStatus === 'LEAVE' || newStatus === 'EXCUSED') leave++;

      return { ...prev, cameIn, missing, late, leave };
    });

    try {
      let currentSession = session;
      let serverSessionId = currentSession?.serverSessionId;

      if (!serverSessionId && currentSession?.id && /^[0-9a-fA-F-]{36}$/.test(currentSession.id) && !currentSession.id.startsWith('sess-')) {
        serverSessionId = currentSession.id;
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
              if (currentSession?.id) {
                await offlineDb.sessions.update(currentSession.id, { serverSessionId });
                setSession((prev: any) => (prev ? { ...prev, serverSessionId } : prev));
              }
            }
          } catch (sessionErr) {
            console.warn('Could not auto-create server session:', sessionErr);
          }
        }

        if (serverSessionId) {
          await api(`/api/v1/schools/${activeSchoolId}/attendance/sessions/${serverSessionId}/manual`, {
            method: 'POST',
            body: JSON.stringify({
              studentId,
              newStatus,
              reason: 'Teacher manual override',
            }),
          });
        }
      }

      const effectiveSessionId = currentSession?.id || serverSessionId || `sess-${Date.now()}`;
      const timestamp = new Date().toISOString();
      const outboxEvent: OutboxEventItem = {
        clientEventId: `manual-${effectiveSessionId}-${studentId}-${Date.now()}`,
        schoolId: activeSchoolId,
        sessionId: serverSessionId || effectiveSessionId,
        sessionMetadata: {
          clientSessionId: currentSession?.clientSessionId || effectiveSessionId,
          classSectionId: selectedClassId,
          sessionDate: currentSession?.sessionDate || new Date().toISOString().slice(0, 10),
          sessionType: 'DAILY',
        },
        studentId,
        eventType: 'MANUAL_STATUS_UPDATE',
        statusValue: newStatus,
        clientTimestamp: timestamp,
        source: 'MANUAL',
        syncStatus: serverSessionId && navigator.onLine ? 'SYNCED' : 'PENDING',
        retryCount: 0,
        createdAt: timestamp,
      };

      await offlineDb.transaction('rw', [offlineDb.sessionRosters, offlineDb.syncOutbox], async () => {
        if (currentSession?.id) {
          const sessionRosterItem = await offlineDb.sessionRosters
            .where('[sessionId+studentId]')
            .equals([currentSession.id, studentId])
            .first();
          if (sessionRosterItem && sessionRosterItem.id) {
            await offlineDb.sessionRosters.update(sessionRosterItem.id, { status: newStatus });
          }
        }
        if (!navigator.onLine || !serverSessionId) {
          await offlineDb.syncOutbox.put(outboxEvent);
        }
      });

      await refreshOutbox();
    } catch (err: any) {
      console.warn('Manual status update error:', err);
    }
  };

  // Handle Scan from Phone Camera or USB
  const handleScan = useCallback(
    async (rawToken: string, source: 'CAMERA' | 'USB') => {
      if (!activeSchoolId || !selectedClassId || !user?.id) {
        playScanErrorFeedback();
        showFeedback({ kind: 'error', text: t('sessionRequired') });
        return;
      }

      let activeSessionId = session?.id;
      if (!activeSessionId) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const localSession = await offlineDb.sessions
          .where('[schoolId+classSectionId]')
          .equals([activeSchoolId, selectedClassId])
          .filter((s) => s.sessionDate === todayStr)
          .first();
        if (localSession) {
          activeSessionId = localSession.id;
          setSession(localSession);
        }
      }

      if (!activeSessionId) {
        playScanErrorFeedback();
        showFeedback({ kind: 'error', text: t('sessionRequired') });
        return;
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
      console.warn('Camera start error:', err);
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

  // Handle Outbox Sync
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
        let attempts = 0;
        while (attempts < 3) {
          try {
            await syncOutboxEvents({ schoolId: sid, deviceIdentifier });
            break;
          } catch (e: any) {
            attempts++;
            if (e.message === 'DEVICE_IDENTIFIER_REQUIRED' || e.message === 'DEVICE_NOT_FOUND') {
              try {
                await api(`/api/v1/schools/${sid}/devices/register`, {
                  method: 'POST',
                  body: JSON.stringify({ deviceIdentifier, label: 'Teacher Browser Device' }),
                });
              } catch {}
            }
            if (attempts >= 3) throw e;
            await new Promise((r) => setTimeout(r, 600));
          }
        }
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
            console.warn('Could not resolve server session to finalize:', createErr);
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

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-3xl border border-line shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success-50 text-forest-700 dark:text-forest-600 text-xs font-bold font-display border border-success-100 dark:border-success-600/30 mb-2">
            <span>{t('gateAttendance')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink tracking-tight font-display">
            {t('classroomDashboard')}
          </h1>
          <p className="t-body text-xs text-ink-soft mt-0.5">
            {activeSchoolName} • {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Class Picker */}
          {classes.length > 0 && (
            <div className="relative flex-1 sm:flex-initial">
              <select
                value={selectedClassId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedClassId(newId);
                  localStorage.setItem('attendance.classSectionId', newId);
                }}
                className="w-full sm:w-48 pl-4 pr-10 py-2 rounded-full bg-surface-soft border border-line text-xs font-extrabold text-ink outline-none focus:border-forest-700 font-display cursor-pointer appearance-none"
              >
                {classes.map((c) => {
                  const id = c.classSectionId || c.id;
                  const label = `${c.className} – ${c.sectionName}`;
                  return (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-4 h-4 text-ink-muted absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Download Roster */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadRoster}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            {t('downloadRoster')}
          </Button>

          {/* Start Session */}
          <Button
            variant="primary"
            size="sm"
            onClick={handleStartSession}
            disabled={!selectedClassId || (!!session && session.status !== 'FINALIZED')}
          >
            {session && session.status !== 'FINALIZED' ? t('sessionOpen') : t('startSession')}
          </Button>

          {/* Push Outbox */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePushOutbox}
            isLoading={isSyncing}
            disabled={!isOnline || outboxCount === 0 || isSyncing}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
          >
            {isSyncing ? t('syncingOutbox') : t('pushOutbox')}
          </Button>

          {/* Language Switcher */}
          <div className="inline-flex rounded-full bg-surface-soft border border-line p-1">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-3 py-1 rounded-full text-xs font-bold font-display transition-all cursor-pointer ${
                language === 'en'
                  ? 'bg-forest-700 text-white shadow-xs'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('bn')}
              className={`px-3 py-1 rounded-full text-xs font-bold font-display transition-all cursor-pointer ${
                language === 'bn'
                  ? 'bg-forest-700 text-white shadow-xs'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              বাংলা
            </button>
          </div>
        </div>
      </div>


      {/* If No Assigned Classes / Teacher */}
      {!isAssigned && classes.length === 0 && (
        <div className="p-8 rounded-3xl bg-amber-50/60 border border-amber-200 dark:border-amber-600/30 text-left">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 rounded-2xl text-amber-800 shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-ink font-display">
                {t('askHeadmasterAssign')}
              </h3>
              <p className="text-xs text-ink-soft mt-1 max-w-xl">
                {t('noAssignedClassesDesc')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Big Numbers (Stat Cards) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Came In */}
            <div className="p-6 rounded-3xl bg-success-50/70 border border-success-100 dark:border-success-600/30 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-forest-700 dark:text-forest-600 uppercase tracking-wider font-display">
                  {t('cameIn')}
                </span>
                <span className="p-2 rounded-full bg-forest-700 text-white">
                  <UserCheck className="w-4 h-4" />
                </span>
              </div>
              <div className="text-4xl sm:text-5xl font-extrabold text-forest-700 dark:text-forest-600 font-display mt-3 font-mono">
                {stats.cameIn}
              </div>
              <p className="text-[11px] text-forest-700/80 font-medium mt-1">
                {stats.total > 0 ? `${Math.round((stats.cameIn / stats.total) * 100)}% of class` : 'Gate arrivals'}
              </p>
            </div>

            {/* Still Missing */}
            <div className="p-6 rounded-3xl bg-danger-50/60 border border-danger-100 dark:border-danger-600/30 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-danger-800 uppercase tracking-wider font-display">
                  {t('stillMissing')}
                </span>
                <span className="p-2 rounded-full bg-danger-800 text-white">
                  <UserX className="w-4 h-4" />
                </span>
              </div>
              <div className="text-4xl sm:text-5xl font-extrabold text-danger-800 font-display mt-3 font-mono">
                {stats.missing}
              </div>
              <p className="text-[11px] text-danger-800/80 font-medium mt-1">
                Not yet marked present
              </p>
            </div>

            {/* Late */}
            <div className="p-6 rounded-3xl bg-amber-50/60 border border-amber-100 dark:border-amber-600/30 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider font-display">
                  {t('late')}
                </span>
                <span className="p-2 rounded-full bg-amber-700 text-white">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div className="text-4xl sm:text-5xl font-extrabold text-amber-800 font-display mt-3 font-mono">
                {stats.late}
              </div>
              <p className="text-[11px] text-amber-800/80 font-medium mt-1">
                Arrived after start time
              </p>
            </div>

            {/* Leave */}
            <div className="p-6 rounded-3xl bg-surface-soft border border-line shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink-muted uppercase tracking-wider font-display">
                  {t('leave')}
                </span>
                <span className="p-2 rounded-full bg-ink-muted text-white">
                  <UserMinus className="w-4 h-4" />
                </span>
              </div>
              <div className="text-4xl sm:text-5xl font-extrabold text-ink font-display mt-3 font-mono">
                {stats.leave}
              </div>
              <p className="text-[11px] text-ink-muted font-medium mt-1">
                Approved leave
              </p>
            </div>
          </div>

          {/* Action Bar: Finish Attendance Button */}
          <div className="flex items-center justify-between bg-surface p-4 rounded-3xl border border-line">
            <div className="text-xs font-bold text-ink font-display pl-2">
              <span>{selectedClassName}</span> • <span className="text-forest-700 dark:text-forest-600 font-bold">{stats.cameIn} of {stats.total} Present</span>
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={() => setShowConfirmFinish(true)}
              className="px-6 py-3 rounded-full text-sm font-extrabold shadow-sm"
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
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-success-50 text-forest-700 dark:text-forest-600 font-bold font-mono">
                      {arrivals.length}
                    </span>
                  </h3>
                  <p className="text-xs text-ink-soft mt-0.5">Students who walked through the school gate today.</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {arrivals.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <EmptyState
                      kind="generic"
                      title={t('noArrivalsYet')}
                      description="When students arrive through the school gate, their names appear here automatically."
                    />
                  </div>
                ) : (
                  arrivals.map((st) => (
                    <div
                      key={st.studentId}
                      className="p-3.5 rounded-2xl bg-surface border border-line hover:border-forest-700/40 transition-colors flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-success-50 text-forest-700 dark:text-forest-600 flex items-center justify-center font-bold text-xs font-display">
                          #{st.rollNumber}
                        </div>
                        <div>
                          <h4 className="text-xs font-extrabold text-ink font-display">
                            {language === 'bn' && st.nameBn ? st.nameBn : st.name}
                          </h4>
                          <span className="text-[11px] text-ink-muted font-mono">
                            {new Date(st.time).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-success-50 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 font-display shrink-0">
                        {t('gateAttendance')}
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
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-danger-50 text-danger-800 font-bold font-mono">
                      {missingStudents.length}
                    </span>
                  </h3>
                  <p className="text-xs text-ink-soft mt-0.5">Students not yet recorded at the gate. Mark them manually if in class.</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {missingStudents.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <EmptyState
                      kind="generic"
                      title={t('noMissingStudents')}
                      description="All students in this class have arrived or are accounted for."
                    />
                  </div>
                ) : (
                  missingStudents.map((st) => (
                    <div
                      key={st.studentId}
                      className="p-3.5 rounded-2xl bg-surface border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-surface-soft text-ink-muted flex items-center justify-center font-bold text-xs font-display">
                          #{st.rollNumber}
                        </div>
                        <div>
                          <h4 className="text-xs font-extrabold text-ink font-display">
                            {language === 'bn' && st.nameBn ? st.nameBn : st.name}
                          </h4>
                          <span className="text-[11px] text-ink-muted">
                            Roll #{st.rollNumber}
                          </span>
                        </div>
                      </div>

                      {/* Status Override Action Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(st.studentId, 'PRESENT')}
                          className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-success-50 hover:bg-success-100 text-forest-700 dark:text-forest-600 border border-success-100 dark:border-success-600/30 font-display cursor-pointer transition-colors"
                        >
                          {t('markPresent')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(st.studentId, 'LATE')}
                          className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 dark:border-amber-600/30 font-display cursor-pointer transition-colors"
                        >
                          {t('markLate')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(st.studentId, 'LEAVE')}
                          className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-surface-soft hover:bg-surface text-ink-soft border border-line font-display cursor-pointer transition-colors"
                        >
                          {t('markLeave')}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Phone Backup Scanner (Collapsed by default, expandable details) */}
          <details className="app-card max-w-xl mx-auto overflow-hidden group border border-line" data-testid="phone-backup-details">
            <summary className="p-4 sm:p-5 flex items-center justify-between cursor-pointer list-none select-none bg-surface hover:bg-surface-soft transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-forest-50 text-forest-700 dark:text-forest-400 border border-forest-100 dark:border-forest-600/30">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-ink font-display">{t('phoneBackup')}</h3>
                  <p className="text-[11px] text-ink-muted">{t('phoneBackupDesc')}</p>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-ink-muted group-open:rotate-180 transition-transform" />
            </summary>

            <div className="p-6 pt-2 space-y-4 border-t border-line" data-testid="camera-hud">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-forest-700 dark:text-forest-600" />
                  <h3 className="text-sm font-extrabold text-ink font-display">{t('cameraHud')}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {isCameraActive ? (
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full cursor-pointer hover:bg-amber-100 font-display"
                    >
                      <CameraOff className="w-3.5 h-3.5" />
                      <span>{t('stopCamera')}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void startCamera(videoEl)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full cursor-pointer hover:bg-emerald-100 font-display"
                    >
                      <Camera className="w-3.5 h-3.5" />
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
                    <Button variant="secondary" size="sm" onClick={() => void startCamera(videoEl)}>
                      {t('retryCamera')}
                    </Button>
                  </div>
                )}

                {!cameraError && (
                  <div className="absolute inset-0 border-2 border-emerald-400/30 rounded-3xl pointer-events-none flex flex-col justify-between p-4">
                    <div className="flex justify-between items-center text-[11px] font-mono text-emerald-400 font-bold">
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
                    <div className="text-center text-[11px] font-bold text-white bg-slate-900/80 py-1.5 px-4 rounded-full mx-auto backdrop-blur-sm border border-emerald-400/30 font-display">
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
                  <Usb className="w-4 h-4 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder={t('usbScannerPlaceholder')}
                    className="w-full pl-11 pr-4 py-3 bg-surface-soft border border-line rounded-full text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none"
                  />
                </div>
                <Button type="submit" variant="primary" size="md" className="min-h-[44px] w-full sm:w-auto justify-center">
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
              className="app-card shadow-2xl max-w-md w-full p-6 text-left"
            >
              <h3 className="text-xl font-extrabold text-ink font-display mb-2">
                {t('confirmFinishTitle')}
              </h3>
              <p className="text-xs text-ink-soft mb-6">
                {t('confirmFinishDesc')}
              </p>

              <div className="p-4 rounded-2xl bg-surface-soft border border-line mb-6 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-muted">Class:</span>
                  <strong className="text-ink font-display">{selectedClassName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Marked Present:</span>
                  <strong className="text-forest-700 dark:text-forest-600 font-display">{stats.cameIn} students</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Will Be Marked Absent:</span>
                  <strong className="text-danger-800 font-display">{stats.missing} students</strong>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfirmFinish(false)}
                >
                  {t('cancel')}
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  disabled={isFinishing}
                  isLoading={isFinishing}
                  onClick={handleFinalizeAttendance}
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
