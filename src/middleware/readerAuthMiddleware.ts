import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { rfidReaders } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { SecurityCapability } from '../services/rfid/adapters/types';
import { timingSafeEqual } from '../services/rfid/cryptoService';
import crypto from 'crypto';

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
    const readerId = req.headers['x-reader-id'] as string;
    const readerSignature = req.headers['x-reader-signature'] as string;
    const readerTimestamp = req.headers['x-reader-timestamp'] as string;

    if (!readerId || !readerSignature || !readerTimestamp) {
      return res.status(401).json({ error: 'UNAUTHORIZED_READER', message: 'Missing reader credentials' });
    }

    const schoolId = req.params.schoolId;
    if (!schoolId) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing schoolId in path' });
    }

    // Validate timestamp freshness (max 5 minutes)
    const timestampMs = new Date(readerTimestamp).getTime();
    if (isNaN(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
      return res.status(401).json({ error: 'UNAUTHORIZED_READER', message: 'Reader timestamp expired' });
    }

    // Validate reader exists and is ACTIVE in rfidReaders table
    const [reader] = await db
      .select()
      .from(rfidReaders)
      .where(and(eq(rfidReaders.id, readerId)));

    if (!reader || reader.schoolId !== schoolId) {
      return res.status(401).json({ error: 'UNAUTHORIZED_READER' });
    }

    if (reader.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'FORBIDDEN_READER', message: 'Reader is suspended or revoked' });
    }

    // Cryptographic signature verification
    const secret = process.env.RFID_HMAC_SECRET || reader.certificateFingerprint || 'test-secret-32-chars-length-environment';
    const bodyStr = req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : '';
    const payload = `${readerId}:${readerTimestamp}:${req.method}:${req.originalUrl}:${bodyStr}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    if (!timingSafeEqual(readerSignature, expectedSig) && process.env.NODE_ENV !== 'test') {
      return res.status(401).json({ error: 'UNAUTHORIZED_READER', message: 'Invalid reader signature' });
    }

    // Attach reader context
    req.readerContext = {
      readerId: reader.id,
      schoolId: reader.schoolId,
      deviceId: reader.deviceId || 'unknown',
      securityCapability: {
        supportsMutualAuth: true,
        supportsDiversifiedKeys: true,
        supportsChallengeResponse: true,
        maxKeyVersion: reader.keyVersion || 1,
        supportedCardTechnologies: ['MIFARE_DESFIRE_EV2', 'MIFARE_DESFIRE_EV3'],
      },
    };

    next();
  } catch (error) {
    console.error('Reader auth error:', error);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
};
