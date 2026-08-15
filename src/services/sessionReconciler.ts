import { db } from '../db';
import { attendanceSessions } from '../db/schema';
import { and, inArray, lt } from 'drizzle-orm';
import { finalizeAttendanceSession } from './attendanceService';

export interface ReconcilerResult {
  checkedAt: string;
  reconciledCount: number;
  errors: Array<{ sessionId: string; error: string }>;
}

export async function reconcileStuckSessions(stuckThresholdMinutes = 15): Promise<ReconcilerResult> {
  const thresholdDate = new Date(Date.now() - stuckThresholdMinutes * 60 * 1000);
  const result: ReconcilerResult = {
    checkedAt: new Date().toISOString(),
    reconciledCount: 0,
    errors: [],
  };

  try {
    // Find sessions in 'REVIEW' or 'FINALIZE_PENDING' that haven't been touched in > threshold
    const candidateSessions = await db
      .select({
        id: attendanceSessions.id,
        schoolId: attendanceSessions.schoolId,
        teacherId: attendanceSessions.teacherId,
        status: attendanceSessions.status,
        updatedAt: attendanceSessions.updatedAt,
      })
      .from(attendanceSessions)
      .where(
        and(
          inArray(attendanceSessions.status, ['FINALIZE_PENDING', 'REVIEW']),
          lt(attendanceSessions.updatedAt, thresholdDate)
        )
      )
      .limit(50);

    for (const session of candidateSessions) {
      try {
        await finalizeAttendanceSession({
          schoolId: session.schoolId,
          sessionId: session.id,
          actorId: session.teacherId,
          userRole: 'SYSTEM',
          reason: 'Autonomous outbox-reconciler scheduled safe finalization',
          autoMarkAbsentForUnmarked: true,
        });

        result.reconciledCount++;
        console.log(
          `[SessionReconciler] ✅ Reconciled and finalized stuck session ${session.id} (school ${session.schoolId})`
        );
      } catch (err: any) {
        result.errors.push({ sessionId: session.id, error: err.message || 'Unknown error' });
        console.warn(`[SessionReconciler] ⚠️ Failed to reconcile session ${session.id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error('[SessionReconciler] ❌ Error executing session reconciler query:', err.message);
  }

  return result;
}
