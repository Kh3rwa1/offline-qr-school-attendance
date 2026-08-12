import React, { useState, useEffect } from 'react';
import { Student, ClassSession, Language, NetworkStatus } from '../types';
import { Camera, Usb, Check, AlertCircle, RefreshCw, UserCheck, ShieldCheck, UserX } from 'lucide-react';

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
  const [isScanningActive, setIsScanningActive] = useState(true);

  const totalStudents = students.length;
  const presentCount = students.filter((s) => s.status === 'PRESENT' || s.status === 'LATE').length;
  const unmarkedCount = students.filter((s) => s.status === 'UNMARKED').length;
  const presentPercentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  // Handle USB Hardware Scanner Simulator
  const handleUsbSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usbInput.trim()) return;
    
    // Find student matching input QR or roll or code
    const found = students.find(
      (s) =>
        s.qrDigest.toLowerCase() === usbInput.trim().toLowerCase() ||
        s.rollNumber.toString() === usbInput.trim() ||
        s.studentCode.toLowerCase() === usbInput.trim().toLowerCase()
    );

    if (found) {
      onScanStudent(found.id, 'USB');
    } else {
    }
    setUsbInput('');
  };

  return (
    <main className="grid grid-cols-1 md:grid-cols-12 md:grid-rows-6 gap-4 flex-1">
      {/* SECTION 1: Current Session Info */}
      <section className="col-span-12 md:col-span-3 md:row-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
        <div>
          <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">
            {language === 'bn' ? 'বর্তমান সেশন' : 'Current Session'}
          </p>
          <h2 className="text-3xl font-black text-slate-800">
            {session.className}-{session.section}
          </h2>
          <p className="text-lg text-slate-500 font-medium">
            {language === 'bn' ? 'শ্রেণী: অষ্টম-ক' : 'Class VIII-A'}
          </p>
        </div>
        <div className="space-y-1 mt-4 md:mt-0">
          <p className="text-sm text-slate-400">
            {language === 'bn' ? 'শিক্ষক:' : 'Teacher:'}{' '}
            <span className="text-slate-700 font-bold">{session.teacherName}</span>
          </p>
          <p className="text-sm text-slate-400">
            {language === 'bn' ? 'তারিখ:' : 'Date:'}{' '}
            <span className="text-slate-700 font-bold">{session.date}</span>
          </p>
        </div>
      </section>

      {/* SECTION 2: Camera & USB Scanner Viewport */}
      <section className="col-span-12 md:col-span-6 md:row-span-4 bg-slate-900 rounded-3xl relative overflow-hidden flex flex-col items-center justify-center border-4 border-white shadow-2xl min-h-[340px] p-4">
        {/* Subtle radial dark canvas background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950 opacity-80"></div>

        {/* Feedback Alert Overlay */}
        {scanFeedback && (
          <div
            className={`absolute top-4 left-4 right-4 z-20 px-4 py-3 rounded-2xl flex items-center gap-3 backdrop-blur-md shadow-lg transition-all animate-bounce ${
              scanFeedback.type === 'DUPLICATE'
                ? 'bg-amber-500/90 text-white border border-amber-300'
                : scanFeedback.type === 'SUCCESS'
                ? 'bg-emerald-500/90 text-white border border-emerald-300'
                : 'bg-rose-500/90 text-white border border-rose-300'
            }`}
          >
            {scanFeedback.type === 'DUPLICATE' ? (
              <AlertCircle className="w-5 h-5 shrink-0" />
            ) : (
              <Check className="w-5 h-5 shrink-0" />
            )}
            <div className="text-xs font-bold leading-snug">{scanFeedback.message}</div>
          </div>
        )}

        {/* Reticle Target Frame */}
        <div className="z-10 border-2 border-dashed border-blue-400/50 w-56 h-56 sm:w-64 sm:h-64 rounded-2xl flex items-center justify-center relative my-2">
          {/* Reticle Corners */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-lg"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-lg"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-lg"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-lg"></div>

          {/* Animated Laser Scan Line */}
          {isScanningActive && (
            <div className="w-full h-1 bg-blue-400/80 shadow-[0_0_15px_rgba(96,165,250,0.9)] absolute top-1/2 animate-pulse"></div>
          )}

          <div className="text-slate-400 text-[11px] font-mono tracking-widest uppercase text-center px-4">
            {language === 'bn' ? 'QR কোড ফ্রেমের মধ্যে রাখুন' : 'Align QR inside frame'}
          </div>
        </div>

        {/* Scan Actions & Hardware Indicators */}
        <div className="z-10 mt-2 flex flex-wrap gap-2 justify-center items-center">
          <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-white text-xs flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-blue-400" />
            <span>Camera: ON</span>
          </div>

          <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-white text-xs flex items-center gap-1.5">
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
              placeholder={language === 'bn' ? 'USB স্ক্যানার কীস্ট্রোক...' : 'USB Scanner Buffer / Roll No...'}
              className="w-full bg-slate-800/90 text-white text-xs px-3 py-1.5 pl-8 rounded-xl border border-slate-700 focus:outline-none focus:border-blue-400 placeholder:text-slate-500"
            />
            <Usb className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          </div>
        </form>
      </section>

      {/* SECTION 3: Total Attendance Summary */}
      <section className="col-span-12 md:col-span-3 md:row-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
          {language === 'bn' ? 'মোট উপস্থিতি' : 'Total Attendance'}
        </p>
        <div className="text-5xl lg:text-6xl font-black text-slate-800 leading-tight">
          {presentCount}
          <span className="text-slate-300 text-3xl lg:text-4xl mx-1">/</span>
          {totalStudents}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            {presentPercentage}% {language === 'bn' ? 'উপস্থিত' : 'Present'}
          </span>
        </div>
      </section>

      {/* SECTION 4: Last Scanned Student Card */}
      <section className="col-span-12 md:col-span-3 md:row-span-2 bg-blue-600 rounded-3xl p-6 shadow-sm text-white flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest opacity-80">
            {language === 'bn' ? 'সর্বশেষ স্ক্যান করা হয়েছে' : 'Last Scanned'}
          </p>
          <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold">
            {lastScannedStudent?.scannedAt || 'JUST NOW'}
          </span>
        </div>

        {lastScannedStudent ? (
          <div className="my-2">
            <h3 className="text-2xl font-bold leading-snug">{lastScannedStudent.name}</h3>
            <p className="text-sm opacity-90 font-medium">{lastScannedStudent.nameBn}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-mono bg-black/20 px-2 py-1 rounded font-bold">
                ROLL: {String(lastScannedStudent.rollNumber).padStart(4, '0')}
              </span>
              <span className="text-[10px] font-bold bg-white/20 px-2 py-1 rounded">
                {lastScannedStudent.studentCode}
              </span>
            </div>
          </div>
        ) : (
          <div className="my-2">
            <h3 className="text-xl font-bold opacity-80">No scan yet</h3>
            <p className="text-xs opacity-70">Scan a student card to verify profile</p>
          </div>
        )}

        <div className="h-10 w-10 bg-white rounded-full border-2 border-blue-400 self-end overflow-hidden flex items-center justify-center text-slate-400 shrink-0">
          <UserCheck className="w-5 h-5 text-blue-600" />
        </div>
      </section>

      {/* SECTION 5: Sync Status Card */}
      <section className="col-span-12 md:col-span-3 md:row-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
            {language === 'bn' ? 'সিঙ্ক স্ট্যাটাস' : 'Sync Status'}
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-600">
                {language === 'bn' ? 'অপেক্ষারত স্ক্যান' : 'Pending Scans'}
              </span>
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">
                {pendingSyncCount}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-600">
                {language === 'bn' ? 'লোকাল স্টোরেজ' : 'Local Health'}
              </span>
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                EXCELLENT
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onSyncNow}
          className="w-full py-3 mt-3 bg-slate-100 text-slate-800 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{language === 'bn' ? 'সিঙ্ক করুন' : 'Sync Now'}</span>
        </button>
      </section>

      {/* SECTION 6: Review & Finish Call to Action */}
      <section className="col-span-12 md:col-span-6 md:row-span-2 bg-emerald-500 rounded-3xl p-6 shadow-lg shadow-emerald-200 text-white flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <h3 className="text-2xl sm:text-3xl font-black mb-0.5">
            {language === 'bn' ? 'পর্যালোচনা এবং সম্পন্ন' : 'Review & Finish'}
          </h3>
          <p className="text-sm opacity-90 font-medium">
            {language === 'bn'
              ? 'অনুপস্থিত ছাত্র নিশ্চিত করুন এবং সাবমিট করুন'
              : 'Review unmarked students & submit final list'}
          </p>
          <p className="text-xs mt-3 font-bold uppercase tracking-widest bg-white/20 self-start px-3 py-1 rounded-full">
            {unmarkedCount} {language === 'bn' ? 'জন বাকী আছে' : 'Students Unmarked'}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onOpenManualModal}
            className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 rounded-2xl flex flex-col items-center justify-center border border-white/30 hover:bg-white/30 transition-all cursor-pointer"
          >
            <UserCheck className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-black uppercase">
              {language === 'bn' ? 'ম্যানুয়াল' : 'Manual'}
            </span>
          </button>

          <button
            onClick={onFinalizeSession}
            className="w-32 sm:w-40 h-16 sm:h-20 bg-white text-emerald-700 rounded-2xl flex flex-col items-center justify-center shadow-xl shadow-emerald-900/10 hover:bg-slate-50 transition-all cursor-pointer"
          >
            <span className="text-base sm:text-lg font-black uppercase">
              {language === 'bn' ? 'জমা দিন' : 'Submit'}
            </span>
            <span className="text-[10px] font-bold opacity-70">
              {language === 'bn' ? 'চূড়ান্ত উপস্থিতি' : 'Finalize Attendance'}
            </span>
          </button>
        </div>
      </section>
    </main>
  );
};
