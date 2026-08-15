import React, { useState, useEffect } from 'react';
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
  PhoneCall,
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
  ShieldAlert,
} from 'lucide-react';
import { Button, TextField, Dialog, Badge, Toast } from '../components/ui';

interface OnboardingStage {
  step: number;
  key: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  details: string[];
  deliverable: string;
}

const ONBOARDING_STAGES: OnboardingStage[] = [
  {
    step: 1,
    key: 'discover',
    title: 'Discover',
    subtitle: 'Explore offline-first attendance infrastructure',
    icon: <Zap className="w-5 h-5 text-forest-700 dark:text-forest-400" />,
    details: [
      'Compare QR vs. DESFire EV3 smartcard verification',
      'Review zero-cloud offline operational guarantees',
      'Assess low-cost Android tablet hardware requirements',
    ],
    deliverable: 'Platform Architecture & Security Brief',
  },
  {
    step: 2,
    key: 'understand',
    title: 'Understand',
    subtitle: 'Architecture and compliance walkthrough',
    icon: <Layers className="w-5 h-5 text-forest-700 dark:text-forest-400" />,
    details: [
      'PostgreSQL Row-Level Security (RLS) tenant isolation',
      'UDISE+ standardized format data exports',
      'Zero-latency offline cryptographic signature checks',
    ],
    deliverable: 'UDISE+ & DPDP Act Compliance Checklist',
  },
  {
    step: 3,
    key: 'request_demo',
    title: 'Request Demo',
    subtitle: 'Interactive live sandbox session',
    icon: <Laptop className="w-5 h-5 text-forest-700 dark:text-forest-400" />,
    details: [
      'Guided role simulation (Super Admin, Headmaster, Teacher)',
      'Simulate total network blackout & offline outbox sync',
      'Test bilingual student roster rendering (English + Bengali/Hindi)',
    ],
    deliverable: 'Custom Institutional Demo Workspace',
  },
  {
    step: 4,
    key: 'agreement',
    title: 'Sign Agreement',
    subtitle: 'Institutional SLA & governance agreement',
    icon: <ShieldCheck className="w-5 h-5 text-forest-700 dark:text-forest-400" />,
    details: [
      'Data sovereignty and student privacy guarantees',
      'State-level or district-level SLA commitments',
      'Hardware provisioning schedule & gateway deployment',
    ],
    deliverable: 'Fully Executed Institutional Contract',
  },
  {
    step: 5,
    key: 'provision',
    title: 'Provision School',
    subtitle: 'Generate a stable workspace path /s/green-valley',
    icon: <Building2 className="w-5 h-5 text-forest-700 dark:text-forest-400" />,
    details: [
      'Generate stable school workspace URL: /s/green-valley',
      'Provision AES-256 tenant encryption master keys',
      'Configure reader mTLS client certificates',
    ],
    deliverable: 'Isolated School Workspace & Admin Credentials',
  },
  {
    step: 6,
    key: 'import_students',
    title: 'Import Students',
    subtitle: 'Transactional XLSX roster onboarding',
    icon: <FileSpreadsheet className="w-5 h-5 text-forest-700 dark:text-forest-400" />,
    details: [
      'Atomic batch import for 500–5,000 students in seconds',
      'Automated validation for roll numbers and class sections',
      'Generate printable QR cards with HMAC security hashes',
    ],
    deliverable: 'Verified Active Student Directory',
  },
  {
    step: 7,
    key: 'train_staff',
    title: 'Train Staff',
    subtitle: '5-minute teacher mobile onboarding',
    icon: <Users className="w-5 h-5 text-forest-700 dark:text-forest-400" />,
    details: [
      'Install offline PWA on teacher smartphones',
      'Quick scan training: 40 students verified in under 90 seconds',
      'Headmaster daily reconciliation & SMS alert training',
    ],
    deliverable: 'Staff Certification & Quick-Start Cards',
  },
  {
    step: 8,
    key: 'go_live',
    title: 'Go Live',
    subtitle: 'Full-scale morning attendance rollout',
    icon: <Award className="w-5 h-5 text-forest-700 dark:text-forest-400" />,
    details: [
      'Simultaneous morning gate & classroom scanning',
      'Real-time automated parent SMS arrival dispatch',
      'Instant aggregate attendance stats on district dashboard',
    ],
    deliverable: '100% Operational Attendance Infrastructure',
  },
];

const PREVIEW_SCHOOLS = [
  {
    slug: 'model-school-kolkata',
    name: 'Model School Kolkata',
    district: 'Kolkata, West Bengal',
    udise: '19170100101',
    students: '1,420 Students',
    status: 'ACTIVE',
  },
  {
    slug: 'rural-vidyalaya-bankura',
    name: 'Rural Vidyalaya Bankura',
    district: 'Bankura, West Bengal',
    udise: '19130200402',
    students: '680 Students',
    status: 'ACTIVE',
  },
  {
    slug: 'st-xaviers-delhi',
    name: "St. Xavier's Academy",
    district: 'Central Delhi',
    udise: '07080100305',
    students: '2,150 Students',
    status: 'ACTIVE',
  },
];

