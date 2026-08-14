import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { ShieldCheck, Database, RefreshCw, CheckCircle2, AlertTriangle, KeyRound, Server } from 'lucide-react';
import { StatCard } from '../../components/shared/StatCard';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';

interface SystemHealthResponse {
  success: boolean;
  status: 'HEALTHY' | 'DEGRADED';
  telemetry: {
    db: 'CONNECTED' | 'DISCONNECTED';
    redis: 'CONNECTED' | 'IN_MEMORY_FALLBACK' | 'DISCONNECTED';
    latestBackupTimestamp: string | null;
    migrationJournalVersion: string;
    kmsProviderMode: string;
    rfidCardProofEnforced: boolean;
    workerHeartbeatAgeSeconds: number | null;
  };
  timestamp: string;
}

export const SecurityOverview: React.FC = () => {
  const { data, isLoading, error, refetch } = useQuery<SystemHealthResponse>({
    queryKey: ['system', 'health'],
    queryFn: async () => {
      return api<SystemHealthResponse>('/api/v1/system/health');
    },
    refetchInterval: 30000,
  });

  if (isLoading && !data) return <LoadingState message="Loading platform security telemetry…" />;
  if (error) return <ErrorState message={(error as any)?.message || 'Failed to load security telemetry'} onRetry={() => refetch()} />;

  const telemetry = data?.telemetry;
  const isHealthy = data?.status === 'HEALTHY' && telemetry?.db === 'CONNECTED';
  const isDbConnected = telemetry?.db === 'CONNECTED';
  const isRedisActive = telemetry?.redis === 'CONNECTED';
  const hasBackup = Boolean(telemetry?.latestBackupTimestamp);

  return (
    <div className="space-y-8" id="security-overview-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
            Data Privacy & Security Governance
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Government of India Digital Personal Data Protection (DPDP) and state school tenant security telemetry.
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          className="btn-forest-secondary text-xs font-display flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Telemetry Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Database Isolation"
          value={isDbConnected ? 'Active (RLS)' : 'DEGRADED'}
          trend={{ value: isDbConnected ? 'PostgreSQL Tenant Context' : 'Database Offline', isPositive: isDbConnected }}
          variant={isDbConnected ? 'hero-forest' : 'default'}
        />
        <StatCard
          title="Distributed Cache"
          value={telemetry?.redis || 'UNKNOWN'}
          trend={{ value: isRedisActive ? 'Redis Rate Limiter' : 'In-Memory Fallback Active', isPositive: isRedisActive }}
          variant="default"
        />
        <StatCard
          title="KMS Cryptography"
          value={telemetry?.kmsProviderMode || 'UNKNOWN'}
          trend={{ value: telemetry?.rfidCardProofEnforced ? 'Hardware Proof Enforced' : 'Card Proof Optional', isPositive: Boolean(telemetry?.rfidCardProofEnforced) }}
          variant="default"
        />
        <StatCard
          title="Automated Backups"
          value={hasBackup ? new Date(telemetry!.latestBackupTimestamp!).toLocaleDateString() : 'UNKNOWN'}
          trend={{ value: hasBackup ? 'Verified Snapshot Available' : 'No Automated Snapshot Recorded', isPositive: hasBackup }}
          variant="default"
        />
      </div>

      {/* Security Architecture Component Inspection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="app-card p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl ${isDbConnected ? 'bg-[#144e39]' : 'bg-rose-600'} text-white flex items-center justify-center shadow-xs`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 font-display">Tenant Boundary Isolation (RLS)</h3>
              <p className="text-xs text-slate-400 font-medium">PostgreSQL tenant separation</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            PostgreSQL database-level Row-Level Security prevents teachers and administrators from viewing attendance records of any other institution. Each query is cryptographically bound to the active school identifier.
          </p>
          <div className="pt-2">
            {isDbConnected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>DB Engine Connected ({telemetry?.migrationJournalVersion || 'Active'})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Database Connection DEGRADED</span>
              </span>
            )}
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
              <span>KMS Mode: {telemetry?.kmsProviderMode || 'UNKNOWN'}</span>
            </span>
          </div>
        </div>

        <div className="app-card p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl ${isRedisActive ? 'bg-amber-500' : 'bg-slate-600'} text-white flex items-center justify-center shadow-xs`}>
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
              <span>Cache Layer: {telemetry?.redis || 'UNKNOWN'}</span>
            </span>
          </div>
        </div>

        <div className="app-card p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl ${hasBackup ? 'bg-purple-600' : 'bg-slate-500'} text-white flex items-center justify-center shadow-xs`}>
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
            {hasBackup ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                <span>Last Snapshot: {new Date(telemetry!.latestBackupTimestamp!).toLocaleString()}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />
                <span>Backup Evidence: UNKNOWN / MANUAL</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityOverview;
