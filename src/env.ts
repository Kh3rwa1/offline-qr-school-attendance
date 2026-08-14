import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  COMPONENT: z.enum(['web', 'worker', 'migrate']).default('web'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().optional(),
  SYSTEM_DATABASE_URL: z.string().optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  CSRF_SECRET: z.string().min(32).optional(),
  ALLOW_TEST_BYPASS: z.string().default('false'),
  APP_URL: z.string().optional(),
  
  KMS_MASTER_KEY: z.string().optional(),
  AUTH_DATABASE_URL: z.string().optional(),
  RFID_CARD_MASTER_KEY: z.string().optional(),
  RFID_REQUIRE_CARD_PROOF: z.string().default('true'),
  // RFID Configuration
  ALLOW_LEGACY_RFID_UID_MODE: z.string().default('false'),
  RFID_HMAC_SECRET: z.string().optional(),
  RFID_HMAC_KEY_VERSION: z.string().default('1'),
  RFID_DUPLICATE_TAP_COOLDOWN_MS: z.string().default('30000'),
  RFID_MAX_CLOCK_SKEW_MS: z.string().default('30000'),
  RFID_MAX_OFFLINE_DURATION_HOURS: z.string().default('24'),
  RFID_MAX_ROSTER_AGE_HOURS: z.string().default('4'),
  RFID_OFFLINE_QUEUE_CAPACITY: z.string().default('10000'),
  RFID_OFFLINE_FAIL_MODE: z.string().default('CLOSED'),
  RFID_READER_SCAN_RATE_LIMIT: z.string().default('120'),
  RFID_GATEWAY_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

const parsedEnv = envSchema.parse(process.env);
if (parsedEnv.NODE_ENV === 'production' && parsedEnv.COMPONENT === 'web' && !parsedEnv.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be provided in production');
}

export function validateProductionEnv() {
  const parsed = envSchema.parse(process.env);
  if (parsed.NODE_ENV === 'production') {
    if (process.env.ALLOW_TEST_BYPASS === 'true') {
      throw new Error('FATAL_SECURITY_CONFIGURATION: ALLOW_TEST_BYPASS is strictly prohibited in production mode');
    }
    if (!parsed.SESSION_SECRET || parsed.SESSION_SECRET.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters in production mode');
    }
    if (parsed.COMPONENT === 'web') {
      const csrfSecret = process.env.CSRF_SECRET || parsed.SESSION_SECRET;
      if (!csrfSecret || csrfSecret.length < 32) {
        throw new Error('CSRF_SECRET (or SESSION_SECRET of at least 32 characters) must be provided in production mode');
      }
      const hmacSecret = process.env.REDIS_KEY_HMAC_SECRET;
      if (!hmacSecret || hmacSecret.length < 32) {
        throw new Error('REDIS_KEY_HMAC_SECRET must be at least 32 characters in production mode');
      }
      const rfidHmacSecret = process.env.RFID_HMAC_SECRET;
      if (!rfidHmacSecret || rfidHmacSecret.length < 32) {
        throw new Error('RFID_HMAC_SECRET must be at least 32 characters in production mode');
      }
      const rfidCardMasterKey = process.env.RFID_CARD_MASTER_KEY;
      if (!rfidCardMasterKey || rfidCardMasterKey.length < 32) {
        throw new Error('RFID_CARD_MASTER_KEY must be at least 32 characters in production mode for DESFire card proof validation');
      }

      // KMS configuration: require explicit key management in production
      const kmsMasterKey = process.env.KMS_MASTER_KEY;
      const awsKmsArn = process.env.AWS_KMS_KEY_ARN;
      const gcpKmsId = process.env.GCP_KMS_RESOURCE_ID;
      if (!kmsMasterKey && !awsKmsArn && !gcpKmsId) {
        throw new Error('FATAL_KMS_CONFIGURATION: Production mode requires explicit key management. Set KMS_MASTER_KEY, AWS_KMS_KEY_ARN, or GCP_KMS_RESOURCE_ID.');
      }

      // Auth database isolation: require dedicated auth database in production
      const authDbUrl = process.env.AUTH_DATABASE_URL;
      if (!authDbUrl) {
        throw new Error('AUTH_DATABASE_URL is required in production for role-separated authentication.');
      }
      try {
        const parsedAuthUrl = new URL(authDbUrl);
        if (parsedAuthUrl.protocol !== 'postgres:' && parsedAuthUrl.protocol !== 'postgresql:') {
          throw new Error('AUTH_DATABASE_URL must be a valid postgres:// or postgresql:// URL.');
        }
      } catch (err: any) {
        throw new Error(`FATAL_AUTH_DATABASE_URL_MALFORMED: Production mode requires a valid PostgreSQL URL for AUTH_DATABASE_URL: ${err.message}`);
      }
    }
  }
  return parsed;
}

if (parsedEnv.NODE_ENV === 'production' && parsedEnv.COMPONENT === 'web') {
  validateProductionEnv();
}

export const env = parsedEnv;
