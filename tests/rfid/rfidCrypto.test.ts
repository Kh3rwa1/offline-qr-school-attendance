import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  canonicalizeUid,
  canonicalizeEpc,
  canonicalizeTid,
  computeEpcDigest,
  computeTidDigest,
  getEpcLastFour,
  deriveReaderSecret,
  verifyZebraHmacSignature,
  verifyBearerToken,
  generateHmacDigest,
  timingSafeEqual,
  generateNonce,
  redactCredentialDigest,
  verifySignature,
} from '../../src/services/rfid/cryptoService';

describe('RFID Crypto Service', () => {
  describe('canonicalizeUid', () => {
    it('handles valid hex', () => {
      expect(canonicalizeUid('04a2b3c4d5')).toBe('04A2B3C4D5');
    });
    it('handles colons and hyphens', () => {
      expect(canonicalizeUid('04:A2:B3:C4:D5')).toBe('04A2B3C4D5');
      expect(canonicalizeUid('04-a2-b3-c4-d5')).toBe('04A2B3C4D5');
    });
    it('rejects invalid chars', () => {
      expect(() => canonicalizeUid('04A2XX')).toThrow();
    });
    it('rejects empty', () => {
      expect(() => canonicalizeUid('')).toThrow();
    });
    it('rejects too long', () => {
      expect(() => canonicalizeUid('a'.repeat(30))).toThrow();
    });
  });

  describe('generateHmacDigest', () => {
    it('produces consistent output', () => {
      const digest1 = generateHmacDigest('04A2B3C4D5', 'school1', 1);
      const digest2 = generateHmacDigest('04A2B3C4D5', 'school1', 1);
      expect(digest1).toBe(digest2);
    });
    it('different UIDs produce different digests', () => {
      expect(generateHmacDigest('04A2B3C4D5', 'school1', 1)).not.toBe(
        generateHmacDigest('04A2B3C4D6', 'school1', 1)
      );
    });
    it('different schools produce different digests', () => {
      expect(generateHmacDigest('04A2B3C4D5', 'school1', 1)).not.toBe(
        generateHmacDigest('04A2B3C4D5', 'school2', 1)
      );
    });
    it('different key versions produce different digests', () => {
      expect(generateHmacDigest('04A2B3C4D5', 'school1', 1)).not.toBe(
        generateHmacDigest('04A2B3C4D5', 'school1', 2)
      );
    });
  });

  describe('timingSafeEqual', () => {
    it('equal strings return true', () => {
      expect(timingSafeEqual('hello', 'hello')).toBe(true);
    });
    it('different strings return false', () => {
      expect(timingSafeEqual('hello', 'world')).toBe(false);
    });
    it('different lengths return false', () => {
      expect(timingSafeEqual('hello', 'helloo')).toBe(false);
    });
    it('handles empty strings', () => {
      expect(timingSafeEqual('', '')).toBe(true);
      expect(timingSafeEqual('', 'a')).toBe(false);
    });
  });

  describe('generateNonce', () => {
    it('correct length and valid hex', () => {
      const nonce = generateNonce();
      expect(nonce.length).toBe(64);
      expect(/^[0-9a-f]{64}$/.test(nonce)).toBe(true);
    });
    it('different each call', () => {
      expect(generateNonce()).not.toBe(generateNonce());
    });
  });

  describe('redactCredentialDigest', () => {
    it('shows last 8 chars, masks rest', () => {
      const digest = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const redacted = redactCredentialDigest(digest);
      expect(redacted).toBe('********************************************************90abcdef');
    });
  });

  describe('verifySignature', () => {
    const secret = 'supersecret';
    const payload = 'data';
    
    it('valid signature accepted', () => {
      const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      expect(verifySignature(payload, signature, secret)).toBe(true);
    });
    it('invalid rejected', () => {
      const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      expect(verifySignature(payload, 'bad' + signature.substring(3), secret)).toBe(false);
    });
    it('tampered data rejected', () => {
      const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      expect(verifySignature(payload + 'x', signature, secret)).toBe(false);
    });
  });

  describe('UHF EPC Gen2 & TID Cryptographic Utilities', () => {
    describe('canonicalizeEpc', () => {
      it('canonicalizes standard hex EPC', () => {
        expect(canonicalizeEpc('e28011700000020b85794820')).toBe('E28011700000020B85794820');
      });

      it('strips 0x prefix and delimiters', () => {
        expect(canonicalizeEpc('0x-e2-80-11-70:00:00:02:0b-85794820')).toBe('E28011700000020B85794820');
      });

      it('rejects non-hex characters and invalid lengths', () => {
        expect(() => canonicalizeEpc('INVALID_NON_HEX_TAG')).toThrow();
        expect(() => canonicalizeEpc('1234')).toThrow(); // Too short (< 16 chars)
        expect(() => canonicalizeEpc('')).toThrow();
      });

      it('rejects odd-length hex strings', () => {
        expect(() => canonicalizeEpc('E28011700000020B8579482')).toThrow(); // 23 hex digits
      });
    });

    describe('canonicalizeTid', () => {
      it('canonicalizes standard hex TID', () => {
        expect(canonicalizeTid('e280110520007890abcdef12')).toBe('E280110520007890ABCDEF12');
      });

      it('strips 0x prefix and delimiters from TID', () => {
        expect(canonicalizeTid('0x-e2-80-11-05:20:00:78:90:ab:cd:ef:12')).toBe('E280110520007890ABCDEF12');
      });

      it('rejects invalid or odd-length TID', () => {
        expect(() => canonicalizeTid('NOT_HEX_TID_XXXX')).toThrow();
        expect(() => canonicalizeTid('E280110520007890ABCDEF1')).toThrow(); // odd length
      });
    });

    describe('computeEpcDigest & computeTidDigest', () => {
      it('produces stable SHA-256 hash for EPC', () => {
        const epc = 'E28011700000020B85794820';
        const expected = crypto.createHash('sha256').update(epc).digest('hex');
        expect(computeEpcDigest(epc)).toBe(expected);
      });

      it('produces stable SHA-256 hash for TID', () => {
        const tid = 'E280110520007890ABCDEF12';
        const expected = crypto.createHash('sha256').update(tid).digest('hex');
        expect(computeTidDigest(tid)).toBe(expected);
      });

      it('different EPCs produce distinct digests', () => {
        expect(computeEpcDigest('E28011700000020B85794820')).not.toBe(
          computeEpcDigest('3034257BF400B7800004CB09')
        );
      });
    });

    describe('getEpcLastFour', () => {
      it('returns last 4 hex chars', () => {
        expect(getEpcLastFour('E28011700000020B85794820')).toBe('4820');
      });
    });

    describe('deriveReaderSecret', () => {
      it('derives consistent, separated secrets using HKDF', () => {
        const master = 'master-secret-key-32-chars-long';
        const secret1 = deriveReaderSecret(master, 'school-a', 'reader-1', 1);
        const secret2 = deriveReaderSecret(master, 'school-a', 'reader-1', 1);
        const secret3 = deriveReaderSecret(master, 'school-a', 'reader-2', 1);
        const secret4 = deriveReaderSecret(master, 'school-b', 'reader-1', 1);

        expect(secret1).toBe(secret2);
        expect(secret1).not.toBe(secret3);
        expect(secret1).not.toBe(secret4);
        expect(secret1.length).toBe(64); // 32 bytes hex
      });
    });

    describe('verifyZebraHmacSignature', () => {
      const secret = 'zebra-webhook-secret-key-32-chars';
      const rawPayload = JSON.stringify({ type: 'tag_read', data: [{ epc: 'E28011700000020B85794820' }] });

      it('accepts valid HMAC signature', () => {
        const sig = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');
        expect(verifyZebraHmacSignature(rawPayload, sig, secret)).toBe(true);
        expect(verifyZebraHmacSignature(rawPayload, `sha256=${sig}`, secret)).toBe(true);
      });

      it('rejects tampered body or incorrect secret', () => {
        const sig = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');
        expect(verifyZebraHmacSignature(rawPayload + ' ', sig, secret)).toBe(false);
        expect(verifyZebraHmacSignature(rawPayload, sig, 'wrong-secret')).toBe(false);
      });
    });

    describe('verifyBearerToken', () => {
      const token = 'fx9600-bearer-token-1234567890';
      const tokenDigest = crypto.createHash('sha256').update(token).digest('hex');

      it('accepts valid bearer token matching secret directly or by digest', () => {
        expect(verifyBearerToken(`Bearer ${token}`, token)).toBe(true);
        expect(verifyBearerToken(`Bearer ${token}`, tokenDigest)).toBe(true);
      });

      it('rejects invalid or malformed bearer token', () => {
        expect(verifyBearerToken(`Bearer wrong-token`, token)).toBe(false);
        expect(verifyBearerToken(`Basic ${token}`, token)).toBe(false);
        expect(verifyBearerToken(undefined, token)).toBe(false);
      });
    });
  });
});
