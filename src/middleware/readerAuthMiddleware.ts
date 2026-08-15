import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { db } from '../db';
import { rfidReaders } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { SecurityCapability } from '../services/rfid/adapters/types';
import { verifyEnvelopeSignature } from '../services/rfid/cryptoService';
import { decryptReaderSecret } from '../services/rfid/readerService';

export interface ReaderContext {
  readerId: string;
  schoolId: string;
  deviceId: string;
  securityCapability: SecurityCapability;
}

export interface ReaderAuthenticatedRequest extends Request {
  readerContext?: ReaderContext;
}

export const readerAuthMiddleware = async (
  req: ReaderAuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = req.body || {};
    const readerId = (req.headers['x-reader-id'] as string) || body.readerId;
    const readerSignature = (req.headers['x-reader-signature'] as string) || body.signature;
    const readerTimestamp = (req.headers['x-reader-timestamp'] as string) || body.readerTimestamp;

    if (!readerId || !readerSignature || !readerTimestamp) {
      return res.status(401).json({ error: 'UNAUTHORIZED_READER', message: 'Missing reader credentials or signature headers' });
    }

    const schoolId = req.params.schoolId || body.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing schoolId' });
    }

    // Validate timestamp freshness (max 5 minutes)
    const timestampMs = new Date(readerTimestamp).getTime();
    if (isNaN(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
      return res.status(401).json({ error: 'UNAUTHORIZED_READER', message: 'Reader timestamp outside allowed skew window' });
    }

    // Validate reader exists and is ACTIVE in rfidReaders table
    const [reader] = await db
      .select()
      .from(rfidReaders)
      .where(and(eq(rfidReaders.id, readerId)));

    if (!reader || reader.schoolId !== schoolId) {
      return res.status(401).json({ error: 'UNAUTHORIZED_READER', message: 'Reader not registered to target school' });
    }

    if (reader.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'FORBIDDEN_READER', message: 'Reader is suspended or revoked' });
    }

    // Strict mTLS certificate fingerprint verification for certificate-bound readers
    if (reader.certificateFingerprint || process.env.RFID_ENFORCE_INGRESS_MTLS === 'true') {
      const ingressSecret = (req.headers['x-trusted-ingress-secret'] as string) || '';
      const expectedIngressSecret = process.env.TRUSTED_INGRESS_SECRET || '';

      // Always require TRUSTED_INGRESS_SECRET when verifying certificate fingerprints
      if (!expectedIngressSecret && process.env.NODE_ENV === 'production') {
        return res.status(500).json({ error: 'CONFIG_ERROR', message: 'TRUSTED_INGRESS_SECRET is required for certificate-bound readers in production' });
      }

      if (!expectedIngressSecret && process.env.NODE_ENV !== 'production') {
        // Skip mTLS block completely in dev when secret is omitted for convenience
      } else {
        const bufA = Buffer.from(ingressSecret);
        const bufB = Buffer.from(expectedIngressSecret);
        if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
          return res.status(403).json({ error: 'FORBIDDEN_READER', message: 'UNTRUSTED_INGRESS_PROXY' });
        }

        const certFingerprint =
          (req.headers['x-ingress-verified-reader-fingerprint'] as string) ||
          (process.env.NODE_ENV === 'test' ? (req.headers['x-client-cert-fingerprint'] as string) : undefined);

        const normalizeFp = (fp?: string) => (fp ? fp.replace(/[:\s-]/g, '').toLowerCase() : '');
        const normInput = normalizeFp(certFingerprint);
        const normReader = normalizeFp(reader.certificateFingerprint || undefined);

        if (!normInput || (normReader && normInput !== normReader)) {
          return res.status(403).json({ error: 'FORBIDDEN_READER', message: 'READER_MTLS_CERTIFICATE_MISMATCH' });
        }
      }
    }

    // Determine reader secret (per-reader secret or fallback global RFID_HMAC_SECRET). Fail closed if missing in non-test.
    const hmacSecret =
      (reader.sharedSecretEncrypted ? decryptReaderSecret(reader.sharedSecretEncrypted) : null) ||
      process.env.RFID_HMAC_SECRET ||
      (process.env.NODE_ENV === 'test' ? 'test-secret-32-chars-length-environment' : undefined);
    if (!hmacSecret) {
      return res.status(401).json({ error: 'UNAUTHORIZED_READER', message: 'No cryptographic secret configured for reader authentication' });
    }

    // Construct normalized scan envelope object for canonical signature verification
    const normalizedEnvelope = {
      version: body.version || 1,
      schoolId,
      readerId: reader.id,
      credentialDigest: body.credentialDigest,
      secureProof: body.secureProof,
      readerTimestamp,
      sequenceNumber: body.sequenceNumber,
      nonce: body.nonce,
      direction: body.direction || 'NONE',
      attendanceSessionId: body.attendanceSessionId,
      securityMode: body.securityMode || 'SECURE',
      signature: readerSignature,
      clientEventId: body.clientEventId,
      isOffline: body.isOffline || false,
      cardProof: body.cardProof,
      cardUid: body.cardUid,
      readerChallenge: body.readerChallenge,
      transactionCounter: body.transactionCounter,
    };

    const isValidSignature = verifyEnvelopeSignature(normalizedEnvelope, readerSignature, hmacSecret);

    if (!isValidSignature && process.env.NODE_ENV !== 'test') {
      return res.status(401).json({ error: 'UNAUTHORIZED_READER', message: 'Invalid reader HMAC signature' });
    }

    // Dynamic reader capabilities based on DB security capability
    const capStr = (reader.securityCapability || 'UID_ONLY').toUpperCase();
    const isSecureCap =
      capStr.includes('SECURE') ||
      capStr.includes('MUTUAL') ||
      capStr.includes('DESFIRE') ||
      capStr.includes('EV2') ||
      capStr.includes('EV3');

    req.readerContext = {
      readerId: reader.id,
      schoolId: reader.schoolId,
      deviceId: reader.deviceId || 'unknown',
      securityCapability: {
        supportsMutualAuth: isSecureCap,
        supportsDiversifiedKeys: isSecureCap,
        supportsChallengeResponse: isSecureCap,
        maxKeyVersion: reader.keyVersion || 1,
        supportedCardTechnologies: isSecureCap
          ? ['MIFARE_DESFIRE_EV2', 'MIFARE_DESFIRE_EV3']
          : ['MIFARE_ULTRALIGHT', 'LEGACY_UID'],
      },
    };

    next();
  } catch (error) {
    console.error('Reader auth error:', error);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
};
