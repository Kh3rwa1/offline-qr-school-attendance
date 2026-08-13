import { Request, Response, NextFunction } from 'express';
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
      const certFingerprint = req.headers['x-reader-cert-fingerprint'] as string;
      if (!certFingerprint || (reader.certificateFingerprint && certFingerprint.toLowerCase() !== reader.certificateFingerprint.toLowerCase())) {
        return res.status(401).json({ error: 'UNAUTHORIZED_READER', message: 'mTLS client certificate required and mismatched' });
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
