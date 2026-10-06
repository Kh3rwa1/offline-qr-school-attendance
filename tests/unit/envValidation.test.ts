import { describe, it, expect } from 'vitest';
import { Schema, validateProductionEnv } from '../../src/env';

describe('Environment Configuration Validation (Step 3.7)', () => {
  it('parses valid development configuration with correct defaults and transforms', () => {
    const devConfig = {
      NODE_ENV: 'development',
      PORT: '3000',
      RFID_INGEST_V2: 'false',
      LEGACY_READER_BEARER_FALLBACK: 'true',
    };

    const parsed = Schema.safeParse(devConfig);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.NODE_ENV).toBe('development');
    expect(parsed.data.PORT).toBe(3000);
    expect(parsed.data.RFID_INGEST_V2).toBe(false);
    expect(parsed.data.LEGACY_READER_BEARER_FALLBACK).toBe(true);
    expect(parsed.data.SHUTDOWN_DRAIN_MS).toBe(20_000);
  });

  it('enforces DATABASE_URL required in production', () => {
    const prodConfig = {
      NODE_ENV: 'production',
      SESSION_SECRET: 'a'.repeat(32),
      READER_TOKEN_PEPPER: 'a'.repeat(32),
      RFID_CREDENTIAL_DIGEST_KEY: 'a'.repeat(32),
    };

    const parsed = Schema.safeParse(prodConfig);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const issue = parsed.error.issues.find((i) => i.path.includes('DATABASE_URL'));
    expect(issue).toBeDefined();
    expect(issue?.message).toContain('Required in production');
  });

  it('rejects placeholder DATABASE_URL in production', () => {
    const prodConfig = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://user:replace-with-password@localhost:5432/db',
      SESSION_SECRET: 'a'.repeat(32),
      READER_TOKEN_PEPPER: 'a'.repeat(32),
      RFID_CREDENTIAL_DIGEST_KEY: 'a'.repeat(32),
    };

    const parsed = Schema.safeParse(prodConfig);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const issue = parsed.error.issues.find((i) => i.path.includes('DATABASE_URL'));
    expect(issue).toBeDefined();
    expect(issue?.message).toContain('Required in production');
  });

  it('enforces role separation between SYSTEM_DATABASE_URL and DATABASE_URL in production', () => {
    const sharedUrl = 'postgres://attendease_app:password123@localhost:5432/attendease';
    const prodConfig = {
      NODE_ENV: 'production',
      DATABASE_URL: sharedUrl,
      SYSTEM_DATABASE_URL: sharedUrl,
      SESSION_SECRET: 'a'.repeat(32),
      READER_TOKEN_PEPPER: 'a'.repeat(32),
      RFID_CREDENTIAL_DIGEST_KEY: 'a'.repeat(32),
    };

    const parsed = Schema.safeParse(prodConfig);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const issue = parsed.error.issues.find((i) => i.path.includes('SYSTEM_DATABASE_URL'));
    expect(issue).toBeDefined();
    expect(issue?.message).toContain('Must use a separate role from DATABASE_URL');
  });

  it('accepts production configuration with distinct database roles and valid secrets', () => {
    const prodConfig = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://attendease_app:password123@localhost:5432/attendease',
      SYSTEM_DATABASE_URL: 'postgres://attendease_system:password456@localhost:5432/attendease',
      SESSION_SECRET: 'a'.repeat(32),
      READER_TOKEN_PEPPER: 'a'.repeat(32),
      RFID_CREDENTIAL_DIGEST_KEY: 'a'.repeat(32),
      SHUTDOWN_DRAIN_MS: '15000',
    };

    const parsed = Schema.safeParse(prodConfig);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.SHUTDOWN_DRAIN_MS).toBe(15_000);
  });

  it('validateProductionEnv throws when required production settings are invalid', () => {
    const oldEnv = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_TEST_BYPASS = 'true';
      expect(() => validateProductionEnv()).toThrow('ALLOW_TEST_BYPASS is strictly prohibited in production mode');
    } finally {
      process.env = oldEnv;
    }
  });

  it('allows COMPONENT=migrate in production with only DATABASE_URL without web secrets', () => {
    const migrateConfig = {
      NODE_ENV: 'production',
      COMPONENT: 'migrate',
      DATABASE_URL: 'postgres://migration_user:password123@localhost:5432/attendease',
    };

    const parsed = Schema.safeParse(migrateConfig);
    expect(parsed.success).toBe(true);
  });

  it('enforces READER_TOKEN_PEPPER and RFID_CREDENTIAL_DIGEST_KEY in production when COMPONENT=web and FEATURE_RFID=true', () => {
    const prodConfigMissingRfid = {
      NODE_ENV: 'production',
      COMPONENT: 'web',
      FEATURE_RFID: 'true',
      DATABASE_URL: 'postgres://attendease_app:password123@localhost:5432/attendease',
      SESSION_SECRET: 'a'.repeat(32),
    };

    const parsed = Schema.safeParse(prodConfigMissingRfid);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const pepperIssue = parsed.error.issues.find((i) => i.path.includes('READER_TOKEN_PEPPER'));
    const digestIssue = parsed.error.issues.find((i) => i.path.includes('RFID_CREDENTIAL_DIGEST_KEY'));
    expect(pepperIssue).toBeDefined();
    expect(digestIssue).toBeDefined();
  });

  it('handles Kubernetes injected tcp:// service URLs in REDIS_PORT', () => {
    const k8sConfig = {
      REDIS_PORT: 'tcp://10.96.166.39:6379',
    };
    const parsed = Schema.safeParse(k8sConfig);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.REDIS_PORT).toBe(6379);
  });

  it('throws when AUTH_DATABASE_URL is malformed in production env validation', () => {
    const oldEnv = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      process.env.COMPONENT = 'web';
      process.env.SESSION_SECRET = 'a'.repeat(32);
      process.env.CSRF_SECRET = 'a'.repeat(32);
      process.env.REDIS_KEY_HMAC_SECRET = 'a'.repeat(32);
      process.env.METRICS_AUTH_TOKEN = 'a'.repeat(32);
      process.env.SMS_PROVIDER = 'console';
      process.env.RFID_HMAC_SECRET = 'a'.repeat(32);
      process.env.RFID_CARD_MASTER_KEY = 'a'.repeat(32);
      process.env.KMS_MASTER_KEY = 'a'.repeat(32);
      process.env.BACKUP_ENCRYPTION_KEY = 'a'.repeat(32);
      process.env.MIGRATION_DB_PASSWORD = 'a'.repeat(32);
      process.env.APP_DB_PASSWORD = 'a'.repeat(32);
      process.env.SYSTEM_DB_PASSWORD = 'a'.repeat(32);
      process.env.AUTH_DB_PASSWORD = 'a'.repeat(32);
      process.env.AUTH_DATABASE_URL = 'invalid-malformed-database-url';

      expect(() => validateProductionEnv()).toThrow('FATAL_AUTH_DATABASE_URL_MALFORMED');
    } finally {
      process.env = oldEnv;
    }
  });

  it('throws in production mode when auth database pool is unavailable instead of falling back', async () => {
    const { lookupAuthUserByPhone, getUserSchoolMemberships } = await import('../../src/db/authFunctions');
    const oldEnv = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      process.env.AUTH_DATABASE_URL = '';

      await expect(lookupAuthUserByPhone('9999999999')).rejects.toThrow('FATAL_AUTH_DATABASE_CONFIG');
      await expect(getUserSchoolMemberships('00000000-0000-4000-8000-000000000001')).rejects.toThrow('FATAL_AUTH_DATABASE_CONFIG');
    } finally {
      process.env = oldEnv;
    }
  });
});
