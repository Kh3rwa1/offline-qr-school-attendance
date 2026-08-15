import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { useSession } from './SessionProvider';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  Wifi,
  Radio,
  ArrowRight,
  CheckCircle2,
  ScanLine,
  HelpCircle,
  Lock,
  PhoneCall,
  FileText,
  Languages,
  Sparkles,
  School as SchoolIcon,
} from 'lucide-react';
import { getDefaultRouteForRole } from '../auth/permissions';
import { Button, TextField, PasswordField, Dialog, Badge, Toast } from '../components/ui';

interface TickerItem {
  id: string;
  student: string;
  classSection: string;
  roll: number;
  time: string;
  method: 'QR' | 'DESFire' | 'Sync';
}

const mockTickerData: TickerItem[] = [
  { id: '1', student: 'Rahul Banerjee', classSection: 'VIII-A', roll: 14, time: '08:32 AM', method: 'QR' },
  { id: '2', student: 'Priya Mukherjee', classSection: 'X-B', roll: 3, time: '08:31 AM', method: 'DESFire' },
  { id: '3', student: 'Amit Das', classSection: 'IX-A', roll: 27, time: '08:30 AM', method: 'QR' },
  { id: '4', student: 'Ananya Roy', classSection: 'VII-B', roll: 9, time: '08:29 AM', method: 'Sync' },
];

