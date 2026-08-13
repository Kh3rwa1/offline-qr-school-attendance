import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KMSService } from '../../src/services/rfid/kmsService';

describe('KMSService & Key Management Suite', () => {
  const masterSecret = 'production-secret-32-bytes-long-key-string-for-kms';
  let origEnv: string | undefined;

  beforeEach(() => {
    origEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
  });

  it('Performs envelope encryption and decryption round-trip', () => {
    const kms = new KMSService({ masterSecret });
    const original = 'reader_shared_secret_val_998877665544';

    const encrypted = kms.encryptSecret(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted).toContain(':');

    const decrypted = kms.decryptSecret(encrypted);
    expect(decrypted).toBe(original);
  });

  it('Fails closed on missing master key in production environment', () => {
    process.env.NODE_ENV = 'production';
    expect(() => new KMSService({ masterSecret: '' })).toThrow('KMS_FATAL');
  });

  it('Signs and verifies offline roster packages using Ed25519 asymmetric keys', () => {
    const kms = new KMSService({ masterSecret });
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
