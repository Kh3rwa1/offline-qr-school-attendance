import React, { useState } from 'react';
import { Student, ClassSession, Language, NetworkStatus } from '../types';
import { Camera, Usb, Check, AlertCircle, RefreshCw, UserCheck, ShieldCheck } from 'lucide-react';
import { RollingNumber } from './shared/RollingNumber';
import { Button } from './shared/Button';

interface BentoScannerGridProps {
  session: ClassSession;
  students: Student[];
  lastScannedStudent: Student | null;
  language: Language;
  networkStatus: NetworkStatus;
  pendingSyncCount: number;
  onScanStudent: (studentId: string, source: 'CAMERA' | 'USB') => void;
  onSyncNow: () => void;
  onOpenManualModal: () => void;
  onFinalizeSession: () => void;
  scanFeedback: { type: 'SUCCESS' | 'DUPLICATE' | 'ERROR'; message: string } | null;
}

export const BentoScannerGrid: React.FC<BentoScannerGridProps> = ({
  session,
  students,
  lastScannedStudent,
  language,
  pendingSyncCount,
  onScanStudent,
  onSyncNow,
  onOpenManualModal,
  onFinalizeSession,
  scanFeedback,
}) => {
  const [usbInput, setUsbInput] = useState('');
  const [isScanningActive] = useState(true);

  const totalStudents = students.length;
  const presentCount = students.filter((s) => s.status === 'PRESENT' || s.status === 'LATE').length;
  const unmarkedCount = students.filter((s) => s.status === 'UNMARKED').length;
  const presentPercentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  // Handle USB Hardware Scanner Simulator
  const handleUsbSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usbInput.trim()) return;

    const found = students.find(
      (s) =>
        s.qrDigest.toLowerCase() === usbInput.trim().toLowerCase() ||
        s.rollNumber.toString() === usbInput.trim() ||
        s.studentCode.toLowerCase() === usbInput.trim().toLowerCase()
    );

    if (found) {
      onScanStudent(found.id, 'USB');
    }
    setUsbInput('');
  };

  return (
    <main className="grid grid-cols-1 md:grid-cols-12 md:grid-rows-6 gap-4 flex-1 text-left">
      {/* SECTION 1: Current Session Info */}
      <section className="col-span-12 md:col-span-3 md:row-span-2 app-card p-6 flex flex-col justify-between">
        <div>
          <p className="t-label text-forest-700 dark:text-forest-600 mb-1">
            {language === 'bn' ? 'Current Session' : 'Current Session'}
          </p>
          <h2 className="text-3xl font-extrabold text-ink font-display">
            {session.className}-{session.section}
          </h2>
          <p className="text-sm text-ink-soft font-medium">
            {language === 'bn' ? `Class: ${session.className}-${session.section}` : `Class: ${session.className}-${session.section}`}
          </p>
        </div>
        <div className="space-y-1 mt-4 md:mt-0 text-xs">
          <p className="text-ink-soft">
            {language === 'bn' ? 'Teacher:' : 'Teacher:'}{' '}
            <span className="text-ink font-bold">{session.teacherName}</span>
          </p>
          <p className="text-ink-soft">
            {language === 'bn' ? 'Date:' : 'Date:'}{' '}
            <span className="text-ink font-bold font-mono">{session.date}</span>
          </p>
        </div>
      </section>

      {/* SECTION 2: Camera & USB Scanner Viewport */}
      <section className="col-span-12 md:col-span-6 md:row-span-4 bg-slate-950 rounded-[28px] relative overflow-hidden flex flex-col items-center justify-center border-4 border-surface shadow-2xl min-h-[340px] p-4">
        {/* Feedback Alert Overlay */}
        {scanFeedback && (
          <div
            className={`absolute top-4 left-4 right-4 z-20 px-4 py-3 rounded-2xl flex items-center gap-3 backdrop-blur-md shadow-lg transition-all ${
              scanFeedback.type === 'DUPLICATE'
                ? 'bg-warning-800/90 text-white border border-warning-600'
                : scanFeedback.type === 'SUCCESS'
                ? 'bg-success-800/90 text-white border border-success-600'
                : 'bg-danger-800/90 text-white border border-danger-600'
            }`}
          >
            {scanFeedback.type === 'DUPLICATE' ? (
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-300" />
            ) : (
              <Check className="w-5 h-5 shrink-0 text-emerald-300" />
            )}
            <div className="text-xs font-bold leading-snug">{scanFeedback.message}</div>
          </div>
        )}

        {/* Reticle Target Frame */}
        <div className="z-10 border-2 border-dashed border-emerald-400/40 w-56 h-56 sm:w-64 sm:h-64 rounded-2xl flex items-center justify-center relative my-2">
          {/* Reticle Corners */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg"></div>

          {/* Animated Laser Scan Line */}
          {isScanningActive && (
            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_rgba(52,211,153,0.8)] absolute top-1/2 animate-pulse"></div>
          )}

          <div className="text-slate-400 text-xs font-mono tracking-widest uppercase text-center px-4">
            {language === 'bn' ? 'Frame-এর মাঝে QR Code রাখুন' : 'Align QR inside frame'}
          </div>
        </div>

        {/* Scan Actions & Hardware Indicators */}
        <div className="z-10 mt-2 flex flex-wrap gap-2 justify-center items-center">
          <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-white text-xs flex items-center gap-1.5 font-mono">
            <Camera className="w-3.5 h-3.5 text-emerald-400" />
            <span>Camera: ON</span>
          </div>

          <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-white text-xs flex items-center gap-1.5 font-mono">
            <Usb className="w-3.5 h-3.5 text-emerald-400" />
            <span>USB Scanner: Ready</span>
          </div>
        </div>

        {/* Quick USB Wedge Input Form */}
        <form onSubmit={handleUsbSubmit} className="z-10 mt-3 w-full max-w-xs px-2">
          <div className="relative">
            <input
              type="text"
              value={usbInput}
              onChange={(e) => setUsbInput(e.target.value)}
              placeholder={language === 'bn' ? 'USB Scanner Token / Roll No...' : 'USB Scanner Buffer / Roll No...'}
              className="w-full bg-slate-900/90 text-white text-xs px-3 py-2 pl-8 rounded-full border border-slate-700 focus:outline-none focus:border-forest-600 placeholder:text-slate-500 font-mono"
            />
            <Usb className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </form>
      </section>

      {/* SECTION 3: Total Attendance Summary */}
      <section className="col-span-12 md:col-span-3 md:row-span-2 app-card p-6 flex flex-col justify-center items-center text-center">
        <p className="t-label text-ink-muted mb-2">
          {language === 'bn' ? 'Total Attendance' : 'Total Attendance'}
        </p>
        <div className="text-5xl lg:text-6xl font-black text-ink leading-tight t-data">
          <RollingNumber value={presentCount} />
          <span className="text-ink-muted text-3xl lg:text-4xl mx-1 font-light">/</span>
          <span>{totalStudents}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs font-bold text-success-800 bg-success-50 px-2.5 py-1 rounded-full border border-success-100 dark:border-success-600/30 font-display">
            {presentPercentage}% {language === 'bn' ? 'Present' : 'Present'}
          </span>
        </div>
      </section>

      {/* SECTION 4: Last Scanned Student Card */}
      <section className="col-span-12 md:col-span-3 md:row-span-2 hero-forest-card p-6 text-white flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <p className="t-label text-emerald-200 uppercase tracking-widest">
            {language === 'bn' ? 'Last Scanned' : 'Last Scanned'}
          </p>
          <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-mono font-bold">
            {lastScannedStudent?.scannedAt || 'JUST NOW'}
          </span>
        </div>

        {lastScannedStudent ? (
          <div className="my-2">
            <h3 className="text-2xl font-bold leading-snug font-display">{lastScannedStudent.name}</h3>
            <p className="text-sm opacity-90 font-medium">{lastScannedStudent.nameBn}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-mono bg-black/20 px-2 py-1 rounded font-bold">
                ROLL: {String(lastScannedStudent.rollNumber).padStart(4, '0')}
              </span>
              <span className="text-xs font-mono font-bold bg-white/20 px-2 py-1 rounded">
                {lastScannedStudent.studentCode}
              </span>
            </div>
          </div>
        ) : (
          <div className="my-2">
            <h3 className="text-lg font-bold opacity-90 font-display">No scan yet</h3>
            <p className="text-xs opacity-75">Scan a student card to verify profile</p>
          </div>
        )}

        <div className="h-10 w-10 bg-white/20 rounded-full self-end overflow-hidden flex items-center justify-center text-white shrink-0 shadow-inner">
          <UserCheck className="w-5 h-5 text-white" />
        </div>
      </section>

      {/* SECTION 5: Sync Status Card */}
      <section className="col-span-12 md:col-span-3 md:row-span-2 app-card p-6 flex flex-col justify-between">
        <div>
          <p className="t-label text-ink-muted mb-3">
            {language === 'bn' ? 'Sync Status' : 'Sync Status'}
          </p>
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-ink-soft">
                {language === 'bn' ? 'Waiting Scans' : 'Pending Scans'}
              </span>
              <span className="px-2.5 py-0.5 bg-warning-50 text-warning-800 border border-warning-100 dark:border-warning-600/30 rounded-full font-mono font-bold t-data">
                {pendingSyncCount}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-ink-soft">
                {language === 'bn' ? 'Storage Status' : 'Local Health'}
              </span>
              <span className="font-bold text-success-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-success-600" />
                HEALTHY
              </span>
            </div>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={onSyncNow}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          className="w-full justify-center mt-3"
        >
          {language === 'bn' ? 'Sync Now' : 'Sync Now'}
        </Button>
      </section>

      {/* SECTION 6: Review & Finish Call to Action */}
      <section className="col-span-12 md:col-span-6 md:row-span-2 hero-forest-card p-6 text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <h3 className="text-2xl sm:text-3xl font-extrabold font-display mb-0.5">
            {language === 'bn' ? 'Review & Finish' : 'Review & Finish'}
          </h3>
          <p className="text-sm opacity-90 font-medium">
            {language === 'bn'
              ? 'Unmarked Students Check করে Attendance Finish করুন'
              : 'Review unmarked students & submit final list'}
          </p>
          <p className="text-xs mt-3 font-bold uppercase tracking-widest bg-white/20 self-start px-3 py-1 rounded-full font-display">
            {unmarkedCount} {language === 'bn' ? 'Records Waiting' : 'Students Unmarked'}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onOpenManualModal}
            className="w-16 h-16 sm:w-20 sm:h-20 bg-white/10 rounded-2xl flex flex-col items-center justify-center border border-white/20 hover:bg-white/20 transition-all cursor-pointer"
          >
            <UserCheck className="w-5 h-5 mb-1" />
            <span className="text-xs font-bold uppercase font-display">
              {language === 'bn' ? 'Manual' : 'Manual'}
            </span>
          </button>

          <button
            onClick={onFinalizeSession}
            className="w-32 sm:w-40 h-16 sm:h-20 bg-white text-forest-900 rounded-2xl flex flex-col items-center justify-center shadow-xl hover:bg-surface-soft transition-all cursor-pointer font-display"
          >
            <span className="text-base sm:text-lg font-extrabold uppercase">
              {language === 'bn' ? 'Submit করুন' : 'Submit'}
            </span>
            <span className="text-xs font-semibold opacity-80">
              {language === 'bn' ? 'Attendance Finish করুন' : 'Finalize Attendance'}
            </span>
          </button>
        </div>
      </section>
    </main>
  );
};

export default BentoScannerGrid;
