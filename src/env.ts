import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const secret = (name: string) => z.string().min(32, `${name} must be at least 32 characters`);
const isProd = process.env.NODE_ENV === 'production';

export const BaseSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    COMPONENT: z.enum(['web', 'worker', 'migrate']).default('web'),
    PORT: z.coerce.number().int().default(3000),
    DATABASE_URL: z.string().url().optional(),
    SYSTEM_DATABASE_URL: z.string().url().optional(),
    AUTH_DATABASE_URL: z.string().optional(),
    REDIS_URL: z.string().url().optional(),
    REDIS_HOST: z.string().optional(),
    REDIS_PORT: z.preprocess((val) => {
      if (typeof val === 'string' && val.startsWith('tcp://')) {
        const match = val.match(/:(\d+)$/);
        return match ? Number(match[1]) : undefined;
      }
      return val;
    }, z.coerce.number().int().optional()),
    REDIS_PASSWORD: z.string().optional(),
    SESSION_SECRET: z.string().optional(),
    CSRF_SECRET: z.string().optional(),
    READER_TOKEN_PEPPER: z.string().optional(),
    RFID_CREDENTIAL_DIGEST_KEY: z.string().optional(),
    RFID_INGEST_V2: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
    LEGACY_READER_BEARER_FALLBACK: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
    SHUTDOWN_DRAIN_MS: z.coerce.number().int().min(1000).max(60_000).default(20_000),
    SHUTDOWN_READINESS_GRACE_MS: z.coerce.number().int().default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
    ALLOW_TEST_BYPASS: z.string().default('false'),
    APP_URL: z.string().optional(),
    FEATURE_RFID: z.string().default('false'),
    KMS_MASTER_KEY: z.string().optional(),
    RFID_CARD_MASTER_KEY: z.string().optional(),
    RFID_REQUIRE_CARD_PROOF: z.string().default('false'),
    ALLOW_LEGACY_RFID_UID_MODE: z.string().default('false'),
    RFID_HMAC_SECRET: z.string().optional(),
    RFID_HMAC_KEY_VERSION: z.string().default('1'),
    RFID_DUPLICATE_TAP_COOLDOWN_MS: z.string().default('30000'),
    RFID_MAX_CLOCK_SKEW_MS: z.string().default('30000'),
    RFID_MAX_OFFLINE_DURATION_HOURS: z.string().default('24'),
    RFID_MAX_ROSTER_AGE_HOURS: z.string().default('4'),
    RFID_OFFLINE_QUEUE_CAPACITY: z.string().default('10000'),
    RFID_OFFLINE_FAIL_MODE: z.string().default('CLOSED'),
    RFID_READER_SCAN_RATE_LIMIT: z.string().default('600'),
    RFID_GATEWAY_URL: z.string().optional(),
    METRICS_AUTH_TOKEN: z.string().optional(),
    REDIS_KEY_HMAC_SECRET: z.string().optional(),
    BACKUP_ENCRYPTION_KEY: z.string().optional(),
    SMS_PROVIDER: z.string().optional(),
    ABSENCE_SMS_DELAY_MINUTES: z.coerce.number().int().min(0).max(240).default(20),
    SMS_WEBHOOK_SECRET: z.string().optional(),
    DLT_SMS_API_KEY: z.string().optional(),
    DLT_SMS_SENDER_ID: z.string().optional(),
    DLT_SMS_ENTITY_ID: z.string().optional(),
    DLT_SMS_BASE_URL: z.string().optional(),
    DLT_SMS_HEADER: z.string().optional(),
    DLT_WEBHOOK_SECRET: z.string().optional(),
    DLT_PRINCIPAL_ENTITY_ID: z.string().optional(),
    PG_APPLICATION_NAME: z.string().optional(),

    PG_POOL_MAX: z.string().optional(),
    PG_POOL_MIN: z.string().default('2'),
    PG_POOL_MAX_APP: z.string().default('10'),
    PG_POOL_MAX_SYS: z.string().default('5'),
    PG_IDLE_TIMEOUT_MS: z.string().default('30000'),
    PG_CONNECTION_TIMEOUT_MS: z.string().default('5000'),
    PG_STATEMENT_TIMEOUT_MS: z.string().default('10000'),
    PG_IDLE_IN_TRANSACTION_TIMEOUT_MS: z.string().default('5000'),
    WEB_REPLICA_COUNT: z.string().default('2'),
    SMS_WORKER_REPLICA_COUNT: z.string().default('2'),
    MAX_ALLOWED_DB_CONNECTIONS: z.string().default('100'),
    AWS_KMS_KEY_ARN: z.string().optional(),
    GCP_KMS_RESOURCE_ID: z.string().optional(),
    RFID_OUTBOX_ENCRYPTION_KEY: z.string().optional(),
    SCHOOL_ID: z.string().optional(),
    RFID_READER_ID: z.string().optional(),
    ALERT_WEBHOOK_URL: z.string().optional(),
    CI: z.string().optional(),
    TEST_SERVER_STATIC: z.string().optional(),
    RUN_SERVER: z.string().optional(),
    VITEST: z.string().optional(),
    // Cloudflare R2 backup replication
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    R2_ENDPOINT: z.string().optional(),
    R2_PREFIX: z.string().optional(),
    R2_JURISDICTION: z.string().optional(),
    R2_RETENTION_DAYS: z.string().optional(),
    R2_UPLOAD_TIMEOUT_SECONDS: z.string().optional(),
    R2_MAX_RETRIES: z.string().optional(),
    // Worker & health
    WORKER_HEARTBEAT_FILE: z.string().optional(),
    LATEST_BACKUP_TIMESTAMP: z.string().optional(),
    // Reports queue & storage
    REPORT_ARTIFACT_MAX_BYTES: z.string().optional(),
    REPORT_ARTIFACT_STORAGE: z.string().optional(),
    REPORT_ARTIFACT_DIR: z.string().optional(),
    REPORT_GENERATION_CONCURRENCY: z.string().optional(),
    REPORT_GENERATION_MAX_PENDING: z.string().optional(),
    REPORT_MAX_ESTIMATED_CELLS: z.string().optional(),
    REPORT_MAX_PERIOD_DAYS: z.string().optional(),
    REPORT_MAX_STUDENTS: z.string().optional(),
    // SMS & webhooks
    SMS_GATEWAY_URL: z.string().optional(),
    SMS_WORKER_INTERVAL_MS: z.string().optional(),
    DLT_SMS_GATEWAY_URL: z.string().optional(),
    DLT_SMS_WEBHOOK_SECRET: z.string().optional(),
    // Ingress & Backups
    BACKUP_DIR: z.string().optional(),
    TRUSTED_INGRESS_SECRET: z.string().optional(),

  });

