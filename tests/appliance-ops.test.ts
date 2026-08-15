import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { reconcileStuckSessions } from '../src/services/sessionReconciler';
import { db } from '../src/db';
import { schools, users, classSections, attendanceSessions, academicYears } from '../src/db/schema';
import { eq } from 'drizzle-orm';

describe('Appliance Operations & Autonomous Infrastructure', () => {
  const testEnvPath = path.resolve(process.cwd(), '.env.test_appliance');
  const testBackupDir = path.resolve(process.cwd(), '.test_backups');

  beforeEach(() => {
    if (fs.existsSync(testEnvPath)) fs.unlinkSync(testEnvPath);
    if (fs.existsSync(testBackupDir)) fs.rmSync(testBackupDir, { recursive: true, force: true });
    fs.mkdirSync(testBackupDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testEnvPath)) fs.unlinkSync(testEnvPath);
    if (fs.existsSync(testBackupDir)) fs.rmSync(testBackupDir, { recursive: true, force: true });
  });

  describe('1. First-Boot Secret Generation (scripts/generate-secrets.sh)', () => {
    it('populates empty and placeholder secrets with >= 32 byte url-safe keys', () => {
      fs.writeFileSync(
        testEnvPath,
        `NODE_ENV="production"
PORT="3000"
SESSION_SECRET=""
CSRF_SECRET="replace-with-a-random-32-byte-csrf-secret-012345678"
REDIS_KEY_HMAC_SECRET="replace-with-a-random-32-byte-redis-hmac-secret-012345678"
METRICS_AUTH_TOKEN="replace-with-a-random-32-byte-metrics-auth-token-012345678"
RFID_HMAC_SECRET="replace-with-a-random-32-byte-rfid-hmac-secret-012345678"
RFID_CARD_MASTER_KEY="replace-with-a-random-32-byte-rfid-card-master-key-012345678"
KMS_MASTER_KEY="replace-with-a-random-32-byte-kms-master-key-012345678"
BACKUP_ENCRYPTION_KEY="replace-with-a-random-32-byte-backup-encryption-key-012345678"
MIGRATION_DB_PASSWORD="replace-with-a-random-migration-password"
APP_DB_PASSWORD="replace-with-a-random-application-password"
SYSTEM_DB_PASSWORD="replace-with-a-random-system-password"
AUTH_DB_PASSWORD="replace-with-a-random-auth-password"
`
      );

      execSync(`bash scripts/generate-secrets.sh "${testEnvPath}"`);

      const content = fs.readFileSync(testEnvPath, 'utf8');
      expect(content).not.toContain('replace-with-');

      const lines = content.split('\n');
      const getVal = (k: string) => {
        const line = lines.find((l) => l.startsWith(`${k}=`));
        return line ? line.split('=')[1].replace(/^["']|["']$/g, '') : '';
      };

      expect(getVal('SESSION_SECRET').length).toBeGreaterThanOrEqual(32);
      expect(getVal('CSRF_SECRET').length).toBeGreaterThanOrEqual(32);
      expect(getVal('REDIS_KEY_HMAC_SECRET').length).toBeGreaterThanOrEqual(32);
      expect(getVal('BACKUP_ENCRYPTION_KEY').length).toBeGreaterThanOrEqual(32);
      expect(getVal('MIGRATION_DB_PASSWORD').length).toBeGreaterThanOrEqual(32);
      expect(getVal('DATABASE_URL')).toContain(getVal('APP_DB_PASSWORD'));
    });

    it('preserves existing non-placeholder secrets', () => {
      const existingSecret = 'custom-pre-existing-secret-12345678901234567890';
      fs.writeFileSync(
        testEnvPath,
        `NODE_ENV="production"
SESSION_SECRET="${existingSecret}"
CSRF_SECRET=""
`
      );

      execSync(`bash scripts/generate-secrets.sh "${testEnvPath}"`);

      const content = fs.readFileSync(testEnvPath, 'utf8');
      expect(content).toContain(existingSecret);
    });
  });

  describe('2. Backup Encryption & Disaster Recovery Restoration Drill', () => {
    it('encrypts a test payload with AES-256 PBKDF2 and decrypts accurately', () => {
      const pass = 'super-secure-appliance-passphrase-32-chars-long';
      const rawPayload = 'SELECT * FROM schools WHERE status = \'ACTIVE\';';
      const plainFile = path.join(testBackupDir, 'test.sql');
      const encFile = path.join(testBackupDir, 'test.sql.gz.enc');
      const restoredFile = path.join(testBackupDir, 'restored.sql');

      fs.writeFileSync(plainFile, rawPayload);

      // Encrypt
      execSync(`gzip -c "${plainFile}" | openssl enc -aes-256-cbc -pbkdf2 -pass pass:"${pass}" > "${encFile}"`);
      expect(fs.existsSync(encFile)).toBe(true);

      // Decrypt
      execSync(`openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${pass}" -in "${encFile}" | gunzip -c > "${restoredFile}"`);
      expect(fs.readFileSync(restoredFile, 'utf8')).toBe(rawPayload);
    });
  });

  describe('3. Autonomous Session Reconciler', () => {
    it('executes safely without errors', async () => {
      const result = await reconcileStuckSessions(0);
      expect(result).toHaveProperty('checkedAt');
      expect(typeof result.reconciledCount).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });
});
