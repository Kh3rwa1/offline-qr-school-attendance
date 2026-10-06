import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const secret = (name: string) => z.string().min(32, `${name} must be at least 32 characters`);
const isProd = process.env.NODE_ENV === 'production';

export const Schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    COMPONENT: z.enum(['web', 'worker', 'migrate']).default('web'),
    PORT: z.coerce.number().int().default(3000),
    DATABASE_URL: z.string().url().optional(),
    SYSTEM_DATABASE_URL: z.string().url().optional(),
    AUTH_DATABASE_URL: z.string().optional(),
    REDIS_URL: z.string().url().optional(),
    REDIS_HOST: z.string().optional(),
    REDIS_PORT: z.coerce.number().int().optional(),
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
    GATEWAY_STORAGE_KEY: z.string().optional(),
    RFID_OUTBOX_ENCRYPTION_KEY: z.string().optional(),
    PCSCD_SOCKET_PATH: z.string().optional(),
    SCHOOL_ID: z.string().optional(),
    RFID_READER_ID: z.string().optional(),
    GATEWAY_PORT: z.string().default('4000'),
    USE_SIMULATOR: z.string().optional(),
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

  })
  .passthrough()
  .superRefine((e, ctx) => {
    if (e.NODE_ENV === 'production') {
      if (!e.DATABASE_URL || /replace[-_]with/.test(e.DATABASE_URL)) {
        ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'Required in production' });
      }
      if (e.COMPONENT === 'web') {
        if (!e.SESSION_SECRET || e.SESSION_SECRET.length < 32) {
          ctx.addIssue({
            code: 'custom',
            path: ['SESSION_SECRET'],
            message: 'SESSION_SECRET must be at least 32 characters in production',
          });
        }
        if (e.READER_TOKEN_PEPPER && e.READER_TOKEN_PEPPER.length < 32) {
          ctx.addIssue({
            code: 'custom',
            path: ['READER_TOKEN_PEPPER'],
            message: 'READER_TOKEN_PEPPER must be at least 32 characters in production',
          });
        }
        if (e.RFID_CREDENTIAL_DIGEST_KEY && e.RFID_CREDENTIAL_DIGEST_KEY.length < 32) {
          ctx.addIssue({
            code: 'custom',
            path: ['RFID_CREDENTIAL_DIGEST_KEY'],
            message: 'RFID_CREDENTIAL_DIGEST_KEY must be at least 32 characters in production',
          });
        }
        if (e.FEATURE_RFID === 'true') {
          if (!e.READER_TOKEN_PEPPER || e.READER_TOKEN_PEPPER.length < 32) {
            ctx.addIssue({
              code: 'custom',
              path: ['READER_TOKEN_PEPPER'],
              message: 'READER_TOKEN_PEPPER must be at least 32 characters in production when FEATURE_RFID is true',
            });
          }
          if (!e.RFID_CREDENTIAL_DIGEST_KEY || e.RFID_CREDENTIAL_DIGEST_KEY.length < 32) {
            ctx.addIssue({
              code: 'custom',
              path: ['RFID_CREDENTIAL_DIGEST_KEY'],
              message: 'RFID_CREDENTIAL_DIGEST_KEY must be at least 32 characters in production when FEATURE_RFID is true',
            });
          }
        }
      }
      if (e.SYSTEM_DATABASE_URL && e.SYSTEM_DATABASE_URL === e.DATABASE_URL) {
        ctx.addIssue({
          code: 'custom',
          path: ['SYSTEM_DATABASE_URL'],
          message: 'Must use a separate role from DATABASE_URL (RLS bypass role isolation)',
        });
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
