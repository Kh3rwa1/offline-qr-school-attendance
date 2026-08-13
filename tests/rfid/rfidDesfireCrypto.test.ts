import { describe, it, expect } from 'vitest';
import {
  computeDiversifiedKey,
  verifySecureProof,
  computeCredentialDigest,
  timingSafeEqual,
} from '../../src/services/rfid/cryptoService';
import crypto from 'crypto';

describe('DESFire EV2/EV3 Card Cryptography Suite', () => {
  const secret = 'desfire-test-secret-32-chars-long';
  const schoolId = 'school_desfire_01';
  const uidHex = '04A1B2C3D4E5F6';
  const timestamp = new Date().toISOString();
  const nonce = 'nonce_desfire_proof_12345';

  it('Derives AN10922 diversified key from master key and card UID', () => {
    const divKey = computeDiversifiedKey(secret, uidHex, schoolId);
    expect(divKey).toBeInstanceOf(Buffer);
    expect(divKey.length).toBe(16);

    const divKey2 = computeDiversifiedKey(secret, uidHex, schoolId);
    expect(divKey.equals(divKey2)).toBe(true);
  });

  it('Verifies valid secureProof cryptogram for DESFire EV2/EV3 scan', () => {
    const digest = computeCredentialDigest({
      schoolId,
      keyVersion: 1,
      uidBytes: Buffer.from(uidHex, 'hex'),
      hmacSecret: secret,
    });

    const payload = `secure-proof-v1:${digest}:${nonce}:${timestamp}`;
    const secureProof = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const isValid = verifySecureProof(digest, nonce, timestamp, secureProof, secret);
    expect(isValid).toBe(true);
  });

  it('Rejects secureProof when timestamp or nonce is tampered', () => {
    const digest = computeCredentialDigest({
      schoolId,
      keyVersion: 1,
      uidBytes: Buffer.from(uidHex, 'hex'),
      hmacSecret: secret,
    });

    const payload = `secure-proof-v1:${digest}:${nonce}:${timestamp}`;
    const secureProof = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const tamperedTimestamp = new Date(Date.now() - 60000).toISOString();
    const isValid = verifySecureProof(digest, nonce, tamperedTimestamp, secureProof, secret);
    expect(isValid).toBe(false);
  });

  it('Executes constant-time comparison in timingSafeEqual', () => {
    const hex1 = crypto.randomBytes(32).toString('hex');
    const hex2 = crypto.randomBytes(32).toString('hex');

    expect(timingSafeEqual(hex1, hex1)).toBe(true);
    expect(timingSafeEqual(hex1, hex2)).toBe(false);
    expect(timingSafeEqual(hex1, 'short')).toBe(false);
  });
});
