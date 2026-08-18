import React, { useState, useEffect, useRef } from 'react';
import { StatCard } from '../../components/shared/StatCard';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { Button } from '../../components/shared/Button';
import { api } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { PLAIN_TERMS } from '../../utils/superAdminPlainTermsMapper';
import {
  Plus,
  Download,
  AlertCircle,
  CheckCircle2,
  Settings2,
  Save,
} from 'lucide-react';

// ─── Platform Settings Panel ───────────────────────────────────────────────
// ─── Platform Settings Panel ───────────────────────────────────────────────
const GENERAL_SETTING_LABELS: Record<string, string> = {
  pricing_amount: 'Pricing Amount (e.g. ₹130)',
  pricing_per_student: 'Pricing Label (e.g. per student / year)',
  pricing_free_note: 'Free Tier Note',
  demo_video_url: 'Demo Video URL (YouTube embed format)',
};

const PlatformSettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeLangTab, setActiveLangTab] = useState<'en' | 'bn' | 'hi'>('en');
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api<{ success: boolean; settings: Record<string, string> }>('/api/v1/admin/platform-settings')
      .then((res) => {
        if (res.success && res.settings) setSettings(res.settings);
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await api<{ success: boolean; message?: string }>('/api/v1/admin/platform-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      if (res.success) {
        setSaveSuccess(true);
        if (successTimer.current) clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setSaveError(res.message || 'Save failed');
      }
    } catch (err: any) {
      setSaveError(err.message || 'Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-card p-6 sm:p-7 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-forest-700 dark:text-forest-600" />
          <div>
            <h3 className="text-base font-extrabold text-ink font-display">Platform & Localization Settings</h3>
            <p className="t-body text-xs text-ink-soft mt-0.5">Manage live marketing subtitles, language variants, and pricing copy</p>
          </div>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={saving || loadingSettings}
          leftIcon={<Save className="w-4 h-4" />}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {saveSuccess && (
        <div className="text-xs font-bold text-success-800 bg-success-50 border border-success-100 dark:border-success-600/30 rounded-2xl px-4 py-2.5 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Settings saved successfully.
        </div>
      )}
      {saveError && (
        <div className="text-xs font-bold text-warning-800 bg-warning-50 border border-warning-100 dark:border-warning-600/30 rounded-2xl px-4 py-2.5">
          {saveError}
        </div>
      )}

      {loadingSettings ? (
        <p className="text-xs text-ink-soft py-4 text-center">Loading settings…</p>
      ) : (
        <div className="space-y-6">
          {/* Subtitle Localization Tabs */}
          <div className="p-4 rounded-2xl bg-surface-raised border border-line space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-ink font-display">Hero Subtitle by Language</label>
              <div className="flex items-center gap-1 rounded-xl bg-surface border border-line p-0.5">
                {(['en', 'bn', 'hi'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveLangTab(tab)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      activeLangTab === tab
                        ? 'bg-forest-700 text-white shadow-xs'
                        : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {tab === 'en' ? 'English (EN)' : tab === 'bn' ? 'বাংলা (BN)' : 'हिंदी (HI)'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <textarea
                id={`ps-hero_subtitle_${activeLangTab}`}
                rows={3}
                value={settings[`hero_subtitle_${activeLangTab}`] ?? settings.hero_subtitle ?? ''}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    [`hero_subtitle_${activeLangTab}`]: e.target.value,
                  }))
                }
                placeholder={
                  activeLangTab === 'en'
                    ? 'English subtitle...'
                    : activeLangTab === 'bn'
                    ? 'বাংলা সাবটাইটেল...'
                    : 'हिंदी सबटाइटल...'
                }
                className="w-full rounded-xl border border-line bg-surface text-sm text-ink px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-forest-700/30 resize-none font-sans"
              />
            </div>
          </div>

          {/* General Platform Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(GENERAL_SETTING_LABELS).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <label htmlFor={`ps-${key}`} className="block text-xs font-bold text-ink-soft">
                  {label}
                </label>
                <input
                  id={`ps-${key}`}
                  type="text"
                  value={settings[key] ?? ''}
                  onChange={(e) => setSettings((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-surface text-sm text-ink px-3 py-2 focus:outline-none focus:ring-2 focus:ring-forest-700/30"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Dashboard ─────────────────────────────────────────────────────────
export const SuperAdminDashboard: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const fetchTelemetry = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ success: boolean; data: any }>('/api/v1/dashboard/super-admin/summary');
      if (res.success && res.data) {
        setSummary(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load district attendance summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTelemetry();
  }, []);

  if (loading) return <LoadingState type="stat-cards" message="Connecting to state education attendance portal…" />;
  if (error) return <ErrorState message={error} onRetry={fetchTelemetry} />;

  // Every number on this screen is derived from the live platform summary — no placeholders.
  const allSchools: any[] = summary?.schools || [];
  const totalSchools = summary?.totalSchools ?? allSchools.length;
  const totalStudents = summary?.totalStudents ?? 0;
  const totalTeachers = summary?.totalTeachers ?? 0;
  const totalSessions = summary?.totalAttendanceSessions ?? 0;
  const isOperational = (summary?.systemHealth || 'OPERATIONAL') === 'OPERATIONAL';

  const activeSchools = allSchools.filter((s) => s.status === 'ACTIVE');
  const attentionSchools = allSchools.filter((s) => s.status && s.status !== 'ACTIVE');
  const activePct = totalSchools > 0 ? Math.round((activeSchools.length / totalSchools) * 100) : 0;

  const districtCounts: Record<string, number> = {};
  allSchools.forEach((s) => {
    const dist = s.district || 'Unassigned District';
    districtCounts[dist] = (districtCounts[dist] || 0) + 1;
  });
  const districtEntries = Object.entries(districtCounts);

  const newestSchools = [...allSchools]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-8 text-left" id="super-admin-dashboard-view">
      {/* Top Header Row with Buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success-50 border border-success-100 dark:border-success-600/30 text-[11px] font-bold text-forest-700 dark:text-forest-600 uppercase tracking-wider mb-2 font-display"
            title={PLAIN_TERMS.multiTenantHub.en}
          >
            <span>Multi-Tenant Platform Hub</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
            District Education Overview
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            Monitor registered schools, platform scale, and workspace health.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/app/super-admin/schools', { state: { openRegister: true } })}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Register School
          </Button>

          <Button
            variant="secondary"
            size="md"
            onClick={() => navigate('/app/reports/exports')}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export District CSV
          </Button>
        </div>
      </div>

      {/* 4 Real Stat Cards Row (live platform totals) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Affiliated Schools"
          value={totalSchools}
          trend={{ value: `${districtEntries.length} ${districtEntries.length === 1 ? 'District' : 'Districts'} Covered`, isPositive: true }}
          variant="hero-forest"
          onClick={() => navigate('/app/super-admin/schools')}
        />
        <StatCard
          title="Students Across Platform"
          value={totalStudents.toLocaleString('en-IN')}
          trend={{ value: 'Enrolled in registered schools', isPositive: true }}
          variant="default"
          onClick={() => navigate('/app/super-admin/schools')}
        />
        <StatCard
          title="Teachers & Staff"
          value={totalTeachers.toLocaleString('en-IN')}
          trend={{ value: 'Authorized to take attendance', isPositive: true }}
          variant="default"
          onClick={() => navigate('/app/super-admin/schools')}
        />
        <StatCard
          title="Attendance Sessions Recorded"
          value={totalSessions.toLocaleString('en-IN')}
          trend={{ value: 'Classroom sessions on the platform', isPositive: totalSessions > 0 }}
          variant="default"
          onClick={() => navigate('/app/reports/trends')}
        />
      </div>

      {/* Middle Row (3 Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Column 1: Schools Summary — newest first, real API data (5 cols) */}
        <div className="lg:col-span-5 app-card p-6 sm:p-7 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-ink font-display">
                Schools Summary
              </h3>
              <p className="t-body text-xs text-ink-soft mt-0.5">Newest registered institutions</p>
            </div>
            <button
              onClick={() => navigate('/app/super-admin/schools')}
              className="text-xs font-bold px-3 py-1 rounded-full border border-line text-ink-soft hover:bg-surface-soft transition-colors cursor-pointer font-display min-h-[44px]"
            >
              View All {totalSchools}
            </button>
          </div>

          <div className="mt-4 space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {newestSchools.length === 0 ? (
              <div className="p-6 text-center text-xs text-ink-soft">
                No schools provisioned yet. Click Register School to begin.
              </div>
            ) : (
              newestSchools.map((school: any, i: number) => (
                <div key={school.id || i} className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-surface-soft transition-colors border border-line">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-forest-700 text-white flex items-center justify-center text-xs font-extrabold shadow-2xs font-display">
                      {school.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-ink font-display">{school.name}</p>
                      <p className="text-[11px] text-ink-muted">{school.district || 'District N/A'} • {school.udiseCode ? `UDISE: ${school.udiseCode}` : 'Unassigned'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border font-display ${school.status === 'ACTIVE' ? 'bg-success-50 text-success-800 border-success-100 dark:border-success-600/30' : 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30'}`}>
                      {school.status || 'ACTIVE'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Platform Status (3 cols) — real systemHealth from the summary */}
        <div className="lg:col-span-3 dark-tracker-card p-6 sm:p-7 flex flex-col justify-between text-white relative overflow-hidden rounded-[28px]">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-emerald-300 font-display">Platform Status</p>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isOperational ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
                <span className="text-[11px] text-emerald-300 font-bold uppercase font-display">{isOperational ? 'Online' : 'Check'}</span>
              </div>
            </div>

            <div className="my-6 text-center">
              <span className="text-3xl font-extrabold font-display tracking-tight text-white block">
                {isOperational ? 'Operational' : 'Needs Check'}
              </span>
              <p className="text-xs text-emerald-200/80 mt-1 font-medium">
                Platform services responding normally
              </p>
            </div>
          </div>

          <div className="space-y-2.5 bg-emerald-950/60 p-3.5 rounded-2xl border border-emerald-500/20 text-xs">
            <div className="flex justify-between text-emerald-200/90 font-medium">
              <span>Registered Schools</span>
              <span className="font-bold text-white font-mono">{totalSchools}</span>
            </div>
            <div className="flex justify-between text-emerald-200/90 font-medium">
              <span>Total Students</span>
              <span className="font-bold text-white font-mono">{totalStudents.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-emerald-300 font-bold pt-1 border-t border-emerald-500/20">
              <span>Sessions Recorded</span>
              <span className="font-mono text-emerald-300">{totalSessions.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Column 3: Active Schools Gauge (4 cols) — derived from real workspace statuses */}
        <div className="lg:col-span-4 app-card p-6 sm:p-7 flex flex-col justify-between items-center text-center">
          <div className="w-full flex items-center justify-between">
            <h3 className="text-base font-extrabold text-ink font-display">
              Schools Active
            </h3>
            <span className="text-xs font-bold text-forest-700 dark:text-forest-600 bg-success-50 border border-success-100 dark:border-success-600/30 px-2.5 py-0.5 rounded-full font-display">
              {activeSchools.length} of {totalSchools}
            </span>
          </div>

          <div className="relative my-4 flex flex-col items-center justify-center">
            <svg className="w-52 h-32" viewBox="0 0 200 110" role="img" aria-label={`${activePct}% of registered schools are currently active`}>
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="var(--line)"
                strokeWidth="18"
                strokeLinecap="round"
              />
              <motion.path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="var(--forest-700)"
                strokeWidth="18"
                strokeDasharray="251.2"
                initial={{ strokeDashoffset: 251.2 }}
                animate={{ strokeDashoffset: 251.2 - (251.2 * Math.min(100, Math.max(0, activePct))) / 100 }}
                transition={{ duration: shouldReduceMotion ? 0 : 1.4, ease: [0.16, 1, 0.3, 1] }}
                className="motion-reduce:transition-none"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute top-12 flex flex-col items-center">
              <span className="text-4xl font-extrabold text-ink font-display tracking-tight t-data">
                {activePct}%
              </span>
              <span className="text-xs font-medium text-ink-soft mt-0.5">Workspaces Active</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 text-xs font-bold text-ink-soft">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-forest-700" />
              <span>Active: {activeSchools.length}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-warning-600" />
              <span>Attention: {attentionSchools.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Settings */}
      <PlatformSettingsPanel />

      {/* Bottom Row (2 Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Column 1: District Schools Distribution (5 cols) — real counts */}
        <div className="lg:col-span-5 app-card p-6 sm:p-7">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-extrabold text-ink font-display">
                District Schools Distribution
              </h3>
              <p className="t-body text-xs text-ink-soft mt-0.5">District-wise registered institutions</p>
            </div>
            <button
              onClick={() => navigate('/app/super-admin/schools')}
              className="text-xs font-bold px-3 py-1 rounded-full border border-line text-ink-soft hover:bg-surface-soft transition-colors cursor-pointer font-display min-h-[44px]"
            >
              Details
            </button>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {districtEntries.length === 0 ? (
              <p className="text-xs text-ink-soft py-4 text-center">No district records available</p>
            ) : (
              districtEntries.map(([district, count], i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-2xl hover:bg-surface-soft transition-colors border border-line">
                  <div>
                    <p className="text-xs font-bold text-ink font-display">{district}</p>
                    <p className="text-[11px] text-ink-muted mt-0.5">{count} {count === 1 ? 'School' : 'Schools'} Registered</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-success-50 text-success-800 border-success-100 dark:border-success-600/30 font-display">
                      Active District
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Schools Needing Attention (7 cols) — real suspended/inactive workspaces */}
        <div className="lg:col-span-7 app-card p-6 sm:p-7">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-extrabold text-ink font-display">
                Schools Needing Attention
              </h3>
              <p className="t-body text-xs text-ink-soft mt-0.5">Suspended or inactive workspaces</p>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border font-display ${attentionSchools.length === 0 ? 'bg-success-50 text-success-800 border-success-100 dark:border-success-600/30' : 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30'}`}>
              {attentionSchools.length === 0 ? 'All Active' : `${attentionSchools.length} To Review`}
            </span>
          </div>

          {attentionSchools.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-forest-700 dark:text-forest-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-ink font-display">Every school is active</p>
              <p className="text-xs text-ink-soft mt-1">Suspended or inactive workspaces will appear here with a direct action link.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {attentionSchools.map((school: any, i: number) => (
                <button
                  key={school.id || i}
                  type="button"
                  onClick={() => navigate('/app/super-admin/schools')}
                  className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-surface-soft transition-colors border border-line text-left cursor-pointer min-h-[44px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-warning-100 text-warning-800 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-ink font-display">{school.name}</p>
                      <p className="text-[11px] text-ink-muted">{school.district || 'District N/A'}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30 font-display">
                    {school.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
