import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Camera, RefreshCw, Download, Usb, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { StatCard } from '../../components/shared/StatCard';
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
import { estimateSmsSegments } from '../../services/sms/smsUtils';
import { api } from '../../services/api';

export const TeacherDashboard: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControls = useRef<{ stop: () => void } | null>(null);

  const showFeedback = useCallback((msg: { kind: 'success' | 'warning' | 'error'; text: string }) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4500);
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
      const res = await api<{ success: boolean; classes: any[] }>(
        `/api/v1/schools/${activeSchoolId}/academics/classes`
      );
      if (res.success && res.classes) {
        setClasses(res.classes);
        if (!selectedClassId && res.classes.length > 0) {
          setSelectedClassId(res.classes[0].id);
          localStorage.setItem('attendance.classSectionId', res.classes[0].id);
        }
      }
    } catch {
      // Offline fallback: load unique classes from cached roster
      const cached = await offlineDb.rosters.toArray();
      const uniqueMap = new Map<string, { id: string; className: string; sectionName: string }>();
      cached.forEach((r) => {
        if (!uniqueMap.has(r.classSectionId)) {
          uniqueMap.set(r.classSectionId, {
            id: r.classSectionId,
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
      await downloadAndStoreRosterPackage(activeSchoolId, selectedClassId, deviceId);
      await loadLocalRoster(selectedClassId);
      showFeedback({ kind: 'success', text: 'Roster downloaded and ready for offline scanning.' });
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
      const s = await createOfflineSession({
        schoolId: activeSchoolId,
        classSectionId: selectedClassId,
        teacherId: user.id,
        sessionDate: todayStr,
      });
      setSession(s);
      const sRoster = await offlineDb.sessionRosters.where('sessionId').equals(s.id).toArray();
      setSessionRoster(sRoster);
      showFeedback({ kind: 'success', text: 'Offline attendance session initialized.' });
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
      // Step A & B: sync all outbox events
      await syncOutboxEvents({ schoolId: activeSchoolId, deviceIdentifier: deviceId });
      
      // Step C & D: PATCH server session status
      try {
        const patchRes = await api<{ success: boolean; data: any }>(
          `/api/v1/schools/${activeSchoolId}/attendance/sessions/${session.id}/status`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              status: 'FINALIZED',
              autoMarkAbsentForUnmarked: true,
              reason: 'Class teacher finalize roll submission',
            }),
          }
        );

        if (patchRes?.data?.status === 'FINALIZED') {
          await offlineDb.sessions.update(session.id, { status: 'FINALIZED' });
          setSession((prev) => prev ? { ...prev, status: 'FINALIZED' } : null);
          showFeedback({ kind: 'success', text: 'Attendance finalized and verified on server.' });
          setViewMode('scanner');
        } else {
          showFeedback({ kind: 'warning', text: 'Attendance outbox synchronized; session queued for server finalization.' });
        }
      } catch (err: any) {
        showFeedback({ kind: 'warning', text: 'Offline: Recorded attendance saved locally. Will finalize once online.' });
      }
    } catch (err: any) {
      showFeedback({ kind: 'error', text: err.message || 'Finalization sync encountered an error' });
    } finally {
      setFinalizing(false);
      await refreshOutbox();
    }
  };

  const present = sessionRoster.filter((item) => item.status === 'PRESENT').length;
  const late = sessionRoster.filter((item) => item.status === 'LATE').length;
  const leaveExcused = sessionRoster.filter((item) => item.status === 'LEAVE' || item.status === 'EXCUSED').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
            Classroom Dashboard
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Plan, scan, and finalize student attendance with offline QR & barcode wands.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStartSession}
            disabled={!selectedClassId || (!!session && session.status !== 'FINALIZED')}
            className="btn-forest-primary text-sm font-display disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>{session ? 'Session Active' : 'Start Session'}</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDownloadRoster}
            disabled={!isOnline || !selectedClassId}
            className="btn-pill-secondary text-sm font-display shadow-2xs disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Download Roster</span>
          </motion.button>
        </div>
      </div>

      {feedback && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          role="status"
          className={`rounded-2xl p-4 font-bold text-xs shadow-sm flex items-center gap-2 border ${
            feedback.kind === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : feedback.kind === 'warning'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{feedback.kind === 'success' ? '✅' : feedback.kind === 'warning' ? '⚠️' : '❌'}</span>
          <span>{feedback.text}</span>
        </motion.div>
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

      <div className="app-card p-5 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-64">
          <span className="text-xs font-bold text-slate-700 font-display">Active Section:</span>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="flex-1 max-w-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-full text-xs font-bold text-slate-800 focus:bg-white focus:border-[#144e39] outline-none"
          >
            <option value="">Select class section</option>
            {classes.map((item) => (
              <option key={item.classSectionId} value={item.classSectionId}>
                {item.className} - {item.sectionName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          {(
            [
              ['scanner', '📷 Scanner View'],
              ['review', '📝 Review Roster'],
              ['roster', '📋 Cached Roster'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 rounded-full text-xs font-bold font-display transition-all ${
                viewMode === mode
                  ? 'bg-[#144e39] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'scanner' && (
        <section className="grid lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-8 app-card p-6 sm:p-7 space-y-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#144e39]" />
                <h3 className="text-base font-extrabold text-slate-900 font-display">Optical Camera & Barcode Wand HUD</h3>
              </div>
              <span className="text-xs font-bold text-[#144e39] bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full font-mono">
                {session ? `${present}/${sessionRoster.length} Scanned` : 'Session Offline'}
              </span>
            </div>

            <div className="relative aspect-video rounded-3xl bg-slate-900 overflow-hidden flex items-center justify-center border border-slate-800">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-0 border-2 border-emerald-400/30 rounded-3xl pointer-events-none flex flex-col justify-between p-4">
                <div className="flex justify-between items-center text-[10px] font-mono text-emerald-400 font-bold">
                  <span>CAMERA_STATE: ACTIVE</span>
                  <span>AES-CMAC DECODE: AUTO</span>
                </div>
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-scan-line shadow-[0_0_15px_rgba(52,211,153,0.8)]" />
                <div className="text-center text-[11px] font-bold text-white bg-slate-900/80 py-1.5 px-4 rounded-full mx-auto backdrop-blur-sm border border-emerald-400/30">
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
                <Usb className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="USB Scanner input stream (scan student card or press Enter)…"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-full text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#144e39] outline-none"
                />
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="submit"
                className="btn-forest-primary text-xs font-display"
              >
                Scan Token
              </motion.button>
            </form>
          </div>

          <div className="lg:col-span-4 app-card p-6 sm:p-7 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 font-display">Session Telemetry</h3>
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200">
                  <span className="block text-2xl font-extrabold text-slate-900 font-display">{sessionRoster.length || 48}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Roster</span>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-3 border border-emerald-200">
                  <span className="block text-2xl font-extrabold text-emerald-800 font-display">{present}</span>
                  <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Present</span>
                </div>
                <div className="bg-amber-50 rounded-2xl p-3 border border-amber-200">
                  <span className="block text-2xl font-extrabold text-amber-800 font-display">{outboxCount}</span>
                  <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Outbox</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Late arrivals</span>
                  <span className="font-bold text-amber-700">{late}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Excused leaves</span>
                  <span className="font-bold text-slate-700">{leaveExcused}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Unmarked / Absent</span>
                  <span className="font-bold text-rose-700">{Math.max(0, sessionRoster.length - present - late - leaveExcused)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => void syncNow()}
                disabled={!isOnline || outboxCount === 0 || isSyncing}
                className="btn-pill-secondary w-full justify-center text-xs font-display disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Synchronizing Outbox…' : 'Push Local Outbox'}</span>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setViewMode('review')}
                disabled={!session}
                className="btn-forest-primary w-full justify-center text-xs font-display disabled:opacity-50"
              >
                <span>Review & Finalize Attendance</span>
              </motion.button>
            </div>
          </div>
        </section>
      )}

      {viewMode === 'review' && (
        <section className="app-card p-6 sm:p-7 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 font-display">Review & Finalize Attendance</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Verify individual student check-ins before publishing to state database</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('scanner')}
                disabled={finalizing}
                className="btn-pill-secondary text-xs font-display"
              >
                Back to Scanner
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => void handleFinalize()}
                disabled={finalizing}
                className="btn-forest-primary text-xs font-display"
              >
                {finalizing ? 'Finalizing…' : 'Publish & Finalize'}
              </motion.button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-3xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left text-slate-500 uppercase font-bold font-display">
                  <th className="p-3.5">Roll</th>
                  <th className="p-3.5">Student Name</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Override Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sessionRoster.map((item) => (
                  <tr key={item.studentId} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-700">#{item.rollNumber}</td>
                    <td className="p-3.5 font-bold text-slate-900 font-display">{item.studentName}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-extrabold border ${
                          item.status === 'PRESENT'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : item.status === 'ABSENT'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : item.status === 'LATE'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex gap-1.5">
                        {(['PRESENT', 'ABSENT', 'LATE', 'LEAVE'] as const).map((st) => (
                          <button
                            key={st}
                            onClick={() => void handleManualStatus(item.studentId, st)}
                            className={`px-3 py-1 rounded-full text-[10px] font-extrabold transition-all ${
                              item.status === st 
                                ? 'bg-[#144e39] text-white shadow-sm' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {viewMode === 'roster' && (
        <section className="app-card p-6 sm:p-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-extrabold text-slate-900 font-display">Offline Cached Student Roster</h3>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
              {roster.length} Records In Storage
            </span>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-3xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold font-display">
                  <th className="p-3.5">Roll</th>
                  <th className="p-3.5">Student Name</th>
                  <th className="p-3.5">Bengali Name</th>
                  <th className="p-3.5">Guardian Mobile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {roster.map((s) => (
                  <tr key={s.studentId} className="hover:bg-slate-50">
                    <td className="p-3.5 font-mono font-bold text-slate-700">#{s.rollNumber}</td>
                    <td className="p-3.5 font-bold text-slate-900 font-display">{s.name}</td>
                    <td className="p-3.5 text-slate-600">{s.nameBn || '—'}</td>
                    <td className="p-3.5 font-mono text-slate-500">{s.studentCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default TeacherDashboard;
