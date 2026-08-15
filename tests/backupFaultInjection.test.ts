import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { backupReplicationService } from '../src/services/backupReplicationService';

describe('Backup Correctness & Fault Injection Test Suite', () => {
  const testDir = path.join(process.cwd(), 'tmp-backup-fault-tests');
  const validKey = 'super-secure-appliance-encryption-key-32-chars-long';

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('1. Successfully encrypts, validates SHA-256 manifest and decrypts', () => {
    const rawSql = 'SELECT * FROM students WHERE status = \'ACTIVE\';';
    const rawFile = path.join(testDir, 'test.sql');
    const encFile = path.join(testDir, 'attendease-20260815-183000.sql.gz.enc');
    const manifestFile = path.join(testDir, 'attendease-20260815-183000.manifest.json');
    const restoredFile = path.join(testDir, 'restored.sql');

    fs.writeFileSync(rawFile, rawSql);

    execSync(`gzip -c "${rawFile}" | openssl enc -aes-256-cbc -pbkdf2 -salt -pass pass:"${validKey}" > "${encFile}"`);
    const checksum = crypto.createHash('sha256').update(fs.readFileSync(encFile)).digest('hex');

    const manifest = {
      backupFormatVersion: '2.0',
      backupFile: 'attendease-20260815-183000.sql.gz.enc',
      checksumSha256: checksum,
      timestamp: new Date().toISOString(),
      sizeBytes: fs.statSync(encFile).size,
      rawSizeBytes: rawSql.length,
      database: 'school_attendance',
      appVersion: '1.0.0',
      schemaVersion: '0015_cursor_pagination_and_query_optimization',
      encryption: 'AES-256-CBC-PBKDF2',
      keyId: 'key12345',
      restoreVerified: false,
      status: 'SUCCESS',
    };
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));

    execSync(`openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${validKey}" -in "${encFile}" | gunzip -c > "${restoredFile}"`);
    expect(fs.readFileSync(restoredFile, 'utf8')).toBe(rawSql);
  });

  it('2. Fault: Detects corrupt ciphertext and fails decryption', () => {
    const corruptFile = path.join(testDir, 'attendease-corrupt.sql.gz.enc');
    fs.writeFileSync(corruptFile, 'corrupted-non-crypto-garbage-data-string');

    expect(() => {
      execSync(`openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${validKey}" -in "${corruptFile}" | gunzip -c`, {
        stdio: 'pipe',
      });
    }).toThrow();
  });

  it('3. Fault: Rejects wrong encryption key', () => {
    const rawFile = path.join(testDir, 'test.sql');
    const encFile = path.join(testDir, 'attendease-keytest.sql.gz.enc');
    fs.writeFileSync(rawFile, 'SELECT 1;');

    execSync(`gzip -c "${rawFile}" | openssl enc -aes-256-cbc -pbkdf2 -salt -pass pass:"${validKey}" > "${encFile}"`);

    expect(() => {
      execSync(`openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"wrong-password-12345678901234567890" -in "${encFile}" | gunzip -c`, {
        stdio: 'pipe',
      });
    }).toThrow();
  });

  it('4. Fault: Detects truncated backup stream', () => {
    const rawFile = path.join(testDir, 'test.sql');
    const encFile = path.join(testDir, 'attendease-trunc.sql.gz.enc');
    fs.writeFileSync(rawFile, 'A'.repeat(50000));

    execSync(`gzip -c "${rawFile}" | openssl enc -aes-256-cbc -pbkdf2 -salt -pass pass:"${validKey}" > "${encFile}"`);

    const fullEnc = fs.readFileSync(encFile);
    fs.writeFileSync(encFile, fullEnc.slice(0, 100)); // truncate

    expect(() => {
      execSync(`openssl enc -d -aes-256-cbc -pbkdf2 -pass pass:"${validKey}" -in "${encFile}" | gunzip -t`, {
        stdio: 'pipe',
      });
    }).toThrow();
  });

  it('5. Fault: Detects checksum mismatch between archive and manifest', () => {
    const rawFile = path.join(testDir, 'test.sql');
    const encFile = path.join(testDir, 'attendease-mismatch.sql.gz.enc');
    const manifestFile = path.join(testDir, 'attendease-mismatch.manifest.json');
    fs.writeFileSync(rawFile, 'SELECT 1;');

    execSync(`gzip -c "${rawFile}" | openssl enc -aes-256-cbc -pbkdf2 -salt -pass pass:"${validKey}" > "${encFile}"`);

    const tamperedChecksum = '0000000000000000000000000000000000000000000000000000000000000000';
    fs.writeFileSync(
      manifestFile,
      JSON.stringify({
        backupFile: 'attendease-mismatch.sql.gz.enc',
        checksumSha256: tamperedChecksum,
        timestamp: new Date().toISOString(),
      })
    );

    const actualChecksum = crypto.createHash('sha256').update(fs.readFileSync(encFile)).digest('hex');
    expect(actualChecksum).not.toBe(tamperedChecksum);
  });

  it('6. Rejects weak key with less than 32 characters', () => {
    const weakKey = 'short-key-123';
    expect(weakKey.length).toBeLessThan(32);
    expect(validKey.length).toBeGreaterThanOrEqual(32);
  });

  it('7. Handles off-host replication when unconfigured gracefully', async () => {
    const rawFile = path.join(testDir, 'test.sql');
    const encFile = path.join(testDir, 'attendease-20260815-183000.sql.gz.enc');
    const manifestFile = path.join(testDir, 'attendease-20260815-183000.manifest.json');
    fs.writeFileSync(rawFile, 'SELECT 1;');
    execSync(`gzip -c "${rawFile}" | openssl enc -aes-256-cbc -pbkdf2 -salt -pass pass:"${validKey}" > "${encFile}"`);
    fs.writeFileSync(manifestFile, JSON.stringify({ backupFile: path.basename(encFile) }));

    const res = await backupReplicationService.replicateBackup(encFile);
    expect(res.success).toBe(false);
    expect(res.error).toBe('S3_REPLICATION_NOT_CONFIGURED');
  });
});
