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
 * RFC 4493 AES-128-CMAC implementation for production DESFire card cryptography.
 */
export function aesCmac(key: Buffer, message: Buffer): Buffer {
  if (key.length !== 16) {
    throw new Error('AES-CMAC requires a 16-byte (128-bit) key');
  }

  const cipherL = crypto.createCipheriv('aes-128-ecb', key, null);
  cipherL.setAutoPadding(false);
  const L = cipherL.update(Buffer.alloc(16));

  const generateSubkey = (input: Buffer): Buffer => {
    const subkey = Buffer.alloc(16);
    let overflow = 0;
    for (let i = 15; i >= 0; i--) {
      const b = input[i];
      subkey[i] = ((b << 1) & 0xff) | overflow;
      overflow = (b & 0x80) ? 1 : 0;
    }
    if ((input[0] & 0x80) !== 0) {
      subkey[15] ^= 0x87;
    }
    return subkey;
  };

  const K1 = generateSubkey(L);
  const K2 = generateSubkey(K1);

  const numBlocks = Math.ceil(message.length / 16) || 1;
  const isCompleteBlock = message.length > 0 && message.length % 16 === 0;

  const paddedLastBlock = Buffer.alloc(16);
  if (isCompleteBlock) {
    const lastBlockOffset = (numBlocks - 1) * 16;
    const lastBlock = message.subarray(lastBlockOffset, lastBlockOffset + 16);
    for (let i = 0; i < 16; i++) {
      paddedLastBlock[i] = lastBlock[i] ^ K1[i];
    }
  } else {
    const lastBlockOffset = (numBlocks - 1) * 16;
    const remainder = message.subarray(lastBlockOffset);
    remainder.copy(paddedLastBlock, 0);
    paddedLastBlock[remainder.length] = 0x80;
    for (let i = remainder.length + 1; i < 16; i++) {
      paddedLastBlock[i] = 0x00;
    }
    for (let i = 0; i < 16; i++) {
      paddedLastBlock[i] ^= K2[i];
    }
  }

  let X = Buffer.alloc(16);
  for (let i = 0; i < numBlocks - 1; i++) {
    const block = message.subarray(i * 16, (i + 1) * 16);
    const Y = Buffer.alloc(16);
    for (let j = 0; j < 16; j++) {
      Y[j] = X[j] ^ block[j];
    }
    const cipher = crypto.createCipheriv('aes-128-ecb', key, null);
    cipher.setAutoPadding(false);
    X = cipher.update(Y);
  }

  const finalY = Buffer.alloc(16);
  for (let j = 0; j < 16; j++) {
    finalY[j] = X[j] ^ paddedLastBlock[j];
  }
  const finalCipher = crypto.createCipheriv('aes-128-ecb', key, null);
  finalCipher.setAutoPadding(false);
  return finalCipher.update(finalY);
}

/**
 * AN10922 AES Key Diversification according to NXP specification.
 * Kdiv = AES-CMAC(Kmaster, 0x01 || CardUID || SystemID)
 */
export function computeDiversifiedKey(masterKey: Buffer | string, cardUidHex: string, systemIdStr: string = 'school_attendance'): Buffer {
  let keyBuf: Buffer;
  if (typeof masterKey === 'string') {
    keyBuf = crypto.createHash('sha256').update(masterKey).digest().subarray(0, 16);
  } else {
    keyBuf = masterKey;
  }
  const uidBuf = Buffer.from(canonicalizeUid(cardUidHex), 'hex');
  const sysBuf = Buffer.from(systemIdStr, 'utf8');
  const divData = Buffer.concat([Buffer.from([0x01]), uidBuf, sysBuf]);
  return aesCmac(keyBuf, divData);
}

/**
 * Computes an HMAC digest for credentials.
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
  let secret = process.env.RFID_CREDENTIAL_DIGEST_KEY || process.env.RFID_HMAC_SECRET;
  let schoolId = '';
  let keyVersion = 1;
  let securityMode = 'SECURE';
  let uidHex = '00';

  if (typeof paramsOrUid === 'string') {
    uidHex = canonicalizeUid(paramsOrUid);
    if (!schoolIdParam) {
      throw new Error('schoolId is required to generate credential digest');
    }
    schoolId = schoolIdParam;
    keyVersion = keyVersionParam || 1;
  } else {
    secret = paramsOrUid.hmacSecret || secret;
    if (!paramsOrUid.schoolId) {
      throw new Error('schoolId is required to generate credential digest');
    }
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
      throw new Error('RFID_CREDENTIAL_DIGEST_KEY must be configured for credential digest computation');
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

export function generateNonce(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Computes canonical HMAC-SHA256 signature for scan payloads or request headers (reader authentication).
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
 * Verifies DESFire EV2/EV3 reader/gateway payload HMAC signature (Reader Authentication).
 */
export function verifyReaderHmac(
  credentialDigest: string,
  nonce: string,
  readerTimestamp: string,
  readerHmacSignature: string,
  secret: string
): boolean {
  if (!readerHmacSignature || !secret) return false;
  const payload = `secure-proof-v1:${credentialDigest}:${nonce}:${readerTimestamp}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return timingSafeEqual(readerHmacSignature, expected);
}

export const verifySecureProof = verifyReaderHmac;

/**
 * Verifies genuine DESFire EV2/EV3 card-originated cryptogram proof.
 */
export interface CardProofParams {
  cardUidHex: string;
  readerChallengeHex: string;
  transactionCounter: number;
  cardProofHex: string;
  masterKeyHex: string;
  systemId?: string;
}

export function verifyCardProof(params: CardProofParams): boolean {
  const { cardUidHex, readerChallengeHex, transactionCounter, cardProofHex, masterKeyHex, systemId = 'school_attendance' } = params;
  if (!cardProofHex || !masterKeyHex || !cardUidHex || !readerChallengeHex) return false;
  try {
    const divKey = computeDiversifiedKey(masterKeyHex, cardUidHex, systemId);
    const txCounterBuf = Buffer.alloc(4);
    txCounterBuf.writeUInt32BE(transactionCounter, 0);

    const challengeBuf = Buffer.from(readerChallengeHex, 'hex');
    const proofData = Buffer.concat([Buffer.from('desfire-ev2-proof-v1', 'utf8'), txCounterBuf, challengeBuf]);

    const expectedCmac = aesCmac(divKey, proofData);
    return timingSafeEqual(cardProofHex.toLowerCase(), expectedCmac.toString('hex').toLowerCase());
  } catch {
    return false;
  }
}

export function redactCredentialDigest(digest: string): string {
  if (!digest || digest.length < 8) return '***';
  const prefixLength = digest.length - 8;
  return '*'.repeat(prefixLength) + digest.slice(-8);
}

export const generateHmacDigest = computeCredentialDigest;
export const verifySignature = verifyEnvelopeSignature;

export const cryptoService = {
  canonicalizeUid,
  canonicalizeUidBuffer,
  aesCmac,
  computeDiversifiedKey,
  computeCredentialDigest,
  generateHmacDigest,
  timingSafeEqual,
  generateNonce,
  computeCanonicalSignature,
  verifyEnvelopeSignature,
  verifySignature,
  verifyReaderHmac,
  verifySecureProof,
  verifyCardProof,
  redactCredentialDigest,
};
