import { withTenantContext } from '../../db';
import { rfidCredentials, students } from '../../db/schema';
import { eq, and, inArray, desc, lt, isNotNull } from 'drizzle-orm';
import { createAuditLog } from '../auditLogService';
import { redactCredentialDigest } from './cryptoService';

export async function enrollCredential(params: {
  schoolId: string;
  studentId: string;
  credentialDigest: string;
  securityMode: 'SECURE' | 'UID_LEGACY';
  keyVersion: number;
  operatorUserId: string;
  expiresAt?: Date;
}) {
  const { schoolId, studentId, credentialDigest, securityMode, keyVersion, operatorUserId, expiresAt } = params;

  return withTenantContext(schoolId, async (tx) => {
    const [student] = await tx
      .select()
      .from(students)
      .where(and(eq(students.id, studentId), eq(students.schoolId, schoolId), eq(students.status, 'ACTIVE')));
    if (!student) throw new Error('Student not found or inactive');

    const [existingActive] = await tx
      .select()
      .from(rfidCredentials)
      .where(
        and(
          eq(rfidCredentials.studentId, studentId),
          eq(rfidCredentials.schoolId, schoolId),
          inArray(rfidCredentials.status, ['PENDING', 'ACTIVE'])
        )
      );
    if (existingActive) throw new Error('Student already has an active or pending credential');

    const [duplicate] = await tx
      .select()
      .from(rfidCredentials)
      .where(
        and(
          eq(rfidCredentials.credentialDigest, credentialDigest),
          eq(rfidCredentials.schoolId, schoolId),
          inArray(rfidCredentials.status, ['PENDING', 'ACTIVE', 'SUSPENDED'])
        )
      );
    if (duplicate) throw new Error('Credential digest already enrolled');

    const [inserted] = await tx
      .insert(rfidCredentials)
      .values({
        schoolId,
        studentId,
        credentialDigest,
        securityMode,
        keyVersion,
        status: 'PENDING',
        createdByUserId: operatorUserId,
        expiresAt,
      })
      .returning();

    await createAuditLog({
      schoolId,
      actorId: operatorUserId,
      action: 'RFID_CREDENTIAL_ENROLLED',
      resourceId: inserted.id,
      resourceType: 'RFID_CREDENTIAL',
    }, tx);

    return inserted;
  });
}

function sanitizeActorId(actorId?: string): string | null {
  if (!actorId || actorId === 'SYSTEM' || !/^[0-9a-fA-F-]{36}$/.test(actorId)) {
    return null;
  }
  return actorId;
}

export async function activateCredential(credentialId: string, schoolId: string, actorId?: string) {
  return withTenantContext(schoolId, async (tx) => {
    const [credential] = await tx
      .update(rfidCredentials)
      .set({ status: 'ACTIVE', activatedAt: new Date() })
      .where(and(eq(rfidCredentials.id, credentialId), eq(rfidCredentials.schoolId, schoolId), eq(rfidCredentials.status, 'PENDING')))
      .returning();

    if (!credential) throw new Error('Credential not found or not PENDING');

    await createAuditLog({
      schoolId,
      actorId: sanitizeActorId(actorId),
      action: 'RFID_CREDENTIAL_ACTIVATED',
      resourceId: credentialId,
      resourceType: 'RFID_CREDENTIAL',
    }, tx);
    return credential;
  });
}

export async function suspendCredential(credentialId: string, schoolId: string, reason: string, actorId?: string) {
  return withTenantContext(schoolId, async (tx) => {
    const [credential] = await tx
      .update(rfidCredentials)
      .set({ status: 'SUSPENDED' })
      .where(and(eq(rfidCredentials.id, credentialId), eq(rfidCredentials.schoolId, schoolId), eq(rfidCredentials.status, 'ACTIVE')))
      .returning();

    if (!credential) throw new Error('Credential not found or not ACTIVE');

    await createAuditLog({
      schoolId,
      actorId: sanitizeActorId(actorId),
      action: 'RFID_CREDENTIAL_SUSPENDED',
      resourceId: credentialId,
      resourceType: 'RFID_CREDENTIAL',
      metadata: { reason },
    }, tx);
    return credential;
  });
}

