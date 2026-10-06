import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Db, Tx } from '../../db';
import { guardianConsents } from '../../db/schema';

export type ConsentPurpose = 'RFID_ATTENDANCE' | 'ABSENCE_SMS' | 'PHOTO';

export async function hasConsent(
  client: Db | Tx,
  schoolId: string,
  studentId: string,
  purpose: ConsentPurpose
): Promise<boolean> {
  const [row] = await client
    .select({ granted: guardianConsents.granted, withdrawnAt: guardianConsents.withdrawnAt })
    .from(guardianConsents)
    .where(
      and(
        eq(guardianConsents.schoolId, schoolId),
        eq(guardianConsents.studentId, studentId),
        eq(guardianConsents.purpose, purpose)
      )
    )
    .orderBy(desc(guardianConsents.recordedAt))
    .limit(1);

  // If no record has been created yet, default to true for backward compatibility with legacy data
  if (!row) return true;
  if (row.withdrawnAt !== null) return false;
  return row.granted === true;
}

export async function recordConsent(
  client: Db | Tx,
  params: {
    schoolId: string;
    studentId: string;
    guardianId?: string | null;
    purpose: ConsentPurpose;
    granted: boolean;
    recordedBy?: string | null;
    evidenceRef?: string | null;
  }
) {
  const [inserted] = await client
    .insert(guardianConsents)
    .values({
      schoolId: params.schoolId,
      studentId: params.studentId,
      guardianId: params.guardianId || null,
      purpose: params.purpose,
      granted: params.granted,
      recordedBy: params.recordedBy || null,
      evidenceRef: params.evidenceRef || null,
    })
    .returning();
  return inserted;
}

export async function withdrawConsent(
  client: Db | Tx,
  params: {
    schoolId: string;
    studentId: string;
    purpose: ConsentPurpose;
  }
) {
  const updated = await client
    .update(guardianConsents)
    .set({ withdrawnAt: new Date() })
    .where(
      and(
        eq(guardianConsents.schoolId, params.schoolId),
        eq(guardianConsents.studentId, params.studentId),
        eq(guardianConsents.purpose, params.purpose),
        isNull(guardianConsents.withdrawnAt)
      )
    )
    .returning();
  return updated;
}
