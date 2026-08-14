import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSession } from './SessionProvider';
import { motion } from 'motion/react';
import { LogIn, ShieldCheck, Wifi, Radio, School, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { getDefaultRouteForRole } from '../auth/permissions';

export const LoginPage: React.FC = () => {
  const isDev = process.env.NODE_ENV !== 'production';
  const [phoneNumber, setPhoneNumber] = useState(isDev ? '+919000000000' : '');
  const [password, setPassword] = useState(isDev ? 'SuperSecretAdminPassword123!' : '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

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
    <main className="min-h-screen bg-[#eef2f5] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-12 relative overflow-hidden">
      {/* Main Container */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center relative z-10">
        
        {/* Left Column: Platform Showcase */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-7 space-y-6 text-left"
        >
          {/* Brand Logo & Compliance Badge */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#144e39] flex items-center justify-center text-white shadow-lg shadow-[#144e39]/20">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
                <path d="M12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4z"/>
              </svg>
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-2xs">
              <span className="text-sm">🇮🇳</span>
              <span className="text-[11px] font-extrabold text-[#144e39] tracking-wider uppercase">
                Govt. of India • UDISE+ Standard 2026
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>

          {/* Large Hero Typography */}
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 font-display leading-[1.08]">
              Autonomous Attendance <br />
              <span className="text-[#144e39]">Operating System.</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed max-w-xl">
              High-speed hybrid offline QR & AES-CMAC DESFire smartcard infrastructure engineered for India's 1,400+ student institutions.
            </p>
          </div>

          {/* Key Infrastructure Highlights Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-2xs">
              <div className="flex items-center gap-2 text-[#144e39] mb-1 font-bold">
                <Wifi className="w-4 h-4" />
                <span className="text-xs font-display">Offline First</span>
              </div>
              <p className="text-xs text-slate-500">Zero-latency classroom scans without internet</p>
            </div>

            <div className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-2xs">
              <div className="flex items-center gap-2 text-[#144e39] mb-1 font-bold">
                <Radio className="w-4 h-4" />
                <span className="text-xs font-display">DESFire EV3</span>
              </div>
              <p className="text-xs text-slate-500">Hardware AES-CMAC tamper-proof smartcards</p>
            </div>

            <div className="p-4 rounded-3xl bg-white border border-slate-200/80 shadow-2xs col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 text-[#144e39] mb-1 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-display">RLS Security</span>
              </div>
              <p className="text-xs text-slate-500">Bank-grade tenant database isolation</p>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Clean White Authentication Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-5 bg-white p-7 sm:p-9 rounded-[32px] border border-slate-200 shadow-xl"
        >
          <div className="space-y-2 mb-6 text-left">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-display">
              Sign In
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Enter your authorized phone number and credentials
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label htmlFor="login-phone" className="block text-xs font-bold text-slate-700 mb-1.5 font-display">
                Phone Number
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-500">
                  🇮🇳
                </span>
                <input
                  id="login-phone"
                  aria-label="Phone number"
                  type="text"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+91 90000 00000"
                  className="w-full pl-11 pr-4 py-3.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#144e39] focus:ring-2 focus:ring-[#144e39]/10 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-bold text-slate-700 mb-1.5 font-display">
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
                className="w-full px-4 py-3.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-[#144e39] focus:ring-2 focus:ring-[#144e39]/10 outline-none transition-all"
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={isSubmitting}
              aria-label="Sign in"
              className="w-full py-4 px-6 rounded-full bg-[#144e39] hover:bg-[#0f3d2c] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#144e39]/25 transition-all font-display disabled:opacity-50 mt-4"
            >
              {isSubmitting ? (
                <span>Authenticating…</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          {/* Development Quick Role Switcher */}
          {isDev && (
            <div className="mt-8 pt-6 border-t border-slate-100 space-y-3 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 font-display">
                  Dev Demo Roles
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
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
                    className="p-2.5 rounded-2xl bg-slate-50 hover:bg-[#144e39] hover:text-white text-slate-700 border border-slate-200/80 text-left transition-all text-xs font-semibold font-display group"
                  >
                    <span className="font-extrabold block text-slate-900 group-hover:text-white text-[11px]">
                      {item.role}
                    </span>
                    <span className="text-[10px] text-slate-400 group-hover:text-emerald-200 font-mono">
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
      <footer className="mt-8 text-center text-xs text-slate-400 font-medium relative z-10 flex items-center gap-4">
        <span>© 2026 AttendEase OS</span>
        <span>•</span>
        <span>Govt. of India UDISE+ Standard</span>
      </footer>
    </main>
  );
};

export default LoginPage;
