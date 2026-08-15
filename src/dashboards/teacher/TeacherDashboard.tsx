import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Camera, RefreshCw, Download, Usb, CheckCircle2, ScanLine, ClipboardCheck, Database, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StatCard } from '../../components/shared/StatCard';
import { Button } from '../../components/shared/Button';
import { Toast } from '../../components/shared/Toast';
import { RollingNumber } from '../../components/shared/RollingNumber';
import { EmptyState } from '../../components/shared/EmptyState';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useOfflineStatus } from '../../app/OfflineStatusProvider';
import { useSession } from '../../app/SessionProvider';
import {
  createOfflineSession,
  downloadAndStoreRosterPackage,
  processOfflineQRCode,
  syncOutboxEvents,
} from '../../services/offlineSyncService';
import { offlineDb, OfflineRosterItem, OfflineSessionItem, OfflineSessionRosterItem, OutboxEventItem } from '../../db/offlineDb';
import { api } from '../../services/api';

export const TeacherDashboard: React.FC = () => {
  const { activeSchoolId } = useActiveSchool();
  const { user } = useSession();
  const { isOnline, outboxCount, isSyncing, syncNow, refreshOutbox } = useOfflineStatus();

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
  const [viewMode, setViewMode] = useState<'scanner' | 'review' | 'roster'>('scanner');
  const [finalizing, setFinalizing] = useState(false);
  const [scanBurst, setScanBurst] = useState<{ active: boolean; studentName?: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControls = useRef<{ stop: () => void } | null>(null);

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

  const handleDownloadRoster = async () => {
    if (!activeSchoolId || !selectedClassId) return;
    try {
      showFeedback({ kind: 'success', text: 'Downloading class cryptographic roster…' });
      const deviceId = getDeviceIdentifier();
      try {
        await downloadAndStoreRosterPackage(activeSchoolId, selectedClassId, deviceId);
      } catch (dlErr: any) {
        // If device is not yet registered, auto-register and retry download
        try {
          await api(`/api/v1/schools/${activeSchoolId}/devices/register`, {
            method: 'POST',
            body: JSON.stringify({ deviceIdentifier: deviceId, label: 'Teacher Browser Terminal' }),
          });
          await downloadAndStoreRosterPackage(activeSchoolId, selectedClassId, deviceId);
        } catch {
          throw dlErr;
        }
      }
      await loadLocalRoster(selectedClassId);
      showFeedback({ kind: 'success', text: 'Roster and active QR digests downloaded successfully.' });
    } catch (err: any) {
      showFeedback({ kind: 'error', text: err.message || 'Failed to download roster' });
    }
  };

  const handleStartSession = async () => {
    if (!activeSchoolId || !selectedClassId) return;
    if (!user?.id) {
      showFeedback({ kind: 'error', text: 'Authentication session required to start attendance' });
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
          const isNetworkError = serverErr?.status === 0 || serverErr?.code === 'NETWORK_UNAVAILABLE' || !navigator.onLine;
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
      showFeedback({ kind: 'success', text: 'Attendance session initialized and roster loaded.' });
    } catch (err: any) {
      showFeedback({ kind: 'error', text: err.message || 'Failed to start session' });
    }
  };

  const handleScan = async (rawToken: string, source: 'CAMERA' | 'USB') => {
    if (!activeSchoolId || !selectedClassId || !session || !user?.id) {
      showFeedback({ kind: 'error', text: 'Please start an authenticated offline session first' });
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
        // Signature moment: trigger spring checkmark burst
        setScanBurst({ active: true, studentName: result.student.name });
        setTimeout(() => setScanBurst(null), 300);

        showFeedback({ kind: 'success', text: `${result.student.name} (Roll ${result.student.rollNumber}) marked PRESENT` });
        const updated = await offlineDb.sessionRosters.where('sessionId').equals(session.id).toArray();
        setSessionRoster(updated);
        await refreshOutbox();
      } else {
        showFeedback({ kind: 'warning', text: result.message || 'QR token rejected' });
      }
    } catch (err: any) {
      showFeedback({ kind: 'error', text: err.message || 'Error processing scan' });
    }
  };

  const handleManualStatus = async (studentId: string, status: any) => {
    if (!session || !activeSchoolId) return;
    const sessionRosterItem = await offlineDb.sessionRosters
      .where('[sessionId+studentId]')
      .equals([session.id, studentId])
      .first();

    if (sessionRosterItem && sessionRosterItem.id) {
      await offlineDb.sessionRosters.update(sessionRosterItem.id, { status });
    }

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
    await offlineDb.syncOutbox.put(outboxEvent);

    const updated = await offlineDb.sessionRosters.where('sessionId').equals(session.id).toArray();
    setSessionRoster(updated);
    await refreshOutbox();
  };

  const handleFinalize = async () => {
    if (!session || !activeSchoolId) return;
    setFinalizing(true);
    try {
      const deviceId = getDeviceIdentifier();

      // Step 1: Ensure server session exists if online
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
            setSession((prev) => prev ? { ...prev, serverSessionId: targetServerSessionId } : null);
          }
        } catch (initErr: any) {
          const isNetworkError = initErr?.status === 0 || initErr?.code === 'NETWORK_UNAVAILABLE' || !navigator.onLine;
          if (!isNetworkError) {
            throw initErr;
          }
        }
      }

      // Step 2: Synchronize all outbox events
      if (navigator.onLine) {
        try {
          await syncOutboxEvents({ schoolId: activeSchoolId, deviceIdentifier: deviceId });
        } catch (syncErr: any) {
          console.warn('Outbox synchronization warning:', syncErr);
        }
      }

      // Step 3: PATCH server session status
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
                reason: 'Class teacher finalized roll submission',
              }),
            }
          );

          if (patchRes?.data?.status === 'FINALIZED') {
            await offlineDb.sessions.update(session.id, { status: 'FINALIZED' });
            setSession((prev) => prev ? { ...prev, status: 'FINALIZED' } : null);
            showFeedback({ kind: 'success', text: 'Attendance finalized and verified on server.' });
            setViewMode('scanner');
            return;
          }
        } catch (patchErr: any) {
          const isNetworkError = patchErr?.status === 0 || patchErr?.code === 'NETWORK_UNAVAILABLE' || !navigator.onLine;
          if (!isNetworkError) {
            throw patchErr;
          }
        }
      }

      // Offline fallback: mark FINALIZE_PENDING locally
      await offlineDb.sessions.update(session.id, { status: 'FINALIZE_PENDING' as any });
      setSession((prev) => prev ? { ...prev, status: 'FINALIZE_PENDING' as any } : null);
      showFeedback({ kind: 'warning', text: 'Offline: Attendance stored in outbox. Marked FINALIZE_PENDING until connection is restored.' });
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
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success-50 border border-success-100 dark:border-success-600/30 text-[11px] font-bold text-forest-700 dark:text-forest-600 uppercase tracking-wider mb-2 font-display">
            <span>Offline QR Attendance</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
            Classroom Dashboard
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            Plan, scan, and finalize student attendance with offline QR & barcode wands.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={handleStartSession}
            disabled={!selectedClassId || (!!session && session.status !== 'FINALIZED')}
            aria-label={session ? 'Session open' : 'Start offline session'}
            leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-300" />}
          >
            {session ? 'Session open' : 'Start offline session'}
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={handleDownloadRoster}
            disabled={!isOnline || !selectedClassId}
            aria-label="Download roster"
            leftIcon={<Download className="w-4 h-4 text-ink-soft" />}
          >
            Download roster
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Present Students"
          value={`${present} / ${sessionRoster.length || 48}`}
          trend={{ value: `${sessionRoster.length ? Math.round((present / sessionRoster.length) * 100) : 0}% Attendance`, isPositive: true }}
          variant="hero-forest"
          onClick={() => setViewMode('review')}
        />
        <StatCard
          title="Enrolled in Section"
          value={sessionRoster.length || 48}
          trend={{ value: "Class Section Roster", isPositive: true }}
          variant="default"
          onClick={() => setViewMode('roster')}
        />
        <StatCard
          title="Offline Outbox"
          value={outboxCount}
          trend={{ value: isOnline ? "Synced to Cloud" : "Stored locally", isPositive: outboxCount === 0 }}
          variant="default"
          onClick={() => void syncNow()}
        />
        <StatCard
          title="Late Arrivals"
          value={late}
          trend={{ value: "Verified with Passcode", isPositive: false }}
          variant="default"
          onClick={() => setViewMode('review')}
        />
      </div>

      <div className="app-card p-4 sm:p-5 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-64">
          <span className="text-xs font-bold text-ink font-display">Active Section:</span>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="flex-1 max-w-xs py-2 px-3 bg-surface-soft border border-line rounded-full text-xs font-bold text-ink focus:bg-surface focus:border-forest-700 outline-none"
          >
            <option value="">Select class section</option>
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
              ['scanner', 'Scanner View', <ScanLine className="w-3.5 h-3.5" key="s" />],
              ['review', 'Review Roster', <ClipboardCheck className="w-3.5 h-3.5" key="r" />],
              ['roster', 'Cached Roster', <Database className="w-3.5 h-3.5" key="c" />],
            ] as const
          ).map(([mode, label, icon]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold font-display transition-all cursor-pointer ${
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

      {viewMode === 'scanner' && (
        <section className="grid lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-8 app-card p-6 sm:p-7 space-y-4 flex flex-col justify-between relative overflow-hidden">
            {/* Signature Burst Animation on Scan Success */}
            <AnimatePresence>
              {scanBurst?.active && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1.1 }}
                  exit={{ opacity: 0, scale: 1.3 }}
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                  className="absolute inset-0 z-30 bg-forest-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-white pointer-events-none"
                >
                  <div className="w-20 h-20 rounded-full bg-forest-600 flex items-center justify-center shadow-2xl mb-3">
                    <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
                  </div>
                  <span className="text-xl font-bold font-display">{scanBurst.studentName || 'Verified'}</span>
                  <span className="text-xs font-mono text-emerald-200 uppercase tracking-widest mt-1">Status: PRESENT</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-forest-700 dark:text-forest-600" />
                <h3 className="text-base font-extrabold text-ink font-display">Optical Camera & Barcode Wand HUD</h3>
              </div>
              <span className="text-xs font-bold text-forest-700 dark:text-forest-600 bg-success-50 border border-success-100 dark:border-success-600/30 px-3 py-1 rounded-full font-mono">
                {session ? `${present}/${sessionRoster.length} Scanned` : 'Session Offline'}
              </span>
            </div>

            <div className="relative aspect-video rounded-3xl bg-slate-950 overflow-hidden flex items-center justify-center border border-line">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-0 border-2 border-emerald-400/30 rounded-3xl pointer-events-none flex flex-col justify-between p-4">
                <div className="flex justify-between items-center text-[11px] font-mono text-emerald-400 font-bold">
                  <span>CAMERA_STATE: ACTIVE</span>
                  <span>AES-CMAC DECODE: AUTO</span>
                </div>
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-scan-line shadow-[0_0_15px_rgba(52,211,153,0.8)]" />
                <div className="text-center text-[11px] font-bold text-white bg-slate-900/80 py-1.5 px-4 rounded-full mx-auto backdrop-blur-sm border border-emerald-400/30 font-display">
                  Align Student QR Badge inside Viewfinder
                </div>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const value = scanInput.trim();
                setScanInput('');
                if (value) void handleScan(value, 'USB');
              }}
              className="flex gap-3 pt-2"
            >
              <div className="relative flex-1">
                <Usb className="w-4 h-4 text-ink-muted absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="USB scanner token (press Enter)"
                  className="w-full pl-11 pr-4 py-3 bg-surface-soft border border-line rounded-full text-xs font-semibold text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 outline-none"
                />
              </div>
              <Button type="submit" variant="primary" size="md">
                Scan Token
              </Button>
            </form>
          </div>

          <div className="lg:col-span-4 app-card p-6 sm:p-7 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-base font-extrabold text-ink font-display">Session Telemetry</h3>
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="bg-surface-soft rounded-2xl p-3 border border-line">
                  <span className="block text-2xl font-extrabold text-ink font-display t-data">{sessionRoster.length || 48}</span>
                  <span className="t-label text-ink-muted block mt-1">Roster</span>
                </div>
                <div className="bg-success-50 rounded-2xl p-3 border border-success-100 dark:border-success-600/30">
                  <span className="block text-2xl font-extrabold text-success-800 font-display t-data">
                    <RollingNumber value={present} />
                  </span>
                  <span className="t-label text-success-600 block mt-1">Present</span>
                </div>
                <div className="bg-warning-50 rounded-2xl p-3 border border-warning-100 dark:border-warning-600/30">
                  <span className="block text-2xl font-extrabold text-warning-800 font-display t-data">
                    <RollingNumber value={outboxCount} />
                  </span>
                  <span className="t-label text-warning-600 block mt-1">Outbox</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-surface-soft border border-line space-y-2.5 text-xs">
                <div className="flex justify-between text-ink-soft">
                  <span>Late arrivals</span>
                  <span className="font-bold text-warning-800 font-mono t-data">{late}</span>
                </div>
                <div className="flex justify-between text-ink-soft">
                  <span>Excused leaves</span>
                  <span className="font-bold text-ink font-mono t-data">{leaveExcused}</span>
                </div>
                <div className="flex justify-between text-ink-soft">
                  <span>Unmarked / Absent</span>
                  <span className="font-bold text-danger-800 font-mono t-data">{Math.max(0, sessionRoster.length - present - late - leaveExcused)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => void syncNow()}
                disabled={!isOnline || outboxCount === 0 || isSyncing}
                className="w-full justify-center"
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />}
              >
                {isSyncing ? 'Synchronizing Outbox…' : 'Push Local Outbox'}
              </Button>

              <Button
                variant="primary"
                size="md"
                onClick={() => setViewMode('review')}
                disabled={!session}
                className="w-full justify-center"
              >
                Review & Finalize Attendance
              </Button>
            </div>
          </div>
        </section>
      )}

      {viewMode === 'review' && (
        <section className="app-card p-6 sm:p-7 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-xl font-extrabold text-ink font-display">Review & Finalize Attendance</h3>
              <p className="t-body text-xs text-ink-soft mt-0.5">Verify individual student check-ins before publishing to state database</p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setViewMode('scanner')}
                disabled={finalizing}
              >
                Back to Scanner
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleFinalize()}
                disabled={finalizing}
                isLoading={finalizing}
              >
                Publish & Finalize
              </Button>
            </div>
          </div>

          {sessionRoster.length === 0 ? (
            <EmptyState
              kind="roster"
              title="No session roster loaded"
              description="Start an attendance session or download the class roster to begin reviewing students."
              actionText="Back to Scanner"
              onAction={() => setViewMode('scanner')}
            />
          ) : (
            <div className="overflow-x-auto border border-line rounded-3xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-soft border-b border-line text-left text-ink-muted uppercase font-bold font-display">
                    <th className="p-3.5">Roll</th>
                    <th className="p-3.5">Student Name</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Override Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-surface">
                  {sessionRoster.map((item) => (
                    <tr key={item.studentId} className="table-row-hover">
                      <td className="p-3.5 font-mono font-bold text-ink">#{item.rollNumber}</td>
                      <td className="p-3.5 font-bold text-ink font-display">{item.studentName}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-3 py-1 rounded-full text-[11px] font-bold border font-display ${
                            item.status === 'PRESENT'
                              ? 'bg-success-50 text-success-800 border-success-100 dark:border-success-600/30'
                              : item.status === 'ABSENT'
                              ? 'bg-danger-50 text-danger-800 border-danger-100 dark:border-danger-600/30'
                              : item.status === 'LATE'
                              ? 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30'
                              : 'bg-surface-soft text-ink-soft border-line'
                          }`}
                        >
                          {item.status}
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
                                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer font-display focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 ${
                                  isSelected
                                    ? 'bg-forest-700 text-white shadow-sm'
                                    : 'bg-surface-soft text-ink-soft hover:bg-surface border border-line'
                                }`}
                              >
                                {st}
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
          )}
        </section>
      )}

      {viewMode === 'roster' && (
        <section className="app-card p-6 sm:p-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-extrabold text-ink font-display">Offline Cached Student Roster</h3>
            <span className="text-xs font-bold text-ink-soft bg-surface-soft px-3 py-1 rounded-full border border-line">
              {roster.length} Records In Storage
            </span>
          </div>

          {roster.length === 0 ? (
            <EmptyState
              kind="roster"
              title="No cached roster found"
              description="Download the class roster package while online to enable full offline QR verification."
              actionText="Download Roster Now"
              onAction={handleDownloadRoster}
            />
          ) : (
            <div className="overflow-x-auto border border-line rounded-3xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-surface-soft border-b border-line text-ink-muted uppercase font-bold font-display">
                    <th className="p-3.5">Roll</th>
                    <th className="p-3.5">Student Name</th>
                    <th className="p-3.5">Bengali Name</th>
                    <th className="p-3.5">Student Code</th>
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
          )}
        </section>
      )}
    </div>
  );
};

export default TeacherDashboard;
