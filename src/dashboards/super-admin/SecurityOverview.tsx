import React from 'react';
import { ShieldCheck, Lock, Database, RefreshCw, CheckCircle2, KeyRound, Server } from 'lucide-react';
import { StatCard } from '../../components/shared/StatCard';

export const SecurityOverview: React.FC = () => {
  return (
    <div className="space-y-8" id="security-overview-view">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
          Data Privacy & Security Governance
        </h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Government of India Digital Personal Data Protection (DPDP) and state school tenant security standards.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Data Isolation"
          value="100% Enforced"
          trend={{ value: "PostgreSQL Row-Level Security", isPositive: true }}
          variant="hero-forest"
        />
        <StatCard
          title="QR Cryptography"
          value="HMAC-SHA256"
          trend={{ value: "Anti-cloning Protection", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Smartcard Security"
          value="AES-128 CMAC"
          trend={{ value: "MIFARE DESFire EV3 Native", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Offsite Backups"
          value="Hourly WAL"
          trend={{ value: "AES-256 Encrypted", isPositive: true }}
          variant="default"
        />
      </div>

      {/* Security Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="app-card p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#144e39] text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 font-display">Tenant Boundary Isolation (RLS)</h3>
              <p className="text-xs text-slate-400 font-medium">Zero cross-school data visibility guarantee</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            PostgreSQL database-level Row-Level Security prevents teachers and administrators from viewing attendance records of any other institution. Each query is cryptographically bound to the active school identifier.
          </p>
          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>100% RLS Policy Verification Passed</span>
            </span>
          </div>
        </div>

        <div className="app-card p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 font-display">Student Token & Card Cryptography</h3>
              <p className="text-xs text-slate-400 font-medium">Hardware-based authentication</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Student QR identity badges and NFC smartcards generate dynamic AES-CMAC challenge-response signatures. Replay attacks and photocopied QR badges are automatically rejected by monotonic counters.
          </p>
          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>DESFire EV3 & Argon2id Active</span>
            </span>
          </div>
        </div>

        <div className="app-card p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 font-display">Rate Limiting & Denial-of-Service Defense</h3>
              <p className="text-xs text-slate-400 font-medium">Distributed protection against spam scans</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Sliding-window rate limiters prevent reader buffer overflows during rush-hour morning gate check-in spikes. Offline batch sync endpoints use cryptographic envelope hashing to detect duplicate uploads.
          </p>
          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
              <span>Sliding Window Active</span>
            </span>
          </div>
        </div>

        <div className="app-card p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 font-display">Automated Encrypted Backups</h3>
              <p className="text-xs text-slate-400 font-medium">Disaster recovery for state student data</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Continuous Write-Ahead Log archiving and daily snapshots encrypted with AES-256-GCM ensure zero data loss even in the event of hardware failure at local school gateways.
          </p>
          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
              <span>Daily Automated Backups Certified</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityOverview;