export const LoginPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { schoolSlug } = useParams<{ schoolSlug?: string }>();
  const { login } = useSession();

  // Explicit demo mode check (VITE_DEMO_MODE=true or ?demo=true query param)
  const isDemoMode = useMemo(() => {
    return (
      (import.meta as any).env?.VITE_DEMO_MODE === 'true' ||
      new URLSearchParams(location.search).get('demo') === 'true'
    );
  }, [location.search]);

  const [phoneNumber, setPhoneNumber] = useState(() => {
    const saved = localStorage.getItem('attendease.remembered_phone');
    if (saved) return saved;
    return isDemoMode ? '+919000000000' : '';
  });
  const [password, setPassword] = useState(() => (isDemoMode ? 'SuperSecretAdminPassword123!' : ''));
  const [rememberMe, setRememberMe] = useState(() => Boolean(localStorage.getItem('attendease.remembered_phone')));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tickerIndex, setTickerIndex] = useState(0);

  // Dialog States
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [accountHelpOpen, setAccountHelpOpen] = useState(false);
  const [adminContactOpen, setAdminContactOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'bn' | 'hi'>('en');

  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % mockTickerData.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  const handleQuickSelect = (phone: string, pass: string) => {
    setPhoneNumber(phone);
    setPassword(pass);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (rememberMe) {
        localStorage.setItem('attendease.remembered_phone', phoneNumber);
      } else {
        localStorage.removeItem('attendease.remembered_phone');
      }

      const role = await login(phoneNumber, password);
      const from = (location.state as any)?.from?.pathname;
      const target = from && from !== '/login' ? from : getDefaultRouteForRole(role);
      navigate(target, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid mobile number or password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Human-friendly contextual greetings
  const schoolDisplayName = schoolSlug
    ? schoolSlug.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') + ' School'
    : null;

  return (
    <main className="min-h-screen bg-canvas flex flex-col justify-between items-center p-4 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* Top Bar for Landing Link & Language Selector */}
      <header className="w-full max-w-6xl flex items-center justify-between z-10 mb-4 sm:mb-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-ink hover:text-forest-700 transition-colors font-display font-bold text-base"
        >
          <div className="w-9 h-9 rounded-xl bg-forest-700 flex items-center justify-center text-white shadow-md shadow-forest-700/20">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
              <path d="M12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4z" />
            </svg>
          </div>
          <span>AttendEase</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="relative inline-flex items-center">
            <Languages className="w-4 h-4 text-ink-muted absolute left-3 pointer-events-none" />
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value as any)}
              aria-label="Select Language"
              className="pl-9 pr-8 py-1.5 rounded-full bg-surface border border-line text-xs font-semibold text-ink shadow-2xs outline-none cursor-pointer hover:bg-surface-soft transition-all"
            >
              <option value="en">English</option>
              <option value="bn">বাংলা (Bengali)</option>
              <option value="hi">हिन्दी (Hindi)</option>
            </select>
          </div>

          <Link to="/">
            <Button variant="ghost" size="sm">
              Product Tour
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10 flex-1 my-auto">
        {/* Left Column: School / Platform Value Hero */}
        <motion.div
          initial={{ opacity: 0, x: -25 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
          className="lg:col-span-7 space-y-6 text-left"
        >
          {/* Brand & Standard Badge */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="forest" size="md" dot pulse>
              Govt. of India • UDISE+ Standard
            </Badge>
            {schoolDisplayName && (
              <Badge variant="neutral" size="md" icon={<SchoolIcon className="w-3.5 h-3.5" />}>
                {schoolDisplayName}
              </Badge>
            )}
          </div>

          {/* Clean, Non-Technical Typography */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-ink font-display leading-[1.12]">
              {schoolDisplayName ? (
                <>
                  Welcome to <br />
                  <span className="text-forest-700 dark:text-forest-500">{schoolDisplayName}</span>
                </>
              ) : (
                <>
                  Daily attendance <br />
                  <span className="text-forest-700 dark:text-forest-500">infrastructure for schools.</span>
                </>
              )}
            </h1>
            <p className="text-sm sm:text-base text-ink-soft font-normal leading-relaxed max-w-xl">
              Sign in to manage today’s school attendance. Offline QR verification and smartcards with automatic ledger synchronization.
            </p>
          </div>

          {/* Live Attendance Ticker */}
          <div className="p-5 rounded-[28px] bg-surface border border-line shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-ink-soft font-display uppercase tracking-wider">
                <ScanLine className="w-4 h-4 text-forest-700 dark:text-forest-500" />
                <span>Live Verification Stream</span>
              </div>
              <Badge variant="success" size="sm" dot pulse>
                Active School Ledger
              </Badge>
            </div>

            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {mockTickerData.map((item, idx) => {
                  const isCurrent = idx === tickerIndex;
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0.4 }}
                      animate={{
                        opacity: isCurrent ? 1 : 0.45,
                        scale: isCurrent ? 1.01 : 1,
                        backgroundColor: isCurrent ? 'var(--surface-soft)' : 'transparent',
                      }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center justify-between p-2.5 rounded-2xl text-xs sm:text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${isCurrent ? 'bg-forest-600' : 'bg-ink-muted'}`} />
                        <span className="font-bold text-ink">{item.student}</span>
                        <span className="text-ink-soft font-mono text-xs">Class {item.classSection}</span>
                        <span className="text-ink-muted font-mono text-xs">Roll #{item.roll}</span>
                      </div>
                      <div className="flex items-center gap-2.5 font-mono text-xs text-ink-soft">
                        <span className="px-2.5 py-0.5 rounded-full bg-surface border border-line text-xs font-semibold">
                          {item.method}
                        </span>
                        <span>{item.time}</span>
                        <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Feature Highlight Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
            <div className="p-4 rounded-2xl bg-surface border border-line shadow-2xs text-left">
              <div className="flex items-center gap-2 text-forest-700 dark:text-forest-500 mb-1 font-bold">
                <Wifi className="w-4 h-4" />
                <span className="text-sm font-display">Offline First</span>
              </div>
              <p className="text-xs text-ink-soft leading-normal">Zero-latency classroom scanning</p>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-line shadow-2xs text-left">
              <div className="flex items-center gap-2 text-forest-700 dark:text-forest-500 mb-1 font-bold">
                <Radio className="w-4 h-4" />
                <span className="text-sm font-display">DESFire EV3</span>
              </div>
              <p className="text-xs text-ink-soft leading-normal">Tamper-proof smartcards</p>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-line shadow-2xs text-left">
              <div className="flex items-center gap-2 text-forest-700 dark:text-forest-500 mb-1 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-sm font-display">Data Privacy</span>
              </div>
              <p className="text-xs text-ink-soft leading-normal">Encrypted tenant isolation</p>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Clean, Accessible Sign-In Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="lg:col-span-5 bg-surface p-7 sm:p-9 rounded-[32px] border border-line shadow-xl text-left"
        >
          <div className="space-y-1.5 mb-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink font-display">
              Sign In
            </h2>
            <p className="text-sm text-ink-soft">
              Enter your registered mobile number and password
            </p>
          </div>

          {error && (
            <div className="mb-5">
              <Toast kind="error" message={error} onDismiss={() => setError(null)} autoDismiss={false} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              label="Mobile Number"
              type="tel"
              id="login-phone"
              required
              prefixText="+91"
              autoComplete="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="90000 00000"
              helperText="Authorized teacher, staff, or administrator number"
            />

            <PasswordField
              label="Password"
              id="login-password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
            />

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-ink-soft cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-line text-forest-700 focus:ring-forest-600 cursor-pointer w-4 h-4"
                />
                <span>Remember mobile number</span>
              </label>

              <button
                type="button"
                onClick={() => setForgotPasswordOpen(true)}
                className="text-xs font-bold text-forest-700 dark:text-forest-400 hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>

            <div className="pt-3">
              <Button
                variant="primary"
                size="lg"
                type="submit"
                isLoading={isSubmitting}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="w-full text-base font-bold shadow-lg shadow-forest-700/20"
                aria-label="Sign In to AttendEase"
              >
                Sign In to Workspace
              </Button>
            </div>
          </form>

          {/* Quick Help & Recovery Links */}
          <div className="mt-6 pt-5 border-t border-line flex items-center justify-between text-xs text-ink-muted">
            <button
              type="button"
              onClick={() => setAccountHelpOpen(true)}
              className="hover:text-ink flex items-center gap-1 font-semibold cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Need help?</span>
            </button>
            <button
              type="button"
              onClick={() => setAdminContactOpen(true)}
              className="hover:text-ink flex items-center gap-1 font-semibold cursor-pointer"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Contact Admin</span>
            </button>
          </div>

          {/* Demo Mode Quick Selectors (Gated by VITE_DEMO_MODE=true) */}
          {isDemoMode && (
            <div className="mt-6 pt-5 border-t border-line space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink-muted font-display uppercase tracking-wider">
                  Demo Environment Credentials
                </span>
                <Badge variant="forest" size="sm">
                  1-Click Select
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { role: 'Super Admin', phone: '+919000000000', pass: 'SuperSecretAdminPassword123!' },
                  { role: 'Headmaster', phone: '+919100000001', pass: 'SchoolAdminPassword123!' },
                  { role: 'Teacher', phone: '+919100000002', pass: 'TeacherPassword123!' },
                  { role: 'RFID Operator', phone: '+919100000003', pass: 'RfidOpPassword123!' },
                  { role: 'District Viewer', phone: '+919100000004', pass: 'ReportViewerPassword123!' },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickSelect(item.phone, item.pass)}
                    className="p-2.5 rounded-2xl bg-surface-soft hover:bg-forest-700 hover:text-white text-ink-soft border border-line text-left transition-all text-xs font-medium font-display group cursor-pointer"
                  >
                    <span className="font-bold block text-ink group-hover:text-white text-xs">
                      {item.role}
                    </span>
                    <span className="text-xs text-ink-muted group-hover:text-emerald-200 font-mono">
                      {item.phone}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Legal & Privacy Footer */}
      <footer className="mt-8 pt-4 text-center text-xs text-ink-muted font-normal relative z-10 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
        <span>© 2026 AttendEase OS</span>
        <span>•</span>
        <button
          type="button"
          onClick={() => setPrivacyOpen(true)}
          className="hover:text-ink underline cursor-pointer"
        >
          Privacy Policy & DPDP Act
        </button>
        <span>•</span>
        <button
          type="button"
          onClick={() => setTermsOpen(true)}
          className="hover:text-ink underline cursor-pointer"
        >
          Terms of Service
        </button>
        <span>•</span>
        <span>Govt. of India UDISE+ Standard</span>
      </footer>

      {/* Dialog: Forgot Password */}
      <Dialog
        isOpen={forgotPasswordOpen}
        onClose={() => setForgotPasswordOpen(false)}
        title="Password Reset Assistance"
        description="Self-service and administrative account recovery options"
      >
        <div className="space-y-4 text-left">
          <div className="p-4 rounded-2xl bg-surface-soft border border-line space-y-2">
            <h4 className="text-sm font-bold text-ink font-display flex items-center gap-2">
              <Lock className="w-4 h-4 text-forest-700" />
              <span>Option 1: Contact School Headmaster</span>
            </h4>
            <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
              Your School Administrator or Headmaster can instantly reset your PIN or temporary password from the School Admin workspace.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-soft border border-line space-y-2">
            <h4 className="text-sm font-bold text-ink font-display flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-forest-700" />
              <span>Option 2: State Education Helpline</span>
            </h4>
            <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
              For district officials and super administrators, call toll-free at <span className="font-bold text-ink font-mono">1800-112-9876</span> (Mon–Sat, 8:00 AM – 6:00 PM IST).
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="primary" size="md" onClick={() => setForgotPasswordOpen(false)}>
              Got It
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Dialog: Account Help / Lockout */}
      <Dialog
        isOpen={accountHelpOpen}
        onClose={() => setAccountHelpOpen(false)}
        title="Sign-In Assistance"
        description="Troubleshooting sign-in issues and account lockouts"
      >
        <div className="space-y-4 text-left">
          <div className="space-y-2">
            <h4 className="text-sm font-bold text-ink">Frequent Solutions</h4>
            <ul className="space-y-2 text-xs sm:text-sm text-ink-soft list-disc list-inside">
              <li>Ensure your phone number is entered with or without +91 (10 digits).</li>
              <li>If you recently switched schools, your new Headmaster must authorize your roster assignment.</li>
              <li>In offline mode, previous cached credentials remain valid for 24 hours.</li>
            </ul>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="secondary" size="md" onClick={() => setAccountHelpOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Dialog: Contact School Admin */}
      <Dialog
        isOpen={adminContactOpen}
        onClose={() => setAdminContactOpen(false)}
        title="School Administration Contact"
        description="Direct channel to authorized school operators"
      >
        <div className="space-y-4 text-left">
          <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
            If you need role reassignment, class assignment changes, or student roster updates, please reach out to your designated School Headmaster.
          </p>

          <div className="p-4 rounded-2xl bg-surface-soft border border-line space-y-1">
            <span className="text-xs text-ink-muted uppercase font-bold tracking-wider">Support Desk</span>
            <div className="text-sm font-bold text-ink">support@attendease.gov.in</div>
            <div className="text-xs font-mono text-ink-soft">+91 (033) 2455-8900</div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="primary" size="md" onClick={() => setAdminContactOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Dialog: Privacy Policy */}
      <Dialog
        isOpen={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        title="Privacy Policy & Student Data Protection"
        description="Compliance with India Digital Personal Data Protection Act 2023"
        maxWidth="lg"
      >
        <div className="space-y-4 text-left text-xs sm:text-sm text-ink-soft leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
          <p>
            AttendEase is designed with privacy-by-design principles to protect minors and school personnel.
          </p>
          <h4 className="text-sm font-bold text-ink">1. Zero Cloud-Dependent Biometrics</h4>
          <p>
            AttendEase does not store or process raw biometric data in third-party clouds. Smartcard authentication uses AES-CMAC cryptography on tamper-resistant DESFire EV3 hardware.
          </p>
          <h4 className="text-sm font-bold text-ink">2. Multi-Tenant PostgreSQL Row Level Security (RLS)</h4>
          <p>
            All student roster records and attendance ledgers are cryptographically and structurally segregated per school. No school can access data from another school.
          </p>
          <h4 className="text-sm font-bold text-ink">3. Offline-First Local Storage</h4>
          <p>
            Teacher device storage stores only class rosters assigned to the active session. Offline caches are cleared upon sign-out.
          </p>
          <div className="pt-4 flex justify-end">
            <Button variant="primary" size="md" onClick={() => setPrivacyOpen(false)}>
              Understood
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Dialog: Terms of Service */}
      <Dialog
        isOpen={termsOpen}
        onClose={() => setTermsOpen(false)}
        title="Terms of Service"
        description="Authorized institutional use guidelines"
      >
        <div className="space-y-4 text-left text-xs sm:text-sm text-ink-soft leading-relaxed">
          <p>
            AttendEase is intended exclusively for authorized educational institutions, teachers, and school administrators for recording student attendance and generating UDISE+ government compliance reports.
          </p>
          <p>
            Unauthorized access, tamper attempts with RFID card proofs, or sharing of administrator credentials is strictly prohibited and logged to the central tamper-evident audit ledger.
          </p>
          <div className="pt-2 flex justify-end">
            <Button variant="primary" size="md" onClick={() => setTermsOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>
    </main>
  );
};

export default LoginPage;
