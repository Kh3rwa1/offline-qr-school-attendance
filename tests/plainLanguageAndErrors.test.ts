import { describe, it, expect } from 'vitest';
import { getUserSafeError } from '../src/errors/userSafeErrors';
import { mapRfidRejectionCode } from '../src/utils/rfidRejectionMapper';

describe('Plain Language Error & RFID Code Mappings', () => {
  describe('getUserSafeError', () => {
    it('translates network / offline errors into reassuring plain language in Bengali & English', () => {
      const bnErr = getUserSafeError(new Error('Failed to fetch'), 'bn');
      expect(bnErr.title).toBe('Internet নেই');
      expect(bnErr.canRetry).toBe(true);

      const enErr = getUserSafeError(new Error('Failed to fetch'), 'en');
      expect(enErr.title).toBe('Internet Unavailable');
      expect(enErr.canRetry).toBe(true);
    });

    it('translates camera permission issues into clear action steps', () => {
      const bnErr = getUserSafeError(new Error('NotAllowedError: Permission denied'), 'bn');
      expect(bnErr.title).toBe('Camera Permission প্রয়োজন');
      expect(bnErr.actionSuggestion).toContain('Camera Allow করুন');

      const enErr = getUserSafeError(new Error('NotAllowedError: Permission denied'), 'en');
      expect(enErr.title).toBe('Camera Permission Needed');
    });

    it('translates 401 / session expiration without developer jargon', () => {
      const bnErr = getUserSafeError({ message: '401 Unauthorized jwt token expired' }, 'bn');
      expect(bnErr.title).toBe('Session শেষ হয়েছে');

      const enErr = getUserSafeError({ message: '401 Unauthorized jwt token expired' }, 'en');
      expect(enErr.title).toBe('Session Expired');
    });
  });

  describe('mapRfidRejectionCode', () => {
    it('maps UNKNOWN_EPC_TAG / UNREGISTERED to actionable badge assignment message', () => {
      const resBn = mapRfidRejectionCode('UNKNOWN_CARD_NOT_FOUND', 'bn');
      expect(resBn.title).toBe('অচেনা ব্যাজ');
      expect(resBn.recommendedAction).toBe('ছাত্রের নাম দিয়ে নতুন ব্যাজ যুক্ত করুন।');

      const resEn = mapRfidRejectionCode('UNKNOWN_CARD_NOT_FOUND', 'en');
      expect(resEn.title).toBe('Unknown badge');
      expect(resEn.recommendedAction).toContain('Give this badge to the student');
    });

    it('maps NONCE_REUSED / DUPLICATE_SCAN to reassuring already-marked status', () => {
      const resBn = mapRfidRejectionCode('NONCE_REUSED_REPLAY_DETECTED', 'bn');
      expect(resBn.title).toBe('একই ব্যাজ একাধিকবার স্ক্যান হয়েছে');
      expect(resBn.severity).toBe('info');

      const resEn = mapRfidRejectionCode('NONCE_REUSED_REPLAY_DETECTED', 'en');
      expect(resEn.title).toBe('Repeated badge read');
      expect(resEn.severity).toBe('info');
    });

    it('maps SUSPENDED and REVOKED badge codes cleanly', () => {
      const resSuspended = mapRfidRejectionCode('CARD_SUSPENDED', 'bn');
      expect(resSuspended.title).toBe('ব্যাজটি সাময়িকভাবে বন্ধ আছে');

      const resRevoked = mapRfidRejectionCode('CARD_REVOKED', 'en');
      expect(resRevoked.title).toBe('Badge permanently cancelled');
      expect(resRevoked.severity).toBe('danger');
    });
  });
});
