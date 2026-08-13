import crypto from 'crypto';

/**
 * Normalizes UID: uppercase, strip colons/hyphens/spaces, validate hex.
 */
export function canonicalizeUid(rawUid: string): string {
  if (!rawUid) throw new Error('UID is required');
  const cleanUid = rawUid.toUpperCase().replace(/[:\-\s]/g, '');
  if (!/^[0-9A-F]+$/.test(cleanUid)) {
    throw new Error('Invalid UID format');
  }
  if (cleanUid.length > 28) {
    throw new Error('UID too long');
  }
  return cleanUid;
}

export function canonicalizeUidBuffer(rawUid: string): Buffer {
  return Buffer.from(canonicalizeUid(rawUid), 'hex');
}

/**
 * Computes an HMAC digest for the credential using domain separation.
 */
export function computeCredentialDigest(
  paramsOrUid:
    | string
    | {
        hmacSecret?: string;
        keyVersion: number;
        schoolId: string;
        securityMode?: 'SECURE' | 'UID_LEGACY';
        uidBytes?: Buffer;
      },
  schoolIdParam?: string,
  keyVersionParam?: number
): string {
  let secret = process.env.RFID_HMAC_SECRET;
  let schoolId = 'default-school';
  let keyVersion = 1;
  let securityMode = 'SECURE';
  let uidHex = '00';

  if (typeof paramsOrUid === 'string') {
    uidHex = canonicalizeUid(paramsOrUid);
    schoolId = schoolIdParam || 'school1';
    keyVersion = keyVersionParam || 1;
  } else {
    secret = paramsOrUid.hmacSecret || secret;
    schoolId = paramsOrUid.schoolId;
    keyVersion = paramsOrUid.keyVersion;
    securityMode = paramsOrUid.securityMode || 'SECURE';
    if (paramsOrUid.uidBytes) {
      uidHex = paramsOrUid.uidBytes.toString('hex').toUpperCase();
    }
  }

  if (!secret) {
    if (process.env.NODE_ENV === 'test') {
      secret = 'test-secret-32-chars-length-environment';
    } else {
      throw new Error('RFID_HMAC_SECRET must be configured for credential digest computation');
    }
  }

  const hmac = crypto.createHmac('sha256', secret);
  const data = `rfid-credential-v${keyVersion}:${schoolId}:${securityMode}:${uidHex}`;
  hmac.update(data);
  return hmac.digest('hex');
}

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

/**
 * Generates a 32-byte crypto random string, hex encoded.
 */
export function generateNonce(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * HMAC-SHA256 verification of scan envelope.
 */
export function verifyEnvelopeSignature(
  envelopeOrData: any,
  signature: string,
  publicKeyOrSecret: string
): boolean {
  try {
    let payload = envelopeOrData;
    if (typeof envelopeOrData === 'object' && envelopeOrData !== null) {
      const { signature: _sig, ...envelopeData } = envelopeOrData;
      payload = JSON.stringify(envelopeData, Object.keys(envelopeData).sort());
    }
    const hmac = crypto.createHmac('sha256', publicKeyOrSecret);
    hmac.update(String(payload));
    const expected = hmac.digest('hex');
    return timingSafeEqual(signature, expected);
  } catch (err) {
    return false;
  }
}

/**
 * Returns redacted digest showing last 8 chars.
 */
export function redactCredentialDigest(digest: string): string {
  if (!digest || digest.length < 8) return '***';
  const prefixLength = digest.length - 8;
  return '*'.repeat(prefixLength) + digest.slice(-8);
}

// Aliases for compatibility
export const generateHmacDigest = computeCredentialDigest;
export const verifySignature = verifyEnvelopeSignature;

export const cryptoService = {
  canonicalizeUid,
  canonicalizeUidBuffer,
  computeCredentialDigest,
  generateHmacDigest,
  timingSafeEqual,
  generateNonce,
  verifyEnvelopeSignature,
  verifySignature,
  redactCredentialDigest,
};
