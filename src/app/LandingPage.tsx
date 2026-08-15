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
  Smartphone,
  CheckCircle,
  FileCheck,
  BellRing,
  Sun,
  Smile,
  XCircle,
} from 'lucide-react';
import { Button, TextField, Dialog, Badge, Toast } from '../components/ui';

type LanguageMode = 'english' | 'bengalish' | 'hinglish';

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
      english: '1. Discover (See How It Works)',
      bengalish: '1. Discover (Jene Nin)',
      hinglish: '1. Discover (Janiye)',
    },
    subtitle: {
      english: 'See how any standard mobile phone or card takes roll call in 1 second',
      bengalish: 'Dekhun kivabe sadharan mobile camera ba card diye 1 second-e hajira hoy',
      hinglish: 'Dekhiye kaise simple mobile camera ya card se 1 second me attendance lagti hai',
    },
    icon: <Zap className="w-6 h-6 text-forest-700 dark:text-forest-400" />,
    details: {
      english: [
        'No costly hardware — runs on simple Android phones or tablets',
        'Works 100% offline — zero internet needed inside classrooms',
        'Print friendly student QR cards on regular school paper',
      ],
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
    },
    deliverable: {
      english: 'Simple School Plan & Demo Card Sample',
      bengalish: 'School-er jonno Sahaj Plan & Demo Card',
      hinglish: 'School ke liye Simple Plan & Demo Card',
    },
  },
  {
    step: 2,
    key: 'understand',
    title: {
      english: '2. Understand (Government Rules & Privacy)',
      bengalish: '2. Understand (Bujhe Nin)',
      hinglish: '2. Understand (Samjhiye)',
    },
    subtitle: {
      english: 'UDISE+ government format compliance and student safety made simple',
      bengalish: 'Shorkari UDISE+ niyam o student privacy-r shob hishab porishkar',
      hinglish: 'Sarkari UDISE+ niyam aur student privacy ka poora hisaab clear',
    },
    icon: <Layers className="w-6 h-6 text-forest-700 dark:text-forest-400" />,
    details: {
      english: [
        'All government UDISE+ attendance reports ready in 1 click',
        'Student data stays completely safe and private to your school',
        'Stops proxy attendance, buddy punching, and paper ledger errors',
      ],
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
    },
    deliverable: {
      english: 'UDISE+ & Government Compliance Checklist',
      bengalish: 'UDISE+ o Shorkari Niyam Checklist',
      hinglish: 'UDISE+ aur Sarkari Compliance Checklist',
    },
  },
  {
    step: 3,
    key: 'request_demo',
    title: {
      english: '3. Request Demo (Free Live Trial)',
      bengalish: '3. Request Demo (Demo Dekhun)',
      hinglish: '3. Request Demo (Demo Dekhiye)',
    },
    subtitle: {
      english: 'A 15-minute guided walkthrough tailored for your teachers and principal',
      bengalish: 'Apnar school-er jonno 15 minute-er ekta live mobile trial session',
      hinglish: 'Aapke school ke liye 15 minute ka live mobile trial session',
    },
    icon: <Laptop className="w-6 h-6 text-forest-700 dark:text-forest-400" />,
    details: {
      english: [
        'Hands-on test for Headmasters and class teachers',
        'Turn off Wi-Fi and mobile data to test offline scanning yourself',
        'See student names in English, Bengali, or Hindi on the screen',
      ],
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
    },
    deliverable: {
      english: 'Free Trial Workspace for Your School',
      bengalish: 'Apnar School-er Free Demo Trial',
      hinglish: 'Aapke School ka Free Demo Trial',
    },
  },
  {
    step: 4,
    key: 'agreement',
    title: {
      english: '4. Sign Agreement (Simple Agreement)',
      bengalish: '4. Sign Agreement (Shorol Chukti)',
      hinglish: '4. Sign Agreement (Aasan Agreement)',
    },
    subtitle: {
      english: 'Straightforward school partnership agreement with no hidden lock-ins',
      bengalish: 'School ba Education Board-er shathe shorol digital shomjhouta',
      hinglish: 'School ya Education Board ke saath aasan digital agreement',
    },
    icon: <ShieldCheck className="w-6 h-6 text-forest-700 dark:text-forest-400" />,
    details: {
      english: [
        'Your school owns 100% of student and attendance records',
        '365-day dedicated teacher support and automatic backup guarantee',
        'Card delivery and teacher setup schedule finalized',
      ],
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
    },
    deliverable: {
      english: 'Signed Simple Partnership Agreement',
      bengalish: 'Digital Shomjhouta Potro',
      hinglish: 'Digital Agreement Document',
    },
  },
  {
    step: 5,
    key: 'provision',
    title: {
      english: '5. Provision School (Your School Link)',
      bengalish: '5. Provision School (School Setup)',
      hinglish: '5. Provision School (School Setup)',
    },
    subtitle: {
      english: 'Generate a stable workspace path /s/green-valley — your school safe digital portal',
      bengalish: 'Generate a stable workspace path /s/green-valley — school-er nijer safe portal link',
      hinglish: 'Generate a stable workspace path /s/green-valley — school ka apna secure login link',
    },
    icon: <Building2 className="w-6 h-6 text-forest-700 dark:text-forest-400" />,
    details: {
      english: [
        'Easy website link created for your school (e.g. /s/green-valley)',
        'Teachers and Headmaster log in using their mobile phone number',
        'All student data locked with bank-level encryption',
      ],
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
    },
    deliverable: {
      english: 'School Login Portal & Staff Passwords',
      bengalish: 'School-er Login Portal o Password',
      hinglish: 'School ka Login Portal aur Password',
    },
  },
  {
    step: 6,
    key: 'import_students',
    title: {
      english: '6. Import Students (Add Student Names)',
      bengalish: '6. Import Students (Chatro-Chatri Nam Tulun)',
      hinglish: '6. Import Students (Baccho ke Naam Chadhayein)',
    },
    subtitle: {
      english: 'Upload one Excel sheet to add 500 to 5,000 students in 2 seconds',
      bengalish: 'Excel file upload kore 2 second-e 500 theke 5,000 student-er nam tulun',
      hinglish: 'Excel file upload karke 2 second me 500 se 5,000 students ke naam chadhayein',
    },
    icon: <FileSpreadsheet className="w-6 h-6 text-forest-700 dark:text-forest-400" />,
    details: {
      english: [
        'Upload your existing class list in Excel or CSV format',
        'Roll numbers and class sections auto-organized automatically',
        'Download ready-to-print ID cards with QR codes in 1 click',
      ],
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
    },
    deliverable: {
      english: 'Verified Student Directory & Printable Cards',
      bengalish: 'Verified Active Student List o Print Cards',
      hinglish: 'Verified Student List aur Print Ready Cards',
    },
  },
  {
    step: 7,
    key: 'train_staff',
    title: {
      english: '7. Train Staff (5-Minute Teacher Training)',
      bengalish: '7. Train Staff (5-Minute-e Shikhun)',
      hinglish: '7. Train Staff (5-Minute me Seekhein)',
    },
    subtitle: {
      english: 'Simple 5-minute phone tutorial for teachers of any age or tech background',
      bengalish: 'Mastermashay-der 5 minute-er sahaj mobile training',
      hinglish: 'Teachers ke liye 5 minute ki aasan mobile training',
    },
    icon: <Users className="w-6 h-6 text-forest-700 dark:text-forest-400" />,
    details: {
      english: [
        'Teachers open the app on their phone and point at student cards',
        'Take roll call for 40 students in less than 90 seconds',
        'Absent student list automatically appears on Headmaster dashboard',
      ],
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
    },
    deliverable: {
      english: 'Teacher Quick-Start Guide Pocket Cards',
      bengalish: 'Mastermashay Quick-Start Guide Cards',
      hinglish: 'Teacher Quick-Start Guide Cards',
    },
  },
  {
    step: 8,
    key: 'go_live',
    title: {
      english: '8. Go Live (Morning Rollout)',
      bengalish: '8. Go Live (Shokal bela Rollout)',
      hinglish: '8. Go Live (Subah ki Attendance Shuru)',
    },
    subtitle: {
      english: 'Start every morning fast and stress-free right after morning prayer',
      bengalish: 'Shokal-er prarthonar por shob class-e jhorer gotite hajira shuru',
      hinglish: 'Subah prayer ke baad sabhi classes me fatafat attendance shuru',
    },
    icon: <Award className="w-6 h-6 text-forest-700 dark:text-forest-400" />,
    details: {
      english: [
        'Students tap their card at the gate or teacher scans inside classroom',
        'Parents instantly get SMS confirming their child reached safely',
        'Headmaster sees live school attendance percentage on their screen',
      ],
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
    },
    deliverable: {
      english: '100% Running Attendance System',
      bengalish: '100% Shokol School Attendance System',
      hinglish: '100% Successful School Attendance System',
    },
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
  // English is now default as requested by user
  const [lang, setLang] = useState<LanguageMode>('english');
  const [selectedStageIndex, setSelectedStageIndex] = useState(0);
  const [studentCount, setStudentCount] = useState<number>(750);
  const [selectedSchoolIndex, setSelectedSchoolIndex] = useState(0);

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
        latencyMs: simMode === 'qr' ? 12 : 8,
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
  const activeSchool = PREVIEW_SCHOOLS[selectedSchoolIndex];

  // Calculated ROI Metrics
  const teacherHoursSavedPerYear = Math.round((studentCount * 0.08 * 220) / 60);
  const paperSavedPages = studentCount * 12 * 4;

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col selection:bg-forest-700 selection:text-white hero-mesh-light">
      {/* Top Floating Navigation */}
      <header className="sticky top-0 z-50 px-4 sm:px-10 py-3.5 flex items-center justify-between backdrop-blur-2xl bg-surface/85 border-b border-line/80 transition-all shadow-xs">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-forest-700 dark:bg-forest-600 flex items-center justify-center text-white shadow-lg shadow-forest-700/25 group-hover:scale-105 transition-transform">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
                <path d="M12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4z" />
              </svg>
            </div>
            <div>
              <span className="text-2xl font-extrabold text-ink font-display tracking-tight group-hover:text-forest-700 dark:group-hover:text-forest-400 transition-colors">
                AttendEase
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-bold text-forest-700 dark:text-forest-400 bg-forest-50 dark:bg-forest-900/40 px-2.5 py-0.5 rounded-full border border-forest-200 dark:border-forest-800/40 font-mono">
                Smart School OS
              </span>
            </div>
          </Link>
        </div>

        {/* Language Switcher Pill */}
        <div className="flex items-center p-1 rounded-full bg-surface-soft border border-line shadow-2xs">
          <button
            type="button"
            onClick={() => setLang('english')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold font-display transition-all cursor-pointer ${
              lang === 'english'
                ? 'bg-forest-700 text-white shadow-xs'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLang('bengalish')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold font-display transition-all cursor-pointer ${
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
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold font-display transition-all cursor-pointer ${
              lang === 'hinglish'
                ? 'bg-forest-700 text-white shadow-xs'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            Hinglish
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="md"
            onClick={() => setDemoModalOpen(true)}
            className="hidden sm:inline-flex shadow-xs hover:border-forest-600 font-display font-bold px-5"
          >
            Request Demo
          </Button>

          <Link to="/login">
            <Button
              variant="primary"
              size="md"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="shadow-lg shadow-forest-700/20 font-display font-bold px-5"
            >
              School Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Massive Hero Section */}
      <section className="relative pt-16 sm:pt-28 pb-20 px-4 sm:px-10 max-w-7xl mx-auto text-center space-y-10 overflow-hidden">
        {/* Floating Animated Badges on Left and Right (Desktop) */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="hidden xl:flex absolute left-4 top-28 items-center gap-3 p-3.5 rounded-2xl bg-surface/95 border border-line shadow-lg backdrop-blur-md text-left max-w-[240px] z-10"
        >
          <div className="w-9 h-9 rounded-xl bg-success-50 text-success-600 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-extrabold text-ink font-display">1-Second Roll Call</div>
            <div className="text-[11px] text-ink-soft">Scan with any simple phone</div>
          </div>
        </motion.div>

        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="hidden xl:flex absolute right-4 top-36 items-center gap-3 p-3.5 rounded-2xl bg-surface/95 border border-line shadow-lg backdrop-blur-md text-left max-w-[240px] z-10"
        >
          <div className="w-9 h-9 rounded-xl bg-forest-50 dark:bg-forest-900/30 text-forest-700 dark:text-forest-400 flex items-center justify-center shrink-0">
            <WifiOff className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-extrabold text-ink font-display">100% Zero Internet</div>
            <div className="text-[11px] text-ink-soft">Power cut? Zero problem</div>
          </div>
        </motion.div>

        {/* Top Government Capsule Badge */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-surface border border-line shadow-xs glowing-badge"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-extrabold text-forest-800 dark:text-forest-300 tracking-wider uppercase font-display">
            Govt. of India • UDISE+ Standard Compliant
          </span>
          <span className="hidden sm:inline-block text-ink-muted text-xs">•</span>
          <span className="hidden sm:inline-block text-xs font-bold text-ink-soft">
            Zero Paper Attendance
          </span>
        </motion.div>

        {/* Grand Headline (Clear, Non-Technical Plain English) */}
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-6xl lg:text-7xl xl:text-8xl font-extrabold text-ink font-display tracking-tight leading-[1.05] max-w-6xl mx-auto"
        >
          Attendance infrastructure <br />
          <span className="bg-gradient-to-r from-forest-700 via-forest-600 to-emerald-600 dark:from-forest-400 dark:via-emerald-400 dark:to-teal-300 bg-clip-text text-transparent">
            built for zero-connectivity classrooms.
          </span>
        </motion.h1>

        {/* Clear, Warm Subtitle for Non-Technical Teachers */}
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg sm:text-2xl text-ink-soft max-w-4xl mx-auto font-normal leading-relaxed"
        >
          Say goodbye to manual paper attendance registers. Teachers scan student cards in <strong>1 second</strong> using any mobile phone. Works 100% without internet and automatically sends SMS arrival alerts to parents.
        </motion.p>

        {/* Big Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-5 pt-4"
        >
          <Button
            variant="primary"
            size="lg"
            onClick={() => setDemoModalOpen(true)}
            rightIcon={<Sparkles className="w-5 h-5" />}
            className="shadow-2xl shadow-forest-700/30 px-10 py-4 text-lg font-bold font-display cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-all"
          >
            Request Free School Demo
          </Button>

          <Link to="/login">
            <Button
              variant="secondary"
              size="lg"
              className="px-10 py-4 text-lg font-bold font-display cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-all"
            >
              School Sign In
            </Button>
          </Link>
        </motion.div>

        {/* 4 Huge Core Stat Highlights */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-5 pt-10 text-left"
        >
          <div className="p-7 rounded-[32px] bg-surface/95 border border-line shadow-xs hover:border-forest-600/50 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-ink-muted uppercase font-display tracking-wider">
                Lightning Speed
              </span>
              <Clock className="w-5 h-5 text-forest-700 dark:text-forest-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-ink font-display mt-3">
              &lt; 90 Sec
            </div>
            <p className="text-sm text-ink-soft mt-2 font-medium">
              Complete roll call for 40 students
            </p>
          </div>

          <div className="p-7 rounded-[32px] bg-surface/95 border border-line shadow-xs hover:border-forest-600/50 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-ink-muted uppercase font-display tracking-wider">
                Zero Internet Needed
              </span>
              <WifiOff className="w-5 h-5 text-forest-700 dark:text-forest-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-forest-700 dark:text-forest-400 font-display mt-3">
              100% Offline
            </div>
            <p className="text-sm text-ink-soft mt-2 font-medium">
              Never drops a single attendance record
            </p>
          </div>

          <div className="p-7 rounded-[32px] bg-surface/95 border border-line shadow-xs hover:border-forest-600/50 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-ink-muted uppercase font-display tracking-wider">
                Parent Peace of Mind
              </span>
              <MessageSquareText className="w-5 h-5 text-forest-700 dark:text-forest-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-ink font-display mt-3">
              Auto SMS
            </div>
            <p className="text-sm text-ink-soft mt-2 font-medium">
              Instant arrival alert to parents' phones
            </p>
          </div>

          <div className="p-7 rounded-[32px] bg-surface/95 border border-line shadow-xs hover:border-forest-600/50 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-ink-muted uppercase font-display tracking-wider">
                Government Ready
              </span>
              <FileSpreadsheet className="w-5 h-5 text-forest-700 dark:text-forest-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-ink font-display mt-3">
              UDISE+ Ready
            </div>
            <p className="text-sm text-ink-soft mt-2 font-medium">
              1-Click download official Excel registers
            </p>
          </div>
        </motion.div>
      </section>

      {/* Massive Interactive Live Hardware & QR Simulator */}
      <section id="simulator" className="py-20 px-4 sm:px-10 max-w-7xl mx-auto w-full space-y-10">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <Badge variant="forest" size="md">
            Interactive Test Drive
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-ink font-display tracking-tight">
            See How Simple Morning Attendance Is
          </h2>
          <p className="text-base sm:text-lg text-ink-soft">
            Click below to simulate an instant morning roll call under complete power or network blackout conditions.
          </p>
        </div>

        {/* Big Simulator Console Container */}
        <div className="rounded-[36px] bg-surface border border-line shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Controls Side */}
          <div className="lg:col-span-5 p-8 sm:p-10 bg-surface-soft border-b lg:border-b-0 lg:border-r border-line space-y-7 text-left">
            <div>
              <span className="text-xs font-extrabold text-forest-700 dark:text-forest-400 uppercase tracking-wider font-display">
                Choose Scanning Method
              </span>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => { setSimMode('qr'); setSimSuccess(false); }}
                  className={`p-4 rounded-2xl text-sm font-bold font-display flex items-center justify-center gap-2.5 border transition-all cursor-pointer ${
                    simMode === 'qr'
                      ? 'bg-forest-700 text-white border-forest-800 shadow-md shadow-forest-700/25'
                      : 'bg-surface text-ink-soft border-line hover:border-forest-600/40'
                  }`}
                >
                  <ScanLine className="w-5 h-5" />
                  <span>Mobile Camera QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setSimMode('rfid'); setSimSuccess(false); }}
                  className={`p-4 rounded-2xl text-sm font-bold font-display flex items-center justify-center gap-2.5 border transition-all cursor-pointer ${
                    simMode === 'rfid'
                      ? 'bg-forest-700 text-white border-forest-800 shadow-md shadow-forest-700/25'
                      : 'bg-surface text-ink-soft border-line hover:border-forest-600/40'
                  }`}
                >
                  <Radio className="w-5 h-5" />
                  <span>Student Card Tap</span>
                </button>
              </div>
            </div>

            {/* Offline Power & Network Switch */}
            <div className="p-5 rounded-2xl bg-surface border border-line space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {simOffline ? (
                    <WifiOff className="w-5 h-5 text-forest-700 dark:text-forest-400" />
                  ) : (
                    <Wifi className="w-5 h-5 text-success-600" />
                  )}
                  <span className="text-sm font-bold text-ink font-display">
                    {simOffline ? '🔴 Internet Cut Off (100% Offline)' : '🟢 Internet Connected'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSimOffline(!simOffline)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-bold font-mono bg-surface-soft hover:bg-line border border-line text-ink cursor-pointer transition-colors"
                >
                  {simOffline ? 'Restore Network' : 'Cut Internet'}
                </button>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                {simOffline
                  ? 'All student cards verify instantly inside phone memory. Nothing gets lost even if network is completely dead.'
                  : 'Attendance automatically streams to Headmaster reports in real time.'}
              </p>
            </div>

            {/* Big Trigger Button */}
            <div>
              <Button
                variant="primary"
                size="lg"
                onClick={handleSimulateScan}
                isLoading={simScanning}
                className="w-full font-display font-bold py-4 text-base shadow-xl shadow-forest-700/25"
                rightIcon={<Zap className="w-5 h-5" />}
              >
                {simScanning
                  ? 'Verifying Student Card...'
                  : simMode === 'qr'
                  ? 'Scan Student QR Card'
                  : 'Tap Student Card at Gate'}
              </Button>
            </div>
          </div>

          {/* Interactive Screen Preview */}
          <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-between bg-surface text-left relative overflow-hidden">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div className="flex items-center gap-2.5 font-mono text-xs text-ink-soft">
                  <span className="w-2.5 h-2.5 rounded-full bg-forest-600 animate-pulse" />
                  <span className="font-bold">CLASSROOM: CLASS 8-A MORNING ROLL CALL</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-forest-700 dark:text-forest-400 bg-forest-50 dark:bg-forest-900/40 px-3 py-1 rounded-full font-mono">
                    1-Second Verified
                  </span>
                </div>
              </div>

              {/* Live Card Screen */}
              <div className="relative h-64 rounded-2xl bg-canvas border border-line p-6 font-mono text-xs flex flex-col justify-between overflow-hidden">
                {simScanning && (
                  <div className="absolute inset-x-0 h-1.5 bg-forest-500 shadow-[0_0_20px_#227b5a] animate-laser-sweep z-10" />
                )}

                <div className="space-y-3">
                  <div className="text-ink-muted">
                    &gt; Scanner Ready: {simMode === 'qr' ? 'Mobile Camera Active' : 'NFC Gate Turnstile Active'}
                  </div>
                  <div className="text-ink-muted">
                    &gt; Network State: {simOffline ? 'Offline (Safe Local Memory)' : 'Online Connected'}
                  </div>

                  {simSuccess && simEvent && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 rounded-2xl bg-success-50 dark:bg-success-900/25 border border-success-200 dark:border-success-800/40 space-y-2 mt-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between text-success-800 dark:text-success-300 font-bold">
                        <span className="flex items-center gap-2 text-base font-display">
                          <CheckCircle2 className="w-5 h-5 text-success-600 shrink-0" />
                          ATTENDANCE CONFIRMED: {simEvent.name}
                        </span>
                        <span className="text-xs font-mono">{simEvent.time}</span>
                      </div>
                      <div className="text-xs text-ink-soft flex items-center justify-between">
                        <span>{simEvent.class} • {simEvent.roll}</span>
                        <span className="text-forest-700 dark:text-forest-400 font-bold">{simEvent.latencyMs}ms Instant Verification</span>
                      </div>
                      <div className="text-xs text-ink-soft bg-surface/90 p-2.5 rounded-xl border border-success-200/60 mt-1">
                        📩 <strong>SMS Sent to Parents:</strong> "Ananya Roy safely reached school at {simEvent.time}."
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="flex items-center justify-between text-ink-muted pt-3 border-t border-line text-xs font-sans">
                  <span>Zero paper registers needed</span>
                  <span className="font-mono font-bold text-forest-700 dark:text-forest-400">
                    {simOffline ? '100% OFFLINE SAFE' : 'CLOUD SYNCED'}
                  </span>
                </div>
              </div>
            </div>

            {/* Proof Metrics Bar */}
            <div className="grid grid-cols-3 gap-4 pt-4 text-center">
              <div className="p-3 rounded-2xl bg-surface-soft border border-line">
                <span className="text-[11px] uppercase font-extrabold text-ink-muted font-display block">
                  Speed
                </span>
                <span className="text-sm font-extrabold text-forest-700 dark:text-forest-400 font-display mt-0.5 block">
                  1 Second / Child
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-surface-soft border border-line">
                <span className="text-[11px] uppercase font-extrabold text-ink-muted font-display block">
                  Accuracy
                </span>
                <span className="text-sm font-extrabold text-ink font-display mt-0.5 block">
                  100% Error-Free
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-surface-soft border border-line">
                <span className="text-[11px] uppercase font-extrabold text-ink-muted font-display block">
                  Parent SMS
                </span>
                <span className="text-sm font-extrabold text-forest-700 dark:text-forest-400 font-display mt-0.5 block">
                  Instant Automatic
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Teachers & Headmasters Love AttendEase */}
      <section className="py-20 px-4 sm:px-10 bg-surface-soft/70 border-y border-line">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <Badge variant="forest" size="md">
              Built for Teachers
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-ink font-display tracking-tight">
              Designed for Real Classrooms, Not Just Tech Demos
            </h2>
            <p className="text-base sm:text-lg text-ink-soft">
              Every feature was tested with school teachers and headmasters across rural and urban schools.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-7 text-left">
            <div className="p-8 rounded-[32px] bg-surface border border-line shadow-xs space-y-4 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-forest-50 dark:bg-forest-900/30 text-forest-700 dark:text-forest-400 flex items-center justify-center">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-ink font-display">Runs on Any Mobile Phone</h3>
              <p className="text-sm text-ink-soft leading-relaxed font-normal">
                Teachers do not need expensive computer labs or fingerprint devices. Simply open the app on any Android phone and scan.
              </p>
            </div>

            <div className="p-8 rounded-[32px] bg-surface border border-line shadow-xs space-y-4 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-forest-50 dark:bg-forest-900/30 text-forest-700 dark:text-forest-400 flex items-center justify-center">
                <WifiOff className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-ink font-display">No Internet? Zero Worries</h3>
              <p className="text-sm text-ink-soft leading-relaxed font-normal">
                Schools in remote villages with frequent power cuts and poor mobile signal can record full morning attendance without interruption.
              </p>
            </div>

            <div className="p-8 rounded-[32px] bg-surface border border-line shadow-xs space-y-4 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-forest-50 dark:bg-forest-900/30 text-forest-700 dark:text-forest-400 flex items-center justify-center">
                <FileCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-ink font-display">1-Click UDISE+ Government Reports</h3>
              <p className="text-sm text-ink-soft leading-relaxed font-normal">
                At the end of the month, Headmasters download pre-formatted Excel sheets ready for direct government submission.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8-Step Simple School Onboarding Journey */}
      <section id="journey" className="py-20 px-4 sm:px-10 max-w-7xl mx-auto space-y-10">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <Badge variant="forest" size="md">
            Simple 8-Step Setup
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-ink font-display tracking-tight">
            From Discovery to Morning Rollout
          </h2>
          <p className="text-base sm:text-lg text-ink-soft">
            A battle-tested step-by-step roadmap to bring smart attendance to your school in less than a week.
          </p>
        </div>

        {/* Stepper Navigation */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-4 no-scrollbar">
          {ONBOARDING_STAGES.map((stage, idx) => {
            const isSelected = idx === selectedStageIndex;
            return (
              <button
                key={stage.key}
                type="button"
                onClick={() => setSelectedStageIndex(idx)}
                className={`flex items-center gap-2.5 px-5 py-3.5 rounded-2xl text-xs sm:text-sm font-bold font-display whitespace-nowrap transition-all border shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-forest-700 text-white border-forest-800 shadow-md shadow-forest-700/25'
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
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="p-8 sm:p-12 rounded-[36px] bg-surface border border-line shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-center text-left"
        >
          <div className="lg:col-span-7 space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-forest-50 dark:bg-forest-900/30 border border-forest-200 dark:border-forest-800/40 flex items-center justify-center shrink-0">
                {selectedStage.icon}
              </div>
              <div>
                <span className="text-xs font-mono font-extrabold text-forest-700 dark:text-forest-400">
                  STEP 0{selectedStage.step} OF 08
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-ink font-display leading-tight">
                  {selectedStage.title[lang]}
                </h3>
              </div>
            </div>

            <p className="text-base sm:text-lg text-ink-soft leading-relaxed font-normal">
              {selectedStage.subtitle[lang]}
            </p>

            <div className="space-y-3 pt-2">
              <span className="text-xs font-extrabold text-ink-muted uppercase tracking-wider font-display">
                What Happens in This Step:
              </span>
              <ul className="space-y-2.5">
                {selectedStage.details[lang].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm sm:text-base text-ink">
                    <CheckCircle2 className="w-5 h-5 text-success-600 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-5 p-7 rounded-3xl bg-surface-soft border border-line space-y-5">
            <span className="text-xs font-extrabold text-forest-700 dark:text-forest-400 uppercase tracking-wider font-display">
              Step Deliverable
            </span>

            <div className="text-xl font-bold text-ink font-display">
              {selectedStage.deliverable[lang]}
            </div>

            <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
              Every step is structured so Headmasters and teachers experience zero confusion or administrative burdens.
            </p>

            <div className="pt-2">
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  if (selectedStageIndex < ONBOARDING_STAGES.length - 1) {
                    setSelectedStageIndex(selectedStageIndex + 1);
                  } else {
                    setDemoModalOpen(true);
                  }
                }}
                rightIcon={<ChevronRight className="w-5 h-5" />}
                className="w-full font-display font-bold py-3.5"
              >
                {selectedStageIndex < ONBOARDING_STAGES.length - 1
                  ? `Next Step: ${ONBOARDING_STAGES[selectedStageIndex + 1].title[lang]}`
                  : 'Request Free School Demo'}
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Impact & ROI Calculator */}
      <section id="roi" className="py-20 px-4 sm:px-10 max-w-7xl mx-auto space-y-10">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <Badge variant="forest" size="md">
            Time & Money Savings
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-ink font-display tracking-tight">
            Calculate Your School's Time & Cost Savings
          </h2>
          <p className="text-base sm:text-lg text-ink-soft">
            See how much time teachers reclaim when replacing manual roll calls with AttendEase.
          </p>
        </div>

        <div className="p-8 sm:p-12 rounded-[36px] bg-surface border border-line shadow-xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-center text-left">
          <div className="lg:col-span-6 space-y-7">
            <div>
              <label htmlFor="student-slider" className="block text-base font-bold text-ink font-display mb-3">
                Total Enrolled Students:{' '}
                <span className="text-forest-700 dark:text-forest-400 font-mono text-2xl font-extrabold">
                  {studentCount} Students
                </span>
              </label>
              <input
                id="student-slider"
                type="range"
                min="100"
                max="3000"
                step="50"
                value={studentCount}
                onChange={(e) => setStudentCount(Number(e.target.value))}
                className="w-full h-3 bg-surface-soft rounded-lg appearance-none cursor-pointer accent-forest-700"
              />
              <div className="flex justify-between text-xs text-ink-muted mt-2 font-mono">
                <span>100 Students</span>
                <span>1,500</span>
                <span>3,000 Students</span>
              </div>
            </div>

            <div className="space-y-3.5 text-sm sm:text-base text-ink-soft">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-forest-700 shrink-0" />
                <span>Reclaims 15 minutes of teacher time per classroom every morning</span>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-forest-700 shrink-0" />
                <span>Eliminates missing attendance sheets, torn registers, and proxy attendance</span>
              </div>
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-forest-700 shrink-0" />
                <span>Sends automatic arrival SMS alerts to parents the moment their child enters</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 grid grid-cols-2 gap-5">
            <div className="p-6 rounded-3xl bg-surface-soft border border-line text-left">
              <div className="text-xs font-extrabold text-ink-muted uppercase font-display tracking-wider">
                Teacher Time Saved
              </div>
              <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-forest-700 dark:text-forest-400 font-display mt-2">
                {teacherHoursSavedPerYear} Hrs
              </div>
              <p className="text-xs text-ink-soft mt-1.5">Reclaimed for classroom teaching every year</p>
            </div>

            <div className="p-6 rounded-3xl bg-surface-soft border border-line text-left">
              <div className="text-xs font-extrabold text-ink-muted uppercase font-display tracking-wider">
                Register Paper Saved
              </div>
              <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-ink font-display mt-2">
                {paperSavedPages.toLocaleString()} Pages
              </div>
              <p className="text-xs text-ink-soft mt-1.5">Zero paper registers to buy or store</p>
            </div>

            <div className="p-6 rounded-3xl bg-surface-soft border border-line text-left col-span-2">
              <div className="text-xs font-extrabold text-ink-muted uppercase font-display tracking-wider">
                UDISE+ Government Ready
              </div>
              <div className="text-xl font-bold text-ink font-display mt-1 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success-600 shrink-0" />
                <span>1-Click Instant State Format Export (CSV & Excel)</span>
              </div>
              <p className="text-xs text-ink-soft mt-1.5">
                No manual counting or late-night register calculations for administrative staff.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Massive Call to Action Section */}
      <section className="py-24 px-4 sm:px-10 bg-forest-900 text-white mt-auto text-center space-y-8 relative overflow-hidden">
        <div className="max-w-4xl mx-auto space-y-5">
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold font-display leading-tight">
            Ready to bring smart attendance to your school?
          </h2>
          <p className="text-emerald-200/90 text-base sm:text-xl max-w-2xl mx-auto leading-relaxed">
            Schedule a free, zero-commitment live demonstration for your school management and teachers today.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-5 pt-3">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setDemoModalOpen(true)}
            className="px-10 py-4 text-lg font-bold font-display cursor-pointer shadow-2xl shadow-black/25 hover:scale-105 transition-all"
          >
            Request School Demo
          </Button>

          <Link to="/login">
            <Button
              variant="ghost"
              size="lg"
              className="text-white hover:bg-forest-800 border border-emerald-500/30 px-10 py-4 text-lg font-bold font-display"
            >
              School Sign In
            </Button>
          </Link>
        </div>
      </section>

      {/* Modern High-Stature Footer */}
      <footer className="py-10 px-4 sm:px-10 bg-surface border-t border-line text-xs text-ink-muted flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-3 font-medium">
          <span className="font-extrabold text-ink font-display text-sm">AttendEase</span>
          <span>•</span>
          <span>Govt. of India UDISE+ Standard</span>
          <span>•</span>
          <span>100% Zero-Net Offline Attendance</span>
        </div>

        <div className="flex items-center gap-6 font-semibold">
          <Link to="/login" className="hover:text-ink transition-colors">
            Teacher Login
          </Link>
          <Link to="/login" className="hover:text-ink transition-colors">
            Headmaster Console
          </Link>
          <Link to="/login" className="hover:text-ink transition-colors">
            School Sign In
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
        title="Schedule a Free School Demo"
        description="Connect with our education team for a live demonstration"
      >
        {demoSubmitted ? (
          <div data-testid="demo-success-state" className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-success-50 text-success-600 border border-success-100 dark:border-success-600/30 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-bold text-ink font-display">Demo Request Received</h4>
            <p className="text-sm text-ink-soft max-w-sm mx-auto leading-relaxed">
              Thank you, <span className="font-bold text-ink">{demoForm.name || 'Administrator'}</span>. Our team will contact you at <span className="font-mono font-bold text-ink">{demoForm.phone || '+91-XXXXXXXXXX'}</span> within 4 business hours.
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
