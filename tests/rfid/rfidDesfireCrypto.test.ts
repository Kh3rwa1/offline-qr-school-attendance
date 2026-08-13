import { describe, it, expect } from 'vitest';
import {
  aesCmac,
  computeDiversifiedKey,
  verifyReaderHmac,
  verifySecureProof,
  verifyCardProof,
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
  const rfcKey = Buffer.from('2b7e151628aed2a6abf7158809cf4f3c', 'hex');

  it('Verifies RFC 4493 known-answer AES-128-CMAC test vectors', () => {
    // Vector 1: Empty message
    const cmacEmpty = aesCmac(rfcKey, Buffer.alloc(0));
    expect(cmacEmpty.toString('hex').toLowerCase()).toBe('bb1d6929e95937287fa37d129b756746');

    // Vector 2: 16-byte message
    const msg16 = Buffer.from('6bc1bee22e409f96e93d7e117393172a', 'hex');
    const cmac16 = aesCmac(rfcKey, msg16);
    expect(cmac16.toString('hex').toLowerCase()).toBe('070a16b46b4d4144f79bdd9dd04a287c');

    // Vector 3: 40-byte message
    const msg40 = Buffer.from('6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411', 'hex');
    const cmac40 = aesCmac(rfcKey, msg40);
    expect(cmac40.toString('hex').toLowerCase()).toBe('dfa66747de9ae63030ca32611497c827');
  });

  it('Derives AN10922 diversified key using AES-CMAC', () => {
    const masterKey = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
    const divKey = computeDiversifiedKey(masterKey, uidHex, schoolId);

    expect(divKey).toBeInstanceOf(Buffer);
    expect(divKey.length).toBe(16);

    const divKey2 = computeDiversifiedKey(masterKey, uidHex, schoolId);
    expect(divKey.equals(divKey2)).toBe(true);
  });

  it('Verifies genuine card-originated DESFire cryptogram proof', () => {
    const masterKeyHex = '00112233445566778899aabbccddeeff';
    const readerChallengeHex = '1122334455667788';
    const transactionCounter = 42;

    const divKey = computeDiversifiedKey(masterKeyHex, uidHex, schoolId);
    const txBuf = Buffer.alloc(4);
    txBuf.writeUInt32BE(transactionCounter, 0);

    const proofData = Buffer.concat([Buffer.from('desfire-ev2-proof-v1', 'utf8'), txBuf, Buffer.from(readerChallengeHex, 'hex')]);
    const validCardProof = aesCmac(divKey, proofData).toString('hex');

    const isValid = verifyCardProof({
      cardUidHex: uidHex,
      readerChallengeHex,
      transactionCounter,
      cardProofHex: validCardProof,
      masterKeyHex,
      systemId: schoolId,
    });
    expect(isValid).toBe(true);
  });

  it('Negative tests: rejects modified CMAC, stale counter, wrong key, and tampered challenge', () => {
    const masterKeyHex = '00112233445566778899aabbccddeeff';
    const readerChallengeHex = '1122334455667788';
    const transactionCounter = 42;

    const divKey = computeDiversifiedKey(masterKeyHex, uidHex, schoolId);
    const txBuf = Buffer.alloc(4);
    txBuf.writeUInt32BE(transactionCounter, 0);

    const proofData = Buffer.concat([Buffer.from('desfire-ev2-proof-v1', 'utf8'), txBuf, Buffer.from(readerChallengeHex, 'hex')]);
    const validCardProof = aesCmac(divKey, proofData).toString('hex');

    // 1. Modified CMAC
    expect(verifyCardProof({
      cardUidHex: uidHex,
      readerChallengeHex,
      transactionCounter,
      cardProofHex: '00'.repeat(16),
      masterKeyHex,
      systemId: schoolId,
    })).toBe(false);

    // 2. Stale transaction counter
    expect(verifyCardProof({
      cardUidHex: uidHex,
      readerChallengeHex,
      transactionCounter: 41,
      cardProofHex: validCardProof,
      masterKeyHex,
      systemId: schoolId,
    })).toBe(false);

    // 3. Wrong card key
    expect(verifyCardProof({
      cardUidHex: uidHex,
      readerChallengeHex,
      transactionCounter,
      cardProofHex: validCardProof,
      masterKeyHex: 'ff'.repeat(16),
      systemId: schoolId,
    })).toBe(false);

    // 4. Tampered challenge
    expect(verifyCardProof({
      cardUidHex: uidHex,
      readerChallengeHex: '9999999999999999',
      transactionCounter,
      cardProofHex: validCardProof,
      masterKeyHex,
      systemId: schoolId,
    })).toBe(false);
  });

  it('Verifies reader HMAC payload signature', () => {
    const digest = computeCredentialDigest({
      schoolId,
      keyVersion: 1,
      uidBytes: Buffer.from(uidHex, 'hex'),
      hmacSecret: secret,
    });

    const payload = `secure-proof-v1:${digest}:${nonce}:${timestamp}`;
    const readerHmacSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const isValid = verifyReaderHmac(digest, nonce, timestamp, readerHmacSignature, secret);
    expect(isValid).toBe(true);
  });
});
