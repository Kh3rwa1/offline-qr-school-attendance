import { env } from '../../env';
import crypto from 'node:crypto';

/**
 * Constant-time comparison using crypto.timingSafeEqual.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, 'utf-8');
    const bBuf = Buffer.from(b, 'utf-8');
    if (aBuf.length !== bBuf.length) {
      crypto.timingSafeEqual(aBuf, aBuf);
      return false;
    }
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch (err) {
    return false;
  }
}

export function generateNonce(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function redactCredentialDigest(digest: string): string {
  if (!digest || digest.length < 8) return '***';
  const prefixLength = digest.length - 8;
  return '*'.repeat(prefixLength) + digest.slice(-8);
}

/**
 * UHF EPC Gen 2 / ISO 18000-63 Cryptographic Helpers
 */

/**
 * Canonicalizes an EPC hexadecimal string (converts to uppercase, strips prefixes, spaces, colons, hyphens).
 * Strictly requires valid hexadecimal characters and even length (byte-aligned).
 */
export function canonicalizeEpc(epc: string): string {
  if (!epc || typeof epc !== 'string') {
    throw new Error('EPC is required and must be a string');
  }
  let cleaned = epc.trim();
  if (cleaned.startsWith('0x') || cleaned.startsWith('0X')) {
    cleaned = cleaned.slice(2);
  }
  cleaned = cleaned.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (cleaned.length < 16 || cleaned.length > 64) {
    throw new Error(`Invalid UHF EPC length: ${cleaned.length} hex chars (expected 16-64 chars / 8-32 bytes).`);
  }
  if (cleaned.length % 2 !== 0) {
    throw new Error(`Invalid UHF EPC: odd length (${cleaned.length} hex digits) is not byte-aligned.`);
  }
  return cleaned;
}

/**
 * Canonicalizes a Tag Identifier (TID) hexadecimal string.
 * Strictly requires valid hexadecimal characters, even length, and valid bounds (16-64 chars).
 */
export function canonicalizeTid(tid: string): string {
  if (!tid || typeof tid !== 'string') {
    throw new Error('TID is required and must be a string');
  }
  let cleaned = tid.trim();
  if (cleaned.startsWith('0x') || cleaned.startsWith('0X')) {
    cleaned = cleaned.slice(2);
  }
  cleaned = cleaned.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (cleaned.length < 16 || cleaned.length > 64) {
    throw new Error(`Invalid UHF TID length: ${cleaned.length} hex chars (expected 16-64 chars / 8-32 bytes).`);
  }
  if (cleaned.length % 2 !== 0) {
    throw new Error(`Invalid UHF TID: odd length (${cleaned.length} hex digits) is not byte-aligned.`);
  }
  return cleaned;
}

/**
 * Computes a stable SHA-256 digest of a canonical EPC hex string.
 */
export function computeEpcDigest(epc: string, salt: string = ''): string {
  const canonical = canonicalizeEpc(epc);
  const input = salt ? `${canonical}:${salt}` : canonical;
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Computes a stable SHA-256 digest of a canonical TID hex string.
 */
export function computeTidDigest(tid: string, salt: string = ''): string {
  const canonical = canonicalizeTid(tid);
  const input = salt ? `${canonical}:${salt}` : canonical;
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Returns the last 4 characters of an EPC for operator support display without exposing the full EPC.
 */
export function getEpcLastFour(epc: string): string {
  try {
    const canonical = canonicalizeEpc(epc);
    return canonical.slice(-4);
  } catch {
    return '****';
  }
}

/**
 * Derives a deterministic, cryptographically separated per-reader HMAC secret using HKDF.
 */
export function deriveReaderSecret(masterKey: string, schoolId: string, deviceId: string, keyVersion: number = 1): string {
  if (!masterKey || masterKey.length < 16) {
    throw new Error('Master key must be at least 16 bytes');
  }
  const info = Buffer.from(`attendease-reader-auth-v${keyVersion}:${schoolId}:${deviceId}`, 'utf8');
  const salt = Buffer.from(`reader-salt-${schoolId}`, 'utf8');
  const derived = crypto.hkdfSync('sha256', Buffer.from(masterKey, 'utf8'), salt, info, 32);
  return Buffer.from(derived).toString('hex');
}

/**
 * Verifies a Zebra IoT Connector webhook HMAC-SHA256 signature against the raw body.
 */
export function verifyZebraHmacSignature(rawBody: string | Buffer, signatureHex: string, secret: string): boolean {
  if (!rawBody || !signatureHex || !secret) return false;
  try {
    const cleanSig = signatureHex.replace(/^sha256=/i, '').trim();
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return timingSafeEqual(cleanSig.toLowerCase(), expected.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Verifies a shared bearer token header (Authorization: Bearer <token>) over HTTPS.
 */
export function verifyBearerToken(authHeader: string | undefined, expectedTokenOrDigest: string): boolean {
  if (!authHeader || !expectedTokenOrDigest) return false;
  const parts = authHeader.trim().split(' ');
  const scheme = parts[0];
  const presentedToken = parts[1];
  if (parts.length !== 2 || !scheme || scheme.toLowerCase() !== 'bearer' || !presentedToken) return false;
  // Direct match
  if (timingSafeEqual(presentedToken, expectedTokenOrDigest)) {
    return true;
  }
  // Digest match
  const presentedDigest = crypto.createHash('sha256').update(presentedToken).digest('hex');
  return timingSafeEqual(presentedDigest, expectedTokenOrDigest);
}

export const cryptoService = {
  canonicalizeEpc,
  canonicalizeTid,
  computeEpcDigest,
  computeTidDigest,
  getEpcLastFour,
  deriveReaderSecret,
  verifyZebraHmacSignature,
  verifyBearerToken,
  timingSafeEqual,
  generateNonce,
  redactCredentialDigest,
};
