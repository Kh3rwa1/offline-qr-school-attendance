import { and, eq } from 'drizzle-orm';
import type { Db, Tx } from '../../db';
import { env } from '../../env';
import { attendanceRecords, notificationJobs } from '../../db/schema';

/** Call inside the finalize transaction. Schedules, never sends. */
export async function scheduleAbsenceSms(tx: Db | Tx, args: { schoolId: string; sessionId: string }) {
  const sendAfter = new Date(Date.now() + env.ABSENCE_SMS_DELAY_MINUTES * 60_000);
  const absent = await tx
    .select({
      id: attendanceRecords.id,
      studentId: attendanceRecords.studentId,
    })
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.attendanceSessionId, args.sessionId),
        eq(attendanceRecords.status, 'ABSENT')
      )
    );

  if (!absent.length) return 0;

  await tx
    .insert(notificationJobs)
    .values(
      absent.map((r) => ({
        schoolId: args.schoolId,
        attendanceSessionId: args.sessionId,
        studentId: r.studentId,
        attendanceRecordId: r.id,
        recipientPhone: 'PENDING',
        messageBody: 'Child marked absent',
        kind: 'ABSENCE' as const,
        status: 'SCHEDULED',
        sendAfter,
      }))
    )
    .onConflictDoNothing();

  return absent.length;
}

/** Call whenever a record's status changes (teacher correction). */
export async function onAttendanceCorrected(
  tx: Db | Tx,
  rec: { id: string; schoolId: string; studentId: string; from: string; to: string }
) {
  if (rec.from !== 'ABSENT' || rec.to === 'ABSENT') return;

  // Not yet sent -> cancel silently
  const cancelled = await tx
    .update(notificationJobs)
    .set({ status: 'CANCELLED', cancelledReason: 'CORRECTED_BEFORE_SEND' })
    .where(
      and(
        eq(notificationJobs.attendanceRecordId, rec.id),
        eq(notificationJobs.kind, 'ABSENCE'),
        eq(notificationJobs.status, 'SCHEDULED')
      )
    )
    .returning({ id: notificationJobs.id });

  if (cancelled.length) return;

  // Already sent -> send a correction, immediately
  const [sent] = await tx
    .select({
      id: notificationJobs.id,
      attendanceSessionId: notificationJobs.attendanceSessionId,
      recipientPhone: notificationJobs.recipientPhone,
      language: notificationJobs.language,
    })
    .from(notificationJobs)
    .where(
      and(
        eq(notificationJobs.attendanceRecordId, rec.id),
        eq(notificationJobs.kind, 'ABSENCE'),
        eq(notificationJobs.status, 'SENT')
      )
    )
    .limit(1);

  if (sent) {
    await tx
      .insert(notificationJobs)
      .values({
        schoolId: rec.schoolId,
        attendanceSessionId: sent.attendanceSessionId,
        studentId: rec.studentId,
        attendanceRecordId: rec.id,
        recipientPhone: sent.recipientPhone,
        messageBody: 'CORRECTION: Child marked present',
        language: sent.language,
        notificationType: 'CORRECTION',
        kind: 'CORRECTION' as const,
        status: 'SCHEDULED',
        sendAfter: new Date(),
      })
      .onConflictDoNothing();
  }
}
