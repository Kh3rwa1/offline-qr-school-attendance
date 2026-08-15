import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSession } from './SessionProvider';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Wifi, Radio, ArrowRight, CheckCircle2, ScanLine } from 'lucide-react';
import { getDefaultRouteForRole } from '../auth/permissions';
import { Button } from '../components/shared/Button';
import { Toast } from '../components/shared/Toast';

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
  const isDev = process.env.NODE_ENV !== 'production';
  const [phoneNumber, setPhoneNumber] = useState(isDev ? '+919000000000' : '');
  const [password, setPassword] = useState(isDev ? 'SuperSecretAdminPassword123!' : '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tickerIndex, setTickerIndex] = useState(0);

  const { login } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

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
      const role = await login(phoneNumber, password);
      const from = (location.state as any)?.from?.pathname;
      const target = from && from !== '/login' ? from : getDefaultRouteForRole(role);
      navigate(target, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid credentials or login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-canvas flex flex-col justify-center items-center p-4 sm:p-6 lg:p-12 relative overflow-hidden">
      {/* Main Container */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
        {/* Left Column: Quiet, Confident Platform Hero */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-7 space-y-6 text-left"
        >
          {/* Brand Logo & Compliance Badge */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-forest-700 flex items-center justify-center text-white shadow-lg shadow-forest-700/20">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
                <path d="M12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4z" />
              </svg>
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface border border-line shadow-2xs">
              <span className="text-[11px] font-bold text-forest-700 dark:text-forest-600 tracking-wider uppercase font-display">
                Govt. of India • UDISE+ Standard
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-success-600 animate-pulse" />
            </div>
          </div>

          {/* Understated, Confident Typography */}
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-ink font-display leading-[1.08]">
              Daily attendance <br />
              <span className="text-forest-700 dark:text-forest-600">infrastructure for schools.</span>
            </h1>
            <p className="text-base sm:text-lg text-ink-soft font-normal leading-relaxed max-w-xl">
              Offline-first QR verification and DESFire smartcards with instant ledger sync. Built for zero-connectivity classrooms.
            </p>
          </div>

          {/* Live Attendance Ticker Mock */}
          <div className="p-4 rounded-[24px] bg-surface border border-line shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-ink-soft font-display uppercase tracking-wider">
                <ScanLine className="w-4 h-4 text-forest-700 dark:text-forest-600" />
                <span>Live Verification Stream</span>
              </div>
              <span className="text-[11px] font-mono font-medium text-forest-700 dark:text-forest-600 bg-success-50 px-2.5 py-0.5 rounded-full border border-success-100 dark:border-success-600/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success-600 animate-pulse" />
                Active Ledger
              </span>
            </div>

            <div className="space-y-1.5">
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
                      className="flex items-center justify-between p-2 rounded-xl text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-forest-600' : 'bg-ink-muted'}`} />
                        <span className="font-bold text-ink">{item.student}</span>
                        <span className="text-ink-soft font-mono text-[11px]">Class {item.classSection}</span>
                        <span className="text-ink-muted font-mono text-[11px]">Roll #{item.roll}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11px] text-ink-soft">
                        <span className="px-2 py-0.5 rounded-md bg-surface border border-line text-[11px] font-semibold">
                          {item.method}
                        </span>
                        <span>{item.time}</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-success-600" />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Infrastructure Pill Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-surface border border-line shadow-2xs">
              <div className="flex items-center gap-2 text-forest-700 dark:text-forest-600 mb-1 font-bold">
                <Wifi className="w-4 h-4" />
                <span className="text-xs font-display">Offline First</span>
              </div>
              <p className="text-xs text-ink-soft font-normal">Zero-latency classroom scanning</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface border border-line shadow-2xs">
              <div className="flex items-center gap-2 text-forest-700 dark:text-forest-600 mb-1 font-bold">
                <Radio className="w-4 h-4" />
                <span className="text-xs font-display">DESFire EV3</span>
              </div>
              <p className="text-xs text-ink-soft font-normal">AES-CMAC tamper-proof smartcards</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface border border-line shadow-2xs col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 text-forest-700 dark:text-forest-600 mb-1 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-display">RLS Isolation</span>
              </div>
              <p className="text-xs text-ink-soft font-normal">Strict multi-tenant security</p>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Clean White Authentication Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-5 bg-surface p-7 sm:p-9 rounded-[28px] border border-line shadow-xl"
        >
          <div className="space-y-2 mb-6 text-left">
            <h2 className="t-display text-2xl sm:text-3xl font-extrabold text-ink font-display">
              Sign In
            </h2>
            <p className="t-body text-xs text-ink-soft font-normal">
              Enter your authorized phone number and credentials
            </p>
          </div>

          {error && (
            <div className="mb-5">
              <Toast kind="error" message={error} onDismiss={() => setError(null)} autoDismiss={false} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label htmlFor="login-phone" className="block t-label text-ink mb-1.5 font-display">
                Phone Number
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-extrabold text-ink-muted">
                  +91
                </span>
                <input
                  id="login-phone"
                  aria-label="Phone number"
                  type="text"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+91 90000 00000"
                  className="w-full pl-12 pr-4 py-3.5 rounded-full bg-surface-soft border border-line text-xs font-medium text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 transition-all outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block t-label text-ink mb-1.5 font-display">
                Password
              </label>
              <input
                id="login-password"
                aria-label="Password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-3.5 rounded-full bg-surface-soft border border-line text-xs font-medium text-ink placeholder:text-slate-500 focus:bg-surface focus:border-forest-700 transition-all outline-none"
              />
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                size="lg"
                type="submit"
                isLoading={isSubmitting}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="w-full"
                aria-label="Sign in"
              >
                Sign In
              </Button>
            </div>
          </form>

          {/* Development Quick Role Switcher */}
          {isDev && (
            <div className="mt-8 pt-6 border-t border-line space-y-3 text-left">
              <div className="flex items-center justify-between">
                <span className="t-label text-ink-muted font-display">
                  Demo Role Credentials
                </span>
                <span className="text-[11px] font-bold text-forest-700 dark:text-forest-600 bg-success-50 px-2 py-0.5 rounded-full border border-success-100 dark:border-success-600/30">
                  1-Click Select
                </span>
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
                    <span className="font-bold block text-ink group-hover:text-white text-[11px]">
                      {item.role}
                    </span>
                    <span className="text-[11px] text-ink-muted group-hover:text-emerald-200 font-mono">
                      {item.phone}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-ink-muted font-normal relative z-10 flex items-center gap-4">
        <span>© 2026 AttendEase OS</span>
        <span>•</span>
        <span>Govt. of India UDISE+ Standard</span>
      </footer>
    </main>
  );
};

export default LoginPage;
