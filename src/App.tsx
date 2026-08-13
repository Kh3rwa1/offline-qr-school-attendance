import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Camera, CheckCircle2, CloudOff, Download, LogIn, LogOut, RefreshCw, ShieldAlert, Usb, Wifi } from 'lucide-react';
import {
  createOfflineSession,
  clearSchoolScopedOfflineData,
  downloadAndStoreRosterPackage,
  getOutboxStatus,
  processOfflineQRCode,
  syncOutboxEvents,
} from './services/offlineSyncService';
import { offlineDb, OfflineRosterItem, OfflineSessionItem, OfflineSessionRosterItem } from './db/offlineDb';
import { estimateSmsSegments } from './services/sms/smsUtils';
import { api, ApiError } from './services/api';

import RfidDashboard from './components/rfid/RfidDashboard';
import CardEnrollmentWizard from './components/rfid/CardEnrollmentWizard';
import ReaderManagement from './components/rfid/ReaderManagement';
import CardStatusPanel from './components/rfid/CardStatusPanel';
import BulkEnrollment from './components/rfid/BulkEnrollment';
import OfflineQueueIndicator from './components/rfid/OfflineQueueIndicator';
import RfidReports from './components/rfid/RfidReports';
import ScanResultDisplay from './components/rfid/ScanResultDisplay';

