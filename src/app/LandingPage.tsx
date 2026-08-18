import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileCheck,
  FileSpreadsheet,
  Globe,
  Info,
  Lightbulb,
  MessageSquareText,
  PlayCircle,
  Radio,
  ScanLine,
  School,
  ShieldCheck,
  Smartphone,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { Button, TextField, Dialog, Toast } from '../components/ui';
import { useLanguage } from './LanguageProvider';
import { LANDING_COPY as COPY, ONBOARDING_STAGES, type LocalizedText } from './landingCopy';
import { APPROVED_TESTIMONIALS, getActiveVerifiedTestimonials } from '../config/approvedTestimonials';
import { calculateAttendanceEstimates, CALCULATION_METHODOLOGY } from './landingAssumptions';
import { buildSafeYouTubeEmbedUrl } from '../utils/videoSecurity';

const CAPABILITIES: { icon: React.ComponentType<{ className?: string }>; label: LocalizedText }[] = [
  { icon: WifiOff, label: COPY.capOffline },
  { icon: Radio, label: COPY.capRfid },
  { icon: FileCheck, label: COPY.capUdise },
  { icon: MessageSquareText, label: COPY.capSms },
  { icon: Globe, label: COPY.capBilingual },
  { icon: FileSpreadsheet, label: COPY.capExcel },
];

const LANG_OPTIONS: { code: 'en' | 'bn' | 'hi'; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'hi', label: 'हिंदी' },
];

