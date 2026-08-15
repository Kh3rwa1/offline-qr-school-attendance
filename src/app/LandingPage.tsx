import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wifi,
  WifiOff,
  Radio,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  ScanLine,
  Users,
  Building2,
  FileSpreadsheet,
  Zap,
  Clock,
  Award,
  ChevronRight,
  Layers,
  Sparkles,
  Laptop,
  Check,
  Activity,
  Lock,
  Cpu,
  RefreshCw,
  Sliders,
  Database,
  ExternalLink,
  ChevronDown,
  ArrowUpRight,
  Smartphone,
  CheckCircle,
  FileCheck,
  MessageSquareText,
  Lightbulb,
  BookOpen,
  ArrowDownToLine,
  FileText,
  School,
  QrCode,
  Globe,
} from 'lucide-react';
import { Button, TextField, Dialog, Badge, Toast } from '../components/ui';

interface OnboardingStage {
  step: number;
  key: string;
  name: string;
  title: string;
  subtitle: string;
  deliverable: string;
  impact: string;
}

const ONBOARDING_STAGES: OnboardingStage[] = [
  {
    step: 1,
    key: 'discover',
    name: '1. Discover',
    title: 'Discover Offline-First Infrastructure',
    subtitle: 'See how simple mobile camera or student smartcards take roll call in 1 second with zero hardware costs.',
    deliverable: 'Platform Architecture & Sample Student Card',
    impact: 'No costly machines needed',
  },
  {
    step: 2,
    key: 'understand',
    name: '2. Understand',
    title: 'Understand Compliance & Privacy',
    subtitle: 'UDISE+ standardized format data exports and strict student privacy guarantees with zero cloud leaks.',
    deliverable: 'UDISE+ & DPDP Compliance Checklist',
    impact: '100% safe & government ready',
  },
  {
    step: 3,
    key: 'request_demo',
    name: '3. Request Demo',
    title: 'Hands-On Interactive Trial',
    subtitle: 'A 15-minute live guided sandbox session for your Headmaster and teachers to test offline roll calls.',
    deliverable: 'Custom Institutional Demo Workspace',
    impact: 'Test offline mode yourself',
  },
  {
    step: 4,
    key: 'agreement',
    name: '4. Sign Agreement',
    title: 'Simple Institutional Agreement',
    subtitle: 'Straightforward school SLA and governance agreement ensuring your school retains 100% data ownership.',
    deliverable: 'Signed Institutional Agreement',
    impact: 'Zero lock-in commitment',
  },
  {
    step: 5,
    key: 'provision',
    name: '5. Provision School',
    title: 'Provision School Portal',
    subtitle: 'Generate a stable workspace path /s/green-valley — isolated school workspace with phone login.',
    deliverable: 'Isolated School Workspace & Admin Credentials',
    impact: 'Generate a stable workspace path /s/green-valley',
  },
  {
    step: 6,
    key: 'import_students',
    name: '6. Import Students',
    title: 'Import Student Rosters',
    subtitle: 'Upload your existing Excel spreadsheet to onboard 500 to 5,000 students and generate printable QR cards.',
    deliverable: 'Verified Active Student Directory',
    impact: 'Ready in 2 seconds',
  },
  {
    step: 7,
    key: 'train_staff',
    name: '7. Train Staff',
    title: '5-Minute Teacher Training',
    subtitle: 'Ultra-simple phone onboarding so any teacher can record full class attendance in under 90 seconds.',
    deliverable: 'Teacher Quick-Start Pocket Cards',
    impact: 'Anyone can use it instantly',
  },
  {
    step: 8,
    key: 'go_live',
    name: '8. Go Live',
    title: 'Full Morning Rollout',
    subtitle: 'Simultaneous classroom and gate scanning with automated parent arrival SMS alerts and live dashboard stats.',
    deliverable: '100% Operational School System',
    impact: 'School attendance up 150%',
  },
];

