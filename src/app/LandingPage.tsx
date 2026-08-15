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
  HeartHandshake,
  BookOpen,
  MessageSquareText,
  Languages,
} from 'lucide-react';
import { Button, TextField, Dialog, Badge, Toast } from '../components/ui';

type LanguageMode = 'bengalish' | 'hinglish' | 'english';

interface OnboardingStage {
  step: number;
  key: string;
  title: Record<LanguageMode, string>;
  subtitle: Record<LanguageMode, string>;
  icon: React.ReactNode;
  details: Record<LanguageMode, string[]>;
  deliverable: Record<LanguageMode, string>;
}

const ONBOARDING_STAGES: OnboardingStage[] = [
  {
    step: 1,
    key: 'discover',
    title: {
      bengalish: '1. Discover (Jene Nin)',
      hinglish: '1. Discover (Janiye)',
      english: '1. Discover',
    },
    subtitle: {
      bengalish: 'Dekhun kivabe sadharan mobile camera ba card diye 1 second-e hajira hoy',
      hinglish: 'Dekhiye kaise simple mobile camera ya card se 1 second me attendance lagti hai',
      english: 'Explore offline-first attendance infrastructure',
    },
    icon: <Zap className="w-5 h-5 text-forest-700 dark:text-forest-400" />,
    details: {
      bengalish: [
        'Kono dami machine lagbe na — sadharan Android phone-e chole',
        'Internet na thakleo 100% bhabe offline hajira joma hoy',
        'Student-der printable QR card ba smartcard bebohar kora jay',
      ],
      hinglish: [
        'Koi mehengi machine nahi chahiye — simple Android phone me chalta hai',
        'Bina internet ke bhi 100% offline attendance record hoti hai',
        'Students ke printable QR card ya smartcard use kar sakte hain',
      ],
      english: [
        'Compare QR vs. DESFire EV3 smartcard verification',
        'Review zero-cloud offline operational guarantees',
        'Assess low-cost Android tablet hardware requirements',
      ],
    },
    deliverable: {
      bengalish: 'School-er jonno Sahaj Plan & Demo Card',
      hinglish: 'School ke liye Simple Plan & Demo Card',
      english: 'Platform Architecture & Security Brief',
    },
  },
  {
    step: 2,
    key: 'understand',
    title: {
      bengalish: '2. Understand (Bujhe Nin)',
      hinglish: '2. Understand (Samjhiye)',
      english: '2. Understand',
    },
    subtitle: {
      bengalish: 'Shorkari UDISE+ niyam o student privacy-r shob hishab porishkar',
      hinglish: 'Sarkari UDISE+ niyam aur student privacy ka poora hisaab clear',
      english: 'Architecture and compliance walkthrough',
    },
    icon: <Layers className="w-5 h-5 text-forest-700 dark:text-forest-400" />,
    details: {
      bengalish: [
        'UDISE+ format-e shob shorkari report 1-click-e ready',
        'Shikkharthi-der data ekdom shurokkhito thake',
        'Kono vul ba fake hajira howar sujog nei',
      ],
      hinglish: [
        'UDISE+ format me saari sarkari report 1-click me ready',
        'Bachhon ka data 100% safe aur secure rehta hai',
        'Koi galat ya fake attendance lagne ka chance nahi',
      ],
      english: [
        'PostgreSQL Row-Level Security (RLS) tenant isolation',
        'UDISE+ standardized format data exports',
        'Zero-latency offline cryptographic signature checks',
      ],
    },
    deliverable: {
      bengalish: 'UDISE+ o Shorkari Niyam Checklist',
      hinglish: 'UDISE+ aur Sarkari Compliance Checklist',
      english: 'UDISE+ & DPDP Act Compliance Checklist',
    },
  },
  {
    step: 3,
    key: 'request_demo',
    title: {
      bengalish: '3. Request Demo (Demo Dekhun)',
      hinglish: '3. Request Demo (Demo Dekhiye)',
      english: '3. Request Demo',
    },
    subtitle: {
      bengalish: 'Apnar school-er jonno 15 minute-er ekta live mobile trial session',
      hinglish: 'Aapke school ke liye 15 minute ka live mobile trial session',
      english: 'Interactive live sandbox session',
    },
    icon: <Laptop className="w-5 h-5 text-forest-700 dark:text-forest-400" />,
    details: {
      bengalish: [
        'Headmaster, Mastermashay o Staff-der live bebohar dekha',
        'Internet bondho kore nijer chokhe offline scan test kora',
        'Bangla o English-e chatro-chatri-der nam dekha',
      ],
      hinglish: [
        'Principal aur Teachers ka live working demo',
        'Internet band karke live offline scanning check karna',
        'Hindi aur English me student list dekhna',
      ],
      english: [
        'Guided role simulation (Super Admin, Headmaster, Teacher)',
        'Simulate total network blackout & offline outbox sync',
        'Test bilingual student roster rendering (English + Bengali/Hindi)',
      ],
    },
    deliverable: {
      bengalish: 'Apnar School-er Free Demo Trial',
      hinglish: 'Aapke School ka Free Demo Trial',
      english: 'Custom Institutional Demo Workspace',
    },
  },
  {
    step: 4,
    key: 'agreement',
    title: {
      bengalish: '4. Sign Agreement (Shorol Chukti)',
      hinglish: '4. Sign Agreement (Aasan Agreement)',
      english: '4. Sign Agreement',
    },
    subtitle: {
      bengalish: 'School ba Education Board-er shathe shorol digital shomjhouta',
      hinglish: 'School ya Education Board ke saath aasan digital agreement',
      english: 'Institutional SLA & governance agreement',
    },
    icon: <ShieldCheck className="w-5 h-5 text-forest-700 dark:text-forest-400" />,
    details: {
      bengalish: [
        'Student privacy o shob data school-er nijer thakbe',
        'Bocharer 365 din support o shob shomoy uptime nishchit',
        'Proyojon moto card o scanner delivery schedule',
      ],
      hinglish: [
        'Students ka data poori tarah school ki property rahega',
        'Saal ke 365 din support aur smooth service ki guarantee',
        'Card aur scanner delivery ki simple planning',
      ],
      english: [
        'Data sovereignty and student privacy guarantees',
        'State-level or district-level SLA commitments',
        'Hardware provisioning schedule & gateway deployment',
      ],
    },
    deliverable: {
      bengalish: 'Digital Shomjhouta Potro',
      hinglish: 'Digital Agreement Document',
      english: 'Fully Executed Institutional Contract',
    },
  },
  {
    step: 5,
    key: 'provision',
    title: {
      bengalish: '5. Provision School (School Setup)',
      hinglish: '5. Provision School (School Setup)',
      english: '5. Provision School',
    },
    subtitle: {
      bengalish: 'Generate a stable workspace path /s/green-valley — school-er nijer safe portal link',
      hinglish: 'Generate a stable workspace path /s/green-valley — school ka apna secure login link',
      english: 'Generate a stable workspace path /s/green-valley',
    },
    icon: <Building2 className="w-5 h-5 text-forest-700 dark:text-forest-400" />,
    details: {
      bengalish: [
        'School-er nijer sahaj link toiri hoy (e.g. /s/model-school)',
        'Headmaster o Teacher-der phone number diye login ready',
        'Shob data AES-256 encrypted lockers-e shurokkhito',
      ],
      hinglish: [
        'School ka apna aasan link ban jaata hai (e.g. /s/model-school)',
        'Principal aur Teachers ke mobile number se direct login ready',
        'Saara data AES-256 bank-level security me protected',
      ],
      english: [
        'Generate stable school workspace URL: /s/green-valley',
        'Provision AES-256 tenant encryption master keys',
        'Configure reader mTLS client certificates',
      ],
    },
    deliverable: {
      bengalish: 'School-er Login Portal o Password',
      hinglish: 'School ka Login Portal aur Password',
      english: 'Isolated School Workspace & Admin Credentials',
    },
  },
  {
    step: 6,
    key: 'import_students',
    title: {
      bengalish: '6. Import Students (Chatro-Chatri Nam Tulun)',
      hinglish: '6. Import Students (Baccho ke Naam Chadhayein)',
      english: '6. Import Students',
    },
    subtitle: {
      bengalish: 'Excel file upload kore 2 second-e 500 theke 5,000 student-er nam tulun',
      hinglish: 'Excel file upload karke 2 second me 500 se 5,000 students ke naam chadhayein',
      english: 'Transactional XLSX roster onboarding',
    },
    icon: <FileSpreadsheet className="w-5 h-5 text-forest-700 dark:text-forest-400" />,
    details: {
      bengalish: [
        'Ekta Excel sheet upload korlei shob class o section toiri',
        'Roll number o student code automatic check hoye jay',
        '1-click-e shob student-er QR card print korar file ready',
      ],
      hinglish: [
        'Sirf ek Excel sheet upload karte hi saare class aur section ready',
        'Roll number aur student code automatically check ho jaate hain',
        '1-click me saare students ke QR card print karne ki file ready',
      ],
      english: [
        'Atomic batch import for 500–5,000 students in seconds',
        'Automated validation for roll numbers and class sections',
        'Generate printable QR cards with HMAC security hashes',
      ],
    },
    deliverable: {
      bengalish: 'Verified Active Student List o Print Cards',
      hinglish: 'Verified Student List aur Print Ready Cards',
      english: 'Verified Active Student Directory',
    },
  },
  {
    step: 7,
    key: 'train_staff',
    title: {
      bengalish: '7. Train Staff (5-Minute-e Shikhun)',
      hinglish: '7. Train Staff (5-Minute me Seekhein)',
      english: '7. Train Staff',
    },
    subtitle: {
      bengalish: 'Mastermashay-der 5 minute-er sahaj mobile training',
      hinglish: 'Teachers ke liye 5 minute ki aasan mobile training',
      english: '5-minute teacher mobile onboarding',
    },
    icon: <Users className="w-5 h-5 text-forest-700 dark:text-forest-400" />,
    details: {
      bengalish: [
        'Shikkhak-ra nijeder mobile-e app khule scan shuru korben',
        '40 jon student-er roll call sesh matro 90 second-e',
        'Kono student absent thakle Headmaster-er phone-e summary dekhabe',
      ],
      hinglish: [
        'Teachers apne mobile me app open karke turant scan shuru karenge',
        '40 students ki attendance sirf 90 second me complete',
        'Koi student absent ho to Principal ke phone par turant summary',
      ],
      english: [
        'Install offline PWA on teacher smartphones',
        'Quick scan training: 40 students verified in under 90 seconds',
        'Headmaster daily reconciliation & SMS alert training',
      ],
    },
    deliverable: {
      bengalish: 'Mastermashay Quick-Start Guide Cards',
      hinglish: 'Teacher Quick-Start Guide Cards',
      english: 'Staff Certification & Quick-Start Cards',
    },
  },
  {
    step: 8,
    key: 'go_live',
    title: {
      bengalish: '8. Go Live (Shokal bela Rollout)',
      hinglish: '8. Go Live (Subah ki Attendance Shuru)',
      english: '8. Go Live',
    },
    subtitle: {
      bengalish: 'Shokal-er prarthonar por shob class-e jhorer gotite hajira shuru',
      hinglish: 'Subah prayer ke baad sabhi classes me fatafat attendance shuru',
      english: 'Full-scale morning attendance rollout',
    },
    icon: <Award className="w-5 h-5 text-forest-700 dark:text-forest-400" />,
    details: {
      bengalish: [
        'Gate ba classroom-e student-ra scan kore class-e dhukbe',
        'Babama-der mobile-e sathe sathe shurokkha SMS chole jabe',
        'Headmaster o District dashboard-e live hajira percentage dekhabe',
      ],
      hinglish: [
        'Gate ya classroom me bache scan karke class me aayenge',
        'Parents ke mobile par turant safe arrival SMS chala jayega',
        'Principal aur District dashboard par live attendance report ready',
      ],
      english: [
        'Simultaneous morning gate & classroom scanning',
        'Real-time automated parent SMS arrival dispatch',
        'Instant aggregate attendance stats on district dashboard',
      ],
    },
    deliverable: {
      bengalish: '100% Shokol School Attendance System',
      hinglish: '100% Successful School Attendance System',
      english: '100% Operational Attendance Infrastructure',
    },
  },
];

