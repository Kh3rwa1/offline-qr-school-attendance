import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
// Assuming rfidReaders is exported from schema. Adjust as necessary if it isn't.
import { rfidReaders } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { SecurityCapability } from '../services/rfid/adapters/types';

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

    // Validate reader exists and is ACTIVE in rfidReaders table
    const [reader] = await db
      .select()
      .from(rfidReaders)
      .where(and(eq(rfidReaders.id, readerId)));

    if (!reader) {
      // Do not reveal whether a reader belongs to another school by just checking readerId
      // Actually, since we queried by readerId, if it doesn't exist at all, return 401
      return res.status(401).json({ error: 'UNAUTHORIZED_READER' });
    }

    if (reader.schoolId !== schoolId) {
      // Return 401 to not reveal it belongs to another school
      return res.status(401).json({ error: 'UNAUTHORIZED_READER' });
    }

    if (reader.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'FORBIDDEN_READER', message: 'Reader is suspended or revoked' });
    }

    // TODO: Validate X-Reader-Signature using reader's public key or shared secret
    
    // Attach reader context
    req.readerContext = {
      readerId: reader.id,
      schoolId: reader.schoolId,
      deviceId: reader.deviceId || 'unknown',
      securityCapability: {
        supportsMutualAuth: true,
        supportsDiversifiedKeys: true,
        supportsChallengeResponse: true,
        maxKeyVersion: 1,
        supportedCardTechnologies: ['MIFARE_DESFIRE']
      }
    };

    next();
  } catch (error) {
    console.error('Reader auth error:', error);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
};