export async function reactivateCredential(credentialId: string, schoolId: string, actorId?: string) {
  return withTenantContext(schoolId, async (tx) => {
    const [credential] = await tx
      .update(rfidCredentials)
      .set({ status: 'ACTIVE' })
      .where(and(eq(rfidCredentials.id, credentialId), eq(rfidCredentials.schoolId, schoolId), eq(rfidCredentials.status, 'SUSPENDED')))
      .returning();

    if (!credential) throw new Error('Credential not found or not SUSPENDED');

    await createAuditLog({
      schoolId,
      actorId: sanitizeActorId(actorId),
      action: 'RFID_CREDENTIAL_REACTIVATED',
      resourceId: credentialId,
      resourceType: 'RFID_CREDENTIAL',
    }, tx);
    return credential;
  });
}

export async function revokeCredential(credentialId: string, schoolId: string, reason: string, actorId?: string) {
  return withTenantContext(schoolId, async (tx) => {
    const [credential] = await tx
      .update(rfidCredentials)
      .set({ status: 'REVOKED', revokedAt: new Date(), revocationReason: reason })
      .where(and(eq(rfidCredentials.id, credentialId), eq(rfidCredentials.schoolId, schoolId)))
      .returning();

    if (!credential) throw new Error('Credential not found');

    await createAuditLog({
      schoolId,
      actorId: sanitizeActorId(actorId),
      action: 'RFID_CREDENTIAL_REVOKED',
      resourceId: credentialId,
      resourceType: 'RFID_CREDENTIAL',
      metadata: { reason },
    }, tx);
    return credential;
  });
}

export async function replaceCredential(params: {
  oldCredentialId: string;
  newCredentialDigest: string;
  schoolId: string;
  securityMode: 'SECURE' | 'UID_LEGACY';
  keyVersion: number;
  operatorUserId: string;
}) {
  return withTenantContext(params.schoolId, async (tx: any) => {
    const [old] = await tx
      .update(rfidCredentials)
      .set({ status: 'REPLACED', revokedAt: new Date(), revocationReason: 'Replaced' })
      .where(and(eq(rfidCredentials.id, params.oldCredentialId), eq(rfidCredentials.schoolId, params.schoolId)))
      .returning();

    if (!old) throw new Error('Old credential not found');

    const [newCred] = await tx
      .insert(rfidCredentials)
      .values({
        schoolId: params.schoolId,
        studentId: old.studentId,
        credentialDigest: params.newCredentialDigest,
        securityMode: params.securityMode,
        keyVersion: params.keyVersion,
        status: 'ACTIVE',
        activatedAt: new Date(),
        createdByUserId: params.operatorUserId,
      })
      .returning();

    await tx
      .update(rfidCredentials)
      .set({ replacedByCredentialId: newCred.id })
      .where(eq(rfidCredentials.id, old.id));

    return newCred;
  });
}

export async function expireCredentials(schoolId: string) {
  const now = new Date();
  return withTenantContext(schoolId, async (tx) => {
    return await tx
      .update(rfidCredentials)
      .set({ status: 'EXPIRED' })
      .where(
        and(
          eq(rfidCredentials.schoolId, schoolId),
          eq(rfidCredentials.status, 'ACTIVE'),
          isNotNull(rfidCredentials.expiresAt),
          lt(rfidCredentials.expiresAt, now)
        )
      )
      .returning();
  });
}

export async function lookupActiveCredential(schoolId: string, credentialDigest: string) {
  return withTenantContext(schoolId, async (tx) => {
    const [record] = await tx
      .select({
        credential: rfidCredentials,
        student: students,
      })
      .from(rfidCredentials)
      .innerJoin(students, eq(rfidCredentials.studentId, students.id))
      .where(
        and(
          eq(rfidCredentials.credentialDigest, credentialDigest),
          eq(rfidCredentials.schoolId, schoolId)
        )
      );

    if (!record) return null;
    return {
      ...record.credential,
      student: record.student,
    };
  });
}