const MIN_SECRET = 32;
const tooShort = (v?: string) => !v || v.length < MIN_SECRET;

export const Schema = BaseSchema.passthrough().superRefine((e, ctx) => {
  if (e.NODE_ENV !== 'production') return;

  if (!e.DATABASE_URL || /replace[-_]with/.test(e.DATABASE_URL)) {
    ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'Required in production' });
  }

  // Web and worker both run RLS-bypass (system) work; it must use a separate DB role.
  if (e.COMPONENT !== 'migrate') {
    if (!e.SYSTEM_DATABASE_URL || /replace[-_]with/.test(e.SYSTEM_DATABASE_URL)) {
      ctx.addIssue({
        code: 'custom',
        path: ['SYSTEM_DATABASE_URL'],
        message: 'Required in production: RLS-bypass work must use a separate role',
      });
    } else if (e.SYSTEM_DATABASE_URL === e.DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['SYSTEM_DATABASE_URL'],
        message: 'Must use a separate role from DATABASE_URL (RLS bypass role isolation)',
      });
    }
  }

  // Web secrets are required unconditionally (not only when FEATURE_RFID=true):
  // reader tokens can be issued regardless of the UI feature flag.
  if (e.COMPONENT === 'web') {
    for (const k of ['SESSION_SECRET', 'READER_TOKEN_PEPPER', 'RFID_CREDENTIAL_DIGEST_KEY'] as const) {
      if (tooShort(e[k])) {
        ctx.addIssue({ code: 'custom', path: [k], message: `${k} (>= ${MIN_SECRET} chars) required in production` });
      }
    }
  }
});

const parsed = Schema.safeParse(process.env);
if (!parsed.success) {
  // Names + reasons only; never print values
  console.error(
    'Invalid configuration:\n' + parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
  );
  process.exit(1);
}

