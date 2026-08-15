import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wifi,
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
} from 'lucide-react';
import { Button, Dialog, TextField, Badge } from '../components/ui';

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
    subtitle: 'Automated tenant subdomain & security keys',
    icon: <Building2 className="w-5 h-5 text-forest-700 dark:text-forest-400" />,
    details: [
      'Generate dedicated school URL: /s/green-valley',
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

export const LandingPage: React.FC = () => {
  const [selectedStageIndex, setSelectedStageIndex] = useState(0);
  const [studentCount, setStudentCount] = useState<number>(650);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  // Demo Form State
  const [demoForm, setDemoForm] = useState({
    name: '',
    phone: '',
    email: '',
    schoolName: '',
    district: '',
    studentCount: '500-1000',
  });

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDemoSubmitted(true);
  };

  const selectedStage = ONBOARDING_STAGES[selectedStageIndex];

  // Calculated ROI Metrics
  const teacherHoursSavedPerYear = Math.round((studentCount * 0.08 * 220) / 60);
  const paperSavedPages = studentCount * 12 * 4;
  const attendanceAccuracyPct = 99.9;

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col selection:bg-forest-700 selection:text-white">
      {/* Public Navigation Header */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-line px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-forest-700 flex items-center justify-center text-white shadow-md shadow-forest-700/20">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
              <path d="M12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4z" />
            </svg>
          </div>
          <div>
            <span className="text-xl font-extrabold text-ink font-display tracking-tight">AttendEase</span>
            <span className="hidden sm:inline-block ml-2 text-xs font-bold text-forest-700 dark:text-forest-400 bg-forest-50 dark:bg-forest-900/40 px-2 py-0.5 rounded-full border border-forest-200 dark:border-forest-800/40 font-mono">
              v1.0 OS
            </span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-ink-soft font-display">
          <a href="#journey" className="hover:text-forest-700 transition-colors">
            Onboarding Journey
          </a>
          <a href="#features" className="hover:text-forest-700 transition-colors">
            Infrastructure Features
          </a>
          <a href="#roi" className="hover:text-forest-700 transition-colors">
            Impact Calculator
          </a>
        </nav>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="md"
            onClick={() => setDemoModalOpen(true)}
            className="hidden sm:inline-flex"
          >
            Request Demo
          </Button>

          <Link to="/login">
            <Button
              variant="primary"
              size="md"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              School Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 sm:py-20 px-4 sm:px-8 max-w-6xl mx-auto text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface border border-line shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-success-600 animate-pulse" />
          <span className="text-xs font-bold text-forest-700 dark:text-forest-400 tracking-wider uppercase font-display">
            Govt. of India • UDISE+ Standard Compliant
          </span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-ink font-display tracking-tight leading-[1.08] max-w-4xl mx-auto">
          Attendance infrastructure <br />
          <span className="text-forest-700 dark:text-forest-500">
            built for zero-connectivity classrooms.
          </span>
        </h1>

        <p className="text-base sm:text-xl text-ink-soft max-w-2xl mx-auto font-normal leading-relaxed">
          Hybrid offline QR scanning and tamper-proof DESFire smartcards with instant ledger synchronization. Empowering teachers, principals, and district administrators.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Button
            variant="primary"
            size="lg"
            onClick={() => setDemoModalOpen(true)}
            rightIcon={<Sparkles className="w-4 h-4" />}
            className="shadow-lg shadow-forest-700/25 px-8"
          >
            Schedule School Demo
          </Button>

          <Link to="/login">
            <Button variant="secondary" size="lg" className="px-8">
              Access School Workspace
            </Button>
          </Link>
        </div>

        {/* Highlight Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 text-left">
          <div className="p-5 rounded-[24px] bg-surface border border-line shadow-2xs">
            <div className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
              Classroom Speed
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-ink font-display mt-1">
              &lt; 90 Sec
            </div>
            <p className="text-xs text-ink-soft mt-1">Full class of 40 students verified</p>
          </div>

          <div className="p-5 rounded-[24px] bg-surface border border-line shadow-2xs">
            <div className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
              Offline Guarantee
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-forest-700 dark:text-forest-400 font-display mt-1">
              100% Zero-Net
            </div>
            <p className="text-xs text-ink-soft mt-1">Local SQLite encrypted ledger</p>
          </div>

          <div className="p-5 rounded-[24px] bg-surface border border-line shadow-2xs">
            <div className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
              Security Standard
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-ink font-display mt-1">
              AES-CMAC
            </div>
            <p className="text-xs text-ink-soft mt-1">DESFire EV3 cryptographic proof</p>
          </div>

          <div className="p-5 rounded-[24px] bg-surface border border-line shadow-2xs">
            <div className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
              Tenant Isolation
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-ink font-display mt-1">
              PostgreSQL RLS
            </div>
            <p className="text-xs text-ink-soft mt-1">Hardware & database segregation</p>
          </div>
        </div>
      </section>

      {/* Interactive 8-Stage Onboarding Journey */}
      <section id="journey" className="py-16 px-4 sm:px-8 bg-surface-soft/60 border-y border-line">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
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

          {/* Interactive Stepper Navigation */}
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
                  className="w-full"
                >
                  {selectedStageIndex < ONBOARDING_STAGES.length - 1
                    ? `Next: ${ONBOARDING_STAGES[selectedStageIndex + 1].title}`
                    : 'Schedule Onboarding Kickoff'}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Impact & ROI Calculator */}
      <section id="roi" className="py-16 px-4 sm:px-8 max-w-6xl mx-auto space-y-10">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <Badge variant="forest" size="md">
            Operational Efficiency
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
              <div className="flex justify-between text-xs text-ink-muted mt-1 font-mono">
                <span>100 Students</span>
                <span>1,500</span>
                <span>3,000 Students</span>
              </div>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-ink-soft">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-forest-700 shrink-0" />
                <span>Replaces 15 minutes of manual roll calls per classroom daily</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-forest-700 shrink-0" />
                <span>Prevents proxy attendance and paper register tampering</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-forest-700 shrink-0" />
                <span>Automated SMS alerts dispatch instantly upon gate tap</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 grid grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-surface-soft border border-line text-left">
              <div className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
                Teacher Time Saved
              </div>
              <div className="text-3xl font-extrabold text-forest-700 dark:text-forest-400 font-display mt-1">
                {teacherHoursSavedPerYear} Hrs
              </div>
              <p className="text-xs text-ink-soft mt-1">Per academic year</p>
            </div>

            <div className="p-5 rounded-2xl bg-surface-soft border border-line text-left">
              <div className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
                Attendance Accuracy
              </div>
              <div className="text-3xl font-extrabold text-ink font-display mt-1">
                {attendanceAccuracyPct}%
              </div>
              <p className="text-xs text-ink-soft mt-1">Cryptographically audited</p>
            </div>

            <div className="p-5 rounded-2xl bg-surface-soft border border-line text-left col-span-2">
              <div className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
                UDISE+ Export Readiness
              </div>
              <div className="text-xl font-bold text-ink font-display mt-1 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success-600" />
                <span>1-Click Automated Compliance</span>
              </div>
              <p className="text-xs text-ink-soft mt-1">Export standardized state format tables instantly</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer Banner */}
      <section className="py-14 px-4 sm:px-8 bg-forest-900 text-white mt-auto text-center space-y-6">
        <h2 className="text-3xl sm:text-4xl font-extrabold font-display max-w-xl mx-auto leading-tight">
          Ready to modernize attendance across your school?
        </h2>
        <p className="text-emerald-200/90 text-sm sm:text-base max-w-lg mx-auto">
          Contact our education deployment specialists for a zero-commitment demonstration.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setDemoModalOpen(true)}
            className="px-8 font-bold"
          >
            Request Institutional Demo
          </Button>
          <Link to="/login">
            <Button
              variant="ghost"
              size="lg"
              className="text-white hover:bg-forest-800 border border-emerald-500/30"
            >
              Sign In to Portal
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-4 sm:px-8 bg-surface border-t border-line text-center text-xs text-ink-muted flex flex-wrap items-center justify-between gap-4">
        <span>© 2026 AttendEase Platform • Govt. of India UDISE+ Standard</span>
        <div className="flex items-center gap-4">
          <Link to="/login" className="hover:text-ink">
            Teacher Login
          </Link>
          <span>•</span>
          <Link to="/login" className="hover:text-ink">
            Administrator Portal
          </Link>
        </div>
      </footer>

      {/* Dialog: Request Demo */}
      <Dialog
        isOpen={demoModalOpen}
        onClose={() => {
          setDemoModalOpen(false);
          setDemoSubmitted(false);
        }}
        title="Schedule an Institutional Demo"
        description="Connect with our education technology team"
      >
        {demoSubmitted ? (
          <div className="text-center py-6 space-y-4">
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
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleDemoSubmit} className="space-y-4 text-left">
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
                required
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
              <Button variant="secondary" size="md" onClick={() => setDemoModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" type="submit">
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
