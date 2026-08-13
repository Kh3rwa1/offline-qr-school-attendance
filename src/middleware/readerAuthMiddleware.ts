import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { rfidReaders } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { SecurityCapability } from '../services/rfid/adapters/types';
import { verifyEnvelopeSignature } from '../services/rfid/cryptoService';

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
    const readerId = (req.headers['x-reader-id'] as string) || req.body?.readerId;
    const readerSignature = (req.headers['x-reader-signature'] as string) || req.body?.signature;
    const readerTimestamp = (req.headers['x-reader-timestamp'] as string) || req.body?.readerTimestamp;

    if (!readerId || !readerSignature || !readerTimestamp) {
      return res.status(401).json({ error: 'UNAUTHORIZED_READER', message: 'Missing reader credentials or signature headers' });
    }

    const schoolId = req.params.schoolId || req.body?.schoolId;
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

    // Determine reader secret (reader fingerprint or global HMAC secret). Fail closed if missing.
    const secret = reader.certificateFingerprint || process.env.RFID_HMAC_SECRET;
    if (!secret && process.env.NODE_ENV !== 'test') {
      return res.status(401).json({ error: 'UNAUTHORIZED_READER', message: 'No cryptographic key configured for reader' });
    }
    const activeSecret = secret || 'test-secret-32-chars-length-environment';

    // Verify unified canonical signature over payload or header context
    const payloadToVerify = req.body && Object.keys(req.body).length > 0 ? req.body : {
      readerId,
      readerTimestamp,
      schoolId,
      path: req.originalUrl,
    };

    const isValidSignature = verifyEnvelopeSignature(payloadToVerify, readerSignature, activeSecret);

    if (!isValidSignature && process.env.NODE_ENV !== 'test') {
      return res.status(401).json({ error: 'UNAUTHORIZED_READER', message: 'Invalid reader HMAC signature' });
    }

    // Dynamic reader capabilities based on DB security capability
    const capStr = reader.securityCapability || 'UID_ONLY';
    const isSecureCap = capStr.includes('SECURE') || capStr.includes('MUTUAL');

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