// Reject unknown variables that use the app's own prefixes (catches typos such as
// RFID_INGEST_VS=true). `.strict()` is unusable because process.env holds PATH, HOME, etc.
const APP_PREFIXES = ['PG_', 'RFID_', 'REDIS_', 'SMS_', 'R2_', 'BACKUP_', 'FEATURE_', 'SHUTDOWN_', 'READER_', 'CSRF_', 'SESSION_', 'ABSENCE_'];
const KNOWN_KEYS = new Set(Object.keys(BaseSchema.shape));
// Same prefix, different owner: read by the backup sidecar / installer scripts, which share .env.
const FOREIGN_KEYS = new Set([
  'BACKUP_CRON', 'BACKUP_FILE', 'BACKUP_KEY', 'BACKUP_KEYS_DIR', 'BACKUP_PASSPHRASE', 'BACKUP_RETAIN_DAYS',
  'PG_VERSION', 'PG_RLS_MIGRATION_DATABASE_URL', 'PG_RLS_APPLICATION_DATABASE_URL',
  'PG_RLS_AUTH_DATABASE_URL', 'PG_RLS_SYSTEM_DATABASE_URL',
]);
// Kubernetes service links, e.g. REDIS_SERVICE_HOST, REDIS_PORT_6379_TCP_ADDR (injected for Service "redis").
const K8S_SERVICE_LINK = /_(SERVICE_HOST|SERVICE_PORT(_[A-Z0-9_]+)?|PORT_\d+_(TCP|UDP|SCTP)(_(PROTO|PORT|ADDR))?)$/;
const unknownKeys = Object.keys(process.env).filter(
  (k) =>
    APP_PREFIXES.some((p) => k.startsWith(p)) &&
    !KNOWN_KEYS.has(k) &&
    !FOREIGN_KEYS.has(k) &&
    !K8S_SERVICE_LINK.test(k)
);
if (unknownKeys.length) {
  const msg = `Unknown config variables (typo?): ${unknownKeys.join(', ')}`;
  if (parsed.data.NODE_ENV === 'production') {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg);
}

const baseData = { ...parsed.data };
const inTestRuntime = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

export const env = new Proxy(baseData, {
  get(target, prop: string | symbol) {
    if (typeof prop === 'string') {
      if (inTestRuntime || prop === 'TEST_SERVER_STATIC' || prop === 'DISABLE_RATE_LIMITING') {
        if (prop in process.env) {
          return (process.env as Record<string, unknown>)[prop];
        }
      }
    }
    return (target as unknown as Record<string | symbol, unknown>)[prop];
  },
  set(_target, _prop, _value) {
    if (inTestRuntime) return true;
    throw new Error('Cannot mutate environment configuration in non-test mode');
  },
});

export type Env = typeof parsed.data;

