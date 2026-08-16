import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from './LanguageProvider';
import {
  ShieldCheck,
  Server,
  Database,
  HardDrive,
  Users,
  Building2,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Lock,
  Globe,
  Loader2,
} from 'lucide-react';

interface SystemStatus {
  isBootstrapped: boolean;
  setupAllowed: boolean;
  systemInfo: {
    dbStatus: string;
    backupConfigured: boolean;
    r2Configured: boolean;
    smsConfigured: boolean;
    smsProvider: string;
    workerAlive: boolean;
    serverDomain: string;
    featureRfid: boolean;
    version: string;
    timestamp: string;
  };
}

export const SetupWizardPage: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [step, setStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [adminName, setAdminName] = useState<string>('');
  const [adminPhone, setAdminPhone] = useState<string>('+91');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const [schoolName, setSchoolName] = useState<string>('');
  const [schoolDistrict, setSchoolDistrict] = useState<string>('Bankura');
  const [udiseCode, setUdiseCode] = useState<string>('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreviewRows, setCsvPreviewRows] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/v1/setup/status')
      .then((res) => res.json())
      .then((data: SystemStatus) => {
        setStatus(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to connect to setup service.');
        setLoading(false);
      });
  }, []);

  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCsvFile(file);

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          const lines = text.split('\n').filter((l) => l.trim().length > 0);
          const preview = lines.slice(1, 4).map((line) => {
            const parts = line.split(',').map((p) => p.trim());
            return {
              name: parts[0] || '',
              roll: parts[1] || '',
              class: parts[2] || '',
              section: parts[3] || 'A',
              phone: parts[4] || '',
            };
          });
          setCsvPreviewRows(preview);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleInitialize = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (adminPassword.length < 12) {
      setError('Password must be at least 12 characters long.');
      return;
    }
    if (adminPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!/^\+?[1-9]\d{9,14}$/.test(adminPhone)) {
      setError('Please provide a valid E.164 phone number (e.g. +919876543210).');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        admin: {
          fullName: adminName,
          phoneNumber: adminPhone,
          password: adminPassword,
        },
      };

      if (schoolName.trim().length > 0) {
        payload.school = {
          name: schoolName,
          district: schoolDistrict,
          udiseCode: udiseCode || undefined,
          preferredLanguage: language,
        };
      }

      const res = await fetch('/api/v1/setup/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Initialization failed.');
      }

      setStep(4);
    } catch (err: any) {
      setError(err.message || 'Setup request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-sm text-slate-400 font-mono">Checking appliance status…</p>
        </div>
      </div>
    );
  }

  if (status && status.isBootstrapped && step !== 4) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center shadow-xl">
          <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">Appliance Already Configured</h2>
          <p className="text-sm text-slate-400 mb-6">
            This AttendEase OS installation has already been initialized with a platform administrator. The one-time setup wizard is permanently locked for security.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition flex items-center justify-center gap-2"
          >
            <span>Proceed to Login</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      {/* Top Bar */}
      <div className="w-full max-w-2xl flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-emerald-400" />
          <span className="font-bold tracking-tight text-lg">AttendEase OS</span>
          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">QR Pilot</span>
        </div>
        <button
          onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 px-2.5 py-1 rounded-lg bg-slate-900 transition"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{language === 'en' ? 'বাংলা' : 'English'}</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header Banner */}
        <div className="p-6 sm:p-8 border-b border-slate-800 bg-slate-900/50">
          <h1 className="text-2xl font-bold text-slate-100 mb-1">{t('setupTitle')}</h1>
          <p className="text-sm text-slate-400">{t('setupSubtitle')}</p>

          {/* Stepper */}
          <div className="grid grid-cols-4 gap-2 mt-6">
            {[
              { id: 1, label: t('stepReadiness') },
              { id: 2, label: t('stepAdmin') },
              { id: 3, label: t('stepSchool') },
              { id: 4, label: t('stepComplete') },
            ].map((s) => (
              <div
                key={s.id}
                className={`flex flex-col gap-1 pb-2 border-b-2 text-xs font-medium transition ${
                  step === s.id
                    ? 'border-emerald-500 text-emerald-400'
                    : step > s.id
                    ? 'border-emerald-500/40 text-slate-400'
                    : 'border-slate-800 text-slate-600'
                }`}
              >
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="m-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: System Readiness */}
        {step === 1 && (
          <div className="p-6 sm:p-8 space-y-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">System Pre-flight Diagnostics</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                <Database className="w-5 h-5 text-emerald-400 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-slate-200">PostgreSQL Database</h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {status?.systemInfo.dbStatus === 'connected' ? 'Connected & Migrations Ready' : 'Disconnected'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                <HardDrive className="w-5 h-5 text-emerald-400 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-slate-200">Encrypted Backups</h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {status?.systemInfo.backupConfigured ? 'AES-256 Key Initialized' : 'Missing Key'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                <Server className="w-5 h-5 text-emerald-400 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-slate-200">Autonomous Worker</h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {status?.systemInfo.workerAlive ? 'Heartbeat Active' : 'Initializing (Standby)'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-slate-200">Offsite Disaster Recovery</h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {status?.systemInfo.r2Configured ? 'Cloudflare R2 Staged' : 'Local Storage Only (R2 Optional)'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="py-3 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition flex items-center gap-2"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Administrator Creation */}
        {step === 2 && (
          <div className="p-6 sm:p-8 space-y-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Step 2: Create Super Administrator</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">{t('adminFullName')}</label>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="e.g. Master Trainer / Headmaster"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">{t('adminPhone')}</label>
                <input
                  type="tel"
                  required
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">{t('adminPassword')} (min 12 chars)</label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-3 px-4 text-slate-400 hover:text-slate-200 font-medium rounded-xl transition flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!adminName || !adminPhone || !adminPassword) {
                    setError('Please fill in all administrator fields.');
                    return;
                  }
                  if (adminPassword !== confirmPassword) {
                    setError('Passwords do not match.');
                    return;
                  }
                  setError(null);
                  setStep(3);
                }}
                className="py-3 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition flex items-center gap-2"
              >
                <span>Continue to School Setup</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: School Provisioning & Roster CSV */}
        {step === 3 && (
          <form onSubmit={handleInitialize} className="p-6 sm:p-8 space-y-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Step 3: Primary School & Student Data</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">{t('schoolName')}</label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="e.g. Khatra High School (H.S.)"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">{t('schoolDistrict')}</label>
                  <input
                    type="text"
                    value={schoolDistrict}
                    onChange={(e) => setSchoolDistrict(e.target.value)}
                    placeholder="e.g. Bankura / Purulia"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">{t('schoolUdise')}</label>
                  <input
                    type="text"
                    value={udiseCode}
                    onChange={(e) => setUdiseCode(e.target.value)}
                    placeholder="e.g. 19130100101"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-sm font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* CSV Upload */}
              <div className="pt-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">{t('importCsvTitle')}</label>
                <p className="text-xs text-slate-500 mb-3">{t('importCsvDesc')}</p>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvChange}
                  className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
                />

                {csvPreviewRows.length > 0 && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                    <p className="font-mono text-emerald-400 mb-1.5">Preview (First {csvPreviewRows.length} students):</p>
                    <div className="space-y-1 text-slate-400 font-mono">
                      {csvPreviewRows.map((r, i) => (
                        <div key={i}>
                          Roll {r.roll}: {r.name} ({r.class}-{r.section})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={submitting}
                className="py-3 px-4 text-slate-400 hover:text-slate-200 font-medium rounded-xl transition flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="py-3 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Initializing…</span>
                  </>
                ) : (
                  <>
                    <span>Complete Initialization</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: Complete */}
        {step === 4 && (
          <div className="p-6 sm:p-10 text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-slate-100">{t('completeTitle')}</h2>
              <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">{t('completeDesc')}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left max-w-md mx-auto space-y-2 text-xs font-mono text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Super Administrator:</span>
                <span>{adminPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Target School:</span>
                <span>{schoolName || 'Default School'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Setup Lock:</span>
                <span className="text-emerald-400">PERMANENTLY LOCKED</span>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={() => navigate('/login')}
                className="w-full max-w-md py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition flex items-center justify-center gap-2 mx-auto"
              >
                <span>{t('goToLogin')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default SetupWizardPage;