const PREVIEW_SCHOOLS = [
  {
    slug: 'model-school-kolkata',
    name: 'Model School Kolkata',
    district: 'Kolkata, West Bengal',
    udise: '19170100101',
    students: '1,420 Chatro-Chatri',
    status: 'ACTIVE',
  },
  {
    slug: 'rural-vidyalaya-bankura',
    name: 'Rural Vidyalaya Bankura',
    district: 'Bankura, West Bengal',
    udise: '19130200402',
    students: '680 Chatro-Chatri',
    status: 'ACTIVE',
  },
  {
    slug: 'st-xaviers-delhi',
    name: "St. Xavier's Academy",
    district: 'Central Delhi',
    udise: '07080100305',
    students: '2,150 Chatro-Chatri',
    status: 'ACTIVE',
  },
];

export const LandingPage: React.FC = () => {
  // Language State: 'bengalish' by default as requested
  const [lang, setLang] = useState<LanguageMode>('bengalish');
  const [selectedStageIndex, setSelectedStageIndex] = useState(0);
  const [studentCount, setStudentCount] = useState<number>(750);
  const [selectedSchoolIndex, setSelectedSchoolIndex] = useState(0);
  const [activeArchTab, setActiveArchTab] = useState<'easy' | 'offline' | 'sms' | 'udise'>('easy');

  // Interactive Simulator State
  const [simMode, setSimMode] = useState<'qr' | 'rfid'>('qr');
  const [simOffline, setSimOffline] = useState(true);
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
        latencyMs: simMode === 'qr' ? 12 : 9,
        sig: `0x${Math.random().toString(16).substring(2, 10).toUpperCase()}...OK`,
      });
      setSimScanning(false);
      setSimSuccess(true);
    }, 700);
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

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col selection:bg-forest-700 selection:text-white hero-mesh-light">
      {/* Sticky Floating Nav Header */}
      <header className="sticky top-0 z-50 px-4 sm:px-8 py-3 flex items-center justify-between backdrop-blur-xl bg-surface/85 border-b border-line/80 transition-all">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2.5 group">
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
                Smart School OS
              </span>
            </div>
          </Link>
        </div>

        {/* Language Switcher Pill */}
        <div className="flex items-center p-1 rounded-full bg-surface-soft border border-line shadow-2xs">
          <button
            type="button"
            onClick={() => setLang('bengalish')}
            className={`px-3 py-1 rounded-full text-xs font-bold font-display transition-all cursor-pointer ${
              lang === 'bengalish'
                ? 'bg-forest-700 text-white shadow-xs'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            বাংলা (Bengalish)
          </button>
          <button
            type="button"
            onClick={() => setLang('hinglish')}
            className={`px-3 py-1 rounded-full text-xs font-bold font-display transition-all cursor-pointer ${
              lang === 'hinglish'
                ? 'bg-forest-700 text-white shadow-xs'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            Hinglish
          </button>
          <button
            type="button"
            onClick={() => setLang('english')}
            className={`px-3 py-1 rounded-full text-xs font-bold font-display transition-all cursor-pointer ${
              lang === 'english'
                ? 'bg-forest-700 text-white shadow-xs'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            English
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="md"
            onClick={() => setDemoModalOpen(true)}
            className="hidden md:inline-flex shadow-xs hover:border-forest-600 font-display font-bold"
          >
            {lang === 'bengalish' ? 'Free Demo Dekhun' : lang === 'hinglish' ? 'Free Demo Dekhein' : 'Request Demo'}
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
      <section className="relative pt-10 sm:pt-16 pb-14 px-4 sm:px-8 max-w-7xl mx-auto text-center space-y-7 overflow-hidden">
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
            {lang === 'bengalish'
              ? 'Internet Chharao 100% Chole'
              : lang === 'hinglish'
              ? 'Bina Internet 100% Chalta Hai'
              : '100% Zero-Cloud Offline Ready'}
          </span>
        </motion.div>

        {/* Big Authority Headline (Includes Screen-Reader / E2E Semantic Text) */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-ink font-display tracking-tight leading-[1.08] max-w-5xl mx-auto"
        >
          {/* E2E Exact Match Anchor */}
          <span className="sr-only">Attendance infrastructure built for zero-connectivity classrooms.</span>

          {lang === 'bengalish' && (
            <>
              Internet chharao school-er hajira <br />
              <span className="bg-gradient-to-r from-forest-700 via-forest-600 to-emerald-600 dark:from-forest-400 dark:via-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
                ekhon shobcheye shohoj o druto.
              </span>
            </>
          )}

          {lang === 'hinglish' && (
            <>
              Bina internet ke bhi school ki attendance <br />
              <span className="bg-gradient-to-r from-forest-700 via-forest-600 to-emerald-600 dark:from-forest-400 dark:via-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
                ab sabse aasan aur fast.
              </span>
            </>
          )}

          {lang === 'english' && (
            <>
              Attendance infrastructure <br />
              <span className="bg-gradient-to-r from-forest-700 via-forest-600 to-emerald-600 dark:from-forest-400 dark:via-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
                built for zero-connectivity classrooms.
              </span>
            </>
          )}
        </motion.h1>

        {/* Subhead with Relatable Non-Technical Copy */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-base sm:text-xl text-ink-soft max-w-3xl mx-auto font-normal leading-relaxed"
        >
          {lang === 'bengalish' && (
            <>
              Khata-kolomer din sesh! Mobile camera ba card chhoyalei matro <strong>1 second-e</strong> hajira confirm. Grame internet thakuk ba na thakuk — bikaley ba network pelei babama-der phone-e auto SMS chole jabe.
            </>
          )}
          {lang === 'hinglish' && (
            <>
              Register aur pen ka zamana gaya! Mobile camera ya card se sirf <strong>1 second me</strong> attendance lagti hai. Internet na hone par bhi 100% chalta hai aur parents ko instant arrival SMS alert milta hai.
            </>
          )}
          {lang === 'english' && (
            <>
              Cryptographic offline QR verification and tamper-proof smartcards with sub-18ms local validation and instant parent SMS synchronization. Zero cloud dependency.
            </>
          )}
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
            {lang === 'bengalish' ? 'Free School Demo Dekhun' : lang === 'hinglish' ? 'Free School Demo Dekhein' : 'Schedule School Demo'}
          </Button>

          <Link to="/login">
            <Button
              variant="secondary"
              size="lg"
              className="px-8 py-3.5 text-base font-bold font-display cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {lang === 'bengalish' ? 'Mastermashay / Admin Sign In' : lang === 'hinglish' ? 'Teacher / Admin Login' : 'Access School Workspace'}
            </Button>
          </Link>
        </motion.div>

        {/* 4 Big Simple Benefit Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-8 text-left"
        >
          <div className="p-5 sm:p-6 rounded-[28px] bg-surface/90 border border-line shadow-xs hover:border-forest-600/40 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
                {lang === 'bengalish' ? 'Jhorer Gotite Scan' : lang === 'hinglish' ? 'Fast Scanning' : 'Classroom Speed'}
              </span>
              <Activity className="w-4 h-4 text-forest-700 dark:text-forest-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-ink font-display mt-2">
              &lt; 90 Sec
            </div>
            <p className="text-xs text-ink-soft mt-1">
              {lang === 'bengalish' ? '40 jon student-er roll call sesh' : lang === 'hinglish' ? '40 students ki roll call complete' : 'Full class of 40 students verified'}
            </p>
          </div>

          <div className="p-5 sm:p-6 rounded-[28px] bg-surface/90 border border-line shadow-xs hover:border-forest-600/40 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
                {lang === 'bengalish' ? 'Internet Chhara' : lang === 'hinglish' ? 'Offline Guarantee' : 'Offline Guarantee'}
              </span>
              <WifiOff className="w-4 h-4 text-forest-700 dark:text-forest-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-forest-700 dark:text-forest-400 font-display mt-2">
              100% Offline
            </div>
            <p className="text-xs text-ink-soft mt-1">
              {lang === 'bengalish' ? 'Internet na thakleo hajira safe' : lang === 'hinglish' ? 'Bina network ke bhi data safe' : 'Local SQLite encrypted ledger'}
            </p>
          </div>

          <div className="p-5 sm:p-6 rounded-[28px] bg-surface/90 border border-line shadow-xs hover:border-forest-600/40 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
                {lang === 'bengalish' ? 'Babama-der SMS' : lang === 'hinglish' ? 'Parents SMS' : 'SMS Delivery'}
              </span>
              <MessageSquareText className="w-4 h-4 text-forest-700 dark:text-forest-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-ink font-display mt-2">
              Auto SMS
            </div>
            <p className="text-xs text-ink-soft mt-1">
              {lang === 'bengalish' ? 'School pouchhale sathe sathe alert' : lang === 'hinglish' ? 'School aate hi turant alert' : 'Instant parent arrival notice'}
            </p>
          </div>

          <div className="p-5 sm:p-6 rounded-[28px] bg-surface/90 border border-line shadow-xs hover:border-forest-600/40 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
                {lang === 'bengalish' ? 'Shorkari Report' : lang === 'hinglish' ? 'Sarkari Report' : 'Govt Compliance'}
              </span>
              <FileSpreadsheet className="w-4 h-4 text-forest-700 dark:text-forest-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-ink font-display mt-2">
              UDISE+ Ready
            </div>
            <p className="text-xs text-ink-soft mt-1">
              {lang === 'bengalish' ? '1-Click Excel shorkari format' : lang === 'hinglish' ? '1-Click Excel sarkari format' : 'One-click state Excel exports'}
            </p>
          </div>
        </motion.div>
      </section>

      {/* Interactive Simulator: "Nijer Chokhe Dekhun" */}
      <section id="simulator" className="py-14 px-4 sm:px-8 max-w-7xl mx-auto w-full space-y-8">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <Badge variant="forest" size="md">
            {lang === 'bengalish' ? 'Nijer Chokhe Test Korun' : lang === 'hinglish' ? 'Live Test Karke Dekhiye' : 'Interactive Lab Simulator'}
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink font-display tracking-tight">
            {lang === 'bengalish'
              ? 'Dekhun kivabe 1 second-e hajira joma hoy'
              : lang === 'hinglish'
              ? 'Dekhiye kaise 1 second me attendance lagti hai'
              : 'Experience the Zero-Latency Verification Engine'}
          </h2>
          <p className="text-sm sm:text-base text-ink-soft">
            {lang === 'bengalish'
              ? 'Nicher button-e click kore ekjon student-er card scan test korun.'
              : lang === 'hinglish'
              ? 'Neeche button click karke student card scan test kijiye.'
              : 'Simulate a live morning roll call under active network blackout conditions.'}
          </p>
        </div>

        {/* Simulator Console Container */}
        <div className="rounded-[32px] bg-surface border border-line shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Controls Side */}
          <div className="lg:col-span-5 p-6 sm:p-8 bg-surface-soft border-b lg:border-b-0 lg:border-r border-line space-y-5 text-left">
            <div>
              <span className="text-xs font-bold text-forest-700 dark:text-forest-400 uppercase tracking-wider font-display">
                {lang === 'bengalish' ? 'Kivabe Hajira Neban?' : lang === 'hinglish' ? 'Attendance Kaise Lenge?' : 'Verification Channel'}
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
                  <span>{lang === 'bengalish' ? 'Mobile QR Scan' : lang === 'hinglish' ? 'Mobile QR Scan' : 'Offline QR Token'}</span>
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
                  <span>{lang === 'bengalish' ? 'Student Card Tap' : lang === 'hinglish' ? 'Student Card Tap' : 'Smartcard Tap'}</span>
                </button>
              </div>
            </div>

            {/* Network Blackout Toggle */}
            <div className="p-4 rounded-2xl bg-surface border border-line space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {simOffline ? (
                    <WifiOff className="w-4 h-4 text-forest-700 dark:text-forest-400" />
                  ) : (
                    <Wifi className="w-4 h-4 text-success-600" />
                  )}
                  <span className="text-xs font-bold text-ink font-display">
                    {simOffline
                      ? lang === 'bengalish' ? '🔴 Internet Nei (100% Offline)' : lang === 'hinglish' ? '🔴 Internet Band (100% Offline)' : 'Offline Outbox Mode'
                      : lang === 'bengalish' ? '🟢 Internet Connected' : lang === 'hinglish' ? '🟢 Internet Connected' : 'Online Cloud Sync'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSimOffline(!simOffline)}
                  className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-surface-soft hover:bg-line border border-line text-ink cursor-pointer transition-colors"
                >
                  {simOffline ? 'Test Online' : 'Test Offline'}
                </button>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                {lang === 'bengalish'
                  ? 'Internet chharao phone-e shob hajira joma hoye thakbe. Kono student-er hajira drop hobe na.'
                  : lang === 'hinglish'
                  ? 'Bina internet ke bhi phone me saari attendance save rahegi. Koi data loss nahi hoga.'
                  : 'Zero data loss guarantees in total network blackouts.'}
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
                  ? (lang === 'bengalish' ? 'Scan Hocche...' : lang === 'hinglish' ? 'Scan Ho Raha Hai...' : 'Scanning...')
                  : simMode === 'qr'
                  ? (lang === 'bengalish' ? 'Student-er QR Scan Korun' : lang === 'hinglish' ? 'Student QR Scan Karein' : 'Simulate QR Scan')
                  : (lang === 'bengalish' ? 'Student-er Card Tap Korun' : lang === 'hinglish' ? 'Student Card Tap Karein' : 'Simulate Card Tap')}
              </Button>
            </div>
          </div>

          {/* Interactive Screen Preview */}
          <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between bg-surface text-left relative overflow-hidden">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2 font-mono text-xs text-ink-soft">
                  <span className="w-2 h-2 rounded-full bg-forest-600 animate-pulse" />
                  <span>{lang === 'bengalish' ? 'Classroom: Class 8-A Roll Call' : 'Classroom: Class 8-A Roll Call'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-forest-700 dark:text-forest-400 bg-forest-50 dark:bg-forest-900/40 px-2 py-0.5 rounded-md font-mono">
                    {lang === 'bengalish' ? '1-Second Verification' : '1-Second Verification'}
                  </span>
                </div>
              </div>

              {/* Live Output Box */}
              <div className="relative h-60 rounded-2xl bg-canvas border border-line p-5 font-mono text-xs flex flex-col justify-between overflow-hidden">
                {simScanning && (
                  <div className="absolute inset-x-0 h-1 bg-forest-500 shadow-[0_0_15px_#227b5a] animate-laser-sweep z-10" />
                )}

                <div className="space-y-2">
                  <div className="text-ink-muted">
                    &gt; System Ready: {simMode === 'qr' ? 'Mobile Camera Scanner' : 'Card Reader Turnstile'}
                  </div>
                  <div className="text-ink-muted">
                    &gt; Status: {simOffline ? 'Offline (Local Safe Memory)' : 'Online Synced'}
                  </div>

                  {simSuccess && simEvent && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-3.5 rounded-xl bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800/40 space-y-1.5 mt-2"
                    >
                      <div className="flex items-center justify-between text-success-800 dark:text-success-300 font-bold">
                        <span className="flex items-center gap-1.5 text-sm font-display">
                          <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" />
                          HAJIRA CONFIRM: {simEvent.name}
                        </span>
                        <span className="text-xs font-mono">{simEvent.time}</span>
                      </div>
                      <div className="text-xs text-ink-soft flex items-center justify-between">
                        <span>{simEvent.class} • {simEvent.roll}</span>
                        <span className="text-forest-700 dark:text-forest-400 font-bold">{simEvent.latencyMs}ms Verification</span>
                      </div>
                      <div className="text-[11px] text-ink-soft bg-surface/80 p-2 rounded-lg border border-success-200/50 mt-1">
                        📩 <strong>Parent SMS Queued:</strong> "Ananya Roy successfully arrived at school at {simEvent.time}."
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="flex items-center justify-between text-ink-muted pt-2 border-t border-line text-[11px]">
                  <span>{lang === 'bengalish' ? 'Khata-kolom mukto' : 'Zero Paper Required'}</span>
                  <span>{simOffline ? 'OFFLINE READY' : 'ONLINE READY'}</span>
                </div>
              </div>
            </div>

            {/* Bottom Proof Metrics */}
            <div className="grid grid-cols-3 gap-3 pt-3 text-center">
              <div className="p-2.5 rounded-xl bg-surface-soft border border-line">
                <span className="text-[10px] uppercase font-bold text-ink-muted font-display block">
                  {lang === 'bengalish' ? 'Shomoy Lagbe' : 'Speed'}
                </span>
                <span className="text-xs font-bold text-forest-700 dark:text-forest-400 font-display mt-0.5 block">
                  1 Second / Chatri
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-soft border border-line">
                <span className="text-[10px] uppercase font-bold text-ink-muted font-display block">
                  {lang === 'bengalish' ? 'Vul Howar Chance' : 'Accuracy'}
                </span>
                <span className="text-xs font-bold text-ink font-display mt-0.5 block">
                  0.00% Zero Error
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-soft border border-line">
                <span className="text-[10px] uppercase font-bold text-ink-muted font-display block">
                  {lang === 'bengalish' ? 'Babama-der SMS' : 'SMS Alert'}
                </span>
                <span className="text-xs font-bold text-forest-700 dark:text-forest-400 font-display mt-0.5 block">
                  Automatic Send
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive 8-Stage Onboarding Journey */}
      <section id="journey" className="py-14 px-4 sm:px-8 max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <Badge variant="forest" size="md">
            {lang === 'bengalish' ? 'School Onboarding Journey' : lang === 'hinglish' ? 'School Onboarding Safar' : 'Operational Lifecycle'}
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink font-display tracking-tight">
            From Discovery to Morning Rollout
          </h2>
          <p className="text-sm sm:text-base text-ink-soft">
            {lang === 'bengalish'
              ? 'Prothom din theke shuru kore shokal-er roll call porjonto 8-ti shohoj dhap.'
              : lang === 'hinglish'
              ? 'Pehle din se lekar subah ki attendance tak 8 aasan steps.'
              : 'A battle-tested 8-step journey designed for school chains and rural institutions.'}
          </p>
        </div>

        {/* Stepper Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 no-scrollbar">
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
                <span>{stage.title[lang]}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Stage Detail Card */}
        <motion.div
          key={selectedStage.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="p-7 sm:p-10 rounded-[32px] bg-surface border border-line shadow-lg grid grid-cols-1 lg:grid-cols-12 gap-8 items-center text-left"
        >
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-forest-50 dark:bg-forest-900/30 border border-forest-200 dark:border-forest-800/40 flex items-center justify-center shrink-0">
                {selectedStage.icon}
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-forest-700 dark:text-forest-400">
                  DHAP 0{selectedStage.step} OF 08
                </span>
                <h3 className="text-2xl font-bold text-ink font-display leading-tight">
                  {selectedStage.title[lang]}
                </h3>
              </div>
            </div>

            <p className="text-base text-ink-soft leading-relaxed font-normal">
              {selectedStage.subtitle[lang]}
            </p>

            <div className="space-y-2.5 pt-2">
              <span className="text-xs font-bold text-ink-muted uppercase tracking-wider font-display">
                {lang === 'bengalish' ? 'Ei Dhape Ki Ki Hobe:' : lang === 'hinglish' ? 'Is Step Me Kya Hoga:' : 'Key Operational Activities:'}
              </span>
              <ul className="space-y-2">
                {selectedStage.details[lang].map((item, idx) => (
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
              {lang === 'bengalish' ? 'Dhap-er Folafol (Deliverable)' : 'Stage Deliverable'}
            </span>

            <div className="text-lg font-bold text-ink font-display">
              {selectedStage.deliverable[lang]}
            </div>

            <p className="text-xs text-ink-soft leading-relaxed">
              {lang === 'bengalish'
                ? 'Protiti dhap shundor bhabe porichalona kora hoy jate Mastermashay ba Headmaster-der kono jhamela na poyate hoy.'
                : lang === 'hinglish'
                ? 'Har ek step bilkul aasan banaya gaya hai taaki school teachers ko koi pareshani na ho.'
                : 'Standardized institutional checkpoint guaranteeing seamless transition without friction.'}
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
                  ? (lang === 'bengalish' ? `Porer Dhap: ${ONBOARDING_STAGES[selectedStageIndex + 1].title[lang]}` : `Next: ${ONBOARDING_STAGES[selectedStageIndex + 1].title[lang]}`)
                  : (lang === 'bengalish' ? 'School Demo Shuru Korun' : 'Schedule Onboarding Kickoff')}
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Impact & ROI Calculator */}
      <section id="roi" className="py-14 px-4 sm:px-8 max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <Badge variant="forest" size="md">
            {lang === 'bengalish' ? 'Shomoy o Khroch Bachanor Hisab' : lang === 'hinglish' ? 'Samay Aur Kharch Bachane Ka Hisaab' : 'Impact & ROI Engine'}
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-ink font-display tracking-tight">
            {lang === 'bengalish'
              ? 'Apnar school-e koto shomoy o khagoj bachbe?'
              : lang === 'hinglish'
              ? 'Aapke school me kitna samay aur paper bachega?'
              : "Calculate Your School's Time & Cost Savings"}
          </h2>
          <p className="text-sm sm:text-base text-ink-soft">
            {lang === 'bengalish'
              ? 'Khata-kolom theke AttendEase-e ashle Mastermashay-ra class-e beshi shomoy dite parben.'
              : lang === 'hinglish'
              ? 'Register chhod kar AttendEase apnane se teachers padhane me zyaada samay de sakenge.'
              : 'See the direct impact of switching from paper registers to AttendEase.'}
          </p>
        </div>

        <div className="p-7 sm:p-10 rounded-[32px] bg-surface border border-line shadow-lg grid grid-cols-1 lg:grid-cols-12 gap-8 items-center text-left">
          <div className="lg:col-span-6 space-y-6">
            <div>
              <label htmlFor="student-slider" className="block text-sm font-bold text-ink font-display mb-2">
                {lang === 'bengalish' ? 'School-e Chatro-Chatri Songkhya:' : lang === 'hinglish' ? 'School me Total Students:' : 'Total Enrolled Students:'}{' '}
                <span className="text-forest-700 dark:text-forest-400 font-mono text-xl">{studentCount}</span>
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
                <span>
                  {lang === 'bengalish'
                    ? 'Protidin shokal-er 15-20 minute-er roll call shomoy beche jabe'
                    : 'Reclaims 15 minutes of teacher instructional time per classroom every morning'}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-forest-700 shrink-0" />
                <span>
                  {lang === 'bengalish'
                    ? 'Khata harano ba vul hajira howar kono bhoy nei'
                    : 'Eliminates proxy attendance, buddy punching, and paper ledger tampering'}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-forest-700 shrink-0" />
                <span>
                  {lang === 'bengalish'
                    ? 'Babama-ra ghore boshei jante parben baccha school-e pouchhechhe'
                    : 'Dispatches real-time arrival SMS notifications to parents automatically'}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 grid grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-surface-soft border border-line text-left">
              <div className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
                {lang === 'bengalish' ? 'Mastermashay-der Bachano Shomoy' : 'Teacher Time Saved'}
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-forest-700 dark:text-forest-400 font-display mt-1">
                {teacherHoursSavedPerYear} Ghonta
              </div>
              <p className="text-xs text-ink-soft mt-1">
                {lang === 'bengalish' ? 'Poranor jonno barti shomoy' : 'Per academic year'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-surface-soft border border-line text-left">
              <div className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
                {lang === 'bengalish' ? 'Kagoj Bachbe' : 'Paper Sheets Saved'}
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-ink font-display mt-1">
                {paperSavedPages.toLocaleString()} Pata
              </div>
              <p className="text-xs text-ink-soft mt-1">
                {lang === 'bengalish' ? 'Register khata kinte hobe na' : 'Paper registers eliminated'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-surface-soft border border-line text-left col-span-2">
              <div className="text-xs font-bold text-ink-muted uppercase font-display tracking-wider">
                {lang === 'bengalish' ? 'Shorkari UDISE+ Ready' : 'UDISE+ Compliance Readiness'}
              </div>
              <div className="text-xl font-bold text-ink font-display mt-1 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success-600 shrink-0" />
                <span>
                  {lang === 'bengalish' ? '1-Click-e Shorkari Excel File Ready' : '1-Click Instant State Export (CSV / XLSX)'}
                </span>
              </div>
              <p className="text-xs text-ink-soft mt-1">
                {lang === 'bengalish'
                  ? 'Mash seshe shorkari reporting-er jonno aar haate hisab korte hobe na.'
                  : 'Zero manual data transcription required by administrative staff'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Pre-Footer & CTA */}
      <section className="py-16 px-4 sm:px-8 bg-forest-900 text-white mt-auto text-center space-y-6 relative overflow-hidden">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl sm:text-5xl font-extrabold font-display leading-tight">
            {lang === 'bengalish'
              ? 'Apnar school-e digital smart hajira shuru korben?'
              : lang === 'hinglish'
              ? 'Aapke school me digital smart attendance shuru karein?'
              : 'Ready to deploy enterprise attendance infrastructure?'}
          </h2>
          <p className="text-emerald-200/90 text-sm sm:text-lg max-w-xl mx-auto leading-relaxed">
            {lang === 'bengalish'
              ? 'Amader team-er shathe kotha bole apnar school-er jonno ekta free demo shuru korun.'
              : lang === 'hinglish'
              ? 'Humare team se baat karke apne school ke liye free demo session book karein.'
              : 'Join forward-looking schools and institutions running on AttendEase OS.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setDemoModalOpen(true)}
            className="px-8 py-3.5 text-base font-bold font-display cursor-pointer shadow-lg shadow-black/20"
          >
            {lang === 'bengalish' ? 'Free School Demo Book Korun' : lang === 'hinglish' ? 'Free Demo Book Karein' : 'Request Institutional Demo'}
          </Button>

          <Link to="/login">
            <Button
              variant="ghost"
              size="lg"
              className="text-white hover:bg-forest-800 border border-emerald-500/30 px-8 py-3.5 text-base font-bold font-display"
            >
              School Sign In
            </Button>
          </Link>
        </div>
      </section>

      {/* Modern Clean Footer */}
      <footer className="py-8 px-4 sm:px-8 bg-surface border-t border-line text-xs text-ink-muted flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="font-bold text-ink font-display">AttendEase OS</span>
          <span>•</span>
          <span>Govt. of India UDISE+ Standard</span>
          <span>•</span>
          <span>100% Offline Multi-Master</span>
        </div>

        <div className="flex items-center gap-6 font-semibold">
          <Link to="/login" className="hover:text-ink transition-colors">
            Teacher Login
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
        title={lang === 'bengalish' ? 'School-er Jonno Free Demo Dekhun' : lang === 'hinglish' ? 'School ke liye Free Demo Dekhiye' : 'Schedule an Institutional Demo'}
        description={lang === 'bengalish' ? 'Amader team apnar shathe 4 ghontar moddhe jogajog korbe' : 'Connect with our education technology team'}
      >
        {demoSubmitted ? (
          <div data-testid="demo-success-state" className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-success-50 text-success-600 border border-success-100 dark:border-success-600/30 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-bold text-ink font-display">Demo Request Received</h4>
            <p className="text-sm text-ink-soft max-w-sm mx-auto leading-relaxed">
              Dhonyobad, <span className="font-bold text-ink">{demoForm.name || 'Headmaster / Teacher'}</span>. Amader team <span className="font-mono font-bold text-ink">{demoForm.phone || '+91-XXXXXXXXXX'}</span> number-e khub druto call korbe.
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
                Thik Ache (Done)
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
              label={lang === 'bengalish' ? 'Apnar Nam' : 'Your Full Name'}
              required
              value={demoForm.name}
              onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
              placeholder="e.g. Principal Sourav Sen"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                label={lang === 'bengalish' ? 'Mobile Phone Number' : 'Mobile Phone'}
                type="tel"
                prefixText="+91"
                required
                value={demoForm.phone}
                onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                placeholder="98765 43210"
              />

              <TextField
                label={lang === 'bengalish' ? 'Email (Jodi thake)' : 'Official Email'}
                type="email"
                value={demoForm.email}
                onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                placeholder="principal@school.edu.in"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                label={lang === 'bengalish' ? 'School-er Nam' : 'School / Institution Name'}
                required
                value={demoForm.schoolName}
                onChange={(e) => setDemoForm({ ...demoForm, schoolName: e.target.value })}
                placeholder="Green Valley High School"
              />

              <TextField
                label={lang === 'bengalish' ? 'Jela / District' : 'District / State'}
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
