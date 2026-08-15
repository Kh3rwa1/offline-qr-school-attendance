import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

describe('Disaster Recovery — Archive Encryption, Decryption & Integrity Verification', () => {
  const passphrase = 'test-backup-passphrase-32bytes-long-key';

  function encryptBackupPayload(sqlDump: string, pass: string): Buffer {
    const compressed = zlib.gzipSync(Buffer.from(sqlDump, 'utf8'));
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(pass, salt, 10000, 32, 'sha256');
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);

    // Format: Magic header "Salted__" (8 bytes) + salt (16 bytes) + iv (16 bytes) + ciphertext
    return Buffer.concat([Buffer.from('Salted__', 'utf8'), salt, iv, encrypted]);
  }

  function decryptBackupPayload(encryptedBuffer: Buffer, pass: string): string {
    const magic = encryptedBuffer.subarray(0, 8).toString('utf8');
    if (magic !== 'Salted__') {
      throw new Error('INVALID_BACKUP_ARCHIVE_HEADER');
    }

    const salt = encryptedBuffer.subarray(8, 24);
    const iv = encryptedBuffer.subarray(24, 40);
    const ciphertext = encryptedBuffer.subarray(40);

    const key = crypto.pbkdf2Sync(pass, salt, 10000, 32, 'sha256');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decryptedCompressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    const decompressed = zlib.gunzipSync(decryptedCompressed);
    return decompressed.toString('utf8');
  }

  it('encrypts database dump, computes SHA-256 digest, and decrypts back to original SQL payload', () => {
    const sampleSql = `-- AttendEase OS Disaster Recovery Dump
BEGIN;
INSERT INTO schools (id, name, slug) VALUES ('sch-123', 'Sundarbans High School', 'sundarbans-high');
INSERT INTO students (id, school_id, name) VALUES ('stu-456', 'sch-123', 'Aniket Mondal');
COMMIT;`;

    const encryptedArchive = encryptBackupPayload(sampleSql, passphrase);
    const archiveSha256 = crypto.createHash('sha256').update(encryptedArchive).digest('hex');

    expect(encryptedArchive.length).toBeGreaterThan(0);
    expect(archiveSha256).toHaveLength(64);

    const decryptedSql = decryptBackupPayload(encryptedArchive, passphrase);
    expect(decryptedSql).toBe(sampleSql);
    expect(decryptedSql).toContain('Sundarbans High School');
    expect(decryptedSql).toContain('Aniket Mondal');
  });

  it('fails closed when attempting to decrypt with an incorrect passphrase', () => {
    const sampleSql = `SELECT 1;`;
    const encryptedArchive = encryptBackupPayload(sampleSql, passphrase);

    expect(() => {
      decryptBackupPayload(encryptedArchive, 'wrong-passphrase');
    }).toThrow();
  });

  it('fails closed when ciphertext is corrupted or truncated', () => {
    const sampleSql = `SELECT 1;`;
    const encryptedArchive = encryptBackupPayload(sampleSql, passphrase);

    // Corrupt ciphertext bytes
    const corrupted = Buffer.from(encryptedArchive);
    corrupted[50] = corrupted[50] ^ 0xff;

    expect(() => {
      decryptBackupPayload(corrupted, passphrase);
    }).toThrow();
  });
});