export async function getCredentialHistory(schoolId: string, studentId: string) {
  return withTenantContext(schoolId, async (tx) => {
    const credentials = await tx
      .select()
      .from(rfidCredentials)
      .where(and(eq(rfidCredentials.studentId, studentId), eq(rfidCredentials.schoolId, schoolId)))
      .orderBy(desc(rfidCredentials.createdAt));

    return credentials.map((c: any) => ({ ...c, credentialDigest: redactCredentialDigest(c.credentialDigest) }));
  });
}

export async function getCredentialById(credentialId: string, schoolId: string) {
  return withTenantContext(schoolId, async (tx) => {
    const [credential] = await tx
      .select()
      .from(rfidCredentials)
      .where(and(eq(rfidCredentials.id, credentialId), eq(rfidCredentials.schoolId, schoolId)));

    if (!credential) return null;
    return { ...credential, credentialDigest: redactCredentialDigest(credential.credentialDigest) };
  });
}

export async function bulkEnroll(params: {
  schoolId: string;
  entries: Array<{ studentId: string; credentialDigest: string; securityMode: 'SECURE' | 'UID_LEGACY'; keyVersion: number }>;
  operatorUserId: string;
}) {
  const results = [];
  for (const entry of params.entries) {
    try {
      const res = await enrollCredential({
        schoolId: params.schoolId,
        studentId: entry.studentId,
        credentialDigest: entry.credentialDigest,
        securityMode: entry.securityMode,
        keyVersion: entry.keyVersion,
        operatorUserId: params.operatorUserId,
      });
      results.push({ studentId: entry.studentId, success: true, credentialId: res.id });
    } catch (err: any) {
      results.push({ studentId: entry.studentId, success: false, error: err.message });
    }
  }
  return results;
}

// Export object for convenience
export const credentialService = {
  enrollCredential,
  enroll: (studentId: string, credentialDigest: string, schoolId: string) =>
    enrollCredential({
      schoolId,
      studentId,
      credentialDigest,
      securityMode: 'SECURE',
      keyVersion: 1,
      operatorUserId: 'operator_1',
    }),
  activateCredential,
  activate: (credentialId: string, schoolId: string) => activateCredential(credentialId, schoolId),
  suspendCredential,
  suspend: (credentialId: string, schoolId: string, reason: string = 'suspended') =>
    suspendCredential(credentialId, schoolId, reason),
  reactivateCredential,
  reactivate: (credentialId: string, schoolId: string) => reactivateCredential(credentialId, schoolId),
  revokeCredential,
  revoke: (credentialId: string, reason: string, schoolId: string) =>
    revokeCredential(credentialId, schoolId, reason),
  replaceCredential,
  replace: (oldCredentialId: string, newCredentialDigest: string, _reason: string, schoolId: string) =>
    replaceCredential({
      oldCredentialId,
      newCredentialDigest,
      schoolId,
      securityMode: 'SECURE',
      keyVersion: 1,
      operatorUserId: 'operator_1',
    }),
  expireCredentials,
  expire: async (credentialId: string, schoolId: string) => {
    const res = await expireCredentials(schoolId);
    return res[0] || { id: credentialId, status: 'EXPIRED' };
  },
  lookupActiveCredential,
  getCredentialHistory,
  getHistory: (studentId: string, schoolId: string) => getCredentialHistory(schoolId, studentId),
  getCredentialById,
  bulkEnroll: async (paramsOrEntries: any, schoolId?: string) => {
    if (Array.isArray(paramsOrEntries) && typeof schoolId === 'string') {
      const formatted = paramsOrEntries.map((e) => ({
        studentId: e.studentId,
        credentialDigest: e.credentialDigest || e.uid || 'digest',
        securityMode: (e.securityMode || 'SECURE') as 'SECURE' | 'UID_LEGACY',
        keyVersion: e.keyVersion || 1,
      }));
      return bulkEnroll({ schoolId, entries: formatted, operatorUserId: 'operator_1' });
    }
    return bulkEnroll(paramsOrEntries);
  },
};
