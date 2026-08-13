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
  APP_URL: z.string().optional(),
  
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
  if (parsed.NODE_ENV === 'production' && parsed.COMPONENT === 'web') {
    if (!parsed.SESSION_SECRET || parsed.SESSION_SECRET.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters in production mode');
    }
    const hmacSecret = process.env.REDIS_KEY_HMAC_SECRET;
    if (!hmacSecret || hmacSecret.length < 32) {
      throw new Error('REDIS_KEY_HMAC_SECRET must be at least 32 characters in production mode');
    }
    const rfidHmacSecret = process.env.RFID_HMAC_SECRET;
    if (!rfidHmacSecret || rfidHmacSecret.length < 32) {
      throw new Error('RFID_HMAC_SECRET must be at least 32 characters in production mode');
    }
  }
  return parsed;
}

if (parsedEnv.NODE_ENV === 'production' && parsedEnv.COMPONENT === 'web') {
  validateProductionEnv();
}

export const env = parsedEnv;
