import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KMSService } from '../../src/services/rfid/kmsService';
import { LocalKmsProvider } from '../../src/services/rfid/kmsProvider';

describe('KMSService & Key Management Suite', () => {
  const masterSecret = 'production-secret-32-bytes-long-key-string-for-kms';
  let origEnv: string | undefined;

  beforeEach(() => {
    origEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
  });

  it('Performs versioned envelope encryption and decryption round-trip', async () => {
    const kms = new KMSService({
      kmsProvider: new LocalKmsProvider({ DATABASE_ENCRYPTION_KEK: masterSecret }),
    });
    const original = 'reader_shared_secret_val_998877665544';

    const encryptedStr = await kms.encryptEnvelope('DATABASE_ENCRYPTION_KEK', original);
    expect(encryptedStr).not.toBe(original);
    expect(encryptedStr).toContain('ciphertext');

    const decrypted = await kms.decryptEnvelope(encryptedStr);
    expect(decrypted).toBe(original);
  });

  it('Fails closed on missing master key in production environment', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.RFID_HMAC_SECRET;
    delete process.env.KMS_MASTER_KEY;
    expect(() => new KMSService()).toThrow('KMS_FATAL');
  });

  it('Rejects short/default-looking keys in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => new KMSService({
      purposeSecrets: { DATABASE_ENCRYPTION_KEK: 'short-key' }
    })).toThrow('KMS_FATAL');
  });

  it('Fails closed when ciphertext envelope is malformed, truncated, or tampered', async () => {
    const kms = new KMSService({
      kmsProvider: new LocalKmsProvider({ DATABASE_ENCRYPTION_KEK: masterSecret }),
    });

    // Plaintext input
    await expect(kms.decryptEnvelope('plaintext_unencrypted_secret')).rejects.toThrow('KMS_DECRYPT_FAILED');

    // Malformed JSON
    await expect(kms.decryptEnvelope('{ bad json }')).rejects.toThrow('KMS_DECRYPT_FAILED');

    // Altered tag/IV in envelope
    const validEnvelopeStr = await kms.encryptEnvelope('DATABASE_ENCRYPTION_KEK', 'test_secret');
    const envelopeObj = JSON.parse(validEnvelopeStr);

    const tamperedTagEnv = JSON.stringify({ ...envelopeObj, tag: '00'.repeat(16) });
    await expect(kms.decryptEnvelope(tamperedTagEnv)).rejects.toThrow('KMS_DECRYPT_FAILED');

    const tamperedIvEnv = JSON.stringify({ ...envelopeObj, iv: '00'.repeat(12) });
    await expect(kms.decryptEnvelope(tamperedIvEnv)).rejects.toThrow('KMS_DECRYPT_FAILED');

    const tamperedCipherEnv = JSON.stringify({ ...envelopeObj, ciphertext: '00'.repeat(32) });
    await expect(kms.decryptEnvelope(tamperedCipherEnv)).rejects.toThrow('KMS_DECRYPT_FAILED');
  });

  it('Signs and verifies offline roster packages using Ed25519 asymmetric keys', () => {
    const kms = new KMSService();
    const { publicKeyPem, privateKeyPem } = kms.generateEd25519KeyPair();

    const rosterPayload = JSON.stringify({
      schoolId: 'school_kms_01',
      version: 1,
      validUntil: '2026-12-31T23:59:59Z',
      credentials: ['digest_a', 'digest_b'],
    });

    const signature = kms.signOfflineRoster(rosterPayload, privateKeyPem);
    expect(signature).toBeDefined();
    expect(typeof signature).toBe('string');

    const isValid = kms.verifyOfflineRosterSignature(rosterPayload, signature, publicKeyPem);
    expect(isValid).toBe(true);

    const tamperedPayload = rosterPayload + 'tampered';
    const isTamperedValid = kms.verifyOfflineRosterSignature(tamperedPayload, signature, publicKeyPem);
    expect(isTamperedValid).toBe(false);
  });
});
