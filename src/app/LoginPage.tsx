import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useSession } from './SessionProvider';
import { useLanguage } from '../app/LanguageProvider';
import { Button, TextField, PasswordField, Toast, Dialog, Badge, Skeleton } from '../components/ui';
import { api } from '../services/api';
import { motion } from 'motion/react';
import { 
  Wifi, 
  ShieldCheck, 
  Languages, 
  ArrowRight, 
  HelpCircle, 
  PhoneCall, 
  School as SchoolIcon,
  Sparkles,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface SchoolPublicInfo {
  id: string;
  name: string;
  slug: string;
  district: string;
  status: string;
}

export const LoginPage: React.FC = () => {
  const { login } = useSession();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { schoolSlug } = useParams<{ schoolSlug?: string }>();

  const [resolvedSchool, setResolvedSchool] = useState<SchoolPublicInfo | null>(null);
  const [isResolvingSchool, setIsResolvingSchool] = useState<boolean>(Boolean(schoolSlug));
  const [schoolResolveError, setSchoolResolveError] = useState<'NOT_FOUND' | 'SUSPENDED' | 'NETWORK' | null>(null);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dialog States
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [accountHelpOpen, setAccountHelpOpen] = useState(false);
  const [adminContactOpen, setAdminContactOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const from = (location.state as any)?.from?.pathname;
  const isDemoMode = (import.meta as any).env?.VITE_DEMO_MODE === 'true';

  // 1. Resolve workspace slug if accessing via /s/:schoolSlug
  useEffect(() => {
    let isMounted = true;

    async function resolveSlug() {
      if (!schoolSlug) {
        setResolvedSchool(null);
        setIsResolvingSchool(false);
        setSchoolResolveError(null);
        return;
      }

      setIsResolvingSchool(true);
      setSchoolResolveError(null);

      try {
        const data = await api<{ school: SchoolPublicInfo }>(`/api/v1/public/schools/by-slug/${schoolSlug}`);
        if (!isMounted) return;

        if (data.school) {
          if (data.school.status === 'SUSPENDED' || data.school.status === 'INACTIVE') {
            setSchoolResolveError('SUSPENDED');
          } else {
            setResolvedSchool(data.school);
          }
        } else {
          setSchoolResolveError('NOT_FOUND');
        }
      } catch (err: any) {
        if (!isMounted) return;
        if (err.status === 404) {
          setSchoolResolveError('NOT_FOUND');
        } else {
          setSchoolResolveError('NETWORK');
        }
      } finally {
        if (isMounted) {
          setIsResolvingSchool(false);
        }
      }
    }

    void resolveSlug();

    return () => {
      isMounted = false;
    };
  }, [schoolSlug]);

  // Handle Login submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = phoneNumber.trim().replace(/\s+/g, '');
    if (!cleanPhone) {
      setError(t('invalidPhone'));
      return;
    }

    if (!password) {
      setError(t('passwordRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      const fullPhone = cleanPhone.startsWith('+91') ? cleanPhone : `+91${cleanPhone.replace(/^0+/, '')}`;
      await login(fullPhone, password, resolvedSchool?.id);

      if (from) {
        navigate(from, { replace: true });
      } else {
        navigate('/app', { replace: true });
      }
    } catch (err: any) {
      const msg = err?.message || '';
      const code = err?.code || '';
      const status = err?.status;
      if (
        code === 'SCHOOL_ACCESS_DENIED' ||
        status === 403 ||
        msg.includes('SCHOOL_ACCESS_DENIED') ||
        msg.includes('not a member') ||
        msg.includes('do not have access')
      ) {
        setError(
          resolvedSchool
            ? t('membershipAccessDenied', { school: resolvedSchool.name })
            : t('unauthorizedSchool')
        );
      } else {
        setError(msg || 'Login failed. Please check your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickSelect = (phone: string, pass: string) => {
    setPhoneNumber(phone.replace('+91', ''));
    setPassword(pass);
  };

  return (
    <main
      className="min-h-screen w-full flex flex-col items-center justify-between p-4 sm:p-6 md:p-10 relative overflow-hidden bg-canvas text-ink"
      id="login-main"
      data-testid="login-view"
    >
      {/* Background Soft Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-forest-700/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-forest-700/5 blur-3xl pointer-events-none" />

      {/* Top Bar: Brand, Workspace Badge & Language Switcher */}
      <header className="w-full max-w-6xl flex items-center justify-between gap-4 z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-forest-700 text-white flex items-center justify-center shadow-md font-extrabold text-xl font-display shrink-0">
            A
          </div>
          <div>
            <span className="font-extrabold text-xl sm:text-2xl text-ink tracking-tight font-display">
              {t('appName')}
            </span>
            <span className="hidden sm:inline-block ml-2.5 px-2.5 py-0.5 rounded-full text-sm font-bold bg-forest-50 text-forest-800 border border-forest-100 font-display">
              {t('schoolSystem')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Active Workspace / School Pill if resolved */}
          {resolvedSchool && (
            <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface border border-line shadow-2xs text-sm font-bold text-ink font-display">
              <SchoolIcon className="w-4 h-4 text-forest-700" />
              <span>{resolvedSchool.name}</span>
            </div>
          )}

          {/* Language Toggle with Accessible Name & Select element for Playwright / screen readers */}
          <div className="flex items-center bg-surface p-1 rounded-2xl border border-line shadow-2xs relative">
            <select
              aria-label="Select Language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="sr-only"
            >
              <option value="en">en</option>
              <option value="bn">bn</option>
              <option value="hi">hi</option>
            </select>
            <button
              type="button"
              onClick={() => setLanguage('bn')}
              aria-label={t('bengaliLabel')}
              className={`px-3.5 py-1.5 text-sm font-bold rounded-xl transition-all cursor-pointer font-display min-h-[44px] min-w-[44px] ${
                language === 'bn'
                  ? 'bg-forest-700 text-white shadow-2xs'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              বাংলা
            </button>
            <button
              type="button"
              onClick={() => setLanguage('hi')}
              aria-label="Hinglish में बदलें"
              className={`px-3.5 py-1.5 text-sm font-bold rounded-xl transition-all cursor-pointer font-display min-h-[44px] min-w-[44px] ${
                language === 'hi'
                  ? 'bg-forest-700 text-white shadow-2xs'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              हिन्दी
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              aria-label={t('englishLabel')}
              className={`px-3.5 py-1.5 text-sm font-bold rounded-xl transition-all cursor-pointer font-display min-h-[44px] min-w-[44px] ${
                language === 'en'
                  ? 'bg-forest-700 text-white shadow-2xs'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              English
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {isResolvingSchool ? (
        <div className="w-full max-w-md my-auto p-8 rounded-3xl bg-surface border border-line text-center space-y-4 shadow-sm z-10">
          <Skeleton className="w-16 h-16 rounded-2xl mx-auto" />
          <Skeleton className="w-48 h-6 mx-auto" />
          <Skeleton className="w-64 h-4 mx-auto" />
          <p className="text-sm font-bold text-ink-soft font-display animate-pulse">
            {t('resolvingSchool')}
          </p>
        </div>
      ) : schoolResolveError ? (
        <div
          data-testid={schoolResolveError === 'NOT_FOUND' ? 'school-not-found-state' : undefined}
          className="w-full max-w-md my-auto p-8 rounded-3xl bg-surface border border-line text-center space-y-5 shadow-lg z-10"
        >
          <div className="w-16 h-16 rounded-2xl bg-danger-50 text-danger-700 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-ink font-display">
              {schoolResolveError === 'NOT_FOUND'
                ? t('schoolNotFoundTitle')
                : schoolResolveError === 'SUSPENDED'
                ? t('schoolSuspendedTitle')
                : t('networkErrorTitle')}
            </h2>
            <p className="text-sm text-ink-soft">
              {schoolResolveError === 'NOT_FOUND'
                ? t('schoolNotFoundDesc', { slug: schoolSlug || '' })
                : schoolResolveError === 'SUSPENDED'
                ? t('schoolSuspendedDesc')
                : t('networkErrorDesc')}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => window.location.reload()}
              leftIcon={<RefreshCw className="w-4 h-4" />}
              className="min-h-[44px] text-sm"
            >
              {t('tryAgain')}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate('/')}
              className="min-h-[44px] text-sm"
            >
              Return to Home
            </Button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-6xl my-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center z-10 py-4">
          {/* Left Column: Reassuring Product Intro */}
          <motion.div
            initial={{ opacity: 0, x: -25 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45 }}
            className="lg:col-span-7 space-y-6 text-left"
          >
            {/* Clean, Non-Technical Typography */}
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-ink font-display leading-[1.12]">
                {resolvedSchool ? (
                  <>
                    Welcome to <span className="text-forest-700 dark:text-forest-500">{resolvedSchool.name}</span>
                  </>
                ) : (
                  <>
                    {t('dailyClassroom')} <br />
                    <span className="text-forest-700 dark:text-forest-500">
                      {t('attendanceSystem')}
                    </span>
                  </>
                )}
              </h1>
              <p className="text-sm sm:text-base text-ink-soft font-normal leading-relaxed max-w-xl">
                {resolvedSchool
                  ? `${resolvedSchool.name} (${resolvedSchool.district}) — ${t('loginHeroSubtitle')}`
                  : t('loginHeroSubtitle')}
              </p>
            </div>

            {/* Feature Highlight Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
              <div className="p-4 rounded-2xl bg-surface border border-line shadow-2xs text-left">
                <div className="flex items-center gap-2 text-forest-700 dark:text-forest-500 mb-1 font-bold">
                  <Wifi className="w-4 h-4" />
                  <span className="text-sm font-display">{t('featureOfflineTitle')}</span>
                </div>
                <p className="text-sm text-ink-soft leading-normal">{t('featureOfflineDesc')}</p>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-line shadow-2xs text-left">
                <div className="flex items-center gap-2 text-forest-700 dark:text-forest-500 mb-1 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-sm font-display">{t('featurePrivacyTitle')}</span>
                </div>
                <p className="text-sm text-ink-soft leading-normal">{t('featurePrivacyDesc')}</p>
              </div>

              <div className="p-4 rounded-2xl bg-surface border border-line shadow-2xs text-left">
                <div className="flex items-center gap-2 text-forest-700 dark:text-forest-500 mb-1 font-bold">
                  <Languages className="w-4 h-4" />
                  <span className="text-sm font-display">{t('featureBilingualTitle')}</span>
                </div>
                <p className="text-sm text-ink-soft leading-normal">{t('featureBilingualDesc')}</p>
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
                {t('login')}
              </h2>
              <p className="text-sm text-ink-soft">
                {resolvedSchool ? `${resolvedSchool.name} — ${t('enterCredentials')}` : t('enterCredentials')}
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhoneNumber(e.target.value)}
                placeholder="90000 00000"
                helperText={t('phoneHelper')}
              />

              <PasswordField
                label={t('password')}
                id="login-password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                placeholder="••••••••••••"
              />

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-sm font-semibold text-ink-soft cursor-pointer select-none min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRememberMe(e.target.checked)}
                    className="rounded border-line text-forest-700 focus:ring-forest-600 cursor-pointer w-4 h-4"
                  />
                  <span>{t('rememberMobile')}</span>
                </label>

                <button
                  type="button"
                  onClick={() => setForgotPasswordOpen(true)}
                  className="text-sm font-bold text-forest-700 dark:text-forest-400 hover:underline cursor-pointer min-h-[44px] inline-flex items-center"
                >
                  {t('forgotPassword')}
                </button>
              </div>

              <div className="pt-3">
                <Button
                  variant="primary"
                  size="lg"
                  type="submit"
                  isLoading={isSubmitting}
                  rightIcon={<ArrowRight className="w-5 h-5" />}
                  className="w-full text-base font-bold shadow-lg shadow-forest-700/20 min-h-[48px]"
                  aria-label={resolvedSchool ? t('loginToSchool', { school: resolvedSchool.name }) : t('signIn')}
                >
                  {resolvedSchool ? t('loginToSchool', { school: resolvedSchool.name }) : t('signIn')}
                </Button>
              </div>
            </form>

            {/* Quick Demo Switcher - Gated strictly behind VITE_DEMO_MODE */}
            {isDemoMode && (
              <div className="mt-6 pt-5 border-t border-line/80">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-sm font-bold uppercase tracking-wider text-ink-muted font-display flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-forest-700 dark:text-forest-400" />
                    <span>Demo Fast-Switch</span>
                  </span>
                  <Badge variant="warning" size="sm">
                    Sandbox
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickSelect('+919000000000', 'SuperSecretAdminPassword123!')}
                    className="p-3 rounded-2xl bg-surface-soft hover:bg-forest-50 dark:hover:bg-forest-900/20 border border-line text-left transition-all cursor-pointer min-h-[44px]"
                  >
                    <div className="text-sm font-bold text-ink">Super Admin</div>
                    <div className="text-sm text-ink-muted font-mono">+919000000000</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickSelect('+919100000001', 'SchoolAdminPassword123!')}
                    className="p-3 rounded-2xl bg-surface-soft hover:bg-forest-50 dark:hover:bg-forest-900/20 border border-line text-left transition-all cursor-pointer min-h-[44px]"
                  >
                    <div className="text-sm font-bold text-ink">School Admin</div>
                    <div className="text-sm text-ink-muted font-mono">+919100000001</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickSelect('+919100000002', 'TeacherPassword123!')}
                    className="p-3 rounded-2xl bg-surface-soft hover:bg-forest-50 dark:hover:bg-forest-900/20 border border-line text-left transition-all cursor-pointer min-h-[44px]"
                  >
                    <div className="text-sm font-bold text-ink">Teacher</div>
                    <div className="text-sm text-ink-muted font-mono">+919100000002</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickSelect('+919100000003', 'RfidOpPassword123!')}
                    className="p-3 rounded-2xl bg-surface-soft hover:bg-forest-50 dark:hover:bg-forest-900/20 border border-line text-left transition-all cursor-pointer min-h-[44px]"
                  >
                    <div className="text-sm font-bold text-ink">RFID Operator</div>
                    <div className="text-sm text-ink-muted font-mono">+919100000003</div>
                  </button>
                </div>
              </div>
            )}

            {/* Auxiliary Actions & Support */}
            <div className="mt-6 pt-5 border-t border-line/80 flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-ink-muted">
              <button
                type="button"
                onClick={() => setAccountHelpOpen(true)}
                className="hover:text-ink flex items-center gap-2 cursor-pointer transition-colors min-h-[44px]"
              >
                <HelpCircle className="w-4 h-4" />
                <span>{t('accountHelp')}</span>
              </button>

              <button
                type="button"
                onClick={() => setAdminContactOpen(true)}
                className="hover:text-ink flex items-center gap-2 cursor-pointer transition-colors min-h-[44px]"
              >
                <PhoneCall className="w-4 h-4" />
                <span>{t('contactAdmin')}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Institutional Legal & Security Footer */}
      <footer className="w-full max-w-6xl mt-6 pt-4 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-ink-muted z-10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-forest-700 dark:text-forest-400" />
          <span>{t('appName')} • {t('westBengalRegion')}</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setPrivacyOpen(true)}
            className="hover:text-ink transition-colors cursor-pointer min-h-[44px] inline-flex items-center"
          >
            {t('privacyPolicy')}
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => setTermsOpen(true)}
            className="hover:text-ink transition-colors cursor-pointer min-h-[44px] inline-flex items-center"
          >
            {t('termsOfService')}
          </button>
        </div>
      </footer>

      {/* Forgot Password Modal */}
      <Dialog
        isOpen={forgotPasswordOpen}
        onClose={() => setForgotPasswordOpen(false)}
        title={t('resetPasswordTitle')}
        description={t('resetPasswordDesc')}
      >
        <div className="space-y-4 text-left">
          <div className="p-4 rounded-2xl bg-surface-soft border border-line space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-ink">
              <SchoolIcon className="w-4 h-4 text-forest-700" />
              <span>{t('contactAdmin')}</span>
            </div>
            <p className="text-sm text-ink-soft leading-relaxed">
              {t('resetPasswordInstruction')}
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="secondary" onClick={() => setForgotPasswordOpen(false)} className="min-h-[44px] text-sm">
              {t('close')}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Account Help Modal */}
      <Dialog
        isOpen={accountHelpOpen}
        onClose={() => setAccountHelpOpen(false)}
        title={t('accountHelpTitle')}
        description={t('accountHelpDesc')}
      >
        <div className="space-y-3.5 text-left text-sm">
          <div className="p-4 rounded-2xl bg-surface-soft border border-line">
            <h4 className="font-bold text-ink mb-1">{t('accountHelp1Title')}</h4>
            <p className="text-ink-soft">{t('accountHelp1Desc')}</p>
          </div>
          <div className="p-4 rounded-2xl bg-surface-soft border border-line">
            <h4 className="font-bold text-ink mb-1">{t('accountHelp2Title')}</h4>
            <p className="text-ink-soft">{t('accountHelp2Desc')}</p>
          </div>
          <div className="p-4 rounded-2xl bg-surface-soft border border-line">
            <h4 className="font-bold text-ink mb-1">{t('accountHelp3Title')}</h4>
            <p className="text-ink-soft">{t('accountHelp3Desc')}</p>
          </div>

          <div className="pt-2 flex justify-end">
            <Button variant="secondary" onClick={() => setAccountHelpOpen(false)} className="min-h-[44px] text-sm">
              {t('close')}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Contact Admin Modal */}
      <Dialog
        isOpen={adminContactOpen}
        onClose={() => setAdminContactOpen(false)}
        title={t('contactAdminTitle')}
        description={t('contactAdminDesc')}
      >
        <div className="space-y-4 text-left">
          <p className="text-sm text-ink-soft leading-relaxed">
            {t('contactAdminDesc')}
          </p>
          <div className="pt-2 flex justify-end">
            <Button variant="secondary" onClick={() => setAdminContactOpen(false)} className="min-h-[44px] text-sm">
              {t('close')}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Privacy Policy Modal */}
      <Dialog
        isOpen={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        title={t('privacyPolicy')}
        description={t('privacyModalDesc')}
      >
        <div className="space-y-3.5 text-left text-sm max-h-[60vh] overflow-y-auto pr-1">
          <p className="text-ink-soft leading-relaxed">
            {t('featurePrivacyDesc')}
          </p>
          <h4 className="font-bold text-ink">1. {t('localEncryption')}</h4>
          <p className="text-ink-soft leading-relaxed">
            {t('localEncryptionDesc')}
          </p>
          <h4 className="font-bold text-ink">2. {t('schoolIsolation')}</h4>
          <p className="text-ink-soft leading-relaxed">
            {t('schoolIsolationDesc')}
          </p>

          <div className="pt-2 flex justify-end">
            <Button variant="secondary" onClick={() => setPrivacyOpen(false)} className="min-h-[44px] text-sm">
              {t('close')}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Terms of Service Modal */}
      <Dialog
        isOpen={termsOpen}
        onClose={() => setTermsOpen(false)}
        title={t('termsOfService')}
        description={t('termsModalDesc')}
      >
        <div className="space-y-3.5 text-left text-sm max-h-[60vh] overflow-y-auto pr-1">
          <p className="text-ink-soft leading-relaxed">
            {t('termsModalBody')}
          </p>
          <div className="pt-2 flex justify-end">
            <Button variant="secondary" onClick={() => setTermsOpen(false)} className="min-h-[44px] text-sm">
              {t('close')}
            </Button>
          </div>
        </div>
      </Dialog>
    </main>
  );
};

export default LoginPage;
