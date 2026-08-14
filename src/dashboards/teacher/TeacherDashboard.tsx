import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Camera, RefreshCw, Download, Usb, CheckCircle2 } from 'lucide-react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import { useOfflineStatus } from '../../app/OfflineStatusProvider';
import {
  createOfflineSession,
  downloadAndStoreRosterPackage,
  processOfflineQRCode,
  syncOutboxEvents,
} from '../../services/offlineSyncService';
import { offlineDb, OfflineRosterItem, OfflineSessionItem, OfflineSessionRosterItem } from '../../db/offlineDb';
import { estimateSmsSegments } from '../../services/sms/smsUtils';
import { api } from '../../services/api';

export const TeacherDashboard: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  const { isOnline, outboxCount, isSyncing, syncNow, refreshOutbox } = useOfflineStatus();

  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
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

  async function ensureDeviceRegistered() {
    if (!navigator.onLine || !activeSchoolId) return getDeviceIdentifier();
    const deviceIdentifier = getDeviceIdentifier();
    try {
      await api(`/api/v1/schools/${activeSchoolId}/devices/register`, {
        method: 'POST',
        body: JSON.stringify({ deviceIdentifier, deviceModel: navigator.userAgent.slice(0, 100) }),
      });
    } catch {
      // Offline fallback
    }
    return deviceIdentifier;
  }

  // Load classes
  useEffect(() => {
    async function loadClasses() {
      if (!activeSchoolId) return;
      try {
        const res = await api<{ success: boolean; data: any[] }>(`/api/v1/schools/${activeSchoolId}/attendance/classes`);
        setClasses(res.data || []);
        if (res.data?.[0]?.classSectionId) {
          const cachedClassId = localStorage.getItem('attendance.classSectionId') || res.data[0].classSectionId;
          setSelectedClassId(cachedClassId);
        }
      } catch {
        // Fallback: check cached classes in offlineDb
        const cachedRoster = await offlineDb.rosters.where('schoolId').equals(activeSchoolId).toArray();
        if (cachedRoster.length > 0) {
          const distinct = Array.from(new Set(cachedRoster.map((r) => r.classSectionId)));
          setClasses(distinct.map((id) => ({ classSectionId: id, className: 'Class', sectionName: 'Section' })));
          setSelectedClassId(distinct[0]);
        }
      }
    }
    void loadClasses();
  }, [activeSchoolId]);

  // Load cached roster and session
  useEffect(() => {
    async function loadClassData() {
      if (!activeSchoolId || !selectedClassId) return;
      localStorage.setItem('attendance.classSectionId', selectedClassId);
      const items = await offlineDb.rosters.where('classSectionId').equals(selectedClassId).toArray();
      setRoster(items);

      const todayStr = new Date().toISOString().slice(0, 10);
      const activeSession = await offlineDb.sessions
        .where('[classSectionId+sessionDate]')
        .equals([selectedClassId, todayStr])
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
    void loadClassData();
  }, [activeSchoolId, selectedClassId]);

  const handleDownloadRoster = async () => {
    if (!activeSchoolId || !selectedClassId) return;
    try {
      const deviceId = await ensureDeviceRegistered();
      const res = await downloadAndStoreRosterPackage(activeSchoolId, selectedClassId, deviceId);
      const items = await offlineDb.rosters.where('classSectionId').equals(selectedClassId).toArray();
      setRoster(items);
      showFeedback({
        kind: 'success',
        text: `Roster and active QR digests downloaded (${res.studentCount} students).`,
      });
    } catch (err: any) {
      showFeedback({ kind: 'error', text: err.message || 'Failed to download roster' });
    }
  };

  const handleStartSession = async () => {
    if (!activeSchoolId || !selectedClassId) return;
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const s = await createOfflineSession({
        schoolId: activeSchoolId,
        classSectionId: selectedClassId,
        teacherId: 'teacher',
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
    if (!activeSchoolId || !selectedClassId || !session) {
      showFeedback({ kind: 'error', text: 'Please start an offline session first' });
      return;
    }
    try {
      const result = await processOfflineQRCode({
        schoolId: activeSchoolId,
        sessionId: session.id,
        rawToken,
        actorId: 'teacher',
        source,
      });

      if (result.success && result.student) {
        showFeedback({ kind: 'success', text: `Recorded PRESENT for ${result.student.name} (Roll ${result.student.rollNumber})` });
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
    if (!session) return;
    await offlineDb.sessionRosters
      .where('[sessionId+studentId]')
      .equals([session.id, studentId])
      .modify({ status });
    const updated = await offlineDb.sessionRosters.where('sessionId').equals(session.id).toArray();
    setSessionRoster(updated);
  };

  const handleFinalize = async () => {
    if (!session || !activeSchoolId) return;
    setFinalizing(true);
    try {
      const deviceId = getDeviceIdentifier();
      await syncOutboxEvents({ schoolId: activeSchoolId, deviceIdentifier: deviceId });
      showFeedback({ kind: 'success', text: 'Attendance finalized and synchronized with backend.' });
      setViewMode('scanner');
    } catch (err: any) {
      showFeedback({ kind: 'error', text: err.message || 'Finalization failed' });
    } finally {
      setFinalizing(false);
    }
  };

  const present = sessionRoster.filter((item) => item.status === 'PRESENT').length;
  const late = sessionRoster.filter((item) => item.status === 'LATE').length;
  const absent = sessionRoster.filter((item) => item.status === 'ABSENT').length;
  const leaveExcused = sessionRoster.filter((item) => item.status === 'LEAVE' || item.status === 'EXCUSED').length;

  return (
    <div className="space-y-6" id="teacher-dashboard-view">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="bg-emerald-500/30 text-emerald-200 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-emerald-400/30">
              Offline QR Attendance
            </span>
            <h2 className="text-2xl sm:text-3xl font-black mt-2">Classroom Attendance Station</h2>
            <p className="text-xs text-emerald-200 mt-1">
              Offline IndexedDB optical scanning, instant USB wedge capture, and guaranteed reconciliation
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('scanner')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'scanner' ? 'bg-white text-emerald-950 shadow-md' : 'bg-emerald-800/60 text-emerald-100 hover:bg-emerald-800'
              }`}
            >
              📷 Scanner
            </button>
            <button
              onClick={() => setViewMode('review')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'review' ? 'bg-white text-emerald-950 shadow-md' : 'bg-emerald-800/60 text-emerald-100 hover:bg-emerald-800'
              }`}
            >
              📝 Review
            </button>
            <button
              onClick={() => setViewMode('roster')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'roster' ? 'bg-white text-emerald-950 shadow-md' : 'bg-emerald-800/60 text-emerald-100 hover:bg-emerald-800'
              }`}
            >
              📋 Roster
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`rounded-2xl p-4 font-bold text-xs shadow-sm ${
            feedback.kind === 'success'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : feedback.kind === 'warning'
              ? 'bg-amber-100 text-amber-800 border border-amber-200'
              : 'bg-rose-100 text-rose-800 border border-rose-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Class Section & Roster Controls */}
      <section className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-wrap gap-3 items-end">
        <label className="text-xs font-bold text-slate-700">
          Assigned class
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="block mt-1 border border-slate-300 rounded-xl p-2.5 min-w-64 text-xs font-semibold text-slate-800"
          >
            <option value="">Select class</option>
            {classes.map((item) => (
              <option key={item.classSectionId} value={item.classSectionId}>
                {item.className} - {item.sectionName}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={handleDownloadRoster}
          disabled={!isOnline || !selectedClassId}
          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-colors"
        >
          <Download className="inline w-3.5 h-3.5 mr-1" />
          Download roster
        </button>
        <button
          onClick={handleStartSession}
          disabled={!selectedClassId || (!!session && session.status !== 'FINALIZED')}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-colors"
        >
          {session ? 'Session open' : 'Start offline session'}
        </button>
      </section>

      {/* Mode Views */}
      {viewMode === 'scanner' && (
        <section className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-slate-900 rounded-3xl p-6 text-white space-y-4 shadow-md">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black">Live Optical & USB Scanner</h3>
              <span className="text-xs font-bold text-emerald-400">
                {session ? `${present}/${sessionRoster.length} Marked Present` : 'No Active Session'}
              </span>
            </div>
            <video ref={videoRef} className="w-full aspect-video rounded-2xl bg-slate-800 object-cover" muted playsInline />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const value = scanInput.trim();
                setScanInput('');
                if (value) void handleScan(value, 'USB');
              }}
              className="flex gap-2"
            >
              <Usb className="w-5 mt-2.5 text-slate-400" />
              <input
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="Scan student QR token via USB wedge (or press Enter)…"
                className="flex-1 rounded-xl bg-slate-800 border border-slate-700 p-3 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <button className="px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-bold text-xs shadow-md transition-colors">
                Scan
              </button>
            </form>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-sm font-black text-slate-900">Session Attendance Counter</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 rounded-xl p-3">
                <b className="block text-xl">{sessionRoster.length}</b>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Roster</span>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3">
                <b className="block text-xl text-emerald-700">{present}</b>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Present</span>
              </div>
              <div className="bg-amber-50 rounded-xl p-3">
                <b className="block text-xl text-amber-700">{outboxCount}</b>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Queued</span>
              </div>
            </div>
            <button
              onClick={() => void syncNow()}
              disabled={!isOnline || outboxCount === 0 || isSyncing}
              className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white p-3 font-bold text-xs shadow-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`inline w-3.5 h-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Synchronizing…' : 'Synchronize now'}
            </button>
            <button
              onClick={() => setViewMode('review')}
              disabled={!session}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white p-3 font-bold text-xs shadow-sm transition-colors disabled:opacity-50"
            >
              Review attendance
            </button>
          </div>
        </section>
      )}

      {viewMode === 'review' && (
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-5">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-black text-slate-900">Review & Finalize Attendance</h3>
              <p className="text-xs text-slate-500 font-medium">Verify status for every student before submitting</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-slate-500 uppercase font-bold">
                  <th className="p-2.5">Roll</th>
                  <th className="p-2.5">Student Name</th>
                  <th className="p-2.5">Current Status</th>
                  <th className="p-2.5">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessionRoster.map((item) => (
                  <tr key={item.studentId}>
                    <td className="p-2.5 font-bold">{item.rollNumber}</td>
                    <td className="p-2.5 font-bold text-slate-900">{item.studentName}</td>
                    <td className="p-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'PRESENT'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'ABSENT'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="p-2.5 flex gap-1">
                      {(['PRESENT', 'ABSENT', 'LATE', 'LEAVE'] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => void handleManualStatus(item.studentId, st)}
                          className={`px-2 py-1 rounded text-[10px] font-bold ${
                            item.status === st ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setViewMode('scanner')}
              disabled={finalizing}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200"
            >
              Back to Scanner
            </button>
            <button
              onClick={() => void handleFinalize()}
              disabled={finalizing}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-colors"
            >
              {finalizing ? 'Finalizing…' : 'Confirm & finalize'}
            </button>
          </div>
        </section>
      )}

      {viewMode === 'roster' && (
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
          <h3 className="text-lg font-black text-slate-900">Cached Student Roster</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b text-slate-500 uppercase font-bold">
                  <th className="p-2.5">Roll</th>
                  <th className="p-2.5">Student Name</th>
                  <th className="p-2.5">Bengali Name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roster.map((s) => (
                  <tr key={s.studentId}>
                    <td className="p-2.5 font-bold">{s.rollNumber}</td>
                    <td className="p-2.5 font-bold text-slate-900">{s.name}</td>
                    <td className="p-2.5 text-slate-500">{s.nameBn || '—'}</td>
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
