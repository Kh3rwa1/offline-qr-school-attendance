import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { ShieldCheck, Database, RefreshCw, CheckCircle2, AlertTriangle, KeyRound, Server } from 'lucide-react';
import { StatCard } from '../../components/shared/StatCard';
import { LoadingState } from '../../components/shared/LoadingState';
import { ErrorState } from '../../components/shared/ErrorState';
import { Button } from '../../components/shared/Button';
import { PLAIN_TERMS } from '../../utils/superAdminPlainTermsMapper';

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

  if (isLoading && !data) return <LoadingState type="stat-cards" message="Loading platform security telemetry…" />;
  if (error) return <ErrorState message={(error as any)?.message || 'Failed to load security telemetry'} onRetry={() => refetch()} />;

  const telemetry = data?.telemetry;
  const isHealthy = data?.status === 'HEALTHY' && telemetry?.db === 'CONNECTED';
  const isDbConnected = telemetry?.db === 'CONNECTED';
  const isRedisActive = telemetry?.redis === 'CONNECTED';
  const hasBackup = Boolean(telemetry?.latestBackupTimestamp);

  return (
    <div className="space-y-8 text-left" id="security-overview-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight font-display">
            Data Privacy & Security Governance
          </h1>
          <p className="t-body text-sm text-ink-soft mt-1">
            Government of India Digital Personal Data Protection (DPDP) and state school tenant security telemetry.
          </p>
          <p className="t-body text-xs text-ink-muted mt-1">
            {PLAIN_TERMS.dpdp.en}
          </p>
        </div>

        <Button
          variant="secondary"
          size="md"
          onClick={() => refetch()}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          Refresh Telemetry
        </Button>
      </div>

      {/* Telemetry Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div title={PLAIN_TERMS.rls.en}>
          <StatCard
            title="Database Isolation"
            value={isDbConnected ? 'Active (RLS)' : 'DEGRADED'}
            trend={{ value: isDbConnected ? 'PostgreSQL Tenant Context' : 'Database Offline', isPositive: isDbConnected }}
            variant={isDbConnected ? 'hero-forest' : 'default'}
          />
        </div>
        <div title={PLAIN_TERMS.rateLimiting.en}>
          <StatCard
            title="Distributed Cache"
            value={telemetry?.redis || 'UNKNOWN'}
            trend={{ value: isRedisActive ? 'Redis Rate Limiter' : 'In-Memory Fallback Active', isPositive: isRedisActive }}
            variant="default"
          />
        </div>
        <div title={PLAIN_TERMS.kms.en}>
          <StatCard
            title="KMS Cryptography"
            value={telemetry?.kmsProviderMode || 'UNKNOWN'}
            trend={{ value: telemetry?.rfidCardProofEnforced ? 'Hardware Proof Enforced' : 'Card Proof Optional', isPositive: Boolean(telemetry?.rfidCardProofEnforced) }}
            variant="default"
          />
        </div>
        <div title={PLAIN_TERMS.walBackup.en}>
          <StatCard
            title="Automated Backups"
            value={hasBackup ? new Date(telemetry!.latestBackupTimestamp!).toLocaleDateString() : 'UNKNOWN'}
            trend={{ value: hasBackup ? 'Verified Snapshot Available' : 'No Automated Snapshot Recorded', isPositive: hasBackup }}
            variant="default"
          />
        </div>
      </div>

      {/* Security Architecture Component Inspection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="app-card p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl ${isDbConnected ? 'bg-forest-700' : 'bg-danger-600'} text-white flex items-center justify-center shadow-xs`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-ink font-display">Tenant Boundary Isolation (RLS)</h3>
              <p className="t-body text-xs text-ink-muted">PostgreSQL tenant separation</p>
            </div>
          </div>
          <p className="t-body text-xs text-ink-soft leading-relaxed">
            PostgreSQL database-level Row-Level Security prevents teachers and administrators from viewing attendance records of any other institution. Each query is cryptographically bound to the active school identifier.
          </p>
          <p className="t-body text-xs text-ink-muted leading-relaxed italic">
            {PLAIN_TERMS.rls.en}
          </p>
          <div className="pt-2">
            {isDbConnected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30 font-display">
                <CheckCircle2 className="w-3.5 h-3.5 text-success-600" />
                <span>DB Engine Connected ({telemetry?.migrationJournalVersion || 'Active'})</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30 font-display">
                <AlertTriangle className="w-3.5 h-3.5 text-danger-600" />
                <span>Database Connection DEGRADED</span>
              </span>
            )}
          </div>
        </div>

        <div className="app-card p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-forest-700 text-white flex items-center justify-center shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-ink font-display">Student Token & Card Cryptography</h3>
              <p className="t-body text-xs text-ink-muted">Hardware-based authentication</p>
            </div>
          </div>
          <p className="t-body text-xs text-ink-soft leading-relaxed">
            Student QR identity badges and NFC smartcards generate dynamic AES-CMAC challenge-response signatures. Replay attacks and photocopied QR badges are automatically rejected by monotonic counters.
          </p>
          <p className="t-body text-xs text-ink-muted leading-relaxed italic">
            {PLAIN_TERMS.aesCmac.en}
          </p>
          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30 font-display">
              <CheckCircle2 className="w-3.5 h-3.5 text-success-600" />
              <span>KMS Mode: {telemetry?.kmsProviderMode || 'UNKNOWN'}</span>
            </span>
          </div>
        </div>

        <div className="app-card p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl ${isRedisActive ? 'bg-warning-600' : 'bg-surface-soft'} text-white flex items-center justify-center shadow-xs`}>
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-ink font-display">Rate Limiting & Denial-of-Service Defense</h3>
              <p className="t-body text-xs text-ink-muted">Distributed protection against spam scans</p>
            </div>
          </div>
          <p className="t-body text-xs text-ink-soft leading-relaxed">
            Sliding-window rate limiters prevent reader buffer overflows during rush-hour morning gate check-in spikes. Offline batch sync endpoints use cryptographic envelope hashing to detect duplicate uploads.
          </p>
          <p className="t-body text-xs text-ink-muted leading-relaxed italic">
            {PLAIN_TERMS.rateLimiting.en} {PLAIN_TERMS.envelopeHashing.en}
          </p>
          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-warning-50 text-warning-800 border border-warning-100 dark:border-warning-600/30 font-display">
              <CheckCircle2 className="w-3.5 h-3.5 text-warning-600" />
              <span>Cache Layer: {telemetry?.redis || 'UNKNOWN'}</span>
            </span>
          </div>
        </div>

        <div className="app-card p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl ${hasBackup ? 'bg-forest-700' : 'bg-surface-soft'} text-white flex items-center justify-center shadow-xs`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-ink font-display">Automated Encrypted Backups</h3>
              <p className="t-body text-xs text-ink-muted">Disaster recovery for state student data</p>
            </div>
          </div>
          <p className="t-body text-xs text-ink-soft leading-relaxed">
            Continuous Write-Ahead Log archiving and daily snapshots encrypted with AES-256-GCM ensure zero data loss even in the event of hardware failure at local school gateways.
          </p>
          <p className="t-body text-xs text-ink-muted leading-relaxed italic">
            {PLAIN_TERMS.walBackup.en}
          </p>
          <div className="pt-2">
            {hasBackup ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-success-50 text-success-800 border border-success-100 dark:border-success-600/30 font-display">
                <CheckCircle2 className="w-3.5 h-3.5 text-success-600" />
                <span>Last Snapshot: {new Date(telemetry!.latestBackupTimestamp!).toLocaleString()}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-surface-soft text-ink-soft border border-line font-display">
                <AlertTriangle className="w-3.5 h-3.5 text-ink-muted" />
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
