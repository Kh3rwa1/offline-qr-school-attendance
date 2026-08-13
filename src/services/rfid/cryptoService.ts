import crypto from 'crypto';

/**
 * Normalizes an 8/14/20 character hex string to uppercase without separators.
 */
export function canonicalizeUid(uid: string): string {
  if (!uid || typeof uid !== 'string') {
    throw new Error('UID is required');
  }
  const cleaned = uid.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (cleaned.length < 8 || cleaned.length > 24) {
    throw new Error(`Invalid RFID/NFC UID length: ${cleaned.length} chars.`);
  }
  return cleaned;
}

export function canonicalizeUidBuffer(buf: Buffer): string {
  return canonicalizeUid(buf.toString('hex'));
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
 * Computes canonical HMAC-SHA256 signature for scan payloads or request headers.
 */
export function computeCanonicalSignature(
  envelopeOrData: any,
  secret: string
): string {
  let payload = envelopeOrData;
  if (typeof envelopeOrData === 'object' && envelopeOrData !== null) {
    const { signature: _sig, ...envelopeData } = envelopeOrData;
    const sortedKeys = Object.keys(envelopeData).sort();
    const sortedObj: Record<string, any> = {};
    for (const k of sortedKeys) {
      if (envelopeData[k] !== undefined) {
        sortedObj[k] = envelopeData[k];
      }
    }
    payload = JSON.stringify(sortedObj);
  }
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(String(payload));
  return hmac.digest('hex');
}

/**
 * Unified HMAC-SHA256 signature verification.
 */
export function verifyEnvelopeSignature(
  envelopeOrData: any,
  signature: string,
  publicKeyOrSecret: string
): boolean {
  try {
    if (!signature || !publicKeyOrSecret) return false;
    const expected = computeCanonicalSignature(envelopeOrData, publicKeyOrSecret);
    return timingSafeEqual(signature, expected);
  } catch (err) {
    return false;
  }
}

/**
 * Verifies DESFire EV2/EV3 transaction secureProof.
 */
export function verifySecureProof(
  credentialDigest: string,
  nonce: string,
  readerTimestamp: string,
  secureProof: string,
  secret: string
): boolean {
  if (!secureProof || !secret) return false;
  const payload = `secure-proof-v1:${credentialDigest}:${nonce}:${readerTimestamp}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return timingSafeEqual(secureProof, expected);
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
  computeCanonicalSignature,
  verifyEnvelopeSignature,
  verifySignature,
  verifySecureProof,
  redactCredentialDigest,
};