export const LandingPage: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  const c = (entry: LocalizedText): string => entry[language] || entry.en;
  const reduceMotion = useReducedMotion();

  const [selectedStageIndex, setSelectedStageIndex] = useState(4);
  const [studentCount, setStudentCount] = useState<number>(750);
  const [attendanceMode, setAttendanceMode] = useState<'QR' | 'RFID'>('QR');
  const [showMethodology, setShowMethodology] = useState<boolean>(false);

  // Dynamic content from platform settings (super admin editable)
  const [ps, setPs] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch('/api/v1/public/settings')
      .then((r) => r.json())
      .then((data: { success: boolean; settings?: Record<string, string> }) => {
        if (data.success && data.settings) {
          setPs(data.settings);
        }
      })
      .catch(() => {
        /* non-fatal — defaults stay */
      });
  }, []);

  // Locale-aware subtitle selection
  const getHeroSubtitle = (): string => {
    const localeKey = `hero_subtitle_${language}`;
    if (ps[localeKey] && ps[localeKey].trim()) return ps[localeKey];
    if (language === 'en' && ps.hero_subtitle && ps.hero_subtitle.trim()) return ps.hero_subtitle;
    return c(COPY.heroSubtitleDefault);
  };

  const getPricingAmount = (): string => ps.pricing_amount || c(COPY.pricingAmount);
  const getPricingPerStudent = (): string => ps.pricing_per_student || c(COPY.pricingPerStudent);
  const getPricingFreeNote = (): string => ps.pricing_free_note || c(COPY.pricingFreeNote);
  const safeVideoEmbedUrl = buildSafeYouTubeEmbedUrl(ps.demo_video_url);

  // Interactive simulated scan state
  const [simScanning, setSimScanning] = useState(false);
  const [simSuccess, setSimSuccess] = useState(false);
  const [simStudent, setSimStudent] = useState<{ name: string; roll: string; class: string; time: string } | null>(null);

  // Demo dialog state
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const [isSubmittingDemo, setIsSubmittingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [demoConsent, setDemoConsent] = useState(false);
  const [demoForm, setDemoForm] = useState({
    name: '',
    phone: '',
    email: '',
    schoolName: '',
    district: '',
    studentCount: '500-1000',
    preferredLanguage: language as 'en' | 'bn' | 'hi',
  });

  const lastFocusedTriggerRef = useRef<HTMLElement | null>(null);

  const openDemoModal = (e?: React.MouseEvent) => {
    if (e && e.currentTarget instanceof HTMLElement) {
      lastFocusedTriggerRef.current = e.currentTarget;
    }
    setDemoModalOpen(true);
    setDemoSubmitted(false);
    setDemoError(null);
    setDemoConsent(false);
  };

  const closeDemoModal = () => {
    setDemoModalOpen(false);
    setDemoSubmitted(false);
    setDemoError(null);
    if (lastFocusedTriggerRef.current) {
      lastFocusedTriggerRef.current.focus();
    }
  };

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
      const timeStr = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      setSimStudent({ ...pick, time: timeStr });
      setSimScanning(false);
      setSimSuccess(true);
    }, 600);
  };

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDemoError(null);

    if (!demoConsent) {
      setDemoError(c(COPY.demoConsentError));
      return;
    }

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
          preferredLanguage: demoForm.preferredLanguage || language,
          consentGiven: true,
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
  const estimates = calculateAttendanceEstimates({
    studentCount,
    attendanceMode,
  });

  const verifiedTestimonials = getActiveVerifiedTestimonials(APPROVED_TESTIMONIALS);

  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#0f172a] flex flex-col selection:bg-[#15803d] selection:text-white font-sans antialiased">
      {/* Skip to main content accessibility link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-[#14532d] focus:text-white focus:rounded-lg focus:shadow-lg text-sm font-bold"
      >
        {c(COPY.skipToContent)}
      </a>

      {/* Header */}
      <header className="sticky top-0 z-40 px-4 sm:px-12 py-4 flex items-center justify-between backdrop-blur-md bg-white/90 border-b border-slate-200/80 transition-all">
        <Link to="/" className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-[#14532d] rounded-lg">
          <div className="w-10 h-10 rounded-xl bg-[#14532d] flex items-center justify-center text-white font-black text-base font-display shadow-md shadow-emerald-900/20 group-hover:scale-105 transition-transform">
            AE
          </div>
          <span className="text-xl font-black text-[#0f172a] font-display tracking-tight">AttendEase</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600" aria-label="Main Navigation">
          <a href="#how-it-works" className="hover:text-[#14532d] transition-colors">{c(COPY.navHowItWorks)}</a>
          <a href="#getting-started" className="hover:text-[#14532d] transition-colors">{c(COPY.navGettingStarted)}</a>
          <a href="#pricing" className="hover:text-[#14532d] transition-colors">{c(COPY.navPricing)}</a>
          <a href="#roi" className="hover:text-[#14532d] transition-colors">{c(COPY.navSavings)}</a>
          <a href="#contact" className="hover:text-[#14532d] transition-colors">{c(COPY.navContact)}</a>
        </nav>

        <div className="flex items-center gap-3">
          {/* Accessible Language Switcher */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label={c(COPY.langLabel)}>
            {LANG_OPTIONS.map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => setLanguage(opt.code)}
                aria-pressed={language === opt.code}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold font-display transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#14532d] ${
                  language === opt.code ? 'bg-[#14532d] text-white shadow-sm' : 'text-slate-600 hover:text-[#14532d]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <Link to="/login" className="hidden sm:inline-block">
            <Button variant="ghost" size="sm" className="font-bold text-slate-700 hover:text-[#14532d] text-sm">
              {c(COPY.signIn)}
            </Button>
          </Link>

          <Button
            id="header-book-demo-btn"
            data-testid="header-book-demo-btn"
            variant="primary"
            size="md"
            onClick={openDemoModal}
            className="bg-[#14532d] hover:bg-[#166534] text-white font-bold rounded-xl px-5 shadow-sm text-sm"
          >
            {c(COPY.bookDemo)}
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="main-content" tabIndex={-1} className="outline-none">
        {/* Reporting Disclaimer Banner (Phase 2 Requirement) */}
        <section className="bg-emerald-50 border-b border-emerald-200/80 px-4 sm:px-12 py-3 text-left">
          <div className="max-w-7xl mx-auto flex items-start gap-3 text-sm text-emerald-950 font-medium leading-relaxed">
            <Info className="w-5 h-5 text-[#15803d] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <strong className="font-bold text-emerald-900">{c(COPY.reportingDisclaimerTitle)}: </strong>
              <span>{c(COPY.reportingDisclaimerBody)}</span>
            </div>
          </div>
        </section>

        {/* Hero Section */}
        <section className="pt-12 sm:pt-16 pb-16 px-4 sm:px-12 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 text-left space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#dcfce7] text-[#15803d] font-mono text-sm font-bold tracking-wide uppercase">
                <ShieldCheck className="w-4 h-4" />
                <span>{c(COPY.heroBadge)}</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-black text-[#0f172a] font-display tracking-tight leading-[1.12]">
                {c(COPY.heroTitle1)}{' '}
                <span className="text-[#15803d]">{c(COPY.heroTitle2)}</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-lg">
                {getHeroSubtitle()}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Button
                  id="hero-book-demo-btn"
                  data-testid="hero-book-demo-btn"
                  variant="primary"
                  size="lg"
                  onClick={openDemoModal}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  className="bg-[#14532d] hover:bg-[#166534] text-white rounded-xl px-6 py-3.5 font-bold shadow-md text-base"
                >
                  {c(COPY.bookDemo)}
                </Button>

                <Link to="/login">
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-slate-300 hover:border-slate-400 bg-white text-slate-800 rounded-xl px-6 py-3.5 font-bold shadow-xs text-base"
                  >
                    {c(COPY.signIn)}
                  </Button>
                </Link>

                <a
                  href="#video"
                  className="text-sm font-bold text-[#15803d] hover:underline flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#14532d] rounded-md px-2 py-1"
                >
                  {c(COPY.watchDemoLink)}
                </a>
              </div>
            </div>

            {/* Hero Visual Register Preview */}
            <div className="lg:col-span-6 relative flex items-center justify-center">
              <div className="relative w-full max-w-[480px] aspect-square flex items-center justify-center">
                <div className="absolute inset-4 rounded-full border-2 border-emerald-400/40 bg-radial from-emerald-500/10 via-emerald-400/5 to-transparent animate-pulse" />

                <motion.div
                  {...float({ y: [0, -12, 0], x: [0, 6, 0] }, 4)}
                  className="absolute top-6 right-12 w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-600 to-lime-400 shadow-lg shadow-emerald-500/40"
                />
                <motion.div
                  {...float({ y: [0, 10, 0], x: [0, -8, 0] }, 5, 0.5)}
                  className="absolute bottom-12 left-8 w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-lime-400 shadow-lg shadow-emerald-500/40"
                />

                <motion.div
                  {...float({ y: [0, -6, 0] }, 4)}
                  className="absolute top-10 left-6 z-20 px-4 py-2 rounded-full bg-white/95 border border-slate-200 shadow-md text-sm font-bold font-display text-slate-800 flex items-center gap-2"
                >
                  <Clock className="w-4 h-4 text-[#15803d]" />
                  <span>09:02 AM</span>
                </motion.div>

                <motion.div
                  {...float({ y: [0, 8, 0] }, 4.5, 0.8)}
                  className="absolute bottom-8 right-6 z-20 px-4 py-2 rounded-full bg-white/95 border border-emerald-200 shadow-md text-sm font-bold font-display text-slate-800 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#15803d]" />
                  <span>{c(COPY.pillOffline)}</span>
                </motion.div>

                {/* Central Appliance Card Mockup */}
                <div className="relative z-10 w-full max-w-[380px] rounded-3xl bg-white border border-slate-200/90 shadow-2xl p-6 space-y-4 text-left">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#14532d] flex items-center justify-center text-white font-bold text-xs font-display">
                        AE
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 font-display">{c(COPY.regTitle)}</div>
                        <div className="text-xs text-slate-700 font-mono font-semibold">CLASS 9-A • 48 ENROLLED</div>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-[#dcfce7] text-[#15803d] text-xs font-black font-mono">
                      {c(COPY.regPresent)}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    {[
                      { name: 'Ananya Roy', roll: 'Roll 01', time: '09:01:14 AM' },
                      { name: 'Rohan Banerjee', roll: 'Roll 02', time: '09:01:22 AM' },
                      { name: 'Pooja Sharma', roll: 'Roll 03', time: '09:01:28 AM' },
                    ].map((st) => (
                      <div key={st.roll} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-[#15803d]" />
                          <span className="font-semibold text-slate-800">{st.name}</span>
                          <span className="text-xs text-slate-700 font-mono font-semibold">({st.roll})</span>
                        </div>
                        <span className="text-xs text-slate-700 font-mono font-semibold">{st.time}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700 font-mono font-semibold">
                    <span className="flex items-center gap-1.5 text-[#15803d] font-bold">
                      <WifiOff className="w-3.5 h-3.5" />
                      {c(COPY.regOfflineTag)}
                    </span>
                    <span>48 / 48 LOGGED</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities Strip */}
        <section className="border-y border-slate-200 bg-white py-6 px-4 sm:px-12">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-center">
            {CAPABILITIES.map((cap, i) => (
              <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl text-left">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-[#15803d] flex items-center justify-center shrink-0">
                  <cap.icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-bold text-slate-700 leading-tight">{c(cap.label)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Section 1: How It Works */}
        <section id="how-it-works" className="py-20 px-4 sm:px-12 max-w-7xl mx-auto w-full space-y-12 text-center scroll-mt-24">
          <div className="space-y-2">
            <span className="text-sm font-mono font-bold tracking-wider text-slate-700 uppercase">{c(COPY.howKicker)}</span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0f172a] font-display tracking-tight">{c(COPY.howTitle)}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            {/* Card 1: Interactive Scanner Demonstration */}
            <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-md space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#15803d] flex items-center justify-center">
                  <ScanLine className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 font-display">{c(COPY.howCard1Title)}</h3>
                <p className="text-base text-slate-600 leading-relaxed">{c(COPY.howCard1Desc)}</p>
              </div>

              {/* Interactive Simulation Area */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleSimulateScan}
                  disabled={simScanning}
                  isLoading={simScanning}
                  className="w-full bg-white hover:bg-slate-100 text-[#14532d] font-bold border-slate-300 text-sm"
                >
                  {simScanning ? c(COPY.howCard1Scanning) : c(COPY.howCard1Cta)}
                </Button>

                {simSuccess && simStudent && (
                  <div className="p-3.5 rounded-xl bg-[#dcfce7] border border-emerald-300 text-emerald-950 flex items-center justify-between text-sm animate-fade-in">
                    <div>
                      <div className="font-bold">{simStudent.name}</div>
                      <div className="text-xs text-emerald-800 font-mono">
                        {simStudent.class} • {simStudent.roll}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-[#15803d] font-mono">{c(COPY.simVerified)}</div>
                      <div className="text-xs text-emerald-800 font-mono">{simStudent.time}</div>
                    </div>
                  </div>
                )}

                <div className="text-xs text-slate-700 font-semibold text-center">
                  {c(COPY.simNote)}
                </div>
              </div>
            </div>

            {/* Card 2: Reconnection and Sync */}
            <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-md space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#15803d] flex items-center justify-center">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 font-display">{c(COPY.howCard2Title)}</h3>
                <p className="text-base text-slate-600 leading-relaxed">{c(COPY.howCard2Desc)}</p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-center gap-3">
                <div className="flex items-center gap-3 text-sm text-slate-700 font-semibold">
                  <CheckCircle className="w-5 h-5 text-[#15803d] shrink-0" />
                  <span>{c(COPY.capOffline)}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-700 font-semibold">
                  <CheckCircle className="w-5 h-5 text-[#15803d] shrink-0" />
                  <span>{c(COPY.capUdise)}</span>
                </div>
                <div className="pt-2">
                  <Link to="/login" className="block">
                    <Button variant="secondary" size="md" className="w-full font-bold text-sm">
                      {c(COPY.howCard2Cta)}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Getting Started (8 Clear Stages) */}
        <section id="getting-started" className="py-20 px-4 sm:px-12 max-w-7xl mx-auto w-full space-y-12 text-center scroll-mt-24">
          <div className="space-y-2">
            <span className="text-sm font-mono font-bold tracking-wider text-slate-700 uppercase">{c(COPY.startKicker)}</span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0f172a] font-display tracking-tight">{c(COPY.startTitle)}</h2>
          </div>

          {/* Stage selector tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2" role="tablist" aria-label="Onboarding Steps">
            {ONBOARDING_STAGES.map((st, idx) => (
              <button
                key={st.key}
                type="button"
                role="tab"
                aria-selected={selectedStageIndex === idx}
                onClick={() => setSelectedStageIndex(idx)}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#14532d] ${
                  selectedStageIndex === idx
                    ? 'bg-[#14532d] text-white border-[#14532d] shadow-md'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-mono font-bold">{c(COPY.stepWord)} {st.step}</div>
                <div className="text-sm font-bold truncate mt-0.5">{c(st.name)}</div>
              </button>
            ))}
          </div>

          {/* Selected Stage Detail Card */}
          <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200 shadow-xl max-w-4xl mx-auto text-left grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-7 space-y-4">
              <div className="inline-block px-3 py-1 rounded-md bg-emerald-50 text-[#15803d] font-mono text-xs font-bold uppercase">
                {c(selectedStage.badge)}
              </div>
              <h3 className="text-2xl font-black text-[#0f172a] font-display">{c(selectedStage.title)}</h3>
              <p className="text-base text-slate-600 leading-relaxed">{c(selectedStage.subtitle)}</p>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800">
                <span className="font-bold text-slate-900">{c(COPY.startDeliverable)}: </span>
                <span>{c(selectedStage.deliverable)}</span>
              </div>
            </div>
            <div className="md:col-span-5 flex items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-slate-50 border border-slate-200">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-[#14532d] text-white mx-auto flex items-center justify-center font-black text-2xl font-display shadow-md">
                  {selectedStage.step}
                </div>
                <div className="font-bold text-slate-900 text-base">{c(selectedStage.name)}</div>
                <div className="text-xs font-mono text-slate-700 font-semibold">{c(selectedStage.tag)}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Built for Real Classrooms */}
        <section className="py-20 px-4 sm:px-12 bg-slate-100/70 border-y border-slate-200">
          <div className="max-w-7xl mx-auto space-y-12 text-center">
            <div className="space-y-3 max-w-3xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-black text-[#0f172a] font-display tracking-tight">{c(COPY.featTitle)}</h2>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed">{c(COPY.featSubtitle)}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#15803d] flex items-center justify-center">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 font-display">{c(COPY.feat1Title)}</h3>
                <p className="text-base text-slate-600 leading-relaxed">{c(COPY.feat1Desc)}</p>
              </div>

              <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#15803d] flex items-center justify-center">
                  <WifiOff className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 font-display">{c(COPY.feat2Title)}</h3>
                <p className="text-base text-slate-600 leading-relaxed">{c(COPY.feat2Desc)}</p>
              </div>

              <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#15803d] flex items-center justify-center">
                  <FileCheck className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 font-display">{c(COPY.feat3Title)}</h3>
                <p className="text-base text-slate-600 leading-relaxed">{c(COPY.feat3Desc)}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section (Phase 3: Render ONLY if verified consent testimonials exist) */}
        {verifiedTestimonials.length > 0 && (
          <section className="py-20 px-4 sm:px-12 max-w-7xl mx-auto w-full space-y-8 text-center">
            <h2 className="text-3xl font-black text-[#0f172a] font-display">Verified School Feedback</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
              {verifiedTestimonials.map((t) => (
                <div key={t.id} className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
                  <p className="text-base italic text-slate-700 leading-relaxed">"{t.quote}"</p>
                  <div>
                    <div className="font-bold text-slate-900">{t.personName}</div>
                    <div className="text-sm text-slate-700">{t.role}, {t.organization}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Demo Video Section (Phase 9 Security & Hostname Validation) */}
        <section id="video" className="py-20 px-4 sm:px-12 max-w-7xl mx-auto w-full space-y-12 text-center scroll-mt-24">
          <div className="space-y-2">
            <span className="text-sm font-mono font-bold tracking-wider text-slate-700 uppercase">{c(COPY.videoKicker)}</span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0f172a] font-display tracking-tight">{c(COPY.videoTitle)}</h2>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">{c(COPY.videoSubtitle)}</p>
          </div>

          <div className="max-w-3xl mx-auto">
            {safeVideoEmbedUrl ? (
              <div className="relative w-full rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-black" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={safeVideoEmbedUrl}
                  title={c(COPY.videoIframeTitle)}
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            ) : (
              /* Interactive placeholder when no video URL is configured */
              <button
                type="button"
                onClick={openDemoModal}
                className="relative w-full rounded-3xl overflow-hidden border border-emerald-200 shadow-xl bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] flex flex-col items-center justify-center gap-5 py-20 group hover:shadow-2xl transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-[#14532d]"
                aria-label={c(COPY.videoWatchBtn)}
              >
                <div className="w-20 h-20 rounded-full bg-white border border-emerald-300 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <PlayCircle className="w-10 h-10 text-[#15803d]" />
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-xl font-black text-[#0f172a] font-display">{c(COPY.videoCardTitle)}</p>
                  <p className="text-sm text-slate-600">{c(COPY.videoCardDesc)}</p>
                </div>
                <span className="px-6 py-3 rounded-xl bg-[#14532d] text-white text-sm font-bold shadow-sm group-hover:bg-[#166534] transition-colors">
                  {c(COPY.videoWatchBtn)}
                </span>
              </button>
            )}
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 px-4 sm:px-12 max-w-7xl mx-auto w-full space-y-12 text-center scroll-mt-24">
          <div className="space-y-2">
            <span className="text-sm font-mono font-bold tracking-wider text-slate-700 uppercase">{c(COPY.pricingKicker)}</span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0f172a] font-display tracking-tight">{c(COPY.pricingTitle)}</h2>
            <p className="text-base text-slate-600 max-w-2xl mx-auto">{c(COPY.pricingSubtitle)}</p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="p-10 rounded-3xl bg-[#14532d] text-white shadow-2xl space-y-8 relative overflow-hidden text-left">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative space-y-2 text-center">
                <div className="flex items-end justify-center gap-2">
                  <span className="text-6xl font-black font-display tracking-tight">{getPricingAmount()}</span>
                  <span className="text-emerald-300 text-base font-semibold pb-3">{getPricingPerStudent()}</span>
                </div>
                <p className="text-emerald-200/90 text-sm font-medium">{getPricingFreeNote()}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-emerald-100 pt-4">
                {[
                  COPY.pricingFeat1,
                  COPY.pricingFeat2,
                  COPY.pricingFeat3,
                  COPY.pricingFeat4,
                  COPY.pricingFeat5,
                  COPY.pricingFeat6,
                ].map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>{c(feat)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={openDemoModal}
                  className="w-full bg-white hover:bg-slate-100 text-[#14532d] font-black rounded-xl py-4 shadow-md text-base"
                >
                  {c(COPY.bookDemo)}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Savings & Comparison Calculator (Phase 7 Requirement) */}
        <section id="roi" className="py-20 px-4 sm:px-12 max-w-7xl mx-auto w-full space-y-12 text-center scroll-mt-24">
          <div className="space-y-2">
            <span className="text-sm font-mono font-bold tracking-wider text-slate-700 uppercase">{c(COPY.roiKicker)}</span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0f172a] font-display tracking-tight">{c(COPY.roiTitle)}</h2>
            <p className="text-base text-slate-600 max-w-2xl mx-auto">{c(COPY.roiSubtitle)}</p>
          </div>

          <div className="rounded-3xl bg-white border border-slate-200 shadow-xl p-8 sm:p-12 max-w-5xl mx-auto space-y-8 text-left">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Controls */}
              <div className="lg:col-span-6 space-y-6">
                <div>
                  <label htmlFor="student-slider" className="block text-base font-extrabold text-[#0f172a] font-display mb-2">
                    {c(COPY.roiSliderLabel)}:{' '}
                    <span className="text-[#15803d]">
                      {studentCount.toLocaleString()} {c(COPY.roiStudents)}
                    </span>
                  </label>
                  <input
                    id="student-slider"
                    type="range"
                    min="50"
                    max="3000"
                    step="50"
                    value={studentCount}
                    onChange={(e) => setStudentCount(Number(e.target.value))}
                    className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#15803d]"
                    aria-valuemin={50}
                    aria-valuemax={3000}
                    aria-valuenow={studentCount}
                  />
                  <div className="flex justify-between text-xs text-slate-700 mt-2 font-mono font-semibold">
                    <span>50</span>
                    <span>1,500</span>
                    <span>3,000</span>
                  </div>
                </div>

                {/* Mode Selector */}
                <div>
                  <div className="text-sm font-bold text-slate-800 mb-2">{c(COPY.roiModeLabel)}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setAttendanceMode('QR')}
                      aria-pressed={attendanceMode === 'QR'}
                      className={`p-3 rounded-xl border text-center font-bold text-sm transition-colors cursor-pointer ${
                        attendanceMode === 'QR'
                          ? 'bg-[#14532d] text-white border-[#14532d] shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {c(COPY.roiModeQr)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendanceMode('RFID')}
                      aria-pressed={attendanceMode === 'RFID'}
                      className={`p-3 rounded-xl border text-center font-bold text-sm transition-colors cursor-pointer ${
                        attendanceMode === 'RFID'
                          ? 'bg-[#14532d] text-white border-[#14532d] shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {c(COPY.roiModeRfid)}
                    </button>
                  </div>
                </div>

                <div className="space-y-3 text-sm text-slate-600">
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

              {/* Output metric tiles */}
              <div className="lg:col-span-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-slate-100 border border-slate-200">
                    <div className="text-xs font-bold text-slate-700 uppercase">{c(COPY.roiHoursLabel)}</div>
                    <div className="text-3xl font-black text-[#0f172a] font-display mt-1">
                      ~{estimates.annualTeacherHoursSaved.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-700 font-semibold mt-0.5">{c(COPY.roiPerYear)}</div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-100 border border-slate-200">
                    <div className="text-xs font-bold text-slate-700 uppercase">{c(COPY.roiPaperLabel)}</div>
                    <div className="text-3xl font-black text-[#0f172a] font-display mt-1">
                      ~{estimates.annualPaperSheetsSaved.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-700 font-semibold mt-0.5">{c(COPY.roiPerYear)}</div>
                  </div>
                </div>

                {/* Prominent Illustrative Disclaimer */}
                <div className="p-4 rounded-2xl bg-[#dcfce7] border border-emerald-300 text-sm text-emerald-950 flex items-start gap-2.5 leading-relaxed font-medium">
                  <Lightbulb className="w-5 h-5 text-[#15803d] shrink-0 mt-0.5" />
                  <span>{c(COPY.roiDisclaimer)}</span>
                </div>
              </div>
            </div>

            {/* Expandable Calculation Methodology */}
            <div className="border-t border-slate-200 pt-6">
              <button
                type="button"
                onClick={() => setShowMethodology(!showMethodology)}
                className="flex items-center justify-between w-full text-left font-bold text-sm text-slate-800 hover:text-[#14532d] transition-colors focus:outline-none focus:ring-2 focus:ring-[#14532d] rounded-lg p-2"
                aria-expanded={showMethodology}
              >
                <span>{c(COPY.roiMethodologyToggle)}</span>
                {showMethodology ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>

              {showMethodology && (
                <div className="mt-4 p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-sm text-slate-700 animate-fade-in">
                  <h4 className="font-bold text-slate-900 font-display">
                    {CALCULATION_METHODOLOGY[language]?.title || CALCULATION_METHODOLOGY.en.title}
                  </h4>
                  <ul className="space-y-2 list-disc list-inside">
                    {(CALCULATION_METHODOLOGY[language]?.points || CALCULATION_METHODOLOGY.en.points).map((pt, i) => (
                      <li key={i} className="leading-relaxed">{pt}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Truthful & Evidence-Based Comparison Table */}
            <div className="border-t border-slate-200 pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-extrabold text-[#0f172a] font-display text-lg">
                  {c(COPY.compSubTitle)}
                </h3>
                <span className="text-xs text-slate-700 font-mono font-semibold">
                  {studentCount} STUDENTS • {estimates.mode} MODE
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th scope="col" className="px-5 py-3.5 font-bold text-slate-700 w-2/5">
                        {c(COPY.compHeaderFeature)}
                      </th>
                      <th scope="col" className="px-4 py-3.5 font-extrabold text-[#14532d] font-display text-center">
                        {c(COPY.compHeaderAE)}
                      </th>
                      <th scope="col" className="px-4 py-3.5 font-bold text-slate-600 text-center">
                        {c(COPY.compHeaderPaper)}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { f: COPY.compRow1Feature, ae: COPY.compRow1Ae, paper: COPY.compRow1Paper },
                      { f: COPY.compRow2Feature, ae: COPY.compRow2Ae, paper: COPY.compRow2Paper },
                      { f: COPY.compRow3Feature, ae: COPY.compRow3Ae, paper: COPY.compRow3Paper },
                      { f: COPY.compRow4Feature, ae: COPY.compRow4Ae, paper: COPY.compRow4Paper },
                      { f: COPY.compRow5Feature, ae: COPY.compRow5Ae, paper: COPY.compRow5Paper },
                    ].map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5 font-semibold text-slate-800">{c(row.f)}</td>
                        <td className="px-4 py-3.5 text-center font-bold text-[#14532d]">{c(row.ae)}</td>
                        <td className="px-4 py-3.5 text-center text-slate-600">{c(row.paper)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section id="contact" className="bg-[#14532d] text-white py-24 px-4 sm:px-12 text-center space-y-8 relative overflow-hidden mt-auto scroll-mt-24">
          <div className="max-w-3xl mx-auto space-y-4">
            <span className="text-sm font-mono font-bold tracking-widest text-emerald-300 uppercase">{c(COPY.ctaKicker)}</span>
            <h2 className="text-3xl sm:text-5xl font-black font-display tracking-tight leading-tight">{c(COPY.ctaTitle)}</h2>
            <p className="text-emerald-100 text-base sm:text-lg max-w-xl mx-auto">{c(COPY.ctaSubtitle)}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Button
              variant="secondary"
              size="lg"
              onClick={openDemoModal}
              className="bg-white hover:bg-slate-100 text-[#14532d] font-bold rounded-xl px-8 py-3.5 shadow-lg shadow-black/20 text-base"
            >
              {c(COPY.bookDemo)}
            </Button>
            <Link to="/login">
              <Button
                variant="ghost"
                size="lg"
                className="text-white hover:bg-[#166534] border border-emerald-400/40 rounded-xl px-8 py-3.5 font-bold text-base"
              >
                {c(COPY.signIn)}
              </Button>
            </Link>
          </div>

          <div className="text-sm text-emerald-200/90 font-medium">
            {c(COPY.ctaContact)}:{' '}
            <a href="mailto:hello@attendease.in" className="underline hover:text-white transition-colors">
              hello@attendease.in
            </a>
          </div>

          <div className="absolute right-8 bottom-8 text-emerald-600/30">
            <Sparkles className="w-16 h-16" />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#0f172a] text-white py-10 px-4 sm:px-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto space-y-6 text-sm text-slate-400">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-6 font-semibold">
              <a href="#how-it-works" className="hover:text-white transition-colors">{c(COPY.navHowItWorks)}</a>
              <a href="#getting-started" className="hover:text-white transition-colors">{c(COPY.navGettingStarted)}</a>
              <a href="#pricing" className="hover:text-white transition-colors">{c(COPY.navPricing)}</a>
              <a href="#roi" className="hover:text-white transition-colors">{c(COPY.navSavings)}</a>
              <Link to="/login" className="hover:text-white transition-colors">{c(COPY.signIn)}</Link>
            </div>
            <div className="flex items-center gap-2 font-display font-black text-base text-white">
              <div className="w-7 h-7 rounded-lg bg-[#15803d] flex items-center justify-center text-white text-xs font-display">AE</div>
              <span>AttendEase</span>
            </div>
            <div className="flex flex-wrap items-center gap-5 font-semibold">
              <Link to="/privacy" className="hover:text-white transition-colors">{c(COPY.footerPrivacy)}</Link>
              <Link to="/terms" className="hover:text-white transition-colors">{c(COPY.footerTerms)}</Link>
              <a href="mailto:hello@attendease.in" className="hover:text-white transition-colors">{c(COPY.footerContact)}</a>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4 text-xs">
            <span>{c(COPY.footerCompliance)}</span>
            <span>{c(COPY.footerCopyright)}</span>
          </div>
        </div>
      </footer>

      {/* Privacy-Safe Demo Request Dialog (Phase 10 Requirement) */}
      <Dialog
        isOpen={demoModalOpen}
        onClose={closeDemoModal}
        title={c(COPY.demoTitle)}
        description={c(COPY.demoDesc)}
      >
        {demoSubmitted ? (
          <div data-testid="demo-success-state" className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-[#dcfce7] text-[#15803d] border border-emerald-200 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 font-display">{c(COPY.demoSuccessTitle)}</h3>
            <p className="text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">{c(COPY.demoSuccessBody)}</p>
            <p className="text-sm font-mono font-bold text-slate-900">{demoForm.phone}</p>
            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={closeDemoModal}
                className="bg-[#14532d] hover:bg-[#166534] text-white font-bold"
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
              id="demo-form-name"
              data-testid="demo-form-name"
              label={c(COPY.demoName)}
              required
              value={demoForm.name}
              onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
              placeholder={c(COPY.demoNamePlaceholder)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                id="demo-form-phone"
                data-testid="demo-form-phone"
                label={c(COPY.demoPhone)}
                type="tel"
                prefixText="+91"
                required
                value={demoForm.phone}
                onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                placeholder={c(COPY.demoPhonePlaceholder)}
              />
              <TextField
                id="demo-form-email"
                data-testid="demo-form-email"
                label={c(COPY.demoEmail)}
                type="email"
                value={demoForm.email}
                onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                placeholder={c(COPY.demoEmailPlaceholder)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                id="demo-form-school"
                data-testid="demo-form-school"
                label={c(COPY.demoSchool)}
                required
                value={demoForm.schoolName}
                onChange={(e) => setDemoForm({ ...demoForm, schoolName: e.target.value })}
                placeholder={c(COPY.demoSchoolPlaceholder)}
              />
              <TextField
                id="demo-form-district"
                data-testid="demo-form-district"
                label={c(COPY.demoDistrict)}
                required
                value={demoForm.district}
                onChange={(e) => setDemoForm({ ...demoForm, district: e.target.value })}
                placeholder={c(COPY.demoDistrictPlaceholder)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="demo-student-count" className="block text-sm font-bold text-slate-700 mb-1.5">
                  {c(COPY.demoStudents)}
                </label>
                <select
                  id="demo-student-count"
                  data-testid="demo-student-count"
                  value={demoForm.studentCount}
                  onChange={(e) => setDemoForm({ ...demoForm, studentCount: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 outline-none focus:border-[#14532d] cursor-pointer"
                >
                  <option value="Under 300">Under 300</option>
                  <option value="300-750">300 – 750</option>
                  <option value="750-1500">750 – 1,500</option>
                  <option value="1500+">1,500+</option>
                </select>
              </div>

              <div>
                <label htmlFor="demo-lang-pref" className="block text-sm font-bold text-slate-700 mb-1.5">
                  {c(COPY.demoLangPref)}
                </label>
                <select
                  id="demo-lang-pref"
                  data-testid="demo-lang-pref"
                  value={demoForm.preferredLanguage}
                  onChange={(e) => setDemoForm({ ...demoForm, preferredLanguage: e.target.value as any })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 outline-none focus:border-[#14532d] cursor-pointer"
                >
                  <option value="en">English</option>
                  <option value="bn">বাংলা (Bengali)</option>
                  <option value="hi">हिंदी (Hindi)</option>
                </select>
              </div>
            </div>

            {/* Privacy & Purpose Notice */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
              {c(COPY.demoPurposeNotice)}
            </div>

            {/* Explicit Consent Checkbox */}
            <div className="flex items-start gap-2.5 pt-1">
              <input
                id="demo-consent-checkbox"
                data-testid="demo-consent-checkbox"
                type="checkbox"
                checked={demoConsent}
                onChange={(e) => setDemoConsent(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[#14532d] focus:ring-[#14532d] cursor-pointer"
                required
              />
              <label htmlFor="demo-consent-checkbox" className="text-xs text-slate-700 leading-snug cursor-pointer select-none">
                {c(COPY.demoConsentLabel)}
              </label>
            </div>

            <div className="pt-3 flex justify-end gap-2.5">
              <Button
                variant="secondary"
                size="md"
                type="button"
                onClick={closeDemoModal}
              >
                {c(COPY.demoCancel)}
              </Button>
              <Button
                id="demo-form-submit"
                data-testid="demo-form-submit"
                variant="primary"
                size="md"
                type="submit"
                isLoading={isSubmittingDemo}
                className="bg-[#14532d] hover:bg-[#166534] text-white font-bold"
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
