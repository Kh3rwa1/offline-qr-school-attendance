import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  Download,
  Usb,
  CheckCircle2,
  ScanLine,
  ClipboardCheck,
  Database,
  CameraOff,
  AlertCircle,
  Volume2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StatCard } from '../../components/shared/StatCard';
import { Button } from '../../components/shared/Button';
import { Toast } from '../../components/shared/Toast';
import { RollingNumber } from '../../components/shared/RollingNumber';
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

export const TeacherDashboard: React.FC = () => {
  const { activeSchoolId } = useActiveSchool();
  const { user } = useSession();
  const { isOnline, outboxCount, isSyncing, syncNow, refreshOutbox } = useOfflineStatus();
  const { language, setLanguage, t } = useLanguage();

  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    try {
      return localStorage.getItem('attendance.classSectionId') || '';
    } catch {
      return '';
    }
  });
  const [roster, setRoster] = useState<OfflineRosterItem[]>([]);
  const [session, setSession] = useState<OfflineSessionItem | null>(null);
  const [sessionRoster, setSessionRoster] = useState<OfflineSessionRosterItem[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [viewMode, setViewMode] = useState<'review' | 'scanner' | 'roster'>('review');
  const [finalizing, setFinalizing] = useState(false);
  const [scanBurst, setScanBurst] = useState<{ id: number; studentName?: string; studentNameBn?: string } | null>(null);

  // Camera & Scanner State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraScannerRef = useRef<CameraScannerService | null>(null);

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

  const loadLocalRoster = useCallback(async (classId: string) => {
    if (!classId) return;
    const records = await offlineDb.rosters.where('classSectionId').equals(classId).toArray();
    setRoster(records);
  }, []);

  const loadClasses = useCallback(async () => {
    if (!activeSchoolId) return;
    try {
      const res = await api<{ success: boolean; data?: any[]; classes?: any[] }>(
        `/api/v1/schools/${activeSchoolId}/attendance/classes`
      );
      const classList = res.data || res.classes || [];
      if (classList.length > 0) {
        setClasses(classList);
        if (!selectedClassId) {
          const firstId = classList[0].classSectionId || classList[0].id;
          setSelectedClassId(firstId);
          localStorage.setItem('attendance.classSectionId', firstId);
        }
      }
    } catch {
      // Offline fallback: load unique classes from cached roster
      const cached = await offlineDb.rosters.toArray();
      const uniqueMap = new Map<string, { id: string; classSectionId: string; className: string; sectionName: string }>();
      cached.forEach((r) => {
        if (!uniqueMap.has(r.classSectionId)) {
          uniqueMap.set(r.classSectionId, {
            id: r.classSectionId,
            classSectionId: r.classSectionId,
            className: 'Class',
            sectionName: 'Section',
          });
        }
      });
      setClasses(Array.from(uniqueMap.values()));
    }
  }, [activeSchoolId, selectedClassId]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    if (selectedClassId) {
      void loadLocalRoster(selectedClassId);
    }
  }, [selectedClassId, loadLocalRoster]);

  // Load cached session
  useEffect(() => {
    async function loadSession() {
      if (!activeSchoolId || !selectedClassId) return;
      localStorage.setItem('attendance.classSectionId', selectedClassId);

      const todayStr = new Date().toISOString().slice(0, 10);
      const activeSession = await offlineDb.sessions
        .where('[schoolId+classSectionId]')
        .equals([activeSchoolId, selectedClassId])
        .filter((s) => s.sessionDate === todayStr && s.status !== 'FINALIZED')
        .first();

      if (activeSession) {
        setSession(activeSession);
        const sRoster = await offlineDb.sessionRosters.where('sessionId').equals(activeSession.id).toArray();
        setSessionRoster(sRoster);
      } else {
        setSession(null);
        setSessionRoster([]);
      }
    }
    void loadSession();
  }, [activeSchoolId, selectedClassId]);

  const handleScan = useCallback(
    async (rawToken: string, source: 'CAMERA' | 'USB') => {
      if (!activeSchoolId || !selectedClassId || !session || !user?.id) {
        playScanErrorFeedback();
        showFeedback({ kind: 'error', text: t('sessionRequired') });
        return;
      }

      try {
        const result = await processOfflineQRCode({
          schoolId: activeSchoolId,
          sessionId: session.id,
          rawToken,
          actorId: user.id,
          source,
        });

        if (result.success && result.student) {
          if (result.duplicateScan) {
            playScanDuplicateFeedback();
            showFeedback({
              kind: 'warning',
              text: result.message || `${result.student.name} ${t('alreadyMarked')}`,
            });
          } else {
            playScanSuccessFeedback();
            setScanBurst({
              id: Date.now(),
              studentName: result.student.name,
              studentNameBn: result.student.nameBn || undefined,
            });
            showFeedback({
              kind: 'success',
              text: `${result.student.name} (#${result.student.rollNumber}) ${t('markedPresent')}`,
            });
            const updated = await offlineDb.sessionRosters.where('sessionId').equals(session.id).toArray();
            setSessionRoster(updated);
            await refreshOutbox();
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
    [activeSchoolId, selectedClassId, session, user, t, showFeedback, refreshOutbox]
  );

  const handleScanRef = useRef(handleScan);
  useEffect(() => {
    handleScanRef.current = handleScan;
  }, [handleScan]);

  const [cameraStatus, setCameraStatus] = useState<'idle' | 'starting' | 'live' | 'error' | 'permission_denied'>('idle');
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);

  const videoCallbackRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setVideoEl(node);
  }, []);

  // Start & Stop Camera Scanner
  const startCamera = useCallback(async (targetEl?: HTMLVideoElement | null) => {
    const el = targetEl || videoRef.current;
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
      console.warn('Camera activation error:', err);
      setIsCameraActive(false);
      const isDenied =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDeniedError' ||
        err?.message?.includes('Permission');
      setCameraStatus(isDenied ? 'permission_denied' : 'error');
      setCameraError(isDenied ? t('cameraDenied') : (err?.message || t('cameraDenied')));
    }
  }, [t]);

  const stopCamera = useCallback(() => {
    if (cameraScannerRef.current) {
      cameraScannerRef.current.stopScanning();
    }
    setIsCameraActive(false);
    setCameraStatus('idle');
  }, []);

  const isSessionActive = Boolean(session && (session.status as string) !== 'FINALIZED' && (session.status as string) !== 'FINALIZE_PENDING');
  useEffect(() => {
    if (viewMode === 'scanner' && videoEl && isSessionActive) {
      void startCamera(videoEl);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [viewMode, videoEl, isSessionActive, startCamera, stopCamera]);

  // Setup USB hardware keyboard-wedge scanner listener
  useEffect(() => {
    const cleanupUsb = setupUSBScannerListener((scannedText) => {
      void handleScan(scannedText, 'USB');
    });
    return () => {
      cleanupUsb();
    };
  }, [handleScan]);

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
            body: JSON.stringify({ deviceIdentifier: deviceId, label: 'Teacher Mobile Chrome' }),
          });
          await downloadAndStoreRosterPackage(activeSchoolId, selectedClassId, deviceId);
        } catch {
          throw dlErr;
        }
      }
      await loadLocalRoster(selectedClassId);
      showFeedback({ kind: 'success', text: t('rosterDownloaded') });
    } catch (err: any) {
      showFeedback({ kind: 'error', text: err.message || 'Failed to download roster' });
    }
  };

  const handleStartSession = async () => {
    if (!activeSchoolId || !selectedClassId) return;
    if (!user?.id) {
      showFeedback({ kind: 'error', text: t('sessionRequired') });
      return;
    }
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      let serverSessionId: string | undefined = undefined;

      // If online, initialize / bind server session record
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
          const isNetworkError =
            serverErr?.status === 0 || serverErr?.code === 'NETWORK_UNAVAILABLE' || !navigator.onLine;
          if (isNetworkError) {
            console.warn('Network unavailable, creating offline local session:', serverErr);
          } else {
            showFeedback({ kind: 'error', text: serverErr.message || 'Server error creating attendance session' });
            return;
          }
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
      const sRoster = await offlineDb.sessionRosters.where('sessionId').equals(s.id).toArray();
      setSessionRoster(sRoster);
      showFeedback({ kind: 'success', text: t('sessionOpen') });
    } catch (err: any) {
      showFeedback({ kind: 'error', text: err.message || 'Failed to start session' });
    }
  };

  const handleManualStatus = async (studentId: string, status: any) => {
    if (!session || !activeSchoolId) return;

    const sessionRosterItem = await offlineDb.sessionRosters
      .where('[sessionId+studentId]')
      .equals([session.id, studentId])
      .first();

    const clientEventId = `manual-${session.id}-${studentId}-${Date.now()}`;
    const timestamp = new Date().toISOString();
    const outboxEvent: OutboxEventItem = {
      clientEventId,
      schoolId: activeSchoolId,
      sessionId: session.id,
      sessionMetadata: {
        clientSessionId: session.clientSessionId,
        classSectionId: session.classSectionId,
        sessionDate: session.sessionDate,
        sessionType: session.sessionType,
      },
      studentId,
      eventType: 'MANUAL_STATUS_UPDATE',
      statusValue: status,
      clientTimestamp: timestamp,
      source: 'MANUAL',
      syncStatus: 'PENDING',
      retryCount: 0,
      createdAt: timestamp,
    };

    // Atomic Dexie transaction for manual status update and outbox insertion
    await offlineDb.transaction('rw', [offlineDb.sessionRosters, offlineDb.syncOutbox], async () => {
      if (sessionRosterItem && sessionRosterItem.id) {
        await offlineDb.sessionRosters.update(sessionRosterItem.id, { status });
      }
      await offlineDb.syncOutbox.put(outboxEvent);
    });

    const updated = await offlineDb.sessionRosters.where('sessionId').equals(session.id).toArray();
    setSessionRoster(updated);
    await refreshOutbox();
  };

  const handleFinalize = async () => {
    if (!session || !activeSchoolId) return;
    setFinalizing(true);
    try {
      const deviceId = getDeviceIdentifier();
      const timestamp = new Date().toISOString();

      // Step 1: Auto-mark remaining UNMARKED students as ABSENT in Dexie and outbox
      const unmarkedStudents = sessionRoster.filter((r) => r.status === 'UNMARKED');
      if (unmarkedStudents.length > 0) {
        await offlineDb.transaction('rw', [offlineDb.sessionRosters, offlineDb.syncOutbox], async () => {
          for (const item of unmarkedStudents) {
            if (item.id) {
              await offlineDb.sessionRosters.update(item.id, { status: 'ABSENT' });
            }
            const outboxAbsent: OutboxEventItem = {
              clientEventId: `auto-absent-${session.id}-${item.studentId}-${Date.now()}`,
              schoolId: activeSchoolId,
              sessionId: session.id,
              sessionMetadata: {
                clientSessionId: session.clientSessionId,
                classSectionId: session.classSectionId,
                sessionDate: session.sessionDate,
                sessionType: session.sessionType,
              },
              studentId: item.studentId,
              eventType: 'MANUAL_STATUS_UPDATE',
              statusValue: 'ABSENT',
              clientTimestamp: timestamp,
              source: 'MANUAL',
              syncStatus: 'PENDING',
              retryCount: 0,
              createdAt: timestamp,
            };
            await offlineDb.syncOutbox.put(outboxAbsent);
          }
        });

        const refreshedRoster = await offlineDb.sessionRosters.where('sessionId').equals(session.id).toArray();
        setSessionRoster(refreshedRoster);
      }

      // Step 2: Ensure server session exists if online
      let targetServerSessionId = session.serverSessionId;
      if (!targetServerSessionId && navigator.onLine) {
        try {
          const res = await api<{ success: boolean; data: any }>(
            `/api/v1/schools/${activeSchoolId}/attendance/sessions`,
            {
              method: 'POST',
              body: JSON.stringify({
                classSectionId: session.classSectionId,
                sessionDate: session.sessionDate,
                sessionType: session.sessionType || 'DAILY',
              }),
            }
          );
          if (res?.data?.id) {
            targetServerSessionId = res.data.id;
            await offlineDb.sessions.update(session.id, { serverSessionId: targetServerSessionId });
            setSession((prev) => (prev ? { ...prev, serverSessionId: targetServerSessionId } : null));
          }
        } catch (initErr: any) {
          const isNetworkError =
            initErr?.status === 0 || initErr?.code === 'NETWORK_UNAVAILABLE' || !navigator.onLine;
          if (!isNetworkError) throw initErr;
        }
      }

      // Step 3: Synchronize all outbox events
      if (navigator.onLine) {
        try {
          await syncOutboxEvents({ schoolId: activeSchoolId, deviceIdentifier: deviceId });
        } catch (syncErr: any) {
          console.warn('Outbox synchronization note:', syncErr);
        }
      }

      // Step 4: Finalize on Server if online
      const effectiveSessionId = targetServerSessionId || session.id;
      if (navigator.onLine && targetServerSessionId) {
        try {
          const patchRes = await api<{ success: boolean; data: any }>(
            `/api/v1/schools/${activeSchoolId}/attendance/sessions/${effectiveSessionId}/status`,
            {
              method: 'PATCH',
              body: JSON.stringify({
                status: 'FINALIZED',
                autoMarkAbsentForUnmarked: true,
                reason: 'Class teacher finalized daily attendance',
              }),
            }
          );

          if (patchRes?.data?.status === 'FINALIZED') {
            await offlineDb.sessions.update(session.id, { status: 'FINALIZED' });
            setSession((prev) => (prev ? { ...prev, status: 'FINALIZED' } : null));
            showFeedback({ kind: 'success', text: t('finalizedSuccess') });
            setViewMode('scanner');
            return;
          }
        } catch (patchErr: any) {
          const isNetworkError =
            patchErr?.status === 0 || patchErr?.code === 'NETWORK_UNAVAILABLE' || !navigator.onLine;
          if (!isNetworkError) throw patchErr;
        }
      }

      // Offline fallback: mark session locked locally as FINALIZE_PENDING
      await offlineDb.sessions.update(session.id, { status: 'FINALIZE_PENDING' as any });
      setSession((prev) => (prev ? { ...prev, status: 'FINALIZE_PENDING' as any } : null));
      showFeedback({ kind: 'warning', text: t('finalizedOffline') });
    } catch (err: any) {
      showFeedback({ kind: 'error', text: err.message || 'Finalization encountered an error' });
    } finally {
      setFinalizing(false);
      await refreshOutbox();
    }
  };

  const present = sessionRoster.filter((item) => item.status === 'PRESENT').length;
  const late = sessionRoster.filter((item) => item.status === 'LATE').length;
  const leaveExcused = sessionRoster.filter((item) => item.status === 'LEAVE' || item.status === 'EXCUSED').length;

  return (
    <div className="space-y-6 text-left" id="teacher-dashboard-view">
      {/* Header with Title and Language Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success-50 border border-success-100 dark:border-success-600/30 text-[11px] font-bold text-forest-700 dark:text-forest-600 uppercase tracking-wider mb-2 font-display">
            <span>{t('uhfGateAttendance')}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
            {t('classroomDashboard')}
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            {t('classroomSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Language Toggle Pill */}
          <div className="inline-flex rounded-full bg-surface-soft border border-line p-1">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold font-display transition-all cursor-pointer ${
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
              className={`px-3 py-1.5 rounded-full text-xs font-bold font-display transition-all cursor-pointer ${
                language === 'bn'
                  ? 'bg-forest-700 text-white shadow-xs'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              বাংলা
            </button>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={handleStartSession}
            disabled={!selectedClassId || (!!session && session.status !== 'FINALIZED')}
            aria-label={session ? t('sessionOpen') : t('startSession')}
            leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-300" />}
          >
            {session ? t('sessionOpen') : t('startSession')}
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={handleDownloadRoster}
            disabled={!isOnline || !selectedClassId}
            aria-label={t('downloadRoster')}
            leftIcon={<Download className="w-4 h-4 text-ink-soft" />}
          >
            {t('downloadRoster')}
          </Button>
        </div>
      </div>

      {feedback && (
        <Toast
          kind={feedback.kind}
          message={feedback.text}
          onDismiss={() => setFeedback(null)}
          autoDismiss={true}
        />
      )}

      {/* Telemetry Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title={t('presentStudents')}
          value={`${present} / ${sessionRoster.length || 0}`}
          trend={{
            value: `${sessionRoster.length ? Math.round((present / sessionRoster.length) * 100) : 0}% Attendance`,
            isPositive: true,
          }}
          variant="hero-forest"
          onClick={() => setViewMode('review')}
        />
        <StatCard
          title={t('enrolledInSection')}
          value={sessionRoster.length || roster.length || 0}
          trend={{ value: t('enrolledInSection'), isPositive: true }}
          variant="default"
          onClick={() => setViewMode('roster')}
        />
        <StatCard
          title={t('offlineOutbox')}
          value={outboxCount}
          trend={{
            value: isOnline ? (outboxCount === 0 ? '✓ Synced' : 'Ready to push') : 'Stored in Dexie',
            isPositive: outboxCount === 0,
          }}
          variant="default"
          onClick={() => void syncNow()}
        />
        <StatCard
          title={t('lateArrivals')}
          value={late}
          trend={{ value: `${leaveExcused} Excused`, isPositive: false }}
          variant="default"
          onClick={() => setViewMode('review')}
        />
      </div>

      {/* Section Selector and Tab Navigation */}
      <div className="app-card p-4 sm:p-5 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-64">
          <span className="text-xs font-bold text-ink font-display">{t('activeSection')}:</span>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="flex-1 max-w-xs py-2.5 px-3.5 bg-surface-soft border border-line rounded-full text-xs font-bold text-ink focus:bg-surface focus:border-forest-700 outline-none"
          >
            <option value="">{t('selectClassSection')}</option>
            {classes.map((item) => {
              const id = item.classSectionId || item.id;
              return (
                <option key={id} value={id}>
                  {item.className} - {item.sectionName}
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex gap-2">
          {(
            [
              ['review', t('gateReviewMode'), <ClipboardCheck className="w-3.5 h-3.5" key="r" />],
              ['roster', t('cachedRoster'), <Database className="w-3.5 h-3.5" key="c" />],
              ['scanner', t('fallbackQrScanner'), <ScanLine className="w-3.5 h-3.5" key="s" />],
            ] as const
          ).map(([mode, label, icon]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold font-display transition-all cursor-pointer ${
                viewMode === mode
                  ? 'bg-forest-700 text-white shadow-sm'
                  : 'bg-surface-soft text-ink-soft hover:bg-surface border border-line'
              }`}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Scanner View Mode */}
      {viewMode === 'scanner' && (
        <section className="grid lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-8 app-card p-6 sm:p-7 space-y-4 flex flex-col justify-between relative overflow-hidden">
            {/* Scan Success Animated Burst Overlay */}
            <AnimatePresence>
              {scanBurst && (
                <motion.div
                  key={scanBurst.id}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  onAnimationComplete={() => {
                    setTimeout(() => {
                      setScanBurst((curr) => (curr?.id === scanBurst.id ? null : curr));
                    }, 400);
                  }}
                  aria-hidden="true"
                  className="absolute inset-0 z-30 bg-forest-900/90 backdrop-blur-xs flex flex-col items-center justify-center text-white pointer-events-none p-6 text-center"
                >
                  <motion.div
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="w-20 h-20 rounded-full bg-forest-600 flex items-center justify-center shadow-2xl mb-3"
                  >
                    <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
                  </motion.div>
                  <span className="text-xl font-bold font-display">{scanBurst.studentName || 'Verified'}</span>
                  {scanBurst.studentNameBn && (
                    <span className="text-sm text-emerald-200 font-sans mt-0.5">{scanBurst.studentNameBn}</span>
                  )}
                  <span className="text-xs font-mono text-emerald-300 uppercase tracking-widest mt-2 bg-forest-800/80 px-3 py-1 rounded-full border border-emerald-400/30">
                    STATUS: PRESENT
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-forest-700 dark:text-forest-600" />
                <h3 className="text-base font-extrabold text-ink font-display">{t('cameraHud')}</h3>
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
                    onClick={() => void startCamera()}
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full cursor-pointer hover:bg-emerald-100 font-display"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{t('startCamera')}</span>
                  </button>
                )}
                <span className="text-xs font-bold text-forest-700 dark:text-forest-600 bg-success-50 border border-success-100 dark:border-success-600/30 px-3 py-1 rounded-full font-mono">
                  {session ? `${present}/${sessionRoster.length} Scanned` : 'Session Offline'}
                </span>
              </div>
            </div>

            {/* Video Viewfinder & Error Fallback */}
            <div className="relative aspect-video max-h-[45vh] rounded-3xl bg-slate-950 overflow-hidden flex items-center justify-center border border-line">
              <video ref={videoCallbackRef} className="w-full h-full object-cover" muted playsInline />
              
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

            {/* USB / Manual Token Input Field */}
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

          {/* Right Side Telemetry Card */}
          <div className="lg:col-span-4 app-card p-6 sm:p-7 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-base font-extrabold text-ink font-display">{t('sessionTelemetry')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center">
                <div className="bg-surface-soft rounded-2xl p-3 border border-line">
                  <span className="block text-2xl font-extrabold text-ink font-display t-data">
                    {sessionRoster.length || 0}
                  </span>
                  <span className="t-label text-ink-muted block mt-1">{t('enrolledInSection')}</span>
                </div>
                <div className="bg-success-50 rounded-2xl p-3 border border-success-100 dark:border-success-600/30">
                  <span className="block text-2xl font-extrabold text-success-800 font-display t-data">
                    <RollingNumber value={present} />
                  </span>
                  <span className="t-label text-success-600 block mt-1">{t('present')}</span>
                </div>
                <div className="bg-warning-50 rounded-2xl p-3 border border-warning-100 dark:border-warning-600/30">
                  <span className="block text-2xl font-extrabold text-warning-800 font-display t-data">
                    <RollingNumber value={outboxCount} />
                  </span>
                  <span className="t-label text-warning-600 block mt-1">{t('offlineOutbox')}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-surface-soft border border-line space-y-2.5 text-xs">
                <div className="flex justify-between text-ink-soft">
                  <span>{t('lateArrivals')}</span>
                  <span className="font-bold text-warning-800 font-mono t-data">{late}</span>
                </div>
                <div className="flex justify-between text-ink-soft">
                  <span>{t('excusedLeaves')}</span>
                  <span className="font-bold text-ink font-mono t-data">{leaveExcused}</span>
                </div>
                <div className="flex justify-between text-ink-soft">
                  <span>{t('unmarkedAbsent')}</span>
                  <span className="font-bold text-danger-800 font-mono t-data">
                    {Math.max(0, sessionRoster.length - present - late - leaveExcused)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => void syncNow()}
                disabled={!isOnline || outboxCount === 0 || isSyncing}
                className="w-full justify-center min-h-[44px]"
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
              >
                {isSyncing ? t('syncingOutbox') : t('pushOutbox')}
              </Button>

              <Button
                variant="primary"
                size="md"
                onClick={() => setViewMode('review')}
                disabled={!session}
                className="w-full justify-center min-h-[44px]"
              >
                {t('reviewAndFinalize')}
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Review and Finalize View Mode */}
      {viewMode === 'review' && (
        <section className="app-card p-6 sm:p-7 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-xl font-extrabold text-ink font-display">{t('reviewAndFinalize')}</h3>
              <p className="t-body text-xs text-ink-soft mt-0.5">{t('reviewSubtitle')}</p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setViewMode('scanner')}
                disabled={finalizing}
                className="min-h-[40px]"
              >
                {t('backToScanner')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleFinalize()}
                disabled={finalizing}
                isLoading={finalizing}
                className="min-h-[40px]"
              >
                {finalizing ? t('finalizing') : t('publishAndFinalize')}
              </Button>
            </div>
          </div>

          {sessionRoster.length === 0 ? (
            <EmptyState
              kind="roster"
              title={t('noRosterFound')}
              description={t('downloadRosterPrompt')}
              actionText={t('backToScanner')}
              onAction={() => setViewMode('scanner')}
            />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto border border-line rounded-3xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface-soft border-b border-line text-left text-ink-muted uppercase font-bold font-display">
                      <th className="p-3.5">{t('roll')}</th>
                      <th className="p-3.5">{t('studentName')}</th>
                      <th className="p-3.5">{t('status')}</th>
                      <th className="p-3.5">{t('overrideAction')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-surface">
                    {sessionRoster.map((item) => (
                      <tr key={item.studentId} className="table-row-hover">
                        <td className="p-3.5 font-mono font-bold text-ink">#{item.rollNumber}</td>
                        <td className="p-3.5 font-bold text-ink font-display">
                          <div>
                            <span>{item.studentName}</span>
                            {item.studentNameBn && (
                              <span className="block text-xs font-normal text-ink-soft">{item.studentNameBn}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-3 py-1 rounded-full text-[11px] font-bold border font-display ${
                              item.status === 'PRESENT'
                                ? 'bg-success-50 text-success-800 border-success-100 dark:border-success-600/30'
                                : item.status === 'ABSENT'
                                ? 'bg-danger-50 text-danger-800 border-danger-100 dark:border-danger-600/30'
                                : item.status === 'LATE'
                                ? 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30'
                                : item.status === 'LEAVE' || item.status === 'EXCUSED'
                                ? 'bg-purple-50 text-purple-800 border-purple-200'
                                : 'bg-surface-soft text-ink-soft border-line'
                            }`}
                          >
                            {t((item.status?.toLowerCase() as any) || 'unmarked')}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex gap-1.5">
                            {(['PRESENT', 'ABSENT', 'LATE', 'LEAVE'] as const).map((st) => {
                              const isSelected = item.status === st;
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  aria-pressed={isSelected}
                                  onClick={() => void handleManualStatus(item.studentId, st)}
                                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all cursor-pointer font-display focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 ${
                                    isSelected
                                      ? 'bg-forest-700 text-white shadow-sm'
                                      : 'bg-surface-soft text-ink-soft hover:bg-surface border border-line'
                                  }`}
                                >
                                  {t(st.toLowerCase() as any)}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Card View */}
              <div className="md:hidden space-y-3">
                {sessionRoster.map((item) => (
                  <div key={item.studentId} className="app-card p-4 space-y-3 border border-line">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono font-bold text-ink-muted">#{item.rollNumber}</span>
                        <h4 className="text-sm font-bold text-ink font-display">{item.studentName}</h4>
                        {item.studentNameBn && (
                          <p className="text-xs text-ink-soft">{item.studentNameBn}</p>
                        )}
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-bold border font-display ${
                          item.status === 'PRESENT'
                            ? 'bg-success-50 text-success-800 border-success-100 dark:border-success-600/30'
                            : item.status === 'ABSENT'
                            ? 'bg-danger-50 text-danger-800 border-danger-100 dark:border-danger-600/30'
                            : item.status === 'LATE'
                            ? 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30'
                            : item.status === 'LEAVE' || item.status === 'EXCUSED'
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : 'bg-surface-soft text-ink-soft border-line'
                        }`}
                      >
                        {t((item.status?.toLowerCase() as any) || 'unmarked')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line">
                      {(['PRESENT', 'ABSENT', 'LATE', 'LEAVE'] as const).map((st) => {
                        const isSelected = item.status === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => void handleManualStatus(item.studentId, st)}
                            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer font-display flex items-center justify-center focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 ${
                              isSelected
                                ? 'bg-forest-700 text-white shadow-sm'
                                : 'bg-surface-soft text-ink-soft hover:bg-surface border border-line'
                            }`}
                          >
                            {t(st.toLowerCase() as any)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Cached Roster View Mode */}
      {viewMode === 'roster' && (
        <section className="app-card p-6 sm:p-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-extrabold text-ink font-display">{t('cachedRoster')}</h3>
            <span className="text-xs font-bold text-ink-soft bg-surface-soft px-3 py-1 rounded-full border border-line">
              {roster.length} {t('recordsInStorage')}
            </span>
          </div>

          {roster.length === 0 ? (
            <EmptyState
              kind="roster"
              title={t('noRosterFound')}
              description={t('downloadRosterPrompt')}
              actionText={t('downloadRoster')}
              onAction={handleDownloadRoster}
            />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto border border-line rounded-3xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-surface-soft border-b border-line text-ink-muted uppercase font-bold font-display">
                      <th className="p-3.5">{t('roll')}</th>
                      <th className="p-3.5">{t('studentName')}</th>
                      <th className="p-3.5">{t('bengaliName')}</th>
                      <th className="p-3.5">{t('studentCode')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-surface">
                    {roster.map((s) => (
                      <tr key={s.studentId} className="table-row-hover">
                        <td className="p-3.5 font-mono font-bold text-ink">#{s.rollNumber}</td>
                        <td className="p-3.5 font-bold text-ink font-display">{s.name}</td>
                        <td className="p-3.5 text-ink-soft">{s.nameBn || '—'}</td>
                        <td className="p-3.5 font-mono text-ink-muted">{s.studentCode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Card View */}
              <div className="md:hidden space-y-3">
                {roster.map((s) => (
                  <div key={s.studentId} className="app-card p-4 flex items-center justify-between border border-line">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-ink-muted">#{s.rollNumber}</span>
                        <h4 className="text-sm font-bold text-ink font-display">{s.name}</h4>
                      </div>
                      {s.nameBn && <p className="text-xs text-ink-soft mt-0.5">{s.nameBn}</p>}
                    </div>
                    <span className="text-[11px] font-mono font-bold text-ink-muted bg-surface-soft px-2.5 py-1 rounded-lg border border-line">
                      {s.studentCode}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
};

export default TeacherDashboard;
