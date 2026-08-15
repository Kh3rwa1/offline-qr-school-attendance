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
  AlertCircle,
  Home,
  RefreshCw,
} from 'lucide-react';
import { getDefaultRouteForRole } from '../auth/permissions';
import { Button, TextField, PasswordField, Dialog, Badge, Toast, Skeleton } from '../components/ui';
import { useLanguage } from './LanguageProvider';

interface TickerItem {
  id: string;
  student: string;
  classSection: string;
  roll: number;
  time: string;
  method: 'QR' | 'DESFire' | 'Sync';
}

interface ResolvedSchool {
  id: string;
  name: string;
  slug: string;
  district: string;
  status: string;
  preferredLanguage?: string;
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
  const { language, setLanguage, t } = useLanguage();

  // Public Tenant Resolution State
  const [resolvedSchool, setResolvedSchool] = useState<ResolvedSchool | null>(null);
  const [isResolvingSchool, setIsResolvingSchool] = useState<boolean>(Boolean(schoolSlug));
  const [schoolResolveError, setSchoolResolveError] = useState<'NOT_FOUND' | 'SUSPENDED' | 'NETWORK' | null>(null);

  // Explicit demo mode check (VITE_DEMO_MODE=true or ?demo=true query param)
  const isDemoMode = useMemo(() => {
    return (
      (import.meta as any).env?.VITE_DEMO_MODE === 'true' ||
      new URLSearchParams(location.search).get('demo') === 'true'
    );
  }, [location.search]);

  const [phoneNumber, setPhoneNumber] = useState(() => (isDemoMode ? '+919000000000' : ''));
  const [password, setPassword] = useState(() => (isDemoMode ? 'SuperSecretAdminPassword123!' : ''));
  const [rememberMe, setRememberMe] = useState(false);
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

