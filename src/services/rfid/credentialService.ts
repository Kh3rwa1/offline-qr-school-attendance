import { withTenantContext } from '../../db';
import { rfidCredentials, students, enrollments } from '../../db/schema';
import { eq, and, inArray, desc, lt, isNotNull, sql } from 'drizzle-orm';
import { createAuditLog } from '../auditLogService';
import {
  redactCredentialDigest,
  canonicalizeEpc,
  computeEpcDigest,
  getEpcLastFour,
} from './cryptoService';

export async function enrollCredential(params: {
  schoolId: string;
  studentId: string;
  credentialDigest: string;
  credentialType?: string;
  epcLastFour?: string;
  tidDigest?: string;
  securityMode?: 'SECURE' | 'UID_LEGACY' | 'UHF_EPC';
  keyVersion?: number;
  operatorUserId: string;
  expiresAt?: Date;
}) {
  const {
    schoolId,
    studentId,
    credentialDigest,
    credentialType = 'UHF_EPC_GEN2',
    epcLastFour,
    tidDigest,
    securityMode = 'UHF_EPC',
    keyVersion = 1,
    operatorUserId,
    expiresAt,
  } = params;

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
        credentialType,
        credentialDigest,
        epcLastFour,
        tidDigest,
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

export async function reactivateCredential(credentialId: string, schoolId: string, reason?: string, actorId?: string) {
  return withTenantContext(schoolId, async (tx) => {
    const existing = await tx
      .select()
      .from(rfidCredentials)
      .where(and(eq(rfidCredentials.id, credentialId), eq(rfidCredentials.schoolId, schoolId)))
      .limit(1);

    if (existing.length === 0) {
      const err: any = new Error('CARD_NOT_FOUND: RFID credential not found');
      err.statusCode = 404;
      throw err;
    }

    if (existing[0].status !== 'SUSPENDED') {
      const err: any = new Error(`CARD_NOT_SUSPENDED: Cannot reactivate card with status ${existing[0].status}`);
      err.statusCode = 409;
      throw err;
    }

    const [credential] = await tx
      .update(rfidCredentials)
      .set({ status: 'ACTIVE' })
      .where(and(eq(rfidCredentials.id, credentialId), eq(rfidCredentials.schoolId, schoolId), eq(rfidCredentials.status, 'SUSPENDED')))
      .returning();

    await createAuditLog({
      schoolId,
      actorId: sanitizeActorId(actorId),
      action: 'RFID_CREDENTIAL_REACTIVATED',
      resourceId: credentialId,
      resourceType: 'RFID_CREDENTIAL',
      metadata: { reason: reason || 'Reactivated by operator/admin' },
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

import { encodeCursor, decodeCursor, parseLimit } from '../paginationHelper';

export async function listAllCredentials(
  schoolId: string,
  options?: { limit?: number | string | null; cursor?: string | null }
) {
  const limit = parseLimit(options?.limit, 50, 200);
  const decoded = decodeCursor(options?.cursor);

  return withTenantContext(schoolId, async (tx) => {
    let conditions: any[] = [eq(rfidCredentials.schoolId, schoolId)];

    if (decoded) {
      const cursorTime = decoded.timestamp ? new Date(decoded.timestamp) : new Date(0);
      conditions.push(
        sql`(${rfidCredentials.createdAt} < ${cursorTime} OR (${rfidCredentials.createdAt} = ${cursorTime} AND ${rfidCredentials.id} < ${decoded.id}))`
      );
    }

    const query = tx
      .select({
        id: rfidCredentials.id,
        studentId: rfidCredentials.studentId,
        studentName: students.name,
        studentCode: students.studentCode,
        credentialDigest: rfidCredentials.credentialDigest,
        securityMode: rfidCredentials.securityMode,
        keyVersion: rfidCredentials.keyVersion,
        status: rfidCredentials.status,
        issuedAt: rfidCredentials.createdAt,
        expiresAt: rfidCredentials.expiresAt,
      })
      .from(rfidCredentials)
      .leftJoin(students, eq(rfidCredentials.studentId, students.id))
      .where(and(...conditions))
      .orderBy(desc(rfidCredentials.createdAt), desc(rfidCredentials.id))
      .limit(limit + 1);

    const rows = await query;
    const hasMore = rows.length > limit;
    const records = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && records.length > 0) {
      const last = records[records.length - 1];
      nextCursor = encodeCursor({
        id: last.id,
        timestamp: last.issuedAt ? new Date(last.issuedAt).toISOString() : undefined,
      });
    }

    const sanitized = records.map((c: any) => ({
      ...c,
      credentialDigest: redactCredentialDigest(c.credentialDigest),
    }));

    return Object.assign(sanitized, {
      items: sanitized,
      nextCursor,
      hasMore,
      limit,
    });
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
  entries: Array<{
    studentId?: string;
    studentCode?: string;
    rollNumber?: number | string;
    classSectionId?: string;
    epc?: string;
    credentialDigest?: string;
    securityMode?: string;
    keyVersion?: number;
  }>;
  operatorUserId: string;
}) {
  return withTenantContext(params.schoolId, async (tx) => {
    const results = [];
    for (const entry of params.entries) {
      try {
        let resolvedStudentId = entry.studentId;

        // If studentId not provided, resolve by studentCode
        if (!resolvedStudentId && entry.studentCode) {
          const [st] = await tx
            .select({ id: students.id })
            .from(students)
            .where(
              and(
                eq(students.schoolId, params.schoolId),
                eq(students.studentCode, entry.studentCode.trim())
              )
            )
            .limit(1);
          if (st) resolvedStudentId = st.id;
        }

        // Or resolve by rollNumber
        if (!resolvedStudentId && entry.rollNumber !== undefined) {
          const rollNum = Number(entry.rollNumber);
          const conditions = [
            eq(enrollments.schoolId, params.schoolId),
            eq(enrollments.rollNumber, rollNum),
            eq(enrollments.status, 'ACTIVE'),
          ];
          if (entry.classSectionId) {
            conditions.push(eq(enrollments.classSectionId, entry.classSectionId));
          }
          const [enr] = await tx
            .select({ studentId: enrollments.studentId })
            .from(enrollments)
            .where(and(...conditions))
            .limit(1);
          if (enr) resolvedStudentId = enr.studentId;
        }

        if (!resolvedStudentId) {
          throw new Error('STUDENT_NOT_FOUND: Could not resolve student by ID, code, or roll number');
        }

        let digest = entry.credentialDigest;
        let epcLastFour: string | undefined = undefined;
        const credentialType = 'UHF_EPC_GEN2';

        if (entry.epc) {
          const canonical = canonicalizeEpc(entry.epc);
          digest = computeEpcDigest(canonical);
          epcLastFour = getEpcLastFour(canonical);
        }

        if (!digest) {
          throw new Error('MISSING_EPC_OR_DIGEST: Either epc or credentialDigest must be provided');
        }

        const res = await enrollCredential({
          schoolId: params.schoolId,
          studentId: resolvedStudentId,
          credentialDigest: digest,
          credentialType,
          epcLastFour,
          securityMode: (entry.securityMode as any) || 'UHF_EPC',
          keyVersion: entry.keyVersion || 1,
          operatorUserId: params.operatorUserId,
        });

        // Activate directly
        await activateCredential(res.id, params.schoolId, params.operatorUserId);

        results.push({
          studentId: resolvedStudentId,
          studentCode: entry.studentCode,
          rollNumber: entry.rollNumber,
          success: true,
          credentialId: res.id,
          epcLastFour,
        });
      } catch (err: any) {
        results.push({
          studentId: entry.studentId,
          studentCode: entry.studentCode,
          rollNumber: entry.rollNumber,
          success: false,
          error: err.message,
        });
      }
    }
    return results;
  });
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
  listAllCredentials,
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