export function validateProductionEnv() {
  if (process.env.NODE_ENV === 'production') {
    if (process.env.ALLOW_TEST_BYPASS === 'true') {
      throw new Error('FATAL_SECURITY_CONFIGURATION: ALLOW_TEST_BYPASS is strictly prohibited in production mode');
    }
    if (process.env.SMS_PROVIDER === 'fake') {
      throw new Error(
        'FATAL_SECURITY_CONFIGURATION: Fake SMS provider is strictly prohibited in production mode. Configure a real provider or console.'
      );
    }
    const authDbUrl = process.env.AUTH_DATABASE_URL;
    if (authDbUrl) {
      try {
        const parsedAuthUrl = new URL(authDbUrl);
        if (parsedAuthUrl.protocol !== 'postgres:' && parsedAuthUrl.protocol !== 'postgresql:') {
          throw new Error('AUTH_DATABASE_URL must be a valid postgres:// or postgresql:// URL.');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          `FATAL_AUTH_DATABASE_URL_MALFORMED: Production mode requires a valid PostgreSQL URL for AUTH_DATABASE_URL: ${msg}`
        );
      }
    }
  }

  const result = Schema.safeParse(process.env);
  if (!result.success) {
    throw new Error(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
  }
  const current = result.data;
  if (current.NODE_ENV === 'production') {


    const secretVars = [
      'SESSION_SECRET',
      'CSRF_SECRET',
      'REDIS_KEY_HMAC_SECRET',
      'METRICS_AUTH_TOKEN',
      'BACKUP_ENCRYPTION_KEY',
      'MIGRATION_DB_PASSWORD',
      'APP_DB_PASSWORD',
      'SYSTEM_DB_PASSWORD',
      'AUTH_DB_PASSWORD',
    ];
    if (process.env.FEATURE_RFID === 'true') {
      secretVars.push('RFID_HMAC_SECRET');
    }

    for (const varName of secretVars) {
      const val = process.env[varName];
      if (val && (val.includes('replace-with') || val.includes('placeholder') || val.includes('changeme'))) {
        throw new Error(
          `FATAL_SECURITY_CONFIGURATION: ${varName} contains an insecure example placeholder. Generate a real random secret before starting in production.`
        );
      }
    }

    const backupKey = process.env.BACKUP_ENCRYPTION_KEY;
    if (backupKey && backupKey.length < 32) {
      throw new Error('BACKUP_ENCRYPTION_KEY must be at least 32 characters in production mode');
    }

    if (current.COMPONENT === 'web') {
      if (!current.SESSION_SECRET || current.SESSION_SECRET.length < 32) {
        throw new Error('SESSION_SECRET must be at least 32 characters in production mode');
      }
      const authDbUrl = process.env.AUTH_DATABASE_URL;
      if (authDbUrl) {
        try {
          const parsedAuthUrl = new URL(authDbUrl);
          if (parsedAuthUrl.protocol !== 'postgres:' && parsedAuthUrl.protocol !== 'postgresql:') {
            throw new Error('AUTH_DATABASE_URL must be a valid postgres:// or postgresql:// URL.');
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(
            `FATAL_AUTH_DATABASE_URL_MALFORMED: Production mode requires a valid PostgreSQL URL for AUTH_DATABASE_URL: ${msg}`
          );
        }
      } else {
        throw new Error('AUTH_DATABASE_URL is required in production for role-separated authentication.');
      }

      const csrfSecret = process.env.CSRF_SECRET || current.SESSION_SECRET;
      if (!csrfSecret || csrfSecret.length < 32) {
        throw new Error(
          'CSRF_SECRET (or SESSION_SECRET of at least 32 characters) must be provided in production mode'
        );
      }
      const hmacSecret = process.env.REDIS_KEY_HMAC_SECRET;
      if (!hmacSecret || hmacSecret.length < 32) {
        throw new Error('REDIS_KEY_HMAC_SECRET must be at least 32 characters in production mode');
      }
      const metricsToken = process.env.METRICS_AUTH_TOKEN;
      if (!metricsToken || metricsToken.length < 32) {
        throw new Error('METRICS_AUTH_TOKEN must be at least 32 characters in production mode');
      }

      if (process.env.FEATURE_RFID === 'true') {
        const rfidHmacSecret = process.env.RFID_HMAC_SECRET;
        if (!rfidHmacSecret || rfidHmacSecret.length < 32) {
          throw new Error(
            'RFID_HMAC_SECRET must be at least 32 characters in production mode when FEATURE_RFID is enabled'
          );
        }
        const rfidCardMasterKey = process.env.RFID_CARD_MASTER_KEY;
        if (!rfidCardMasterKey || rfidCardMasterKey.length < 32) {
          throw new Error(
            'RFID_CARD_MASTER_KEY must be at least 32 characters in production mode when FEATURE_RFID is enabled'
          );
        }

        const kmsMasterKey = process.env.KMS_MASTER_KEY;
        const awsKmsArn = process.env.AWS_KMS_KEY_ARN;
        const gcpKmsId = process.env.GCP_KMS_RESOURCE_ID;
        if (!kmsMasterKey && !awsKmsArn && !gcpKmsId) {
          throw new Error(
            'FATAL_KMS_CONFIGURATION: Production mode with FEATURE_RFID=true requires explicit key management. Set KMS_MASTER_KEY, AWS_KMS_KEY_ARN, or GCP_KMS_RESOURCE_ID.'
          );
        }
      }
    }
  }
  return current;
}

export const EnvSchema = Schema;

export interface EnvVarDoc {
  group: string;
  help: string;
  secret?: boolean;
  example?: string;
}

export const ENV_DOCS: Record<keyof z.infer<typeof EnvSchema>, EnvVarDoc> = {
  // Server & Process
  NODE_ENV: {
    group: 'Server & Process',
    help: 'Application runtime environment (development, test, production)',
    example: 'production',
  },
  COMPONENT: {
    group: 'Server & Process',
    help: 'Process role to execute (web, worker, migrate)',
    example: 'web',
  },
  PORT: {
    group: 'Server & Process',
    help: 'HTTP server listening port',
    example: '3000',
  },
  APP_URL: {
    group: 'Server & Process',
    help: 'Canonical public base URL of the AttendEase web portal',
    example: 'http://localhost:3000',
  },
  LOG_LEVEL: {
    group: 'Server & Process',
    help: 'Pino structured logging level (fatal, error, warn, info, debug, trace)',
    example: 'info',
  },
  WEB_REPLICA_COUNT: {
    group: 'Server & Process',
    help: 'Number of active web application replicas running behind proxy',
    example: '2',
  },
  SHUTDOWN_DRAIN_MS: {
    group: 'Server & Process',
    help: 'Timeout in ms to wait for in-flight requests to complete during SIGTERM drain',
    example: '20000',
  },
  SHUTDOWN_READINESS_GRACE_MS: {
    group: 'Server & Process',
    help: 'Delay in ms between unmarking readiness check and closing server listeners',
    example: '3000',
  },

  // Database & Connection Pools
  DATABASE_URL: {
    group: 'Database & Connection Pools',
    help: 'PostgreSQL connection URL for school tenant operations (RLS enforced)',
    example: 'postgres://attendease_app:password@localhost:5432/attendease',
  },
  SYSTEM_DATABASE_URL: {
    group: 'Database & Connection Pools',
    help: 'PostgreSQL connection URL for system/migration operations (must be isolated role)',
    example: 'postgres://attendease_sys:password@localhost:5432/attendease',
  },
  AUTH_DATABASE_URL: {
    group: 'Database & Connection Pools',
    help: 'PostgreSQL connection URL for authentication and credential verification',
    example: 'postgres://attendease_auth:password@localhost:5432/attendease',
  },
  PG_APPLICATION_NAME: {
    group: 'Database & Connection Pools',
    help: 'Custom application_name tag sent to PostgreSQL for connection identification',
    example: 'attendease-web',
  },
  PG_POOL_MIN: {
    group: 'Database & Connection Pools',
    help: 'Minimum idle connections maintained per pool',
    example: '2',
  },
  PG_POOL_MAX: {
    group: 'Database & Connection Pools',
    help: 'Fallback global maximum pool size override',
    example: '20',
  },
  PG_POOL_MAX_APP: {
    group: 'Database & Connection Pools',
    help: 'Maximum database connections dedicated to tenant app pool',
    example: '10',
  },
  PG_POOL_MAX_SYS: {
    group: 'Database & Connection Pools',
    help: 'Maximum database connections dedicated to system/maintenance pool',
    example: '5',
  },
  PG_IDLE_TIMEOUT_MS: {
    group: 'Database & Connection Pools',
    help: 'Milliseconds an idle connection can remain open before being closed',
    example: '30000',
  },
  PG_CONNECTION_TIMEOUT_MS: {
    group: 'Database & Connection Pools',
    help: 'Milliseconds to wait before timing out while acquiring a connection from the pool',
    example: '5000',
  },
  PG_STATEMENT_TIMEOUT_MS: {
    group: 'Database & Connection Pools',
    help: 'PostgreSQL statement timeout limit in milliseconds per query',
    example: '10000',
  },
  PG_IDLE_IN_TRANSACTION_TIMEOUT_MS: {
    group: 'Database & Connection Pools',
    help: 'PostgreSQL idle_in_transaction_session_timeout in milliseconds',
    example: '5000',
  },
  MAX_ALLOWED_DB_CONNECTIONS: {
    group: 'Database & Connection Pools',
    help: 'Cluster-wide safety cap on total allowed database connections',
    example: '100',
  },

  // Redis Cache & Rate Limiting
  REDIS_URL: {
    group: 'Redis Cache & Rate Limiting',
    help: 'Full connection URL for Redis cache and rate limiting service',
    example: 'redis://localhost:6379',
  },
  REDIS_HOST: {
    group: 'Redis Cache & Rate Limiting',
    help: 'Redis hostname when not using REDIS_URL',
    example: 'localhost',
  },
  REDIS_PORT: {
    group: 'Redis Cache & Rate Limiting',
    help: 'Redis TCP port when not using REDIS_URL',
    example: '6379',
  },
  REDIS_PASSWORD: {
    group: 'Redis Cache & Rate Limiting',
    help: 'Redis password authentication credential',
    secret: true,
  },
  REDIS_KEY_HMAC_SECRET: {
    group: 'Redis Cache & Rate Limiting',
    help: 'HMAC key used to hash student identifiers in Redis cache keys',
    secret: true,
  },

  // Session & Security
  SESSION_SECRET: {
    group: 'Session & Security',
    help: 'HMAC secret key used to sign and encrypt session cookies (min 32 chars)',
    secret: true,
  },
  CSRF_SECRET: {
    group: 'Session & Security',
    help: 'HMAC key used for CSRF double-submit token verification (min 32 chars)',
    secret: true,
  },
  TRUSTED_INGRESS_SECRET: {
    group: 'Session & Security',
    help: 'Shared secret verified on incoming reverse proxy forwarded headers',
    secret: true,
  },
  ALLOW_TEST_BYPASS: {
    group: 'Session & Security',
    help: 'Allow bypassing auth checks for local testing (STRICTLY FORBIDDEN in production)',
    example: 'false',
  },

  // UHF RFID Gate Ingest
  FEATURE_RFID: {
    group: 'UHF RFID Gate Ingest',
    help: 'Enable UHF RFID reader endpoints and background ingest services',
    example: 'true',
  },
  RFID_INGEST_V2: {
    group: 'UHF RFID Gate Ingest',
    help: 'Enable high-throughput batch ingest pipeline with transaction batching',
    example: 'true',
  },
  LEGACY_READER_BEARER_FALLBACK: {
    group: 'UHF RFID Gate Ingest',
    help: 'Allow transitional fallback for legacy reader bearer token authentication',
    example: 'false',
  },
  READER_TOKEN_PEPPER: {
    group: 'UHF RFID Gate Ingest',
    help: 'Server-side cryptographic pepper used when hashing reader bearer tokens at rest',
    secret: true,
  },
  RFID_CREDENTIAL_DIGEST_KEY: {
    group: 'UHF RFID Gate Ingest',
    help: 'HMAC secret key used to compute irreversible EPC badge credential digests',
    secret: true,
  },
  RFID_HMAC_SECRET: {
    group: 'UHF RFID Gate Ingest',
    help: 'Shared secret for verifying reader HTTP webhook HMAC-SHA256 signatures',
    secret: true,
  },
  RFID_HMAC_KEY_VERSION: {
    group: 'UHF RFID Gate Ingest',
    help: 'Key version identifier for active RFID HMAC secret',
    example: '1',
  },
  RFID_DUPLICATE_TAP_COOLDOWN_MS: {
    group: 'UHF RFID Gate Ingest',
    help: 'Debounce window in milliseconds to suppress rapid duplicate badge reads',
    example: '30000',
  },
  RFID_MAX_CLOCK_SKEW_MS: {
    group: 'UHF RFID Gate Ingest',
    help: 'Maximum tolerated clock skew in ms between reader and server timestamps',
    example: '30000',
  },
  RFID_MAX_OFFLINE_DURATION_HOURS: {
    group: 'UHF RFID Gate Ingest',
    help: 'Maximum tolerated reader offline operation buffer duration in hours',
    example: '24',
  },
  RFID_MAX_ROSTER_AGE_HOURS: {
    group: 'UHF RFID Gate Ingest',
    help: 'Maximum allowable age of local edge roster cache in hours',
    example: '4',
  },
  RFID_OFFLINE_QUEUE_CAPACITY: {
    group: 'UHF RFID Gate Ingest',
    help: 'Maximum capacity of offline scan event buffer queue',
    example: '10000',
  },
  RFID_OFFLINE_FAIL_MODE: {
    group: 'UHF RFID Gate Ingest',
    help: 'Queue full failure policy (OPEN or CLOSED)',
    example: 'CLOSED',
  },
  RFID_READER_SCAN_RATE_LIMIT: {
    group: 'UHF RFID Gate Ingest',
    help: 'Maximum scans per minute permitted from a single reader',
    example: '600',
  },
  RFID_CARD_MASTER_KEY: {
    group: 'UHF RFID Gate Ingest',
    help: 'Master key for reader credential signature verification',
    secret: true,
  },
  RFID_REQUIRE_CARD_PROOF: {
    group: 'UHF RFID Gate Ingest',
    help: 'Enforce cryptographic proof in incoming tag read events',
    example: 'false',
  },
  ALLOW_LEGACY_RFID_UID_MODE: {
    group: 'UHF RFID Gate Ingest',
    help: 'Allow legacy unhashed card UID mode (deprecated)',
    example: 'false',
  },
  RFID_GATEWAY_URL: {
    group: 'UHF RFID Gate Ingest',
    help: 'URL of internal hardware gateway relay if deployed',
    example: 'http://localhost:4000',
  },
  RFID_OUTBOX_ENCRYPTION_KEY: {
    group: 'UHF RFID Gate Ingest',
    help: 'Symmetric encryption key for local offline scan event store',
    secret: true,
  },
  RFID_READER_ID: {
    group: 'UHF RFID Gate Ingest',
    help: 'Default identifier assigned to local hardware reader',
    example: 'reader-gate-01',
  },
  SCHOOL_ID: {
    group: 'UHF RFID Gate Ingest',
    help: 'Default school UUID identifier for single-tenant appliance deployment',
    example: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
  },

  // KMS & Envelope Encryption
  KMS_MASTER_KEY: {
    group: 'KMS & Envelope Encryption',
    help: 'Master 256-bit encryption key used by local KMS provider',
    secret: true,
  },
  AWS_KMS_KEY_ARN: {
    group: 'KMS & Envelope Encryption',
    help: 'AWS KMS Key ARN for cloud-managed envelope encryption',
    example: 'arn:aws:kms:ap-south-1:123456789012:key/example-key',
  },
  GCP_KMS_RESOURCE_ID: {
    group: 'KMS & Envelope Encryption',
    help: 'Google Cloud KMS Key Resource ID for cloud-managed envelope encryption',
    example: 'projects/p/locations/l/keyRings/r/cryptoKeys/k',
  },

  // Telemetry & Alerting
  METRICS_AUTH_TOKEN: {
    group: 'Telemetry & Alerting',
    help: 'Bearer authentication token required to scrape Prometheus /metrics',
    secret: true,
  },
  ALERT_WEBHOOK_URL: {
    group: 'Telemetry & Alerting',
    help: 'HTTP webhook URL for dispatching urgent operational failure alerts',
    example: 'https://alerts.example.com/webhook',
  },

  // DLT SMS & Telecom Integration
  SMS_PROVIDER: {
    group: 'DLT SMS & Telecom Integration',
    help: 'Active SMS dispatch engine implementation (fake, console, dlt)',
    example: 'console',
  },
  ABSENCE_SMS_DELAY_MINUTES: {
    group: 'DLT SMS & Telecom Integration',
    help: 'Delay window in minutes before sending absence SMS notifications to prevent false alarms',
    example: '20',
  },
  SMS_WEBHOOK_SECRET: {
    group: 'DLT SMS & Telecom Integration',
    help: 'HMAC secret for verifying inbound carrier delivery receipts',
    secret: true,
  },
  SMS_GATEWAY_URL: {
    group: 'DLT SMS & Telecom Integration',
    help: 'HTTP endpoint of telecom SMS gateway provider',
    example: 'https://sms.example.com/send',
  },
  SMS_WORKER_INTERVAL_MS: {
    group: 'DLT SMS & Telecom Integration',
    help: 'Queue poll interval in milliseconds for background SMS worker',
    example: '5000',
  },
  SMS_WORKER_REPLICA_COUNT: {
    group: 'DLT SMS & Telecom Integration',
    help: 'Number of SMS background worker processes running',
    example: '2',
  },
  DLT_SMS_API_KEY: {
    group: 'DLT SMS & Telecom Integration',
    help: 'API authorization key for Indian Telecom DLT gateway provider',
    secret: true,
  },
  DLT_SMS_SENDER_ID: {
    group: 'DLT SMS & Telecom Integration',
    help: 'Approved 6-character TRAI DLT Header / Sender ID',
    example: 'SCHATT',
  },
  DLT_SMS_ENTITY_ID: {
    group: 'DLT SMS & Telecom Integration',
    help: 'Registered Principal Entity ID on TRAI DLT portal',
    example: '1201159000000000000',
  },
  DLT_SMS_BASE_URL: {
    group: 'DLT SMS & Telecom Integration',
    help: 'Base API URL for TRAI DLT telecom messaging gateway',
    example: 'https://api.sms-provider.in/v1',
  },
  DLT_SMS_HEADER: {
    group: 'DLT SMS & Telecom Integration',
    help: 'Custom header required by DLT SMS provider',
    example: 'X-DLT-Header',
  },
  DLT_WEBHOOK_SECRET: {
    group: 'DLT SMS & Telecom Integration',
    help: 'Secret key for verifying DLT delivery status callback webhooks',
    secret: true,
  },
  DLT_PRINCIPAL_ENTITY_ID: {
    group: 'DLT SMS & Telecom Integration',
    help: 'Principal entity ID alias for secondary DLT configuration',
    example: '1201159000000000000',
  },
  DLT_SMS_GATEWAY_URL: {
    group: 'DLT SMS & Telecom Integration',
    help: 'Direct API URL for DLT message dispatch endpoint',
    example: 'https://api.sms-provider.in/v1/send',
  },
  DLT_SMS_WEBHOOK_SECRET: {
    group: 'DLT SMS & Telecom Integration',
    help: 'Direct webhook signature secret for DLT callbacks',
    secret: true,
  },

  // Backups & Disaster Recovery
  BACKUP_DIR: {
    group: 'Backups & Disaster Recovery',
    help: 'Local filesystem directory path for encrypted database backups',
    example: '/var/backups/attendease',
  },
  BACKUP_ENCRYPTION_KEY: {
    group: 'Backups & Disaster Recovery',
    help: 'Age recipient public key or passphrase for database backup encryption',
    secret: true,
  },
  LATEST_BACKUP_TIMESTAMP: {
    group: 'Backups & Disaster Recovery',
    help: 'Timestamp of latest verified successful backup drill',
    example: '2026-10-06T00:00:00Z',
  },
  WORKER_HEARTBEAT_FILE: {
    group: 'Backups & Disaster Recovery',
    help: 'Filesystem path touched periodically by workers for liveness checks',
    example: '/tmp/worker-heartbeat',
  },
  R2_ACCOUNT_ID: {
    group: 'Backups & Disaster Recovery',
    help: 'Cloudflare Account ID for offsite R2 replication storage',
    example: 'cf-account-id',
  },
  R2_ACCESS_KEY_ID: {
    group: 'Backups & Disaster Recovery',
    help: 'Cloudflare R2 S3-compatible Access Key ID',
    example: 'r2-access-key-id',
  },
  R2_SECRET_ACCESS_KEY: {
    group: 'Backups & Disaster Recovery',
    help: 'Cloudflare R2 S3-compatible Secret Access Key',
    secret: true,
  },
  R2_BUCKET: {
    group: 'Backups & Disaster Recovery',
    help: 'Cloudflare R2 bucket name for encrypted backup archives',
    example: 'attendease-backups',
  },
  R2_ENDPOINT: {
    group: 'Backups & Disaster Recovery',
    help: 'S3-compatible endpoint URL for Cloudflare R2 bucket',
    example: 'https://<account-id>.r2.cloudflarestorage.com',
  },
  R2_PREFIX: {
    group: 'Backups & Disaster Recovery',
    help: 'Key prefix / folder within Cloudflare R2 bucket',
    example: 'backups/school-01',
  },
  R2_JURISDICTION: {
    group: 'Backups & Disaster Recovery',
    help: 'Cloudflare R2 data storage jurisdiction (e.g., in, eu)',
    example: 'in',
  },
  R2_RETENTION_DAYS: {
    group: 'Backups & Disaster Recovery',
    help: 'Days to retain backup archives in Cloudflare R2 storage',
    example: '90',
  },
  R2_UPLOAD_TIMEOUT_SECONDS: {
    group: 'Backups & Disaster Recovery',
    help: 'Timeout in seconds for R2 backup archive upload operations',
    example: '300',
  },
  R2_MAX_RETRIES: {
    group: 'Backups & Disaster Recovery',
    help: 'Maximum retry attempts for failed R2 backup uploads',
    example: '3',
  },

  // Reporting Engine
  REPORT_ARTIFACT_MAX_BYTES: {
    group: 'Reporting Engine',
    help: 'Maximum byte size allowed for a generated report file',
    example: '52428800',
  },
  REPORT_ARTIFACT_STORAGE: {
    group: 'Reporting Engine',
    help: 'Storage backend for report files (local or object)',
    example: 'local',
  },
  REPORT_ARTIFACT_DIR: {
    group: 'Reporting Engine',
    help: 'Directory path for storing generated report files',
    example: '/var/data/reports',
  },
  REPORT_GENERATION_CONCURRENCY: {
    group: 'Reporting Engine',
    help: 'Maximum concurrent background report generation tasks',
    example: '2',
  },
  REPORT_GENERATION_MAX_PENDING: {
    group: 'Reporting Engine',
    help: 'Maximum pending report requests allowed in queue',
    example: '10',
  },
  REPORT_MAX_ESTIMATED_CELLS: {
    group: 'Reporting Engine',
    help: 'Upper threshold of spreadsheet cells to avoid memory exhaustion',
    example: '1000000',
  },
  REPORT_MAX_PERIOD_DAYS: {
    group: 'Reporting Engine',
    help: 'Maximum date span in days for a single attendance report',
    example: '365',
  },
  REPORT_MAX_STUDENTS: {
    group: 'Reporting Engine',
    help: 'Maximum student count processed in a single report generation task',
    example: '5000',
  },

  // Testing & Development Runtime
  CI: {
    group: 'Testing & Development Runtime',
    help: 'Flag indicating execution inside automated continuous integration environment',
    example: 'true',
  },
  TEST_SERVER_STATIC: {
    group: 'Testing & Development Runtime',
    help: 'Serve built static frontend bundle in test environment',
    example: 'true',
  },
  RUN_SERVER: {
    group: 'Testing & Development Runtime',
    help: 'Start HTTP server listener automatically upon module execution',
    example: 'true',
  },
  VITEST: {
    group: 'Testing & Development Runtime',
    help: 'Flag indicating execution within the Vitest test runner',
    example: 'true',
  },
};