type User = { id: string; fullName: string; phoneNumber: string };
type Membership = { schoolId: string; schoolName: string; role: string; status: string };
type AuthState = { user: User; memberships: Membership[]; schoolId: string; cachedAt: number; expiresAt: number };
type AssignedClass = { classSectionId: string; className: string; sectionName: string; academicYearId: string };
type Feedback = { kind: 'success' | 'warning' | 'error'; text: string };
const AUTH_CACHE_TTL_MS = 8 * 60 * 60 * 1000;

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [loginForm, setLoginForm] = useState({ phoneNumber: '', password: '' });
  const [busy, setBusy] = useState(true);
  const [loginBusy, setLoginBusy] = useState(false);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [classes, setClasses] = useState<AssignedClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [roster, setRoster] = useState<OfflineRosterItem[]>([]);
  const [session, setSession] = useState<OfflineSessionItem | null>(null);
  const [sessionRoster, setSessionRoster] = useState<OfflineSessionRosterItem[]>([]);
  const [outboxCount, setOutboxCount] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [activeView, setActiveView] = useState<'scanner' | 'roster' | 'review' | 'reports' | 'admin' | 'rfid'>('scanner');
  const [rfidSubView, setRfidSubView] = useState<'dashboard' | 'cards' | 'readers' | 'reports' | 'enroll' | 'bulk'>('dashboard');
  const [scanInput, setScanInput] = useState('');
  const [report, setReport] = useState<any>(null);
  const [finalizing, setFinalizing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControls = useRef<{ stop: () => void } | null>(null);
  const wedgeBuffer = useRef('');

  function getDeviceIdentifier() {
    const existing = localStorage.getItem('attendance.deviceIdentifier');
    if (existing) return existing;
    const created = `browser-${globalThis.crypto.randomUUID()}`;
    localStorage.setItem('attendance.deviceIdentifier', created);
    return created;
  }

  async function ensureDeviceRegistered(state: AuthState) {
    if (!navigator.onLine) throw new Error('DEVICE_REGISTRATION_REQUIRES_NETWORK');
    const deviceIdentifier = getDeviceIdentifier();
    await api(`/api/v1/schools/${state.schoolId}/devices/register`, {
      method: 'POST',
      body: JSON.stringify({ deviceIdentifier, deviceModel: navigator.userAgent.slice(0, 100) }),
    });
    return deviceIdentifier;
  }

  const showFeedback = useCallback((next: Feedback) => {
    setFeedback(next);
    window.setTimeout(() => setFeedback(null), 4500);
  }, []);

  const refreshLocalState = useCallback(async (currentSessionId?: string) => {
    const status = await getOutboxStatus();
    setOutboxCount(status.unsyncedTotal);
    const target = currentSessionId || session?.id;
    if (target) {
      const [localSession, localRoster] = await Promise.all([
        offlineDb.sessions.get(target),
        offlineDb.sessionRosters.where('sessionId').equals(target).toArray(),
      ]);
      if (localSession) setSession(localSession);
      setSessionRoster(localRoster.sort((a, b) => a.rollNumber - b.rollNumber));
    }
  }, [session?.id]);

  const loadClasses = useCallback(async (state: AuthState) => {
    const response = await api<{ data: AssignedClass[] }>(`/api/v1/schools/${state.schoolId}/attendance/classes`);
    setClasses(response.data || []);
    if (!selectedClassId && response.data?.[0]) setSelectedClassId(response.data[0].classSectionId);
  }, [selectedClassId]);

  const restoreSession = useCallback(async () => {
    try {
      const response = await api<{ user: User; sessionContext: { schoolId?: string; memberships: Membership[]; activeMembership?: Membership } }>('/api/v1/auth/me');
      const schoolId = response.sessionContext.schoolId || response.sessionContext.activeMembership?.schoolId || response.sessionContext.memberships?.[0]?.schoolId;
      if (!schoolId) throw new Error('NO_ACTIVE_SCHOOL');
      if (localStorage.getItem('attendance.loggedOut') === 'true') throw new Error('LOGGED_OUT');
      const now = Date.now();
      const next = { user: response.user, memberships: response.sessionContext.memberships || [], schoolId, cachedAt: now, expiresAt: now + AUTH_CACHE_TTL_MS };
      setAuth(next);
      localStorage.setItem('attendance.auth', JSON.stringify(next));
      if (navigator.onLine) await ensureDeviceRegistered(next);
      await loadClasses(next);
    } catch (err: any) {
      // Only client-side network failure (status === 0) activates cached offline auth.
      // Explicit server rejections (401/403) or 5xx errors force clean sign-in.
      const networkUnavailable = err instanceof ApiError && err.status === 0 && err.code === 'NETWORK_UNAVAILABLE';
      const cached = networkUnavailable && localStorage.getItem('attendance.loggedOut') !== 'true' ? localStorage.getItem('attendance.auth') : null;
      if (cached) {
        let next: AuthState | null = null;
        try { next = JSON.parse(cached) as AuthState; } catch { localStorage.removeItem('attendance.auth'); }
        if (!next || !next.expiresAt || next.expiresAt <= Date.now()) {
          localStorage.removeItem('attendance.auth');
          setAuth(null);
          setError('Cached sign-in expired. Connect to the network and sign in again.');
        } else {
          setAuth(next);
          const cachedClassId = localStorage.getItem('attendance.classSectionId') || '';
          setSelectedClassId(cachedClassId);
          setClasses(cachedClassId ? [{ classSectionId: cachedClassId, className: 'Cached class', sectionName: '', academicYearId: '' }] : []);
        }
      } else {
        localStorage.removeItem('attendance.auth');
        setAuth(null);
      }
    } finally {
      setBusy(false);
    }
  }, [loadClasses]);

  useEffect(() => { void restoreSession(); }, [restoreSession]);

  useEffect(() => {
    const goOnline = () => { setOnline(true); void restoreSession(); };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [restoreSession]);

  useEffect(() => {
    if (!auth || !selectedClassId) return;
    localStorage.setItem('attendance.classSectionId', selectedClassId);
    void offlineDb.rosters.where('[schoolId+classSectionId]').equals([auth.schoolId, selectedClassId]).toArray().then(setRoster);
    void offlineDb.sessions.where('[schoolId+classSectionId]').equals([auth.schoolId, selectedClassId]).toArray().then((items) => {
      const latest = items.filter((item) => item.status !== 'FINALIZED').sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))[0];
      if (latest) {
        setSession(latest);
        void refreshLocalState(latest.id);
      }
    });
  }, [auth, selectedClassId, refreshLocalState]);

  useEffect(() => {
    if (online && auth && outboxCount > 0) void handleSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, auth?.schoolId]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (event.key === 'Enter') {
        const token = wedgeBuffer.current.trim();
        wedgeBuffer.current = '';
        if (token) void handleScan(token, 'USB');
        return;
      }
      if (event.key.length === 1) wedgeBuffer.current += event.key;
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  useEffect(() => {
    if (!session || activeView !== 'scanner' || !videoRef.current) return;
    const reader = new BrowserMultiFormatReader();
    let stopped = false;
    reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
      if (!stopped && result?.getText()) void handleScan(result.getText(), 'CAMERA');
    }).then((controls) => {
      if (stopped) controls.stop();
      else scannerControls.current = controls;
    }).catch(() => undefined);
    return () => {
      stopped = true;
      scannerControls.current?.stop();
      scannerControls.current = null;
    };
    // Scanner lifecycle follows the active session/view/network.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, activeView, online]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoginBusy(true); setError('');
    try {
      await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(loginForm) });
      localStorage.removeItem('attendance.loggedOut');
      await restoreSession();
    } catch (err: any) { setError(err.message); }
    finally { setLoginBusy(false); }
  }

  async function handleLogout() {
    if (!auth) return;
    const schoolEvents = await offlineDb.syncOutbox.where('schoolId').equals(auth.schoolId).toArray();
    if (schoolEvents.some((event) => event.syncStatus !== 'SYNCED') && !window.confirm('Unsynchronized attendance events will be deleted from this device. Sign out anyway?')) return;
    scannerControls.current?.stop();
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    await api('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
    await clearSchoolScopedOfflineData(auth.schoolId);
    localStorage.removeItem('attendance.auth');
    localStorage.removeItem('attendance.classSectionId');
    localStorage.removeItem('attendance.deviceIdentifier');
    localStorage.setItem('attendance.loggedOut', 'true');
    setAuth(null); setSession(null); setSessionRoster([]); setRoster([]);
  }

  async function handleDownloadRoster() {
    if (!auth || !selectedClassId || !online) return showFeedback({ kind: 'warning', text: 'Connect to the network to download the latest roster.' });
    setBusy(true);
    try {
      const deviceIdentifier = await ensureDeviceRegistered(auth);
      await downloadAndStoreRosterPackage(auth.schoolId, selectedClassId, deviceIdentifier);
      setRoster(await offlineDb.rosters.where('[schoolId+classSectionId]').equals([auth.schoolId, selectedClassId]).toArray());
      showFeedback({ kind: 'success', text: 'Roster and active QR digests are stored on this device.' });
    } catch (err: any) { showFeedback({ kind: 'error', text: err.message }); }
    finally { setBusy(false); }
  }

  async function handleCreateSession() {
    if (!auth || !selectedClassId) return;
    if (roster.length === 0) return showFeedback({ kind: 'warning', text: 'Download the assigned class roster before starting attendance.' });
    try {
      const next = await createOfflineSession({ schoolId: auth.schoolId, classSectionId: selectedClassId, teacherId: auth.user.id, sessionDate: today() });
      setSession(next);
      await refreshLocalState(next.id);
      showFeedback({ kind: 'success', text: `Offline session ${next.clientSessionId} is ready. Scans will be queued in IndexedDB.` });
    } catch (err: any) { showFeedback({ kind: 'error', text: err.message }); }
  }

  async function handleScan(rawToken: string, source: 'CAMERA' | 'USB') {
    if (!session || !auth || session.status === 'FINALIZED') return;
    try {
      const result = await processOfflineQRCode({ schoolId: auth.schoolId, sessionId: session.id, rawToken, actorId: auth.user.id, source });
      if (!result.success) return showFeedback({ kind: 'error', text: result.message || result.error || 'Scan rejected.' });
      await refreshLocalState(session.id);
      if (result.duplicateScan) showFeedback({ kind: 'warning', text: result.message || 'Duplicate scan.' });
      else showFeedback({ kind: 'success', text: `${result.student?.name || 'Student'} marked PRESENT.` });
    } catch (err: any) { showFeedback({ kind: 'error', text: err.message }); }
  }

  async function handleSync() {
    if (!auth || !online) return showFeedback({ kind: 'warning', text: 'Offline: scans remain safely queued on this device.' });
    try {
      const deviceIdentifier = await ensureDeviceRegistered(auth);
      const result: any = await syncOutboxEvents({ schoolId: auth.schoolId, deviceIdentifier });
      for (const mapping of result.sessionMappings || []) {
        await offlineDb.sessions.update(mapping.clientSessionId, { serverSessionId: mapping.serverSessionId });
      }
      await refreshLocalState();
      showFeedback({ kind: 'success', text: `${result.syncedCount} queued scan(s) synchronized.` });
    } catch (err: any) { showFeedback({ kind: 'error', text: `Synchronization failed: ${err.message}` }); }
  }

  async function handleManualStatus(studentId: string, status: 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE' | 'EXCUSED') {
    if (!auth || !session?.serverSessionId || !online) return showFeedback({ kind: 'warning', text: 'Synchronize the session before making review changes.' });
    try {
      await api(`/api/v1/schools/${auth.schoolId}/attendance/sessions/${session.serverSessionId}/manual`, {
        method: 'POST',
        body: JSON.stringify({ studentId, newStatus: status, reason: 'Teacher attendance review' }),
      });
      const item = sessionRoster.find((entry) => entry.studentId === studentId);
      if (item?.id) await offlineDb.sessionRosters.update(item.id, { status });
      await refreshLocalState(session.id);
    } catch (err: any) { showFeedback({ kind: 'error', text: err.message }); }
  }

  function openReview() {
    if (!session?.serverSessionId || !online) return showFeedback({ kind: 'warning', text: 'Synchronize this session before reviewing it.' });
    setActiveView('review');
  }

  async function handleFinalize() {
    if (finalizing) return;
    if (!auth || !session?.serverSessionId || !online) return showFeedback({ kind: 'warning', text: 'Synchronize this session before finalizing it.' });
    const expectedSmsCount = sessionRoster.filter((item) => item.status === 'ABSENT' || item.status === 'UNMARKED').length;
    if (!window.confirm(`Finalize attendance? ${expectedSmsCount} absence SMS job(s) will be queued.`)) return;
    setFinalizing(true);
    try {
      await api(`/api/v1/schools/${auth.schoolId}/attendance/sessions/${session.serverSessionId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'FINALIZED', autoMarkAbsentForUnmarked: true }) });
      await offlineDb.sessions.update(session.id, { status: 'FINALIZED' });
      await refreshLocalState(session.id);
      setActiveView('scanner');
      showFeedback({ kind: 'success', text: 'Attendance finalized. Unmarked students were recorded absent and notification jobs were queued.' });
    } catch (err: any) { showFeedback({ kind: 'error', text: err.message }); }
    finally { setFinalizing(false); }
  }

  async function loadReport() {
    if (!auth || !selectedClassId) return;
    try {
      const response = await api<any>(`/api/v1/schools/${auth.schoolId}/reports/daily-class?classSectionId=${selectedClassId}&date=${today()}`);
      setReport(response);
    } catch (err: any) { showFeedback({ kind: 'error', text: err.message }); }
  }

  async function reissueQr(studentId: string) {
    if (!auth) return;
    try {
      await api(`/api/v1/schools/${auth.schoolId}/qr/reissue`, { method: 'POST', body: JSON.stringify({ studentId }) });
      showFeedback({ kind: 'success', text: 'Previous credential revoked and a new QR credential issued.' });
    } catch (err: any) { showFeedback({ kind: 'error', text: err.message }); }
  }

  if (busy && !auth) return <main className="min-h-screen grid place-items-center bg-slate-100">Loading secure attendance workspace…</main>;
  if (!auth) return (
    <main className="min-h-screen bg-slate-100 grid place-items-center p-4">
      <form onSubmit={handleLogin} className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md space-y-5">
        <header><h1 className="text-2xl font-black text-slate-800">Offline QR Attendance</h1><p className="text-sm text-slate-500">Teacher sign-in</p></header>
        {error && <p role="alert" className="bg-rose-50 text-rose-700 rounded-xl p-3 text-sm">{error}</p>}
        <input aria-label="Phone number" required value={loginForm.phoneNumber} onChange={(e) => setLoginForm({ ...loginForm, phoneNumber: e.target.value })} placeholder="Phone number" className="w-full border rounded-xl p-3" />
        <input aria-label="Password" required type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} placeholder="Password" className="w-full border rounded-xl p-3" />
        <button disabled={loginBusy} className="w-full rounded-xl bg-blue-600 text-white p-3 font-bold flex gap-2 justify-center"><LogIn className="w-4" />{loginBusy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );

  const selectedClass = classes.find((item) => item.classSectionId === selectedClassId);
  const present = sessionRoster.filter((item) => item.status === 'PRESENT').length;
  const late = sessionRoster.filter((item) => item.status === 'LATE').length;
  const absent = sessionRoster.filter((item) => item.status === 'ABSENT').length;
  const leaveExcused = sessionRoster.filter((item) => item.status === 'LEAVE' || item.status === 'EXCUSED').length;
  const expectedSmsSegments = sessionRoster.filter((item) => item.status === 'ABSENT' || item.status === 'UNMARKED')
    .reduce((total) => total + estimateSmsSegments('absence').segmentCount, 0);
  
  const activeMembership = auth.memberships.find((m) => m.schoolId === auth.schoolId);
  const admin = activeMembership?.role === 'SCHOOL_ADMIN' || activeMembership?.role === 'SUPER_ADMIN';
  const rfidAdmin = admin || activeMembership?.role === 'RFID_OPERATOR';

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <header className="bg-white rounded-3xl p-5 shadow-sm flex flex-wrap gap-4 items-center justify-between">
          <div><h1 className="text-xl font-black text-slate-800">Offline QR Attendance</h1><p className="text-sm text-slate-500">{auth.memberships.find((m) => m.schoolId === auth.schoolId)?.schoolName || 'School'} · {auth.user.fullName}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <OfflineQueueIndicator online={online} depth={outboxCount} lastSync={new Date()} age={0} />
            <button onClick={handleLogout} className="px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold"><LogOut className="inline w-4 mr-1" />Sign out</button>
          </div>
          <nav className="w-full flex flex-wrap gap-2 border-t pt-3">
            <button onClick={() => setActiveView('scanner')} className={`px-3 py-2 rounded-lg text-sm font-bold ${activeView === 'scanner' ? 'bg-blue-50 text-blue-700' : ''}`}>Scanner</button>
            <button onClick={() => setActiveView('roster')} className={`px-3 py-2 rounded-lg text-sm font-bold ${activeView === 'roster' ? 'bg-blue-50 text-blue-700' : ''}`}>Roster</button>
            <button onClick={() => { setActiveView('reports'); void loadReport(); }} className={`px-3 py-2 rounded-lg text-sm font-bold ${activeView === 'reports' ? 'bg-blue-50 text-blue-700' : ''}`}>Reports</button>
            {admin && <button onClick={() => setActiveView('admin')} className={`px-3 py-2 rounded-lg text-sm font-bold ${activeView === 'admin' ? 'bg-blue-50 text-blue-700' : ''}`}>Admin</button>}
            {rfidAdmin && <button onClick={() => setActiveView('rfid')} className={`px-3 py-2 rounded-lg text-sm font-bold ${activeView === 'rfid' ? 'bg-blue-50 text-blue-700' : ''}`}>RFID</button>}
            <span className="ml-auto text-sm text-slate-500 self-center">{outboxCount} unsynced</span>
          </nav>
        </header>

        {feedback && <div role="status" className={`rounded-2xl p-4 font-bold ${feedback.kind === 'success' ? 'bg-emerald-100 text-emerald-800' : feedback.kind === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>{feedback.text}</div>}

        <section className="bg-white rounded-3xl p-5 shadow-sm flex flex-wrap gap-3 items-end">
          <label className="text-sm font-bold text-slate-600">Assigned class<select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="block mt-1 border rounded-xl p-2 min-w-64"><option value="">Select class</option>{classes.map((item) => <option key={item.classSectionId} value={item.classSectionId}>{item.className} - {item.sectionName}</option>)}</select></label>
          <button onClick={handleDownloadRoster} disabled={!online || !selectedClassId} className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-sm"><Download className="inline w-4 mr-1" />Download roster</button>
          <button onClick={handleCreateSession} disabled={!selectedClassId || !!session && session.status !== 'FINALIZED'} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm">{session ? 'Session open' : 'Start offline session'}</button>
          {selectedClass && <span className="text-sm text-slate-500">{selectedClass.className}-{selectedClass.sectionName} · {roster.length} cached students</span>}
        </section>

        {activeView === 'scanner' && <section className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-slate-900 rounded-3xl p-5 text-white space-y-4"><div className="flex items-center justify-between"><h2 className="text-xl font-black">Live scanner</h2><span className="text-sm text-slate-300">{session ? `${present}/${sessionRoster.length} present` : 'No session'}</span></div><video ref={videoRef} className="w-full aspect-video rounded-2xl bg-slate-800 object-cover" muted playsInline /><div className="flex gap-2 items-center text-sm text-slate-300"><Camera className="w-4" />Camera decoding remains active offline.</div><form onSubmit={(e) => { e.preventDefault(); const value = scanInput.trim(); setScanInput(''); if (value) void handleScan(value, 'USB'); }} className="flex gap-2"><Usb className="w-5 mt-3" /><input value={scanInput} onChange={(e) => setScanInput(e.target.value)} placeholder="USB scanner token (press Enter)" className="flex-1 rounded-xl bg-slate-800 border border-slate-700 p-3 text-white" /><button className="px-4 rounded-xl bg-blue-600 font-bold">Scan</button></form></div>
          <div className="bg-white rounded-3xl p-5 shadow-sm space-y-4"><div className="grid grid-cols-3 gap-2 text-center"><div className="bg-slate-50 rounded-xl p-3"><b className="block text-2xl">{sessionRoster.length}</b><span className="text-xs text-slate-500">Roster</span></div><div className="bg-emerald-50 rounded-xl p-3"><b className="block text-2xl text-emerald-700">{present}</b><span className="text-xs text-slate-500">Present</span></div><div className="bg-amber-50 rounded-xl p-3"><b className="block text-2xl text-amber-700">{outboxCount}</b><span className="text-xs text-slate-500">Queued</span></div></div><button onClick={handleSync} disabled={!online || outboxCount === 0} className="w-full rounded-xl bg-slate-800 text-white p-3 font-bold"><RefreshCw className="inline w-4 mr-1" />Synchronize now</button><button onClick={openReview} disabled={!session?.serverSessionId || !online} className="w-full rounded-xl bg-emerald-600 text-white p-3 font-bold">Review attendance</button><p className="text-xs text-slate-500">Offline scans are written to IndexedDB before any network call. Rejected events and conflicts stay visible in the outbox state.</p></div>
        </section>}

        {activeView === 'review' && <section className="bg-white rounded-3xl p-5 shadow-sm space-y-4"><div className="flex justify-between items-center"><div><h2 className="text-xl font-black">Review attendance</h2><p className="text-sm text-slate-500">Choose a final status for every student before submitting.</p></div><span className="rounded-xl bg-amber-50 text-amber-800 px-3 py-2 text-sm font-bold">Expected SMS segments: {expectedSmsSegments}</span></div><div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center"><div className="bg-emerald-50 rounded-xl p-2"><b className="block text-lg text-emerald-700">{present}</b><span className="text-xs">Present</span></div><div className="bg-rose-50 rounded-xl p-2"><b className="block text-lg text-rose-700">{absent}</b><span className="text-xs">Absent</span></div><div className="bg-amber-50 rounded-xl p-2"><b className="block text-lg text-amber-700">{late}</b><span className="text-xs">Late</span></div><div className="bg-indigo-50 rounded-xl p-2"><b className="block text-lg text-indigo-700">{leaveExcused}</b><span className="text-xs">Leave/Excused</span></div><div className="bg-slate-50 rounded-xl p-2"><b className="block text-lg">{sessionRoster.length - present - absent - late - leaveExcused}</b><span className="text-xs">Unmarked</span></div></div><div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Roll</th><th className="p-2">Student</th><th className="p-2">Current status</th><th className="p-2">Change</th></tr></thead><tbody>{sessionRoster.map((item) => <tr key={item.studentId} className="border-b"><td className="p-2">{item.rollNumber}</td><td className="p-2 font-bold">{item.studentName}</td><td className="p-2">{item.status}</td><td className="p-2 flex flex-wrap gap-1">{(['PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'EXCUSED'] as const).map((status) => <button key={status} onClick={() => void handleManualStatus(item.studentId, status)} className={`px-2 py-1 rounded-lg text-xs font-bold ${item.status === status ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>{status}</button>)}</td></tr>)}</tbody></table></div><div className="flex justify-end gap-2"><button onClick={() => setActiveView('scanner')} disabled={finalizing} className="px-4 py-2 rounded-xl bg-slate-100 font-bold">Back</button><button onClick={() => void handleFinalize()} disabled={finalizing} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold">{finalizing ? 'Finalizing…' : 'Confirm & finalize'}</button></div></section>}

        {activeView === 'roster' && <section className="bg-white rounded-3xl p-5 shadow-sm"><h2 className="text-xl font-black mb-4">Cached roster</h2><div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="p-2">Roll</th><th className="p-2">Student</th><th className="p-2">Status</th></tr></thead><tbody>{sessionRoster.map((item) => <tr key={item.studentId} className="border-b"><td className="p-2">{item.rollNumber}</td><td className="p-2 font-bold">{item.studentName}<div className="text-xs text-slate-500">{item.studentNameBn}</div></td><td className="p-2">{item.status}</td></tr>)}</tbody></table></div></section>}

        {activeView === 'reports' && <section className="bg-white rounded-3xl p-5 shadow-sm"><h2 className="text-xl font-black mb-4">Live class report</h2>{report ? <pre className="text-xs whitespace-pre-wrap bg-slate-50 rounded-xl p-4 overflow-auto">{JSON.stringify(report, null, 2)}</pre> : <p className="text-slate-500">Select a class to load its report.</p>}</section>}

        {activeView === 'admin' && admin && <section className="bg-white rounded-3xl p-5 shadow-sm"><h2 className="text-xl font-black mb-4">Credential administration</h2><p className="text-sm text-slate-500 mb-4">Reissue explicitly revokes the previous credential before issuing a new one.</p><div className="grid md:grid-cols-2 gap-3">{roster.map((student) => <div key={student.studentId} className="border rounded-xl p-3 flex justify-between items-center"><span><b>{student.name}</b><small className="block text-slate-500">Roll {student.rollNumber}</small></span><button onClick={() => void reissueQr(student.studentId)} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold"><ShieldAlert className="inline w-4 mr-1" />Reissue</button></div>)}</div></section>}
        
        {activeView === 'rfid' && rfidAdmin && (
          <section className="space-y-4">
            <div className="bg-white p-3 rounded-2xl shadow-sm flex gap-2">
              <button onClick={() => setRfidSubView('dashboard')} className={`px-4 py-2 rounded-xl text-sm font-bold ${rfidSubView === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>Dashboard</button>
              <button onClick={() => setRfidSubView('cards')} className={`px-4 py-2 rounded-xl text-sm font-bold ${rfidSubView === 'cards' ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>Cards</button>
              <button onClick={() => setRfidSubView('enroll')} className={`px-4 py-2 rounded-xl text-sm font-bold ${rfidSubView === 'enroll' ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>Enroll</button>
              <button onClick={() => setRfidSubView('bulk')} className={`px-4 py-2 rounded-xl text-sm font-bold ${rfidSubView === 'bulk' ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>Bulk Enroll</button>
              <button onClick={() => setRfidSubView('readers')} className={`px-4 py-2 rounded-xl text-sm font-bold ${rfidSubView === 'readers' ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>Readers</button>
              <button onClick={() => setRfidSubView('reports')} className={`px-4 py-2 rounded-xl text-sm font-bold ${rfidSubView === 'reports' ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>Reports</button>
            </div>
            
            {rfidSubView === 'dashboard' && <RfidDashboard schoolId={auth.schoolId} />}
            {rfidSubView === 'cards' && <CardStatusPanel studentId="" />}
            {rfidSubView === 'enroll' && <CardEnrollmentWizard schoolId={auth.schoolId} />}
            {rfidSubView === 'bulk' && <BulkEnrollment />}
            {rfidSubView === 'readers' && <ReaderManagement schoolId={auth.schoolId} />}
            {rfidSubView === 'reports' && <RfidReports schoolId={auth.schoolId} />}
          </section>
        )}
      </div>
      
      {/* Mock scan result display component usage */}
      <ScanResultDisplay result={null} />
    </main>
  );
}