export const LandingPage: React.FC = () => {
  const [selectedStageIndex, setSelectedStageIndex] = useState(4); // Default to stage 5 for quick preview
  const [studentCount, setStudentCount] = useState<number>(750);

  // Interactive Simulator State
  const [simScanning, setSimScanning] = useState(false);
  const [simSuccess, setSimSuccess] = useState(false);
  const [simStudent, setSimStudent] = useState<{
    name: string;
    roll: string;
    class: string;
    time: string;
    latencyMs: number;
  } | null>(null);

  // Demo Modal State
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [demoSubmitted, setDemoSubmitted] = useState(false);
  const [isSubmittingDemo, setIsSubmittingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  // Demo Form State
  const [demoForm, setDemoForm] = useState({
    name: '',
    phone: '',
    email: '',
    schoolName: '',
    district: '',
    studentCount: '500-1000',
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
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

      setSimStudent({
        ...pick,
        time: timeStr,
        latencyMs: 12,
      });
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
      const formattedPhone = rawPhone.startsWith('+91')
        ? rawPhone
        : `+91${rawPhone.replace(/\D/g, '')}`;

      const res = await fetch('/api/v1/public/demo-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
        setDemoError(data.message || data.error || 'Failed to record demo request. Please verify fields and try again.');
      }
    } catch (err: any) {
      setDemoError('Network connection issue. Please retry demo request.');
    } finally {
      setIsSubmittingDemo(false);
    }
  };

  const selectedStage = ONBOARDING_STAGES[selectedStageIndex];

  // Calculated ROI Metrics
  const teacherHoursSavedPerYear = Math.round((studentCount * 0.08 * 220) / 60);
  const paperSavedPages = studentCount * 12 * 4;

  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#0f172a] flex flex-col selection:bg-[#15803d] selection:text-white font-sans antialiased">
      {/* Top Header Navbar */}
      <header className="sticky top-0 z-50 px-4 sm:px-12 py-4 flex items-center justify-between backdrop-blur-md bg-white/90 border-b border-slate-200/80 transition-all">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-[#14532d] flex items-center justify-center text-white font-black text-sm font-display shadow-md shadow-emerald-900/20 group-hover:scale-105 transition-transform">
            AZ
          </div>
          <span className="text-xl font-black text-[#0f172a] font-display tracking-tight">
            AttendEase
          </span>
        </Link>

        {/* Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
          <a href="#how-it-works" className="hover:text-[#14532d] transition-colors">
            How it works
          </a>
          <a href="#plans" className="hover:text-[#14532d] transition-colors">
            Plans
          </a>
          <a href="#case-studies" className="hover:text-[#14532d] transition-colors">
            Case Studies
          </a>
          <a href="#roi" className="hover:text-[#14532d] transition-colors">
            Calculator
          </a>
        </nav>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <Link to="/login" className="hidden sm:inline-block">
            <Button variant="ghost" size="sm" className="font-bold text-slate-700 hover:text-[#14532d]">
              School Sign In
            </Button>
          </Link>
          <Button
            variant="primary"
            size="md"
            onClick={() => setDemoModalOpen(true)}
            className="bg-[#14532d] hover:bg-[#166534] text-white font-bold rounded-xl px-5 shadow-sm"
          >
            Book a Demo
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-12 sm:pt-20 pb-16 px-4 sm:px-12 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Hero Left Content */}
          <div className="lg:col-span-6 text-left space-y-6">
            {/* Pill Badge */}
            <div className="inline-block px-3 py-1 rounded-md bg-[#dcfce7] text-[#15803d] font-mono text-xs font-black tracking-wider uppercase">
              ATTENDEASE ATTENDANCE
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-black text-[#0f172a] font-display tracking-tight leading-[1.12]">
              Attendance <br />
              infrastructure <span className="text-[#15803d]">built</span> <br />
              <span className="text-[#15803d]">for zero-connectivity</span> <br />
              <span className="text-[#15803d]">classrooms.</span>
            </h1>

            {/* Subtext */}
            <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-lg">
              Supercharged offline roll calls for educators. Take morning attendance in 1 second per student using any standard phone camera or smartcard, 100% offline.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link to="/login">
                <Button
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  className="bg-[#0f172a] hover:bg-slate-800 text-white rounded-xl px-6 py-3.5 font-bold shadow-md"
                >
                  School Sign In
                </Button>
              </Link>

              <Button
                variant="outline"
                size="lg"
                onClick={() => setDemoModalOpen(true)}
                className="border-slate-300 hover:border-slate-400 bg-white text-slate-800 rounded-xl px-6 py-3.5 font-bold shadow-2xs"
              >
                Request a Demo
              </Button>
            </div>
          </div>

          {/* Hero Right 3D Visual Mockup */}
          <div className="lg:col-span-6 relative flex items-center justify-center">
            {/* 3D Orbit Pedestal Container */}
            <div className="relative w-full max-w-[480px] aspect-square flex items-center justify-center">
              {/* Outer Orbit Disc */}
              <div className="absolute inset-4 rounded-full border-2 border-emerald-400/40 bg-radial from-emerald-500/10 via-emerald-400/5 to-transparent animate-pulse" />

              {/* Floating Green Spheres */}
              <motion.div
                animate={{ y: [0, -12, 0], x: [0, 6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-6 right-12 w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-600 to-lime-400 shadow-lg shadow-emerald-500/40"
              />
              <motion.div
                animate={{ y: [0, 10, 0], x: [0, -8, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                className="absolute bottom-12 left-8 w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-lime-400 shadow-lg shadow-emerald-500/40"
              />
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute bottom-6 right-20 w-4 h-4 rounded-full bg-gradient-to-tr from-emerald-500 to-lime-300 shadow-md shadow-emerald-500/30"
              />

              {/* Floating Pill: 90s Setup */}
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-10 left-6 z-20 px-3.5 py-1.5 rounded-full bg-white/95 border border-slate-200 shadow-md text-xs font-bold font-display text-slate-800 flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-[#15803d]" />
                <span>90s Setup</span>
              </motion.div>

              {/* Floating Pill: Offline First */}
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                className="absolute top-8 right-6 z-20 px-3.5 py-1.5 rounded-full bg-white/95 border border-slate-200 shadow-md text-xs font-bold font-display text-slate-800 flex items-center gap-1.5"
              >
                <WifiOff className="w-3.5 h-3.5 text-[#15803d]" />
                <span>Offline First</span>
              </motion.div>

              {/* Floating Pill: SMS Backup */}
              <motion.div
                animate={{ y: [0, -7, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
                className="absolute bottom-16 left-6 z-20 px-3.5 py-1.5 rounded-full bg-white/95 border border-slate-200 shadow-md text-xs font-bold font-display text-slate-800 flex items-center gap-1.5"
              >
                <MessageSquareText className="w-3.5 h-3.5 text-[#15803d]" />
                <span>SMS Backup</span>
              </motion.div>

              {/* Floating Pill: UDISE+ */}
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                className="absolute bottom-14 right-6 z-20 px-3.5 py-1.5 rounded-full bg-white/95 border border-slate-200 shadow-md text-xs font-bold font-display text-slate-800 flex items-center gap-1.5"
              >
                <FileCheck className="w-3.5 h-3.5 text-[#15803d]" />
                <span>UDISE+</span>
              </motion.div>

              {/* 3D Stack of Attendance Register Cards */}
              <motion.div
                animate={{ rotate: [-12, -10, -12], y: [0, -6, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                className="relative z-10 w-72 sm:w-80 rounded-2xl bg-gradient-to-br from-[#fefce8] to-[#fef08a] p-5 shadow-2xl border border-yellow-200/80 transform -rotate-12"
              >
                {/* Underneath stacked paper shadows */}
                <div className="absolute inset-0 bg-[#fef9c3] rounded-2xl -rotate-3 -z-10 shadow-lg" />
                <div className="absolute inset-0 bg-[#fef08a] rounded-2xl rotate-4 -z-20 shadow-md" />

                {/* Card Ruled Lines & Header */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-yellow-300/80 pb-2">
                    <span className="font-mono text-[11px] font-bold text-yellow-900">
                      DAILY CLASS ATTENDANCE REGISTER
                    </span>
                    <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      VERIFIED
                    </span>
                  </div>

                  {/* Grid Lines with Tick Marks */}
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

      {/* Integration Ribbon Bar */}
      <section className="bg-[#14532d] py-6 px-4 sm:px-12 text-white">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-6 opacity-90 text-sm font-semibold">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-300" />
            <span>Google Classroom</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-300" />
            <span>Microsoft Teams</span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-300" />
            <span>Coursera</span>
          </div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-300" />
            <span>Khan Academy</span>
          </div>
          <div className="flex items-center gap-2">
            <School className="w-5 h-5 text-emerald-300" />
            <span>Govt Education Board</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-300" />
            <span>Classwork</span>
          </div>
        </div>
      </section>

      {/* Section 1: "SOLUTION & METHOD" -> "See How Simple Morning Attendance Is" */}
      <section id="how-it-works" className="py-20 px-4 sm:px-12 max-w-7xl mx-auto w-full space-y-12 text-center">
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold tracking-wider text-slate-500 uppercase">
            SOLUTION & METHOD
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-[#0f172a] font-display tracking-tight">
            See How Simple Morning Attendance Is
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-center max-w-4xl mx-auto">
          {/* Card 1: AttendEase App (Online/Offline Mode) */}
          <div className="p-8 sm:p-10 rounded-3xl bg-[#f0fdf4] border border-emerald-200/80 shadow-sm flex flex-col items-center space-y-5 hover:shadow-md transition-all">
            {/* Visual Icon */}
            <div className="w-20 h-20 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center shadow-xs">
              <ScanLine className="w-10 h-10 text-[#15803d]" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-[#0f172a] font-display">
                AttendEase App <br />
                (Online/Offline Mode)
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
                Mark your attendance and register in one click. Works without internet inside classrooms with zero latency.
              </p>
            </div>

            <div className="w-full pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleSimulateScan}
                isLoading={simScanning}
                className="bg-[#15803d] hover:bg-[#166534] text-white rounded-xl font-bold px-8 py-3 w-full sm:w-auto shadow-sm"
              >
                {simScanning ? 'Scanning Card...' : 'Scan Student'}
              </Button>
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
                    Verified: {simStudent.name}
                  </span>
                  <span>{simStudent.time}</span>
                </div>
                <div className="text-slate-600 flex justify-between">
                  <span>{simStudent.class} • {simStudent.roll}</span>
                  <span className="text-emerald-700 font-bold">{simStudent.latencyMs}ms check</span>
                </div>
              </motion.div>
            )}
          </div>

          {/* Card 2: Simple Upload (Internet Optional) */}
          <div className="p-8 sm:p-10 rounded-3xl bg-[#f0fdf4] border border-emerald-200/80 shadow-sm flex flex-col items-center space-y-5 hover:shadow-md transition-all">
            {/* Visual Icon */}
            <div className="w-20 h-20 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-10 h-10 text-[#15803d]" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold text-[#0f172a] font-display">
                Simple Upload <br />
                (Internet Optional)
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
                Upload the register to generate reports and auto sync data whenever your mobile device reconnects.
              </p>
            </div>

            <div className="w-full pt-2">
              <Link to="/login">
                <Button
                  variant="outline"
                  size="md"
                  className="bg-white hover:bg-slate-50 border-emerald-300 text-emerald-800 rounded-xl font-bold px-8 py-3 w-full sm:w-auto shadow-2xs"
                >
                  Upload Register
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: "CASE STUDY & ROLLOUT" -> "From Discovery to Morning Rollout" */}
      <section id="case-studies" className="py-20 px-4 sm:px-12 max-w-7xl mx-auto w-full space-y-12 text-center">
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold tracking-wider text-slate-500 uppercase">
            CASE STUDY & ROLLOUT
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-[#0f172a] font-display tracking-tight">
            From Discovery to Morning Rollout <br />
            <span className="text-slate-500 text-2xl font-bold font-sans">(Our Case Studies)</span>
          </h2>
        </div>

        {/* Split Container */}
        <div className="rounded-3xl bg-white border border-slate-200 shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 max-w-5xl mx-auto">
          {/* Left Side: 3D Lightbulb & Stepper */}
          <div className="lg:col-span-6 p-8 sm:p-10 bg-slate-50/70 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between space-y-6 text-left">
            {/* Visual 3D Lightbulb Illustration Container */}
            <div className="w-full h-44 rounded-2xl bg-gradient-to-b from-emerald-100/60 to-emerald-50 border border-emerald-200/60 flex items-center justify-center relative overflow-hidden">
              <motion.div
                animate={{ scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="w-20 h-20 rounded-full bg-emerald-400/30 flex items-center justify-center shadow-lg shadow-emerald-500/20"
              >
                <Lightbulb className="w-12 h-12 text-[#15803d]" />
              </motion.div>

              {/* Little Floating Classroom elements */}
              <div className="absolute bottom-3 left-4 flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-white/80 px-2.5 py-1 rounded-md border border-emerald-200">
                <School className="w-3.5 h-3.5 text-[#15803d]" />
                <span>Classroom Ready</span>
              </div>
              <div className="absolute top-3 right-4 flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-white/80 px-2.5 py-1 rounded-md border border-emerald-200">
                <Clock className="w-3.5 h-3.5 text-[#15803d]" />
                <span>&lt; 90s Roll Call</span>
              </div>
            </div>

            {/* 8-Stage Selectable List */}
            <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-700">
              {ONBOARDING_STAGES.map((st, idx) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setSelectedStageIndex(idx)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    idx === selectedStageIndex
                      ? 'bg-[#14532d] text-white border-[#14532d] shadow-2xs'
                      : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <span className="truncate">{st.name}</span>
                  {idx === selectedStageIndex && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
                </button>
              ))}
            </div>
          </div>

          {/* Right Side: Case Study Content & CTA */}
          <div className="lg:col-span-6 p-8 sm:p-10 flex flex-col justify-between space-y-6 text-left bg-white">
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-100 text-slate-600 text-xs font-medium">
                Case Study: Model School Kolkata & Rural Vidyalaya
              </div>

              <h3 className="text-2xl sm:text-3xl font-black text-[#0f172a] font-display">
                Real Results: School attendance up 150%
              </h3>

              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                {selectedStage.subtitle}
              </p>

              <div className="p-3.5 rounded-xl bg-[#f0fdf4] border border-emerald-200 text-xs text-emerald-900 font-medium">
                <strong>Deliverable:</strong> {selectedStage.deliverable}
              </div>
            </div>

            <div>
              <Button
                variant="primary"
                size="lg"
                onClick={() => setDemoModalOpen(true)}
                className="w-full bg-[#15803d] hover:bg-[#166534] text-white font-bold rounded-xl py-3.5 shadow-sm"
              >
                Request a Proposal
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: "Real Classrooms, Not Just Tech Demos" */}
      <section className="py-20 px-4 sm:px-12 max-w-7xl mx-auto w-full space-y-12 text-center">
        <div className="space-y-2">
          <h2 className="text-3xl sm:text-4xl font-black text-[#0f172a] font-display tracking-tight">
            Real Classrooms, Not Just Tech Demos
          </h2>
          <p className="text-base text-slate-600">
            Designed for the reality of your school.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left max-w-5xl mx-auto">
          {/* Card 1 */}
          <div className="p-8 rounded-3xl bg-[#f0fdf4] border border-emerald-200/80 shadow-sm space-y-4 hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center shadow-xs">
              <Smartphone className="w-6 h-6 text-[#15803d]" />
            </div>
            <h3 className="text-lg font-bold text-[#0f172a] font-display">
              Runs on ANY Mobile Phone
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              Proven compatibility with your phone and accessibility over massive registrations.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-8 rounded-3xl bg-[#f0fdf4] border border-emerald-200/80 shadow-sm space-y-4 hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center shadow-xs">
              <WifiOff className="w-6 h-6 text-[#15803d]" />
            </div>
            <h3 className="text-lg font-bold text-[#0f172a] font-display">
              No Internet? Zero Worries.
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              Local storage in memory safe state keeps attendance logs safe and secure.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-8 rounded-3xl bg-[#f0fdf4] border border-emerald-200/80 shadow-sm space-y-4 hover:shadow-md transition-all">
            <div className="w-12 h-12 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center shadow-xs">
              <FileCheck className="w-6 h-6 text-[#15803d]" />
            </div>
            <h3 className="text-lg font-bold text-[#0f172a] font-display">
              UDISE+ Government Reports
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              UDISE+ Government export compliance and automated data preservation for schools.
            </p>
          </div>
        </div>
      </section>

      {/* Section 4: "Calculate Your School's Time & Cost Savings" */}
      <section id="roi" className="py-20 px-4 sm:px-12 max-w-7xl mx-auto w-full space-y-12 text-center">
        <div className="space-y-2">
          <h2 className="text-3xl sm:text-4xl font-black text-[#0f172a] font-display tracking-tight">
            Calculate Your School's Time <br />
            & Cost Savings
          </h2>
        </div>

        <div className="rounded-3xl bg-white border border-slate-200 shadow-xl p-8 sm:p-12 max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center text-left">
          {/* Left: Slider */}
          <div className="lg:col-span-6 space-y-6">
            <div>
              <label htmlFor="student-slider" className="block text-base font-extrabold text-[#0f172a] font-display mb-2">
                Slider View - <span className="text-[#15803d]">{studentCount} Students</span>
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
                <span>100 Students</span>
                <span>1,500</span>
                <span>3,000 Students</span>
              </div>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-600">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 text-[#15803d] shrink-0" />
                <span>Morning roll call finished in &lt; 90 seconds</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 text-[#15803d] shrink-0" />
                <span>100% attendance records automatically backed up</span>
              </div>
            </div>
          </div>

          {/* Right: Metrics & Green Callout */}
          <div className="lg:col-span-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-slate-100 border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase">
                  Feature numbers
                </div>
                <div className="text-3xl font-black text-[#0f172a] font-display mt-1">
                  {teacherHoursSavedPerYear} Hrs
                </div>
                <div className="text-xs text-slate-500 mt-0.5">/ Year</div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-100 border border-slate-200">
                <div className="text-[11px] font-bold text-slate-500 uppercase">
                  Feature sheets
                </div>
                <div className="text-3xl font-black text-[#0f172a] font-display mt-1">
                  {paperSavedPages.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Pages / Year</div>
              </div>
            </div>

            {/* Green Callout Alert Box */}
            <div className="p-4 rounded-2xl bg-[#dcfce7] border border-emerald-300 text-xs text-emerald-900 flex items-start gap-2.5 leading-relaxed font-medium">
              <Lightbulb className="w-4 h-4 text-[#15803d] shrink-0 mt-0.5" />
              <span>
                E.g., {teacherHoursSavedPerYear} hrs saved per year, freeing up instructional time for teachers every single month.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Dark Green Banner "NEXT STEPS" */}
      <section id="plans" className="bg-[#14532d] text-white py-24 px-4 sm:px-12 text-center space-y-8 relative overflow-hidden mt-auto">
        <div className="max-w-3xl mx-auto space-y-4">
          <span className="text-xs font-mono font-bold tracking-widest text-emerald-300 uppercase">
            NEXT STEPS
          </span>
          <h2 className="text-3xl sm:text-5xl font-black font-display tracking-tight leading-tight">
            Ready to bring smart attendance <br />
            to your school?
          </h2>
          <p className="text-emerald-100 text-base sm:text-lg max-w-xl mx-auto">
            Schedule a demo or download our guide.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setDemoModalOpen(true)}
            className="bg-white hover:bg-slate-100 text-[#14532d] font-bold rounded-xl px-8 py-3.5 shadow-lg shadow-black/20"
          >
            Request a Demo
          </Button>

          <Link to="/login">
            <Button
              variant="ghost"
              size="lg"
              className="text-white hover:bg-[#166534] border border-emerald-400/40 rounded-xl px-8 py-3.5 font-bold"
            >
              School Sign In
            </Button>
          </Link>
        </div>

        <div className="text-xs text-emerald-200/80 font-medium">
          Contact our sales team today.
        </div>

        {/* Star Sparkle Watermark in Corner */}
        <div className="absolute right-8 bottom-8 text-emerald-600/30">
          <Sparkles className="w-16 h-16" />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0f172a] text-white py-10 px-4 sm:px-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-6 text-xs text-slate-400">
          {/* Left Nav */}
          <div className="flex items-center gap-6 font-semibold">
            <a href="#how-it-works" className="hover:text-white transition-colors">
              How it works
            </a>
            <a href="#plans" className="hover:text-white transition-colors">
              Plans
            </a>
            <a href="#case-studies" className="hover:text-white transition-colors">
              Case Studies
            </a>
            <Link to="/login" className="hover:text-white transition-colors">
              School Sign In
            </Link>
          </div>

          {/* Center Brand */}
          <div className="flex items-center gap-2 font-display font-black text-sm text-white">
            <div className="w-6 h-6 rounded-md bg-[#15803d] flex items-center justify-center text-white text-[10px]">
              AZ
            </div>
            <span>AttendEase</span>
          </div>

          {/* Right Copyright */}
          <div>
            © {new Date().getFullYear()} AttendEase OS. Govt. of India UDISE+ Compliant.
          </div>
        </div>
      </footer>

      {/* Dialog: Request Demo */}
      <Dialog
        isOpen={demoModalOpen}
        onClose={() => {
          setDemoModalOpen(false);
          setDemoSubmitted(false);
          setDemoError(null);
        }}
        title="Schedule a Free School Demo"
        description="Connect with our education team for a live demonstration"
      >
        {demoSubmitted ? (
          <div data-testid="demo-success-state" className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#dcfce7] text-[#15803d] border border-emerald-200 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-bold text-slate-900 font-display">Demo Request Received</h4>
            <p className="text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
              Thank you, <span className="font-bold text-slate-900">{demoForm.name || 'Administrator'}</span>. Our team will contact you at <span className="font-mono font-bold text-slate-900">{demoForm.phone || '+91-XXXXXXXXXX'}</span> within 4 business hours.
            </p>
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
                Done
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
              label="Your Full Name"
              required
              value={demoForm.name}
              onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
              placeholder="e.g. Principal Sourav Sen"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                label="Mobile Phone"
                type="tel"
                prefixText="+91"
                required
                value={demoForm.phone}
                onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                placeholder="98765 43210"
              />

              <TextField
                label="Official Email"
                type="email"
                value={demoForm.email}
                onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                placeholder="principal@school.edu.in"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                label="School / Institution Name"
                required
                value={demoForm.schoolName}
                onChange={(e) => setDemoForm({ ...demoForm, schoolName: e.target.value })}
                placeholder="Green Valley High School"
              />

              <TextField
                label="District / State"
                required
                value={demoForm.district}
                onChange={(e) => setDemoForm({ ...demoForm, district: e.target.value })}
                placeholder="Kolkata, West Bengal"
              />
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
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                isLoading={isSubmittingDemo}
                className="bg-[#14532d] hover:bg-[#166534] text-white"
              >
                Submit Request
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
};

export default LandingPage;
