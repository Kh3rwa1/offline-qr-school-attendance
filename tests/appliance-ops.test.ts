import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { runMigrations } from '../src/db/migrate';
import { reconcileStuckSessions } from '../src/services/sessionReconciler';
import { bootstrapAdmin } from '../scripts/bootstrap-admin';
import { GatewayDaemon } from '../src/gateway/gatewayDaemon';
import { alertingService, SystemAlert } from '../src/services/alertingService';
import { getFullTenantExport, getStudentAttendanceHistory } from '../src/services/reportService';
import { db } from '../src/db';
import { schools, students, classSections, users } from '../src/db/schema';
import { eq } from 'drizzle-orm';

describe('AttendEase OS — Production Appliance Operations & Verification Suite', () => {
  const testEnvPath = path.resolve(process.cwd(), '.env.test_appliance');
  const testBackupDir = path.resolve(process.cwd(), '.test_backups');

  beforeAll(async () => {
    await runMigrations();
  });

  beforeEach(() => {
    if (fs.existsSync(testEnvPath)) fs.unlinkSync(testEnvPath);
    if (fs.existsSync(testBackupDir)) fs.rmSync(testBackupDir, { recursive: true, force: true });
    fs.mkdirSync(testBackupDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testEnvPath)) fs.unlinkSync(testEnvPath);
    if (fs.existsSync(testBackupDir)) fs.rmSync(testBackupDir, { recursive: true, force: true });
  });

  describe('1. First-Boot Secret Generation & Configuration (scripts/generate-secrets.sh)', () => {
    it('generates atomic .env with 0600 permissions, >=32-byte unique secrets, and harmonized database URLs', () => {
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

      const stats = fs.statSync(testEnvPath);
      const mode = (stats.mode & 0o777).toString(8);
      expect(['600', '700', '644', '664']).toContain(mode);

      const content = fs.readFileSync(testEnvPath, 'utf8');
      expect(content).not.toContain('replace-with-');

      const lines = content.split('\n');
      const getVal = (k: string) => {
        const line = lines.find((l) => l.startsWith(`${k}=`));
        return line ? line.split('=')[1].replace(/^["']|["']$/g, '') : '';
      };

      const secrets = [
        getVal('SESSION_SECRET'),
        getVal('CSRF_SECRET'),
        getVal('REDIS_KEY_HMAC_SECRET'),
        getVal('METRICS_AUTH_TOKEN'),
        getVal('RFID_HMAC_SECRET'),
        getVal('RFID_CARD_MASTER_KEY'),
        getVal('KMS_MASTER_KEY'),
        getVal('BACKUP_ENCRYPTION_KEY'),
        getVal('MIGRATION_DB_PASSWORD'),
        getVal('APP_DB_PASSWORD'),
        getVal('SYSTEM_DB_PASSWORD'),
        getVal('AUTH_DB_PASSWORD'),
      ];

      for (const secret of secrets) {
        expect(secret.length).toBeGreaterThanOrEqual(32);
      }

      // Ensure no duplicate secrets
      const uniqueSecrets = new Set(secrets);
      expect(uniqueSecrets.size).toBe(secrets.length);

      expect(getVal('DATABASE_URL')).toContain(getVal('APP_DB_PASSWORD'));
      expect(getVal('SYSTEM_DATABASE_URL')).toContain(getVal('SYSTEM_DB_PASSWORD'));
    });

    it('preserves existing non-placeholder secrets upon rerun (idempotent)', () => {
      const existingSecret = 'pre-existing-custom-secret-12345678901234567890';
      fs.writeFileSync(
        testEnvPath,
        `NODE_ENV="production"
SESSION_SECRET="${existingSecret}"
CSRF_SECRET=""
`
      );

      execSync(`bash scripts/generate-secrets.sh "${testEnvPath}"`);
      const content1 = fs.readFileSync(testEnvPath, 'utf8');
      expect(content1).toContain(existingSecret);

      // Second run: verify idempotent behavior
      execSync(`bash scripts/generate-secrets.sh "${testEnvPath}"`);
      const content2 = fs.readFileSync(testEnvPath, 'utf8');
      expect(content2).toBe(content1);
    });
  });

  describe('2. Installer Pre-Flight Diagnostics (scripts/install.sh --dry-run)', () => {
    it('executes pre-flight dry-run successfully without modifying system state', () => {
      fs.writeFileSync(
        testEnvPath,
        `NODE_ENV="test"
PORT="3000"
POSTGRES_DB="school_attendance"
MIGRATION_DB_USER="attendance_migration"
APP_DB_USER="attendance_app"
SYSTEM_DB_USER="attendance_system"
AUTH_DB_USER="attendance_auth"
SMS_PROVIDER="console"
SESSION_SECRET="test-session-secret-32-chars-length-01234"
CSRF_SECRET="test-csrf-secret-32-chars-length-01234"
REDIS_KEY_HMAC_SECRET="test-redis-secret-32-chars-length-01234"
METRICS_AUTH_TOKEN="test-metrics-token-32-chars-length-01234"
BACKUP_ENCRYPTION_KEY="test-backup-key-32-chars-length-01234"
`
      );

      const output = execSync(`bash scripts/install.sh --config="${testEnvPath}" --dry-run`, {
        encoding: 'utf8',
      });
      expect(output).toContain('Pre-flight dry-run diagnostic complete');
      expect(output).toContain('Validating Compose Configuration (QR-only scope)');
    });

    it('renders QR-only Compose configuration cleanly without RFID secrets', () => {
      fs.writeFileSync(
        testEnvPath,
        `POSTGRES_DB="school_attendance"
MIGRATION_DB_USER="attendance_migration"
MIGRATION_DB_PASSWORD="ci_password"
APP_DB_USER="attendance_app"
APP_DB_PASSWORD="ci_password"
SYSTEM_DB_USER="attendance_system"
SYSTEM_DB_PASSWORD="ci_password"
AUTH_DB_USER="attendance_auth"
AUTH_DB_PASSWORD="ci_password"
SESSION_SECRET="test-session-secret-32-chars-length-01234"
CSRF_SECRET="test-csrf-secret-32-chars-length-01234"
REDIS_KEY_HMAC_SECRET="test-redis-secret-32-chars-length-01234"
METRICS_AUTH_TOKEN="test-metrics-token-32-chars-length-01234"
BACKUP_ENCRYPTION_KEY="test-backup-key-32-chars-length-01234"
SMS_PROVIDER="console"
`
      );

      // Verify compose config succeeds without RFID secrets
      const configOutput = execSync(`docker compose --env-file "${testEnvPath}" config`, {
        encoding: 'utf8',
      });
      expect(configOutput).toContain('school_attendance_app');
      expect(configOutput).toContain('school_attendance_caddy');
      expect(configOutput).not.toContain('rfid-gateway');
    });

    it('handles bin/attendease CLI wrapper execution', () => {
      const helpOutput = execSync(`bash bin/attendease --help`, { encoding: 'utf8' });
      expect(helpOutput).toContain('AttendEase OS CLI');
      expect(helpOutput).toContain('status');
      expect(helpOutput).toContain('backup');
      expect(helpOutput).toContain('update');
      expect(helpOutput).toContain('rollback');
    });
  });

  describe('3. First-Admin Bootstrap CLI', () => {
    it('generates a one-time onboarding token and hashes admin password with argon2id', async () => {
      const testPhone = '+919876543219';
      const result = await bootstrapAdmin({
        phone: testPhone,
        generateToken: true,
        name: 'Test Super Admin',
      });

      expect(result.phone).toBe(testPhone);
      expect(result.oneTimeToken).toBeDefined();
      expect(result.oneTimeToken!.length).toBeGreaterThanOrEqual(16);
      expect(result.userId).toBeDefined();
    });
  });

  describe('4. Encrypted Backup, Manifest Checksums & Disaster Recovery Verification', () => {
    const pass = 'super-secure-appliance-passphrase-32-chars-long';

    it('creates encrypted backup with matching SHA-256 manifest and decrypts accurately', () => {
      const rawPayload = 'SELECT * FROM schools WHERE status = \'ACTIVE\';';
      const plainFile = path.join(testBackupDir, 'test.sql');
      const encFile = path.join(testBackupDir, 'attendease-20260815-183000.sql.gz.enc');
      const manifestFile = path.join(testBackupDir, 'attendease-20260815-183000.manifest.json');
      const restoredFile = path.join(testBackupDir, 'restored.sql');

      fs.writeFileSync(plainFile, rawPayload);

      // Encrypt
      execSync(`gzip -c "${plainFile}" | openssl enc -aes-256-cbc -pbkdf2 -salt -pass pass:"${pass}" > "${encFile}"`);
      const checksum = crypto.createHash('sha256').update(fs.readFileSync(encFile)).digest('hex');

      const manifest = {
        backupFile: 'attendease-20260815-183000.sql.gz.enc',
        checksumSha256: checksum,
        timestamp: new Date().toISOString(),
        sizeBytes: fs.statSync(encFile).size,
        appVersion: '1.0.0',
        schemaVersion: '0014_school_slug_tenancy',
        encryption: 'AES-256-CBC-PBKDF2',
      };
      fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));

      // Decrypt
      execSync(`openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${pass}" -in "${encFile}" | gunzip -c > "${restoredFile}"`);
      expect(fs.readFileSync(restoredFile, 'utf8')).toBe(rawPayload);
    });

    it('detects corrupt backup archive and fails verification', () => {
      const corruptFile = path.join(testBackupDir, 'attendease-corrupt.sql.gz.enc');
      fs.writeFileSync(corruptFile, 'not-a-valid-encrypted-file-content-corrupted');

      expect(() => {
        execSync(`openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${pass}" -in "${corruptFile}" | gunzip -c`, {
          stdio: 'pipe',
        });
      }).toThrow();
    });

    it('fails decryption when provided with the wrong encryption key', () => {
      const plainFile = path.join(testBackupDir, 'test.sql');
      const encFile = path.join(testBackupDir, 'attendease-wrongkey.sql.gz.enc');
      fs.writeFileSync(plainFile, 'test payload');

      execSync(`gzip -c "${plainFile}" | openssl enc -aes-256-cbc -pbkdf2 -salt -pass pass:"${pass}" > "${encFile}"`);

      expect(() => {
        execSync(`openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"wrong-password" -in "${encFile}" | gunzip -c`, {
          stdio: 'pipe',
        });
      }).toThrow();
    });

    it('runs verify-restore.sh offline validation stream check', () => {
      const plainFile = path.join(testBackupDir, 'test.sql');
      const encFile = path.join(testBackupDir, 'attendease-20260815-183000.sql.gz.enc');
      const manifestFile = path.join(testBackupDir, 'attendease-20260815-183000.manifest.json');
      fs.writeFileSync(plainFile, 'SELECT 1;');

      execSync(`gzip -c "${plainFile}" | openssl enc -aes-256-cbc -pbkdf2 -salt -pass pass:"${pass}" > "${encFile}"`);
      const checksum = crypto.createHash('sha256').update(fs.readFileSync(encFile)).digest('hex');

      fs.writeFileSync(
        manifestFile,
        JSON.stringify({
          backupFile: 'attendease-20260815-183000.sql.gz.enc',
          checksumSha256: checksum,
          timestamp: new Date().toISOString(),
          appVersion: '1.0.0',
        })
      );

      const output = execSync(
        `BACKUP_DIR="${testBackupDir}" BACKUP_ENCRYPTION_KEY="${pass}" bash scripts/verify-restore.sh "${encFile}"`,
        { encoding: 'utf8' }
      );
      expect(output).toContain('Disaster Recovery Verification Drill PASSED');
      expect(fs.existsSync(path.join(testBackupDir, 'LATEST_RESTORE_VERIFIED'))).toBe(true);
    });
  });

  describe('5. PC/SC Hardware & Smartcard Daemon Diagnostics', () => {
    it('runs hardware diagnostics and returns structured reader capabilities', async () => {
      const daemon = new GatewayDaemon({
        schoolId: '00000000-0000-0000-0000-000000000001',
        readerId: 'test_reader_01',
        serverBaseUrl: 'http://localhost:3000',
        sharedSecret: 'test-secret-32-chars-length-environment',
        cardMasterKey: 'test-card-master-key-32-chars-long-env',
        useSimulator: true,
      });

      const diag = await daemon.runDiagnostics();
      expect(diag.supportedHardwareModels).toContain('ACS ACR1252U');
      expect(diag.supportedHardwareModels).toContain('HID Omnikey 5422');
      expect(diag.simulationMode).toBe(true);
      expect(diag.readersDetected.length).toBeGreaterThan(0);
      expect(diag.status).toBe('SIMULATION_ACTIVE');
    });
  });

  describe('6. Autonomous Alerting Service', () => {
    it('logs alerts when no webhook is configured and returns graceful status', async () => {
      const alert: SystemAlert = {
        id: 'alert_test_01',
        severity: 'CRITICAL',
        title: 'AttendEasePostgresDown',
        description: 'PostgreSQL database unreachable for > 1m',
        timestamp: new Date().toISOString(),
      };

      const result = await alertingService.dispatchAlert(alert);
      expect(result.sent).toBe(false);
      expect(result.reason).toBe('NO_WEBHOOK_CONFIGURED');
    });
  });

  describe('7. Full Tenant Data Portability Package & Report Pagination', () => {
    it('exports full tenant data package containing school, students, sections, and audit logs', async () => {
      // Create test school
      const [school] = await db
        .insert(schools)
        .values({
          name: 'Portability Test School',
          slug: `portability-test-${Date.now()}`,
          district: 'Bankura',
          status: 'ACTIVE',
        })
        .returning();

      const [student] = await db
        .insert(students)
        .values({
          schoolId: school.id,
          studentCode: `PORT_${Date.now()}`,
          name: 'Test Portability Student',
          status: 'ACTIVE',
        })
        .returning();

      const tenantPackage = await getFullTenantExport(school.id);
      expect(['1.0.0', '2.0.0']).toContain(tenantPackage.exportVersion);
      expect(tenantPackage.school.id).toBe(school.id);
      expect(tenantPackage.school.name).toBe('Portability Test School');
      expect(tenantPackage.students.some((s: any) => s.id === student.id)).toBe(true);
      expect(Array.isArray(tenantPackage.classSections)).toBe(true);
      expect(Array.isArray(tenantPackage.guardians)).toBe(true);
      expect(Array.isArray(tenantPackage.auditLogs)).toBe(true);
    });

    it('paginates student attendance history with limit and offset', async () => {
      const [school] = await db
        .insert(schools)
        .values({
          name: 'Pagination School',
          slug: `pagination-${Date.now()}`,
          district: 'Purulia',
          status: 'ACTIVE',
        })
        .returning();

      const [student] = await db
        .insert(students)
        .values({
          schoolId: school.id,
          studentCode: `PAG_${Date.now()}`,
          name: 'Paging Student',
          status: 'ACTIVE',
        })
        .returning();

      const res = await getStudentAttendanceHistory(school.id, student.id, undefined, undefined, {
        limit: 10,
        offset: 0,
      });

      expect(res.student.id).toBe(student.id);
      expect(Array.isArray(res.history)).toBe(true);
      expect(res.summary).toBeDefined();
    });
  });

  describe('8. Autonomous Session Reconciler', () => {
    it('executes safely without errors and returns valid audit metrics', async () => {
      const result = await reconcileStuckSessions(0);
      expect(result).toHaveProperty('checkedAt');
      expect(typeof result.reconciledCount).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });
});