  // 1. Live Public Tenant Resolution
  useEffect(() => {
    if (!schoolSlug) {
      setResolvedSchool(null);
      setIsResolvingSchool(false);
      setSchoolResolveError(null);
      return;
    }

    let isMounted = true;
    setIsResolvingSchool(true);
    setSchoolResolveError(null);

    fetch(`/api/v1/public/schools/by-slug/${encodeURIComponent(schoolSlug)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!isMounted) return;
        if (res.status === 200 && data.success && data.school) {
          setResolvedSchool(data.school);
          setSchoolResolveError(null);
        } else if (res.status === 403 || data.error === 'SCHOOL_NOT_ACTIVE') {
          setSchoolResolveError('SUSPENDED');
        } else {
          setSchoolResolveError('NOT_FOUND');
        }
      })
      .catch(() => {
        if (isMounted) setSchoolResolveError('NETWORK');
      })
      .finally(() => {
        if (isMounted) setIsResolvingSchool(false);
      });

    return () => {
      isMounted = false;
    };
  }, [schoolSlug]);

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
      const normalizedPhone = phoneNumber.trim().startsWith('+')
        ? phoneNumber.trim()
        : `+91${phoneNumber.trim().replace(/\D/g, '')}`;


      const role = await login(normalizedPhone, password, resolvedSchool?.id);

      if (resolvedSchool?.slug) {
        localStorage.setItem('attendease.active_slug', resolvedSchool.slug);
      }

      const from = (location.state as any)?.from?.pathname;
      const target = from && from !== '/login' ? from : getDefaultRouteForRole(role);
      navigate(target, { replace: true });
    } catch (err: any) {
      if (
        err.code === 'SCHOOL_ACCESS_DENIED' ||
        err.message === 'SCHOOL_ACCESS_DENIED' ||
        (err.status === 403 && (err.code === 'SCHOOL_ACCESS_DENIED' || err.message?.includes('access to this school')))
      ) {
        setError(
          resolvedSchool
            ? `This mobile number is not a member of ${resolvedSchool.name}.`
            : 'You do not have access to this school workspace.'
        );
      } else {
        setError(err.message || 'Invalid mobile number or password. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              aria-label="Select Language"
              className="pl-9 pr-8 py-1.5 rounded-full bg-surface border border-line text-xs font-semibold text-ink shadow-2xs outline-none cursor-pointer hover:bg-surface-soft transition-all"
            >
              <option value="en">English</option>
              <option value="bn">বাংলা (Bengali)</option>
            </select>
          </div>

          <Link to="/">
            <Button variant="ghost" size="sm">
              Product Tour
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      {isResolvingSchool ? (
        <div className="w-full max-w-md my-auto p-8 rounded-[32px] bg-surface border border-line shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-surface-soft border border-line flex items-center justify-center mx-auto text-forest-700 dark:text-forest-400">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-ink font-display">Resolving School Workspace</h2>
          <p className="text-sm text-ink-soft">Connecting to the authenticated school directory…</p>
          <div className="pt-2 space-y-2">
            <Skeleton variant="text" className="h-4 w-full" />
            <Skeleton variant="text" className="h-4 w-3/4 mx-auto" />
          </div>
        </div>
      ) : schoolResolveError === 'NOT_FOUND' ? (
        <div
          data-testid="school-not-found-state"
          className="w-full max-w-lg my-auto p-8 sm:p-10 rounded-[32px] bg-surface border border-line shadow-xl text-center space-y-5"
        >
          <div className="w-16 h-16 rounded-2xl bg-danger-50 dark:bg-danger-900/20 text-danger-600 border border-danger-100 dark:border-danger-900/30 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-ink font-display">
              This school workspace was not found
            </h2>
            <p className="text-sm text-ink-soft leading-relaxed max-w-md mx-auto">
              We could not find an active school workspace at <code className="px-1.5 py-0.5 rounded bg-surface-soft font-mono text-xs text-ink font-bold">/s/{schoolSlug}</code>. Please check the URL or contact your school administrator.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Home className="w-4 h-4" />}
              onClick={() => navigate('/')}
            >
              Return to Home
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate('/login')}
            >
              Platform Sign In
            </Button>
          </div>
        </div>
      ) : schoolResolveError === 'SUSPENDED' ? (
        <div
          data-testid="school-suspended-state"
          className="w-full max-w-lg my-auto p-8 sm:p-10 rounded-[32px] bg-surface border border-line shadow-xl text-center space-y-5"
        >
          <div className="w-16 h-16 rounded-2xl bg-warning-50 dark:bg-warning-900/20 text-warning-600 border border-warning-100 dark:border-warning-900/30 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-ink font-display">
              This school workspace is suspended
            </h2>
            <p className="text-sm text-ink-soft leading-relaxed max-w-md mx-auto">
              This institutional workspace is currently inactive or suspended by the district authority.
            </p>
          </div>

          <div className="flex justify-center pt-2">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Home className="w-4 h-4" />}
              onClick={() => navigate('/')}
            >
              Return to Home
            </Button>
          </div>
        </div>
      ) : (
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
              {resolvedSchool && (
                <Badge variant="neutral" size="md" icon={<SchoolIcon className="w-3.5 h-3.5" />}>
                  {resolvedSchool.district} District
                </Badge>
              )}
            </div>

            {/* Clean, Non-Technical Typography */}
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-ink font-display leading-[1.12]">
                {resolvedSchool ? (
                  <>
                    Welcome to <br />
                    <span className="text-forest-700 dark:text-forest-500">{resolvedSchool.name}</span>
                  </>
                ) : (
                  <>
                    Daily attendance <br />
                    <span className="text-forest-700 dark:text-forest-500">infrastructure for schools.</span>
                  </>
                )}
              </h1>
              <p className="text-sm sm:text-base text-ink-soft font-normal leading-relaxed max-w-xl">
                {resolvedSchool
                  ? `Sign in to manage today’s school attendance for ${resolvedSchool.name} (${resolvedSchool.district}).`
                  : 'Sign in to manage today’s school attendance. Offline QR verification and smartcards with automatic ledger synchronization.'}
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
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-xl bg-forest-700/10 text-forest-700 dark:text-forest-400 flex items-center justify-center font-bold text-xs">
                            {item.roll}
                          </div>
                          <div>
                            <p className="font-bold text-ink">{item.student}</p>
                            <p className="text-xs text-ink-muted">Class {item.classSection}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant={item.method === 'DESFire' ? 'forest' : 'success'} size="sm">
                            {item.method}
                          </Badge>
                          <span className="font-mono text-xs text-ink-muted hidden sm:inline">{item.time}</span>
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
                {language === 'bn' ? 'লগ ইন করুন' : 'Sign In'}
              </h2>
              <p className="text-sm text-ink-soft">
                {resolvedSchool
                  ? (language === 'bn' ? `${resolvedSchool.name} এ প্রবেশ করতে লগ ইন করুন` : `Sign in to access ${resolvedSchool.name}`)
                  : (language === 'bn' ? 'আপনার নিবন্ধিত মোবাইল নম্বর এবং পাসওয়ার্ড লিখুন' : 'Enter your registered mobile number and password')}
              </p>
            </div>

            {error && (
              <div className="mb-5">
                <Toast kind="error" message={error} onDismiss={() => setError(null)} autoDismiss={false} />
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <TextField
                label={t('phoneNumber')}
                type="tel"
                id="login-phone"
                required
                prefixText="+91"
                autoComplete="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="90000 00000"
                helperText={language === 'bn' ? 'অনুমোদিত শিক্ষক বা প্রশাসকের ফোন নম্বর' : 'Authorized teacher, staff, or administrator number'}
              />

              <PasswordField
                label={t('password')}
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
                  <span>{language === 'bn' ? 'মোবাইল নম্বর মনে রাখুন' : 'Remember mobile number'}</span>
                </label>

                <button
                  type="button"
                  onClick={() => setForgotPasswordOpen(true)}
                  className="text-xs font-bold text-forest-700 dark:text-forest-400 hover:underline cursor-pointer"
                >
                  {language === 'bn' ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot password?'}
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
                  aria-label={resolvedSchool ? `Sign In to ${resolvedSchool.name}` : 'Sign In to Workspace'}
                >
                  {resolvedSchool ? (language === 'bn' ? `${resolvedSchool.name} - Sign In` : `Sign In to ${resolvedSchool.name}`) : (language === 'bn' ? 'লগ ইন করুন (Sign In)' : 'Sign In to Workspace')}
                </Button>
              </div>
            </form>

            {/* Quick Demo Switcher - Gated strictly behind VITE_DEMO_MODE */}
            {isDemoMode && (
              <div className="mt-6 pt-5 border-t border-line/80">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted font-display flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-forest-700 dark:text-forest-400" />
                    <span>Demo Environment Fast-Switch</span>
                  </span>
                  <Badge variant="warning" size="sm">
                    Sandbox Mode
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickSelect('+919000000000', 'SuperSecretAdminPassword123!')}
                    className="p-2.5 rounded-2xl bg-surface-soft hover:bg-forest-50 dark:hover:bg-forest-900/20 border border-line text-left transition-all cursor-pointer"
                  >
                    <div className="text-xs font-bold text-ink">Super Admin</div>
                    <div className="text-[11px] text-ink-muted font-mono">+919000000000</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickSelect('+919100000001', 'SchoolAdminPassword123!')}
                    className="p-2.5 rounded-2xl bg-surface-soft hover:bg-forest-50 dark:hover:bg-forest-900/20 border border-line text-left transition-all cursor-pointer"
                  >
                    <div className="text-xs font-bold text-ink">School Admin</div>
                    <div className="text-[11px] text-ink-muted font-mono">+919100000001</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickSelect('+919100000002', 'TeacherPassword123!')}
                    className="p-2.5 rounded-2xl bg-surface-soft hover:bg-forest-50 dark:hover:bg-forest-900/20 border border-line text-left transition-all cursor-pointer"
                  >
                    <div className="text-xs font-bold text-ink">Teacher</div>
                    <div className="text-[11px] text-ink-muted font-mono">+919100000002</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickSelect('+919100000003', 'RfidOpPassword123!')}
                    className="p-2.5 rounded-2xl bg-surface-soft hover:bg-forest-50 dark:hover:bg-forest-900/20 border border-line text-left transition-all cursor-pointer"
                  >
                    <div className="text-xs font-bold text-ink">RFID Operator</div>
                    <div className="text-[11px] text-ink-muted font-mono">+919100000003</div>
                  </button>
                </div>
              </div>
            )}

            {/* Auxiliary Actions & Support */}
            <div className="mt-6 pt-5 border-t border-line/80 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-ink-muted">
              <button
                type="button"
                onClick={() => setAccountHelpOpen(true)}
                className="hover:text-ink flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Account Help</span>
              </button>

              <button
                type="button"
                onClick={() => setAdminContactOpen(true)}
                className="hover:text-ink flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Contact School Admin</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Institutional Legal & Security Footer */}
      <footer className="w-full max-w-6xl mt-6 pt-4 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-muted z-10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-forest-700 dark:text-forest-400" />
          <span>AES-256 Encrypted Session • DPDP Act (2023) Compliant</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setPrivacyOpen(true)}
            className="hover:text-ink transition-colors cursor-pointer"
          >
            Privacy Policy
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => setTermsOpen(true)}
            className="hover:text-ink transition-colors cursor-pointer"
          >
            Terms of Service
          </button>
          <span>•</span>
          <span>AttendEase OS v1.2</span>
        </div>
      </footer>

      {/* Forgot Password Modal */}
      <Dialog
        isOpen={forgotPasswordOpen}
        onClose={() => setForgotPasswordOpen(false)}
        title="Reset Account Password"
        description="Password recovery workflow for institutional users"
      >
        <div className="space-y-4 text-left">
          <div className="p-4 rounded-2xl bg-surface-soft border border-line space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-ink">
              <SchoolIcon className="w-4 h-4 text-forest-700" />
              <span>Contact Your School Administrator</span>
            </div>
            <p className="text-xs text-ink-soft leading-relaxed">
              In accordance with state education security protocols, password resets for teachers and staff are managed directly by your institution's Headmaster or designated Administrator.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-surface-soft border border-line space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-ink">
              <PhoneCall className="w-4 h-4 text-forest-700" />
              <span>State Education Support Helpline</span>
            </div>
            <p className="text-xs text-ink-soft leading-relaxed">
              Toll Free: <strong className="text-ink">1800-112-9876</strong> (Mon–Sat, 08:00 AM – 06:00 PM IST)
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="secondary" onClick={() => setForgotPasswordOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Account Help Modal */}
      <Dialog
        isOpen={accountHelpOpen}
        onClose={() => setAccountHelpOpen(false)}
        title="Account & Login Troubleshooting"
        description="Common solutions for sign-in difficulties"
      >
        <div className="space-y-3.5 text-left text-xs">
          <div className="p-3.5 rounded-2xl bg-surface-soft border border-line">
            <h4 className="font-bold text-ink mb-1">1. Number Format</h4>
            <p className="text-ink-soft">Enter your 10-digit Indian mobile number registered with UDISE+ without country code prefixes.</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-surface-soft border border-line">
            <h4 className="font-bold text-ink mb-1">2. Offline Mode Notice</h4>
            <p className="text-ink-soft">If your mobile device is offline, you can continue scanning with existing stored credentials.</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-surface-soft border border-line">
            <h4 className="font-bold text-ink mb-1">3. Locked Account</h4>
            <p className="text-ink-soft">After 5 consecutive incorrect password attempts, account access is temporarily paused for 15 minutes.</p>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="secondary" onClick={() => setAccountHelpOpen(false)}>
              Got It
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Contact Admin Modal */}
      <Dialog
        isOpen={adminContactOpen}
        onClose={() => setAdminContactOpen(false)}
        title="Contact School Administrator"
        description="Direct contact information for your school office"
      >
        <div className="space-y-4 text-left">
          <p className="text-xs text-ink-soft leading-relaxed">
            Please reach out to your school's designated headmaster or IT coordinator for card re-issuance, roster updates, or credential management.
          </p>
          <div className="p-4 rounded-2xl bg-surface-soft border border-line space-y-1.5 font-mono text-xs">
            <div className="text-ink font-bold">State Command Center: support@attendease.gov.in</div>
            <div className="text-ink-muted">Emergency Dispatch: +91 33 2289 0000</div>
          </div>
          <div className="pt-2 flex justify-end">
            <Button variant="secondary" onClick={() => setAdminContactOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Privacy Policy Modal */}
      <Dialog
        isOpen={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        title="Privacy Policy & Student Data Protection"
        description="Compliance with the Digital Personal Data Protection (DPDP) Act 2023"
      >
        <div className="space-y-3.5 text-left text-xs max-h-[60vh] overflow-y-auto pr-1">
          <p className="text-ink-soft leading-relaxed">
            AttendEase is designed with strict data minimization principles for institutional child safety and attendance accounting.
          </p>
          <h4 className="font-bold text-ink">1. Zero Cloud Biometrics</h4>
          <p className="text-ink-soft leading-relaxed">No fingerprint or facial biometric data is ever collected, transmitted, or stored on remote servers.</p>
          <h4 className="font-bold text-ink">2. Cryptographic Pseudonymization</h4>
          <p className="text-ink-soft leading-relaxed">QR cards use HMAC-SHA256 authenticated secret keys. Scanning cards reveals no PII without authorized school ledger credentials.</p>
          <h4 className="font-bold text-ink">3. Row-Level Tenant Isolation</h4>
          <p className="text-ink-soft leading-relaxed">PostgreSQL RLS guarantees strict isolation between schools and administrative districts.</p>

          <div className="pt-2 flex justify-end">
            <Button variant="secondary" onClick={() => setPrivacyOpen(false)}>
              Acknowledge
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Terms of Service Modal */}
      <Dialog
        isOpen={termsOpen}
        onClose={() => setTermsOpen(false)}
        title="Terms of Service"
        description="Standard institutional software agreement"
      >
        <div className="space-y-3.5 text-left text-xs max-h-[60vh] overflow-y-auto pr-1">
          <p className="text-ink-soft leading-relaxed">
            By signing in to AttendEase, you agree to operate the attendance system solely for authorized governmental or educational purposes.
          </p>
          <h4 className="font-bold text-ink">1. Authorized Operators</h4>
          <p className="text-ink-soft leading-relaxed">Only appointed teachers, administrators, and verified staff may operate scanner terminals.</p>
          <h4 className="font-bold text-ink">2. Audit Logging</h4>
          <p className="text-ink-soft leading-relaxed">All roster modifications, card re-issuances, and synchronization events are immutably audited for government compliance.</p>

          <div className="pt-2 flex justify-end">
            <Button variant="secondary" onClick={() => setTermsOpen(false)}>
              Accept
            </Button>
          </div>
        </div>
      </Dialog>
    </main>
  );
};

export default LoginPage;
