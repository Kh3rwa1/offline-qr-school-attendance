import React from 'react';
import { ShieldCheck, Lock, Database, RefreshCw } from 'lucide-react';

export const SecurityOverview: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900">Platform Security & Infrastructure Status</h2>
        <p className="text-xs text-slate-500">Row-Level Security invariants, token signing configurations, and cryptographic health</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-emerald-600">
            <ShieldCheck className="w-6 h-6" />
            <h3 className="font-black text-sm text-slate-900">PostgreSQL Row-Level Security (RLS)</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Forced RLS active across all tenant tables (<code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700">app_current_tenant</code>). Cross-school leakage is strictly prevented at database level.
          </p>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
            ✓ 100% Policy Coverage Enforced
          </span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-indigo-600">
            <Lock className="w-6 h-6" />
            <h3 className="font-black text-sm text-slate-900">Token & Credential Cryptography</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            HMAC-SHA256 signed QR tokens with monotonic sequence counters. DESFire EV2 AES-128 CMAC card authentication with key diversification.
          </p>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
            ✓ AES-128 & Argon2id Active
          </span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <Database className="w-6 h-6" />
            <h3 className="font-black text-sm text-slate-900">Redis Distributed Rate Limiter</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Sliding-window rate limiters protect auth and scanning endpoints. Strict replay window detection with payload envelope hashing.
          </p>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
            ✓ Distributed Rate Limiting Active
          </span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 text-purple-600">
            <RefreshCw className="w-6 h-6" />
            <h3 className="font-black text-sm text-slate-900">Encrypted Automated Backups</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Continuous WAL archiving and daily full database backups encrypted with AES-256-GCM. Automated restoration drill verified.
          </p>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
            ✓ Backup Verification Drill Passed
          </span>
        </div>
      </div>
    </div>
  );
};

export default SecurityOverview;
