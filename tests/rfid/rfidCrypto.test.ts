import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  canonicalizeUid,
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
});