export const LandingPage: React.FC = () => {
  const [selectedStageIndex, setSelectedStageIndex] = useState(0);
  const [studentCount, setStudentCount] = useState<number>(750);
  const [selectedSchoolIndex, setSelectedSchoolIndex] = useState(0);
  const [activeArchTab, setActiveArchTab] = useState<'crypto' | 'appliance' | 'hardware' | 'gov'>('crypto');

  // Interactive Simulator State
  const [simMode, setSimMode] = useState<'qr' | 'rfid'>('qr');
  const [simOffline, setSimOffline] = useState(false);
  const [simScanning, setSimScanning] = useState(false);
  const [simSuccess, setSimSuccess] = useState(false);
  const [simEvent, setSimEvent] = useState<{
    name: string;
    roll: string;
    class: string;
    time: string;
    latencyMs: number;
    sig: string;
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
      
      setSimEvent({
        ...pick,
        time: timeStr,
        latencyMs: simMode === 'qr' ? 14 : 11,
        sig: `0x${Math.random().toString(16).substring(2, 10).toUpperCase()}...AES-CMAC`,
      });
      setSimScanning(false);
      setSimSuccess(true);
    }, 800);
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
  const activeSchool = PREVIEW_SCHOOLS[selectedSchoolIndex];

  // Calculated ROI Metrics
  const teacherHoursSavedPerYear = Math.round((studentCount * 0.08 * 220) / 60);
  const paperSavedPages = studentCount * 12 * 4;
  const morningMinutesSaved = Math.round((studentCount * 1.5) / 60);

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col selection:bg-forest-700 selection:text-white hero-mesh-light">
      {/* Sticky Floating Nav Header */}
      <header className="sticky top-0 z-50 px-4 sm:px-8 py-3.5 flex items-center justify-between backdrop-blur-xl bg-surface/85 border-b border-line/80 transition-all">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-forest-700 dark:bg-forest-600 flex items-center justify-center text-white shadow-md shadow-forest-700/20 group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
                <path d="M12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4z" />
              </svg>
            </div>
            <div>
              <span className="text-xl font-extrabold text-ink font-display tracking-tight group-hover:text-forest-700 dark:group-hover:text-forest-400 transition-colors">
                AttendEase
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-bold text-forest-700 dark:text-forest-400 bg-forest-50 dark:bg-forest-900/40 px-2 py-0.5 rounded-full border border-forest-200 dark:border-forest-800/40 font-mono">
                v1.0 OS
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Quick Nav */}
        <nav className="hidden lg:flex items-center gap-7 text-xs font-bold tracking-wide uppercase text-ink-soft font-display">
          <a href="#simulator" className="hover:text-forest-700 dark:hover:text-forest-400 transition-colors">
            Protocol Simulator
          </a>
          <a href="#journey" className="hover:text-forest-700 dark:hover:text-forest-400 transition-colors">
            8-Stage Lifecycle
          </a>
          <a href="#architecture" className="hover:text-forest-700 dark:hover:text-forest-400 transition-colors">
            Architecture
          </a>
          <a href="#roi" className="hover:text-forest-700 dark:hover:text-forest-400 transition-colors">
            ROI Engine
          </a>
          <a href="#tenants" className="hover:text-forest-700 dark:hover:text-forest-400 transition-colors">
            School Tenants
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="md"
            onClick={() => setDemoModalOpen(true)}
            className="hidden sm:inline-flex shadow-xs hover:border-forest-600 font-display font-bold"
          >
            Request Demo
          </Button>

          <Link to="/login">
            <Button
              variant="primary"
              size="md"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="shadow-md shadow-forest-700/20 font-display font-bold"
            >
              School Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 sm:pt-20 pb-16 px-4 sm:px-8 max-w-7xl mx-auto text-center space-y-8 overflow-hidden">
        {/* Top Status Capsule */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-surface border border-line shadow-xs glowing-badge"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-forest-800 dark:text-forest-300 tracking-wider uppercase font-display">
            Govt. of India • UDISE+ Standard Compliant
          </span>
          <span className="hidden sm:inline-block text-ink-muted text-xs">•</span>
          <span className="hidden sm:inline-block text-xs font-mono font-bold text-ink-soft">
            100% Offline Multi-Master Ledger
          </span>
        </motion.div>

        {/* Authority Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-ink font-display tracking-tight leading-[1.06] max-w-5xl mx-auto"
        >
          Attendance infrastructure <br />
          <span className="bg-gradient-to-r from-forest-700 via-forest-600 to-emerald-600 dark:from-forest-400 dark:via-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
            built for zero-connectivity classrooms.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-base sm:text-xl text-ink-soft max-w-3xl mx-auto font-normal leading-relaxed"
        >
          Sub-18ms cryptographic offline QR scanning and tamper-proof DESFire EV3 smartcards with zero cloud dependency, automatic conflict-free ledger reconciliation, and instant parent SMS arrival alerts.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-4 pt-2"
        >
          <Button
            variant="primary"
            size="lg"
            onClick={() => setDemoModalOpen(true)}
            rightIcon={<Sparkles className="w-4 h-4" />}
            className="shadow-xl shadow-forest-700/25 px-8 py-3.5 text-base font-bold font-display cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Schedule School Demo
          </Button>

          <Link to="/login">
            <Button
              variant="secondary"
              size="lg"
              className="px-8 py-3.5 text-base font-bold font-display cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Access School Workspace
            </Button>
          </Link>
        </motion.div>

        {/* Real-Time Telemetry Metrics Ticker */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-10 text-left"
        >
          <div className="p-6 rounded-[28px] bg-surface/90 border border-line shadow-xs hover:border-forest-600/40 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
                Verification Speed
              </span>
              <Activity className="w-4 h-4 text-forest-700 dark:text-forest-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-ink font-display mt-2">
              &lt; 18ms
            </div>
            <p className="text-xs text-ink-soft mt-1.5">P99 cryptographic local check</p>
          </div>

          <div className="p-6 rounded-[28px] bg-surface/90 border border-line shadow-xs hover:border-forest-600/40 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
                Offline Guarantee
              </span>
              <WifiOff className="w-4 h-4 text-forest-700 dark:text-forest-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-forest-700 dark:text-forest-400 font-display mt-2">
              100.0%
            </div>
            <p className="text-xs text-ink-soft mt-1.5">Zero dropped records in blackout</p>
          </div>

          <div className="p-6 rounded-[28px] bg-surface/90 border border-line shadow-xs hover:border-forest-600/40 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
                Classroom Throughput
              </span>
              <Clock className="w-4 h-4 text-forest-700 dark:text-forest-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-ink font-display mt-2">
              &lt; 90 Sec
            </div>
            <p className="text-xs text-ink-soft mt-1.5">Full 40-student roll validated</p>
          </div>

          <div className="p-6 rounded-[28px] bg-surface/90 border border-line shadow-xs hover:border-forest-600/40 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
                Tenant Isolation
              </span>
              <Lock className="w-4 h-4 text-forest-700 dark:text-forest-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-ink font-display mt-2">
              Postgres RLS
            </div>
            <p className="text-xs text-ink-soft mt-1.5">Fail-closed kernel & database rows</p>
          </div>
        </motion.div>
      </section>

      {/* Interactive Hero Hardware & Protocol Simulator */}
      <section id="simulator" className="py-16 px-4 sm:px-8 max-w-7xl mx-auto w-full space-y-10">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge variant="forest" size="md">
            Interactive Hardware & Protocol Lab
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink font-display tracking-tight">
            Experience the Zero-Latency Verification Engine
          </h2>
          <p className="text-sm sm:text-base text-ink-soft">
            Simulate a live morning roll call under active network blackout conditions.
          </p>
        </div>

        {/* Simulator Console Container */}
        <div className="rounded-[32px] bg-surface border border-line shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Controls Side */}
          <div className="lg:col-span-5 p-6 sm:p-8 bg-surface-soft border-b lg:border-b-0 lg:border-r border-line space-y-6 text-left">
            <div>
              <span className="text-xs font-bold text-forest-700 dark:text-forest-400 uppercase tracking-wider font-display">
                Verification Channel
              </span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => { setSimMode('qr'); setSimSuccess(false); }}
                  className={`p-3 rounded-2xl text-xs font-bold font-display flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    simMode === 'qr'
                      ? 'bg-forest-700 text-white border-forest-800 shadow-sm shadow-forest-700/20'
                      : 'bg-surface text-ink-soft border-line hover:border-forest-600/40'
                  }`}
                >
                  <ScanLine className="w-4 h-4" />
                  <span>Offline QR Token</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setSimMode('rfid'); setSimSuccess(false); }}
                  className={`p-3 rounded-2xl text-xs font-bold font-display flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                    simMode === 'rfid'
                      ? 'bg-forest-700 text-white border-forest-800 shadow-sm shadow-forest-700/20'
                      : 'bg-surface text-ink-soft border-line hover:border-forest-600/40'
                  }`}
                >
                  <Radio className="w-4 h-4" />
                  <span>DESFire EV3 Smartcard</span>
                </button>
              </div>
            </div>

            {/* Network Blackout Toggle */}
            <div className="p-4 rounded-2xl bg-surface border border-line space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {simOffline ? (
                    <WifiOff className="w-4 h-4 text-danger-600 animate-pulse" />
                  ) : (
                    <Wifi className="w-4 h-4 text-success-600" />
                  )}
                  <span className="text-xs font-bold text-ink font-display">
                    Network State: {simOffline ? 'Total Blackout (Offline)' : 'Connected Cloud'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSimOffline(!simOffline)}
                  className={`px-3 py-1 rounded-full text-xs font-bold font-mono transition-colors cursor-pointer ${
                    simOffline ? 'bg-danger-100 text-danger-800' : 'bg-success-100 text-success-800'
                  }`}
                >
                  {simOffline ? 'Restore Network' : 'Cut Internet'}
                </button>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                {simOffline
                  ? 'All verification keys remain cached locally. Signatures resolve in memory; transactions persist to SQLite outbox.'
                  : 'Ledger stream actively syncing state back to primary PostgreSQL cluster.'}
              </p>
            </div>

            {/* Trigger Simulation Button */}
            <div>
              <Button
                variant="primary"
                size="lg"
                onClick={handleSimulateScan}
                isLoading={simScanning}
                className="w-full font-display font-bold py-3.5 shadow-lg shadow-forest-700/25"
                rightIcon={<Zap className="w-4 h-4" />}
              >
                {simScanning
                  ? 'Executing AES Cryptographic Check...'
                  : simMode === 'qr'
                  ? 'Simulate QR Code Scan'
                  : 'Simulate Smartcard Turnstile Tap'}
              </Button>
            </div>
          </div>

          {/* Interactive Screen Preview */}
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between bg-surface text-left relative overflow-hidden">
            {/* Visual Scanning Animation Overlay */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2 font-mono text-xs text-ink-soft">
                  <span className="w-2 h-2 rounded-full bg-forest-600 animate-pulse" />
                  <span>STATION_ID: GATE_READER_01</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-forest-700 dark:text-forest-400 bg-forest-50 dark:bg-forest-900/40 px-2 py-0.5 rounded-md font-mono">
                    AES-256 PBKDF2
                  </span>
                </div>
              </div>

              {/* Live Terminal Output */}
              <div className="relative h-64 rounded-2xl bg-canvas border border-line p-5 font-mono text-xs flex flex-col justify-between overflow-hidden">
                {simScanning && (
                  <div className="absolute inset-x-0 h-1 bg-forest-500 shadow-[0_0_15px_#227b5a] animate-laser-sweep z-10" />
                )}

                <div className="space-y-2">
                  <div className="text-ink-muted">
                    &gt; Protocol initialized: {simMode === 'qr' ? 'Ed25519 / HMAC QR Stream' : 'DESFire EV3 AES-CMAC ISO14443-A'}
                  </div>
                  <div className="text-ink-muted">
                    &gt; Local cache integrity: VALID (0 errors)
                  </div>
                  <div className="text-ink-muted">
                    &gt; Network interface: {simOffline ? 'OFFLINE (Local Outbox Mode)' : 'ONLINE (Direct Sync)'}
                  </div>

                  {simSuccess && simEvent && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-3 rounded-xl bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800/40 space-y-1.5 mt-2"
                    >
                      <div className="flex items-center justify-between text-success-800 dark:text-success-300 font-bold">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-success-600" />
                          VERIFIED PRESENT: {simEvent.name}
                        </span>
                        <span>{simEvent.time}</span>
                      </div>
                      <div className="text-xs text-ink-soft flex items-center justify-between">
                        <span>{simEvent.class} • {simEvent.roll}</span>
                        <span className="text-forest-700 dark:text-forest-400 font-bold">{simEvent.latencyMs}ms Latency</span>
                      </div>
                      <div className="text-[10px] text-ink-muted truncate">
                        SIG: {simEvent.sig} • SMS QUEUED: +91 98765 43210
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="flex items-center justify-between text-ink-muted pt-2 border-t border-line text-[11px]">
                  <span>STORAGE: SQLite 3.45 (Encrypted)</span>
                  <span>SYNC STATUS: {simOffline ? 'PENDING_BURST' : 'IDLE_SYNCED'}</span>
                </div>
              </div>
            </div>

            {/* Bottom Proof Metrics */}
            <div className="grid grid-cols-3 gap-3 pt-4 text-center">
              <div className="p-2.5 rounded-xl bg-surface-soft border border-line">
                <span className="text-[10px] uppercase font-bold text-ink-muted font-display block">
                  Signature Type
                </span>
                <span className="text-xs font-bold text-ink font-mono mt-0.5 block">
                  {simMode === 'qr' ? 'HMAC-SHA256' : 'AES-128 CMAC'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-soft border border-line">
                <span className="text-[10px] uppercase font-bold text-ink-muted font-display block">
                  Replay Guard
                </span>
                <span className="text-xs font-bold text-forest-700 dark:text-forest-400 font-mono mt-0.5 block">
                  Nonce + Salt
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-soft border border-line">
                <span className="text-[10px] uppercase font-bold text-ink-muted font-display block">
                  Fail-Safe
                </span>
                <span className="text-xs font-bold text-ink font-mono mt-0.5 block">
                  Zero Data Drop
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Tenant Path Identity Showcase */}
      <section id="tenants" className="py-16 px-4 sm:px-8 bg-surface-soft/60 border-y border-line">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Badge variant="forest" size="md">
              Single-Origin Path Tenancy
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-ink font-display tracking-tight">
              One Unified Origin. Isolated School Workspaces.
            </h2>
            <p className="text-sm sm:text-base text-ink-soft">
              No brittle subdomain DNS records or SSL wildcards. Schools access their bound workspace securely via clean URL paths.
            </p>
          </div>

          <div className="p-7 sm:p-10 rounded-[32px] bg-surface border border-line shadow-lg grid grid-cols-1 lg:grid-cols-12 gap-8 items-center text-left">
            <div className="lg:col-span-6 space-y-5">
              <span className="text-xs font-bold text-forest-700 dark:text-forest-400 uppercase tracking-wider font-display">
                Select Active Institutional Tenant
              </span>
              <div className="space-y-3">
                {PREVIEW_SCHOOLS.map((school, idx) => {
                  const isSelected = idx === selectedSchoolIndex;
                  return (
                    <button
                      key={school.slug}
                      type="button"
                      onClick={() => setSelectedSchoolIndex(idx)}
                      className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-forest-50 dark:bg-forest-900/30 border-forest-600 dark:border-forest-500 shadow-xs'
                          : 'bg-surface hover:bg-surface-soft border-line'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-bold text-ink font-display">
                          {school.name}
                        </div>
                        <div className="text-xs text-ink-soft font-mono mt-0.5">
                          /s/{school.slug}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-forest-700 dark:text-forest-400 font-display">
                          {school.students}
                        </span>
                        <div className="text-[11px] text-ink-muted">{school.district}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tenant Workspace Card */}
            <div className="lg:col-span-6 p-7 rounded-2xl bg-surface-soft border border-line space-y-5">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <span className="text-xs font-bold text-forest-700 dark:text-forest-400 uppercase tracking-wider font-display">
                  Bound Tenant Profile
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-success-100 text-success-800 font-mono">
                  {activeSchool.status}
                </span>
              </div>

              <div className="space-y-3">
                <div className="text-2xl font-extrabold text-ink font-display">
                  {activeSchool.name}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-surface border border-line">
                    <span className="text-ink-muted block uppercase tracking-wider font-display font-bold">
                      UDISE+ Code
                    </span>
                    <span className="text-ink font-mono font-bold mt-1 block">{activeSchool.udise}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-surface border border-line">
                    <span className="text-ink-muted block uppercase tracking-wider font-display font-bold">
                      District Jurisdiction
                    </span>
                    <span className="text-ink font-bold mt-1 block truncate">{activeSchool.district}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-surface border border-line font-mono text-xs text-ink-soft flex items-center justify-between">
                  <span>Workspace Path:</span>
                  <span className="font-bold text-forest-700 dark:text-forest-400">
                    /s/{activeSchool.slug}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <Link to={`/s/${activeSchool.slug}/login`} className="block">
                  <Button
                    variant="primary"
                    size="md"
                    rightIcon={<ArrowUpRight className="w-4 h-4" />}
                    className="w-full font-display font-bold"
                  >
                    Open {activeSchool.name} Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive 8-Stage Onboarding Journey */}
      <section id="journey" className="py-16 px-4 sm:px-8 max-w-7xl mx-auto space-y-10">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge variant="forest" size="md">
            End-to-End Operational Lifecycle
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink font-display tracking-tight">
            From Discovery to Morning Rollout
          </h2>
          <p className="text-sm sm:text-base text-ink-soft">
            A battle-tested 8-step journey designed for state education boards, private school chains, and rural schools.
          </p>
        </div>

        {/* Stepper Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar">
          {ONBOARDING_STAGES.map((stage, idx) => {
            const isSelected = idx === selectedStageIndex;
            return (
              <button
                key={stage.key}
                type="button"
                onClick={() => setSelectedStageIndex(idx)}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold font-display whitespace-nowrap transition-all border shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-forest-700 text-white border-forest-800 shadow-md shadow-forest-700/20'
                    : 'bg-surface hover:bg-surface text-ink-soft hover:text-ink border-line shadow-2xs'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                    isSelected ? 'bg-white text-forest-800' : 'bg-surface-soft text-ink-muted'
                  }`}
                >
                  {stage.step}
                </span>
                <span>{stage.title}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Stage Detail Card */}
        <motion.div
          key={selectedStage.key}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-7 sm:p-10 rounded-[32px] bg-surface border border-line shadow-lg grid grid-cols-1 lg:grid-cols-12 gap-8 items-center text-left"
        >
          <div className="lg:col-span-7 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-forest-50 dark:bg-forest-900/30 border border-forest-200 dark:border-forest-800/40 flex items-center justify-center">
                {selectedStage.icon}
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-forest-700 dark:text-forest-400">
                  STAGE 0{selectedStage.step} OF 08
                </span>
                <h3 className="text-2xl font-bold text-ink font-display leading-tight">
                  {selectedStage.title}
                </h3>
              </div>
            </div>

            <p className="text-base text-ink-soft leading-relaxed font-normal">
              {selectedStage.subtitle}
            </p>

            <div className="space-y-2.5 pt-2">
              <span className="text-xs font-bold text-ink-muted uppercase tracking-wider font-display">
                Key Operational Activities
              </span>
              <ul className="space-y-2">
                {selectedStage.details.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-ink">
                    <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-5 p-6 rounded-2xl bg-surface-soft border border-line space-y-4">
            <span className="text-xs font-bold text-forest-700 dark:text-forest-400 uppercase tracking-wider font-display">
              Stage Deliverable
            </span>

            <div className="text-lg font-bold text-ink font-display">
              {selectedStage.deliverable}
            </div>

            <p className="text-xs text-ink-soft leading-relaxed">
              Standardized institutional checkpoint guaranteeing seamless transition to the next phase without data loss or administrative bottlenecks.
            </p>

            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  if (selectedStageIndex < ONBOARDING_STAGES.length - 1) {
                    setSelectedStageIndex(selectedStageIndex + 1);
                  } else {
                    setDemoModalOpen(true);
                  }
                }}
                rightIcon={<ChevronRight className="w-4 h-4" />}
                className="w-full font-display font-bold"
              >
                {selectedStageIndex < ONBOARDING_STAGES.length - 1
                  ? `Next: ${ONBOARDING_STAGES[selectedStageIndex + 1].title}`
                  : 'Schedule Onboarding Kickoff'}
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Enterprise Architecture Deep Dive */}
      <section id="architecture" className="py-16 px-4 sm:px-8 bg-surface-soft/60 border-y border-line">
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Badge variant="forest" size="md">
              Enterprise Technology Stack
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-ink font-display tracking-tight">
              Engineered for Zero Failure Tolerances
            </h2>
            <p className="text-sm sm:text-base text-ink-soft">
              Explore the core architectural pillars powering AttendEase across diverse school environments.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            {[
              { id: 'crypto', label: 'Cryptographic Security', icon: <Lock className="w-4 h-4" /> },
              { id: 'appliance', label: 'Zero-Cloud Appliance', icon: <Cpu className="w-4 h-4" /> },
              { id: 'hardware', label: 'Hardware & Gateway Fleet', icon: <Radio className="w-4 h-4" /> },
              { id: 'gov', label: 'UDISE+ & Data Sovereignty', icon: <ShieldCheck className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveArchTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold font-display transition-all border cursor-pointer ${
                  activeArchTab === tab.id
                    ? 'bg-forest-700 text-white border-forest-800 shadow-sm shadow-forest-700/20'
                    : 'bg-surface text-ink-soft hover:text-ink border-line'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="p-7 sm:p-10 rounded-[32px] bg-surface border border-line shadow-lg text-left">
            {activeArchTab === 'crypto' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="p-5 rounded-2xl bg-surface-soft border border-line space-y-3">
                  <div className="text-xs font-bold text-forest-700 dark:text-forest-400 font-mono">01. QR DUAL SIGNATURE</div>
                  <h4 className="text-lg font-bold text-ink font-display">HMAC-SHA256 Key Rotations</h4>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Student QR cards incorporate salted rotating hashes validated offline against embedded public keystores.
                  </p>
                </div>
                <div className="p-5 rounded-2xl bg-surface-soft border border-line space-y-3">
                  <div className="text-xs font-bold text-forest-700 dark:text-forest-400 font-mono">02. NXP DESFIRE EV3</div>
                  <h4 className="text-lg font-bold text-ink font-display">Hardware AES-128 CMAC</h4>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Turnstiles perform mutual 3-pass authentication preventing card cloning, relay attacks, and proxy scans.
                  </p>
                </div>
                <div className="p-5 rounded-2xl bg-surface-soft border border-line space-y-3">
                  <div className="text-xs font-bold text-forest-700 dark:text-forest-400 font-mono">03. AUDIT INTEGRITY</div>
                  <h4 className="text-lg font-bold text-ink font-display">Append-Only Event Ledger</h4>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Every roll correction creates an immutable audit trail recording the approving admin, previous status, and justification.
                  </p>
                </div>
              </div>
            )}

            {activeArchTab === 'appliance' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="p-5 rounded-2xl bg-surface-soft border border-line space-y-3">
                  <div className="text-xs font-bold text-forest-700 dark:text-forest-400 font-mono">01. AUTONOMOUS APPLIANCE</div>
                  <h4 className="text-lg font-bold text-ink font-display">Single-Command Deployment</h4>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Runs unattended with automated self-healing sidecars, database migration scripts, and continuous health probes.
                  </p>
                </div>
                <div className="p-5 rounded-2xl bg-surface-soft border border-line space-y-3">
                  <div className="text-xs font-bold text-forest-700 dark:text-forest-400 font-mono">02. ENCRYPTED BACKUPS</div>
                  <h4 className="text-lg font-bold text-ink font-display">Staged AES-256 Snapshots</h4>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Self-testing daily encrypted database dumps with SHA-256 manifest verification and guaranteed last-known-good retention.
                  </p>
                </div>
                <div className="p-5 rounded-2xl bg-surface-soft border border-line space-y-3">
                  <div className="text-xs font-bold text-forest-700 dark:text-forest-400 font-mono">03. ROW-LEVEL SECURITY</div>
                  <h4 className="text-lg font-bold text-ink font-display">Strict Postgres RLS Isolation</h4>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Database-level tenant context enforcement preventing accidental cross-tenant data leakage across all queries.
                  </p>
                </div>
              </div>
            )}

            {activeArchTab === 'hardware' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="p-5 rounded-2xl bg-surface-soft border border-line space-y-3">
                  <div className="text-xs font-bold text-forest-700 dark:text-forest-400 font-mono">01. PC/SC FLEET DRIVERS</div>
                  <h4 className="text-lg font-bold text-ink font-display">ACS & HID Native Support</h4>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Auto-negotiates with ACS ACR1252U, HID Omnikey 5422, and standard USB CCID smartcard readers.
                  </p>
                </div>
                <div className="p-5 rounded-2xl bg-surface-soft border border-line space-y-3">
                  <div className="text-xs font-bold text-forest-700 dark:text-forest-400 font-mono">02. DUAL-GATE OPERATORS</div>
                  <h4 className="text-lg font-bold text-ink font-display">Directional In/Out Tracking</h4>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Configurable gates manage entry/exit flows with duplicate tap throttling and anti-passback controls.
                  </p>
                </div>
                <div className="p-5 rounded-2xl bg-surface-soft border border-line space-y-3">
                  <div className="text-xs font-bold text-forest-700 dark:text-forest-400 font-mono">03. HARDWARE DIAGNOSTICS</div>
                  <h4 className="text-lg font-bold text-ink font-display">Automated Fleet Self-Test</h4>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Built-in diagnostic daemon probes USB bus capabilities, smartcard ATR sequences, and reader response times.
                  </p>
                </div>
              </div>
            )}

            {activeArchTab === 'gov' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="p-5 rounded-2xl bg-surface-soft border border-line space-y-3">
                  <div className="text-xs font-bold text-forest-700 dark:text-forest-400 font-mono">01. UDISE+ INTEGRATION</div>
                  <h4 className="text-lg font-bold text-ink font-display">One-Click State Exports</h4>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Pre-formatted monthly and annual attendance registers matching Department of School Education standards.
                  </p>
                </div>
                <div className="p-5 rounded-2xl bg-surface-soft border border-line space-y-3">
                  <div className="text-xs font-bold text-forest-700 dark:text-forest-400 font-mono">02. DATA SOVEREIGNTY</div>
                  <h4 className="text-lg font-bold text-ink font-display">Zero Foreign Cloud Leaks</h4>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    All student biometric and attendance identifiers remain on localized institutional hardware.
                  </p>
                </div>
                <div className="p-5 rounded-2xl bg-surface-soft border border-line space-y-3">
                  <div className="text-xs font-bold text-forest-700 dark:text-forest-400 font-mono">03. BILINGUAL ROSTERS</div>
                  <h4 className="text-lg font-bold text-ink font-display">Regional Language Support</h4>
                  <p className="text-xs text-ink-soft leading-relaxed">
                    Full Unicode UTF-8 support for student names in Bengali, Hindi, and regional scripts alongside English.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Impact & ROI Calculator */}
      <section id="roi" className="py-16 px-4 sm:px-8 max-w-7xl mx-auto space-y-10">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge variant="forest" size="md">
            Operational Efficiency Engine
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink font-display tracking-tight">
            Calculate Your School's Time & Cost Savings
          </h2>
          <p className="text-sm sm:text-base text-ink-soft">
            See the direct impact of switching from paper registers to AttendEase.
          </p>
        </div>

        <div className="p-7 sm:p-10 rounded-[32px] bg-surface border border-line shadow-lg grid grid-cols-1 lg:grid-cols-12 gap-8 items-center text-left">
          <div className="lg:col-span-6 space-y-6">
            <div>
              <label htmlFor="student-slider" className="block text-sm font-bold text-ink font-display mb-2">
                Total Enrolled Students: <span className="text-forest-700 dark:text-forest-400 font-mono text-xl">{studentCount}</span>
              </label>
              <input
                id="student-slider"
                type="range"
                min="100"
                max="3000"
                step="50"
                value={studentCount}
                onChange={(e) => setStudentCount(Number(e.target.value))}
                className="w-full h-2 bg-surface-soft rounded-lg appearance-none cursor-pointer accent-forest-700"
              />
              <div className="flex justify-between text-xs text-ink-muted mt-1.5 font-mono">
                <span>100 Students</span>
                <span>1,500</span>
                <span>3,000 Students</span>
              </div>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-ink-soft">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-forest-700 shrink-0" />
                <span>Reclaims 15 minutes of teacher instructional time per classroom every morning</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-forest-700 shrink-0" />
                <span>Eliminates proxy attendance, buddy punching, and paper ledger tampering</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-forest-700 shrink-0" />
                <span>Dispatches real-time arrival SMS notifications to parents automatically</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 grid grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-surface-soft border border-line text-left">
              <div className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
                Teacher Time Saved
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-forest-700 dark:text-forest-400 font-display mt-1">
                {teacherHoursSavedPerYear} Hrs
              </div>
              <p className="text-xs text-ink-soft mt-1">Reclaimed for classroom teaching</p>
            </div>

            <div className="p-5 rounded-2xl bg-surface-soft border border-line text-left">
              <div className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
                Morning Line Delay
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-ink font-display mt-1">
                &lt; 3.5 Min
              </div>
              <p className="text-xs text-ink-soft mt-1">Down from 45+ minutes</p>
            </div>

            <div className="p-5 rounded-2xl bg-surface-soft border border-line text-left col-span-2">
              <div className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
                UDISE+ Compliance Readiness
              </div>
              <div className="text-xl font-bold text-ink font-display mt-1 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success-600 shrink-0" />
                <span>1-Click Instant State Export (CSV / XLSX)</span>
              </div>
              <p className="text-xs text-ink-soft mt-1">Zero manual data transcription required by administrative staff</p>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Pre-Footer & CTA */}
      <section className="py-16 px-4 sm:px-8 bg-forest-900 text-white mt-auto text-center space-y-6 relative overflow-hidden">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl sm:text-5xl font-extrabold font-display leading-tight">
            Ready to deploy enterprise attendance infrastructure?
          </h2>
          <p className="text-emerald-200/90 text-sm sm:text-lg max-w-xl mx-auto leading-relaxed">
            Join forward-looking schools, state districts, and institutions running on AttendEase OS.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setDemoModalOpen(true)}
            className="px-8 py-3.5 text-base font-bold font-display cursor-pointer shadow-lg shadow-black/20"
          >
            Request Institutional Demo
          </Button>

          <Link to="/login">
            <Button
              variant="ghost"
              size="lg"
              className="text-white hover:bg-forest-800 border border-emerald-500/30 px-8 py-3.5 text-base font-bold font-display"
            >
              Sign In to Portal
            </Button>
          </Link>
        </div>
      </section>

      {/* Modern High-End Footer */}
      <footer className="py-8 px-4 sm:px-8 bg-surface border-t border-line text-xs text-ink-muted flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="font-bold text-ink font-display">AttendEase OS</span>
          <span>•</span>
          <span>Govt. of India UDISE+ Standard</span>
          <span>•</span>
          <span>Zero-Cloud Resilience</span>
        </div>

        <div className="flex items-center gap-6 font-semibold">
          <Link to="/login" className="hover:text-ink transition-colors">
            Teacher Portal
          </Link>
          <Link to="/login" className="hover:text-ink transition-colors">
            Headmaster Console
          </Link>
          <Link to="/login" className="hover:text-ink transition-colors">
            Super-Admin Platform
          </Link>
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
        title="Schedule an Institutional Demo"
        description="Connect with our education deployment specialists"
      >
        {demoSubmitted ? (
          <div data-testid="demo-success-state" className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-success-50 text-success-600 border border-success-100 dark:border-success-600/30 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-bold text-ink font-display">Demo Request Received</h4>
            <p className="text-sm text-ink-soft max-w-sm mx-auto leading-relaxed">
              Thank you, <span className="font-bold text-ink">{demoForm.name || 'Administrator'}</span>. Our deployment coordinator will contact you at <span className="font-mono font-bold text-ink">{demoForm.phone || '+91-XXXXXXXXXX'}</span> within 4 business hours.
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
