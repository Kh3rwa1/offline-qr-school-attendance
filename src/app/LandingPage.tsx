import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  Check,
  CheckCircle,
  CheckCircle2,
  Clock,
  FileCheck,
  FileSpreadsheet,
  Globe,
  Lightbulb,
  MessageSquareText,
  Radio,
  RefreshCw,
  ScanLine,
  School,
  Smartphone,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { Button, TextField, Dialog, Toast } from '../components/ui';
import { useLanguage } from './LanguageProvider';
import { LANDING_COPY as COPY, ONBOARDING_STAGES, type LocalizedText } from './landingCopy';

const CAPABILITIES: { icon: React.ComponentType<{ className?: string }>; label: LocalizedText }[] = [
  { icon: WifiOff, label: COPY.capOffline },
  { icon: Radio, label: COPY.capRfid },
  { icon: FileCheck, label: COPY.capUdise },
  { icon: MessageSquareText, label: COPY.capSms },
  { icon: Globe, label: COPY.capBilingual },
  { icon: FileSpreadsheet, label: COPY.capExcel },
];

const LANG_OPTIONS: { code: 'en' | 'bn' | 'hi'; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'hi', label: 'हिंदी' },
];

export const LandingPage: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  const c = (entry: LocalizedText): string => entry[language] || entry.en;
  const reduceMotion = useReducedMotion();

  const [selectedStageIndex, setSelectedStageIndex] = useState(4);
  const [studentCount, setStudentCount] = useState<number>(750);

  const [simScanning, setSimScanning] = useState(false);
  const [simSuccess, setSimSuccess] = useState(false);
  const [simStudent, setSimStudent] = useState<{ name: string; roll: string; class: string; time: string } | null>(null);

  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const [isSubmittingDemo, setIsSubmittingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoForm, setDemoForm] = useState({
    name: '',
    phone: '',
    email: '',
    schoolName: '',
    district: '',
    studentCount: '500-1000',
  });

  const float = (values: Record<string, number[]>, duration: number, delay = 0) => ({
    animate: reduceMotion ? undefined : values,
    transition: reduceMotion ? { duration: 0 } : { duration, repeat: Infinity, ease: 'easeInOut' as const, delay },
  });

  const handleSimulateScan = () => {
    if (simScanning) return;
    setSimScanning(true);
    setSimSuccess(false);
    setTimeout(() => {
      const names = [
        { name: 'Ananya Roy', roll: 'Roll 14', class: 'Class 8-A' },
        { name: 'Rohan Banerjee', roll: 'Roll 22', class: 'Class 9-B' },
        { name: 'Pooja Sharma', roll: 'Roll 07', class: 'Class 10-A' },
        { name: 'Devendra Mahato', roll: 'Roll 31', class: 'Class 7-C' },
      ];
      const pick = names[Math.floor(Math.random() * names.length)];
      const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      setSimStudent({ ...pick, time: timeStr });
      setSimScanning(false);
      setSimSuccess(true);
    }, 600);
  };

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDemoError(null);
    setIsSubmittingDemo(true);
    try {
      const rawPhone = demoForm.phone.trim();
      const formattedPhone = rawPhone.startsWith('+91') ? rawPhone : `+91${rawPhone.replace(/\D/g, '')}`;
      const res = await fetch('/api/v1/public/demo-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: demoForm.name.trim(),
          phone: formattedPhone,
          email: demoForm.email.trim() || undefined,
          schoolName: demoForm.schoolName.trim(),
          district: demoForm.district.trim(),
          studentCount: demoForm.studentCount || '500-1000',
          source: 'landing',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201 && data.success) {
        setDemoSubmitted(true);
      } else {
        setDemoError(data.message || data.error || c(COPY.demoError));
      }
    } catch {
      setDemoError(c(COPY.demoNetworkError));
    } finally {
      setIsSubmittingDemo(false);
    }
  };

  const selectedStage = ONBOARDING_STAGES[selectedStageIndex];
  const teacherHoursSavedPerYear = Math.round((studentCount * 0.08 * 220) / 60);
  const paperSavedPages = studentCount * 12 * 4;

  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#0f172a] flex flex-col selection:bg-[#15803d] selection:text-white font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 px-4 sm:px-12 py-4 flex items-center justify-between backdrop-blur-md bg-white/90 border-b border-slate-200/80 transition-all">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-[#14532d] flex items-center justify-center text-white font-black text-sm font-display shadow-md shadow-emerald-900/20 group-hover:scale-105 transition-transform">
            AE
          </div>
          <span className="text-xl font-black text-[#0f172a] font-display tracking-tight">AttendEase</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
          <a href="#how-it-works" className="hover:text-[#14532d] transition-colors">{c(COPY.navHowItWorks)}</a>
          <a href="#getting-started" className="hover:text-[#14532d] transition-colors">{c(COPY.navGettingStarted)}</a>
          <a href="#roi" className="hover:text-[#14532d] transition-colors">{c(COPY.navSavings)}</a>
          <a href="#contact" className="hover:text-[#14532d] transition-colors">{c(COPY.navContact)}</a>
        </nav>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label={c(COPY.langLabel)}>
            {LANG_OPTIONS.map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => setLanguage(opt.code)}
                aria-pressed={language === opt.code}
                className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold font-display transition-colors cursor-pointer ${language === opt.code ? 'bg-[#14532d] text-white shadow-sm' : 'text-slate-600 hover:text-[#14532d]'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Link to="/login" className="hidden sm:inline-block">
            <Button variant="ghost" size="sm" className="font-bold text-slate-700 hover:text-[#14532d]">
              {c(COPY.signIn)}
            </Button>
          </Link>
          <Button
            variant="primary"
            size="md"
            onClick={() => setDemoModalOpen(true)}
            className="bg-[#14532d] hover:bg-[#166534] text-white font-bold rounded-xl px-5 shadow-sm"
          >
            {c(COPY.bookDemo)}
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-12 sm:pt-20 pb-16 px-4 sm:px-12 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 text-left space-y-6">
            <div className="inline-block px-3 py-1 rounded-md bg-[#dcfce7] text-[#15803d] font-mono text-xs font-black tracking-wider uppercase">
              {c(COPY.heroBadge)}
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-black text-[#0f172a] font-display tracking-tight leading-[1.12]">
              {c(COPY.heroTitle1)}{' '}
              <span className="text-[#15803d]">{c(COPY.heroTitle2)}</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-lg">
              {c(COPY.heroSubtitle)}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button
                variant="primary"
                size="lg"
                onClick={() => setDemoModalOpen(true)}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="bg-[#14532d] hover:bg-[#166534] text-white rounded-xl px-6 py-3.5 font-bold shadow-md"
              >
                {c(COPY.bookDemo)}
              </Button>
              <Link to="/login">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-slate-300 hover:border-slate-400 bg-white text-slate-800 rounded-xl px-6 py-3.5 font-bold shadow-2xs"
                >
                  {c(COPY.signIn)}
                </Button>
              </Link>
            </div>
          </div>

          {/* Hero visual */}
          <div className="lg:col-span-6 relative flex items-center justify-center">
            <div className="relative w-full max-w-[480px] aspect-square flex items-center justify-center">
              <div className="absolute inset-4 rounded-full border-2 border-emerald-400/40 bg-radial from-emerald-500/10 via-emerald-400/5 to-transparent animate-pulse" />

              <motion.div {...float({ y: [0, -12, 0], x: [0, 6, 0] }, 4)} className="absolute top-6 right-12 w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-600 to-lime-400 shadow-lg shadow-emerald-500/40" />
              <motion.div {...float({ y: [0, 10, 0], x: [0, -8, 0] }, 5, 0.5)} className="absolute bottom-12 left-8 w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-lime-400 shadow-lg shadow-emerald-500/40" />
              <motion.div {...float({ y: [0, -8, 0] }, 3.5, 1)} className="absolute bottom-6 right-20 w-4 h-4 rounded-full bg-gradient-to-tr from-emerald-500 to-lime-300 shadow-md shadow-emerald-500/30" />

              <motion.div {...float({ y: [0, -6, 0] }, 4)} className="absolute top-10 left-6 z-20 px-3.5 py-1.5 rounded-full bg-white/95 border border-slate-200 shadow-md text-xs font-bold font-display text-slate-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#15803d]" />
                <span>{c(COPY.pillSetup)}</span>
              </motion.div>
              <motion.div {...float({ y: [0, 8, 0] }, 4.5, 0.8)} className="absolute top-8 right-6 z-20 px-3.5 py-1.5 rounded-full bg-white/95 border border-slate-200 shadow-md text-xs font-bold font-display text-slate-800 flex items-center gap-1.5">
                <WifiOff className="w-3.5 h-3.5 text-[#15803d]" />
                <span>{c(COPY.pillOffline)}</span>
              </motion.div>
              <motion.div {...float({ y: [0, -7, 0] }, 5, 1.2)} className="absolute bottom-16 left-6 z-20 px-3.5 py-1.5 rounded-full bg-white/95 border border-slate-200 shadow-md text-xs font-bold font-display text-slate-800 flex items-center gap-1.5">
                <MessageSquareText className="w-3.5 h-3.5 text-[#15803d]" />
                <span>{c(COPY.pillSms)}</span>
              </motion.div>
              <motion.div {...float({ y: [0, 6, 0] }, 4.2, 0.4)} className="absolute bottom-14 right-6 z-20 px-3.5 py-1.5 rounded-full bg-white/95 border border-slate-200 shadow-md text-xs font-bold font-display text-slate-800 flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-[#15803d]" />
                <span>{c(COPY.pillUdise)}</span>
              </motion.div>

              <motion.div
                {...float({ rotate: [-12, -10, -12], y: [0, -6, 0] }, 6)}
                className="relative z-10 w-72 sm:w-80 rounded-2xl bg-gradient-to-br from-[#fefce8] to-[#fef08a] p-5 shadow-2xl border border-yellow-200/80 transform -rotate-12"
              >
                <div className="absolute inset-0 bg-[#fef9c3] rounded-2xl -rotate-3 -z-10 shadow-lg" />
                <div className="absolute inset-0 bg-[#fef08a] rounded-2xl rotate-4 -z-20 shadow-md" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-yellow-300/80 pb-2">
                    <span className="font-mono text-[11px] font-bold text-yellow-900">DAILY CLASS ATTENDANCE REGISTER</span>
                    <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">VERIFIED</span>
                  </div>
                  <div className="space-y-2 font-mono text-[10px] text-yellow-950">
                    <div className="flex items-center justify-between border-b border-yellow-200 pb-1">
                      <span>01. Ananya Roy (Roll 14)</span>
                      <span className="text-emerald-700 font-bold">PRESENT [P]</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-yellow-200 pb-1">
                      <span>02. Rohan Banerjee (Roll 22)</span>
                      <span className="text-emerald-700 font-bold">PRESENT [P]</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-yellow-200 pb-1">
                      <span>03. Pooja Sharma (Roll 07)</span>
                      <span className="text-emerald-700 font-bold">PRESENT [P]</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>04. Devendra Mahato (Roll 31)</span>
                      <span className="text-emerald-700 font-bold">PRESENT [P]</span>
                    </div>
                  </div>
                  <div className="pt-2 flex items-center justify-between text-[10px] font-bold text-yellow-800 border-t border-yellow-300/80">
                    <span>UDISE+ CODE: 19170100101</span>
                    <span>100% OFFLINE</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Real capabilities strip (no third-party brand logos) */}
      <section className="bg-[#14532d] py-6 px-4 sm:px-12 text-white">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-6 opacity-90 text-sm font-semibold">
          {CAPABILITIES.map((cap) => (
            <div key={cap.label.en} className="flex items-center gap-2">
              <cap.icon className="w-5 h-5 text-emerald-300" />
              <span>{c(cap.label)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-12 max-w-7xl mx-auto w-full space-y-12 text-center scroll-mt-24">
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold tracking-wider text-slate-500 uppercase">{c(COPY.howKicker)}</span>
          <h2 className="text-3xl sm:text-4xl font-black text-[#0f172a] font-display tracking-tight">{c(COPY.howTitle)}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-center max-w-4xl mx-auto">
          <div className="p-8 sm:p-10 rounded-3xl bg-[#f0fdf4] border border-emerald-200/80 shadow-sm flex flex-col items-center space-y-5 hover:shadow-md transition-all">
            <div className="w-20 h-20 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center shadow-xs">
              <ScanLine className="w-10 h-10 text-[#15803d]" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-[#0f172a] font-display">{c(COPY.howCard1Title)}</h3>
              <p className="text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">{c(COPY.howCard1Desc)}</p>
            </div>
            <div className="w-full pt-2 space-y-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleSimulateScan}
                isLoading={simScanning}
                className="bg-[#15803d] hover:bg-[#166534] text-white rounded-xl font-bold px-8 py-3 w-full sm:w-auto shadow-sm"
              >
                {simScanning ? c(COPY.howCard1Scanning) : c(COPY.howCard1Cta)}
              </Button>
              <p className="text-[11px] text-slate-500">{c(COPY.simNote)}</p>
            </div>

            {simSuccess && simStudent && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3.5 rounded-xl bg-white border border-emerald-300 text-xs text-left w-full space-y-1 shadow-2xs"
              >
                <div className="flex items-center justify-between font-bold text-emerald-800">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {c(COPY.simVerified)}: {simStudent.name}
                  </span>
                  <span>{simStudent.time}</span>
                </div>
                <div className="text-slate-600 flex justify-between">
                  <span>{simStudent.class} • {simStudent.roll}</span>
                  <span className="text-emerald-700 font-bold">{c(COPY.simInstant)}</span>
                </div>
              </motion.div>
            )}
          </div>

          <div className="p-8 sm:p-10 rounded-3xl bg-[#f0fdf4] border border-emerald-200/80 shadow-sm flex flex-col items-center space-y-5 hover:shadow-md transition-all">
            <div className="w-20 h-20 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center shadow-xs">
              <RefreshCw className="w-10 h-10 text-[#15803d]" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-[#0f172a] font-display">{c(COPY.howCard2Title)}</h3>
              <p className="text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">{c(COPY.howCard2Desc)}</p>
            </div>
            <div className="w-full pt-2">
              <Link to="/login">
                <Button
                  variant="outline"
                  size="md"
                  className="bg-white hover:bg-slate-50 border-emerald-300 text-emerald-800 rounded-xl font-bold px-8 py-3 w-full sm:w-auto shadow-2xs"
                >
                  {c(COPY.howCard2Cta)}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Getting started: 8 steps */}
      <section id="getting-started" className="py-20 px-4 sm:px-12 max-w-7xl mx-auto w-full space-y-12 text-center scroll-mt-24">
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold tracking-wider text-slate-500 uppercase">{c(COPY.startKicker)}</span>
          <h2 className="text-3xl sm:text-4xl font-black text-[#0f172a] font-display tracking-tight">{c(COPY.startTitle)}</h2>
        </div>

        <div className="rounded-3xl bg-white border border-slate-200 shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 max-w-5xl mx-auto">
          <div className="lg:col-span-6 p-6 sm:p-8 bg-slate-50/70 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between space-y-5 text-left">
            <div className="w-full h-52 sm:h-56 rounded-2xl border border-slate-200/80 overflow-hidden relative shadow-inner bg-slate-900 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.img
                  key={selectedStage.image}
                  src={selectedStage.image}
                  alt={c(selectedStage.title)}
                  loading="lazy"
                  decoding="async"
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: reduceMotion ? 0 : 0.35, ease: 'easeOut' }}
                  className="w-full h-full object-cover object-center"
                />
              </AnimatePresence>
              <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 text-[11px] font-extrabold text-[#14532d] bg-white/95 backdrop-blur-md px-3 py-1 rounded-full border border-emerald-200 shadow-md">
                <School className="w-3.5 h-3.5 text-[#15803d]" />
                <span>{c(selectedStage.tag)}</span>
              </div>
              <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 text-[11px] font-extrabold text-slate-800 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full border border-slate-200 shadow-md">
                <Clock className="w-3.5 h-3.5 text-[#15803d]" />
                <span>{c(selectedStage.badge)}</span>
              </div>
              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/60 to-transparent pointer-events-none flex items-end px-3 py-2">
                <span className="text-white text-xs font-bold font-display drop-shadow-md">
                  {c(COPY.stepWord)} 0{selectedStage.step}: {c(selectedStage.title)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-700">
              {ONBOARDING_STAGES.map((st, idx) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setSelectedStageIndex(idx)}
                  aria-pressed={idx === selectedStageIndex}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    idx === selectedStageIndex
                      ? 'bg-[#14532d] text-white border-[#14532d] shadow-sm'
                      : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <span className="truncate">{c(st.name)}</span>
                  {idx === selectedStageIndex && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 p-8 sm:p-10 flex flex-col justify-between space-y-6 text-left bg-white">
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-100 text-slate-600 text-xs font-medium">{c(COPY.startBoxLabel)}</div>
              <h3 className="text-2xl sm:text-3xl font-black text-[#0f172a] font-display">{c(COPY.startPromise)}</h3>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">{c(selectedStage.subtitle)}</p>
              <div className="p-3.5 rounded-xl bg-[#f0fdf4] border border-emerald-200 text-xs text-emerald-900 font-medium">
                <strong>{c(COPY.startDeliverable)}:</strong> {c(selectedStage.deliverable)}
              </div>
            </div>
            <div>
              <Button
                variant="primary"
                size="lg"
                onClick={() => setDemoModalOpen(true)}
                className="w-full bg-[#15803d] hover:bg-[#166534] text-white font-bold rounded-xl py-3.5 shadow-sm"
              >
                {c(COPY.bookDemo)}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="why-us" className="py-20 px-4 sm:px-12 max-w-7xl mx-auto w-full space-y-12 text-center scroll-mt-24">
        <div className="space-y-2">
          <h2 className="text-3xl sm:text-4xl font-black text-[#0f172a] font-display tracking-tight">{c(COPY.featTitle)}</h2>
          <p className="text-base text-slate-600">{c(COPY.featSubtitle)}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left max-w-5xl mx-auto">
          <div className="p-8 rounded-3xl bg-[#f0fdf4] border border-emerald-200/80 shadow-sm space-y-4 hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center shadow-xs">
              <Smartphone className="w-6 h-6 text-[#15803d]" />
            </div>
            <h3 className="text-lg font-bold text-[#0f172a] font-display">{c(COPY.feat1Title)}</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">{c(COPY.feat1Desc)}</p>
          </div>
          <div className="p-8 rounded-3xl bg-[#f0fdf4] border border-emerald-200/80 shadow-sm space-y-4 hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center shadow-xs">
              <WifiOff className="w-6 h-6 text-[#15803d]" />
            </div>
            <h3 className="text-lg font-bold text-[#0f172a] font-display">{c(COPY.feat2Title)}</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">{c(COPY.feat2Desc)}</p>
          </div>
          <div className="p-8 rounded-3xl bg-[#f0fdf4] border border-emerald-200/80 shadow-sm space-y-4 hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center shadow-xs">
              <FileCheck className="w-6 h-6 text-[#15803d]" />
            </div>
            <h3 className="text-lg font-bold text-[#0f172a] font-display">{c(COPY.feat3Title)}</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">{c(COPY.feat3Desc)}</p>
          </div>
        </div>
      </section>

      {/* Savings calculator */}
      <section id="roi" className="py-20 px-4 sm:px-12 max-w-7xl mx-auto w-full space-y-12 text-center scroll-mt-24">
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold tracking-wider text-slate-500 uppercase">{c(COPY.roiKicker)}</span>
          <h2 className="text-3xl sm:text-4xl font-black text-[#0f172a] font-display tracking-tight">{c(COPY.roiTitle)}</h2>
        </div>

        <div className="rounded-3xl bg-white border border-slate-200 shadow-xl p-8 sm:p-12 max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center text-left">
          <div className="lg:col-span-6 space-y-6">
            <div>
              <label htmlFor="student-slider" className="block text-base font-extrabold text-[#0f172a] font-display mb-2">
                {c(COPY.roiSliderLabel)}: <span className="text-[#15803d]">{studentCount.toLocaleString()} {c(COPY.roiStudents)}</span>
              </label>
              <input
                id="student-slider"
                type="range"
                min="100"
                max="3000"
                step="50"
                value={studentCount}
                onChange={(e) => setStudentCount(Number(e.target.value))}
                className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#15803d]"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-2 font-mono">
                <span>100</span>
                <span>1,500</span>
                <span>3,000</span>
              </div>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-600">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 text-[#15803d] shrink-0" />
                <span>{c(COPY.roiPoint1)}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 text-[#15803d] shrink-0" />
                <span>{c(COPY.roiPoint2)}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-slate-100 border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase">{c(COPY.roiHoursLabel)}</div>
                <div className="text-3xl font-black text-[#0f172a] font-display mt-1">{teacherHoursSavedPerYear.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-0.5">{c(COPY.roiPerYear)}</div>
              </div>
              <div className="p-5 rounded-2xl bg-slate-100 border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase">{c(COPY.roiPaperLabel)}</div>
                <div className="text-3xl font-black text-[#0f172a] font-display mt-1">{paperSavedPages.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-0.5">{c(COPY.roiPerYear)}</div>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-[#dcfce7] border border-emerald-300 text-xs text-emerald-900 flex items-start gap-2.5 leading-relaxed font-medium">
              <Lightbulb className="w-4 h-4 text-[#15803d] shrink-0 mt-0.5" />
              <span>{c(COPY.roiNote)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="contact" className="bg-[#14532d] text-white py-24 px-4 sm:px-12 text-center space-y-8 relative overflow-hidden mt-auto scroll-mt-24">
        <div className="max-w-3xl mx-auto space-y-4">
          <span className="text-xs font-mono font-bold tracking-widest text-emerald-300 uppercase">{c(COPY.ctaKicker)}</span>
          <h2 className="text-3xl sm:text-5xl font-black font-display tracking-tight leading-tight">{c(COPY.ctaTitle)}</h2>
          <p className="text-emerald-100 text-base sm:text-lg max-w-xl mx-auto">{c(COPY.ctaSubtitle)}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setDemoModalOpen(true)}
            className="bg-white hover:bg-slate-100 text-[#14532d] font-bold rounded-xl px-8 py-3.5 shadow-lg shadow-black/20"
          >
            {c(COPY.bookDemo)}
          </Button>
          <Link to="/login">
            <Button
              variant="ghost"
              size="lg"
              className="text-white hover:bg-[#166534] border border-emerald-400/40 rounded-xl px-8 py-3.5 font-bold"
            >
              {c(COPY.signIn)}
            </Button>
          </Link>
        </div>

        <div className="text-xs text-emerald-200/80 font-medium">
          {c(COPY.ctaContact)}:{' '}
          <a href="mailto:founder@tumdah.com" className="underline hover:text-white transition-colors">
            founder@tumdah.com
          </a>
        </div>

        <div className="absolute right-8 bottom-8 text-emerald-600/30">
          <Sparkles className="w-16 h-16" />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0f172a] text-white py-10 px-4 sm:px-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto space-y-5 text-xs text-slate-400">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-6 font-semibold">
              <a href="#how-it-works" className="hover:text-white transition-colors">{c(COPY.navHowItWorks)}</a>
              <a href="#getting-started" className="hover:text-white transition-colors">{c(COPY.navGettingStarted)}</a>
              <a href="#roi" className="hover:text-white transition-colors">{c(COPY.navSavings)}</a>
              <Link to="/login" className="hover:text-white transition-colors">{c(COPY.signIn)}</Link>
            </div>
            <div className="flex items-center gap-2 font-display font-black text-sm text-white">
              <div className="w-6 h-6 rounded-md bg-[#15803d] flex items-center justify-center text-white text-[10px]">AE</div>
              <span>AttendEase</span>
            </div>
            <div className="flex flex-wrap items-center gap-5 font-semibold">
              <Link to="/privacy" className="hover:text-white transition-colors">{c(COPY.footerPrivacy)}</Link>
              <Link to="/terms" className="hover:text-white transition-colors">{c(COPY.footerTerms)}</Link>
              <a href="mailto:founder@tumdah.com" className="hover:text-white transition-colors">{c(COPY.footerContact)}</a>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
            <span>{c(COPY.footerCompliance)}</span>
            <span>© {new Date().getFullYear()} AttendEase</span>
          </div>
        </div>
      </footer>

      {/* Demo dialog */}
      <Dialog
        isOpen={demoModalOpen}
        onClose={() => {
          setDemoModalOpen(false);
          setDemoSubmitted(false);
          setDemoError(null);
        }}
        title={c(COPY.demoTitle)}
        description={c(COPY.demoDesc)}
      >
        {demoSubmitted ? (
          <div data-testid="demo-success-state" className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#dcfce7] text-[#15803d] border border-emerald-200 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-bold text-slate-900 font-display">{c(COPY.demoSuccessTitle)}</h4>
            <p className="text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">{c(COPY.demoSuccessBody)}</p>
            <p className="text-sm font-mono font-bold text-slate-900">{demoForm.phone}</p>
            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setDemoModalOpen(false);
                  setDemoSubmitted(false);
                  setDemoError(null);
                }}
                className="bg-[#14532d] hover:bg-[#166534] text-white"
              >
                {c(COPY.demoDone)}
              </Button>
            </div>
          </div>
        ) : (
          <form data-testid="demo-request-form" onSubmit={handleDemoSubmit} className="space-y-4 text-left">
            {demoError && (
              <div className="mb-2">
                <Toast kind="error" message={demoError} onDismiss={() => setDemoError(null)} autoDismiss={false} />
              </div>
            )}

            <TextField
              label={c(COPY.demoName)}
              required
              value={demoForm.name}
              onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
              placeholder="e.g. Principal Sourav Sen"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                label={c(COPY.demoPhone)}
                type="tel"
                prefixText="+91"
                required
                value={demoForm.phone}
                onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                placeholder="98765 43210"
              />
              <TextField
                label={c(COPY.demoEmail)}
                type="email"
                value={demoForm.email}
                onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                placeholder="principal@school.edu.in"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                label={c(COPY.demoSchool)}
                required
                value={demoForm.schoolName}
                onChange={(e) => setDemoForm({ ...demoForm, schoolName: e.target.value })}
                placeholder="Green Valley High School"
              />
              <TextField
                label={c(COPY.demoDistrict)}
                required
                value={demoForm.district}
                onChange={(e) => setDemoForm({ ...demoForm, district: e.target.value })}
                placeholder="Kolkata, West Bengal"
              />
            </div>

            <div>
              <label htmlFor="demo-student-count" className="block text-xs font-bold text-slate-700 mb-1.5">
                {c(COPY.demoStudents)}
              </label>
              <select
                id="demo-student-count"
                value={demoForm.studentCount}
                onChange={(e) => setDemoForm({ ...demoForm, studentCount: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 outline-none focus:border-[#14532d] cursor-pointer"
              >
                <option value="Under 500">Under 500</option>
                <option value="500-1000">500 – 1,000</option>
                <option value="1000-2000">1,000 – 2,000</option>
                <option value="2000+">2,000+</option>
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2.5">
              <Button
                variant="secondary"
                size="md"
                type="button"
                onClick={() => {
                  setDemoModalOpen(false);
                  setDemoError(null);
                }}
              >
                {c(COPY.demoCancel)}
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                isLoading={isSubmittingDemo}
                className="bg-[#14532d] hover:bg-[#166534] text-white"
              >
                {c(COPY.demoSubmit)}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
};

export default LandingPage;
