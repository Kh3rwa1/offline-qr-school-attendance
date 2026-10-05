import { and, eq } from 'drizzle-orm';
import { withTenantContext } from '../../db';
import { rfidReaders } from '../../db/schema';
import { hashReaderToken, parseBearer } from './readerTokens';
import { verifyZebraHmacSignature, timingSafeEqual } from './cryptoService';
import { decryptReaderSecret } from './readerService';
import { readerAuthFailed, AppError } from '../../errors/AppError';

export interface AuthenticatedReader {
  id: string;
  name: string;
  schoolId: string;
  status: string;
  authMethod: 'HMAC' | 'BEARER' | 'LEGACY_SECRET_AS_BEARER';
  assignedClassSectionId?: string | null;
}

const LEGACY_FALLBACK = process.env.LEGACY_READER_BEARER_FALLBACK === 'true';
export const LEGACY_SUNSET = '2026-12-31';

export async function findReaderByIdentifier(schoolId: string, readerIdentifier: string) {
  return await withTenantContext(schoolId, async (tx) => {
    const isUuid = /^[0-9a-fA-F-]{36}$/.test(readerIdentifier);
    if (isUuid) {
      const [byUuid] = await tx
        .select()
        .from(rfidReaders)
        .where(and(eq(rfidReaders.id, readerIdentifier), eq(rfidReaders.schoolId, schoolId)));
      if (byUuid) return byUuid;
    }
    const [byDeviceId] = await tx
      .select()
      .from(rfidReaders)
      .where(and(eq(rfidReaders.deviceId, readerIdentifier), eq(rfidReaders.schoolId, schoolId)));
    return byDeviceId || null;
  });
}

export async function touchLastUsed(schoolId: string, readerId: string): Promise<void> {
  await withTenantContext(schoolId, async (tx) => {
    await tx
      .update(rfidReaders)
      .set({
        bearerTokenLastUsedAt: new Date(),
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(rfidReaders.id, readerId), eq(rfidReaders.schoolId, schoolId)));
  });
}

export async function authenticateZebraRequest(params: {
  schoolId: string;
  headers: Record<string, string | string[] | undefined>;
  rawBody: Buffer;
  readerIdentifier?: string;
}): Promise<AuthenticatedReader> {
  const { schoolId, headers, rawBody, readerIdentifier } = params;
  const signature =
    (headers['x-zebra-signature'] as string) ||
    (headers['x-reader-signature'] as string) ||
    (headers['x-signature'] as string) ||
    (headers['x-hub-signature-256'] as string);

  // Path A: HMAC signature (preferred when the connector supports it)
  if (typeof signature === 'string' && readerIdentifier) {
    const reader = await findReaderByIdentifier(schoolId, readerIdentifier);
    if (!reader?.sharedSecretEncrypted) {
      throw readerAuthFailed({ reason: 'hmac_reader_missing', schoolId });
    }
    const secret = decryptReaderSecret(reader.sharedSecretEncrypted);
    if (!verifyZebraHmacSignature(rawBody, signature, secret)) {
      throw readerAuthFailed({ reason: 'hmac_mismatch', readerId: reader.id });
    }
    return finalize(reader, 'HMAC');
  }

  // Path B: dedicated bearer token
  const token = parseBearer(headers['authorization']);
  if (token) {
    const tokenHash = hashReaderToken(token);
    const reader = await withTenantContext(schoolId, async (tx) => {
      const rows = await tx
        .select()
        .from(rfidReaders)
        .where(and(eq(rfidReaders.schoolId, schoolId), eq(rfidReaders.bearerTokenHash, tokenHash)))
        .limit(1);
      return rows[0];
    });
    if (reader) return finalize(reader, 'BEARER');
  }

  // Path C: legacy fallback (temporary, loud, off by default)
  if (LEGACY_FALLBACK && readerIdentifier && typeof headers['authorization'] === 'string') {
    const legacyToken = headers['authorization'].replace(/^Bearer\s+/i, '').trim();
    const legacy = await findReaderByIdentifier(schoolId, readerIdentifier);
    if (legacy?.sharedSecretEncrypted) {
      const decrypted = decryptReaderSecret(legacy.sharedSecretEncrypted);
      if (timingSafeEqual(legacyToken, decrypted)) {
        console.warn(
          JSON.stringify({
            level: 'warn',
            code: 'LEGACY_READER_AUTH_USED',
            readerId: legacy.id,
            message: `Rotate this reader to a dedicated bearer token before ${LEGACY_SUNSET}`,
          })
        );
        return finalize(legacy, 'LEGACY_SECRET_AS_BEARER');
      }
    }
  }

  throw readerAuthFailed({ reason: 'bearer_mismatch', schoolId });
}

import type { RfidReader } from '../../db/types';

async function finalize(
  reader: RfidReader,
  authMethod: AuthenticatedReader['authMethod']
): Promise<AuthenticatedReader> {
  if (reader.status !== 'ACTIVE') {
    // Only now — after successful auth — may we reveal status.
    throw new AppError('FORBIDDEN_READER', 403, 'Reader is not active', {
      internal: { readerId: reader.id, status: reader.status },
    });
  }
  // Fire-and-forget last-used stamp (don't block ingest on it)
  void touchLastUsed(reader.schoolId, reader.id).catch(() => {});
  return {
    id: reader.id,
    name: reader.name,
    schoolId: reader.schoolId,
    status: reader.status,
    authMethod,
    assignedClassSectionId: reader.assignedClassSectionId || null,
  };
}
