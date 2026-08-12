import { eq, and, inArray, lt, or, desc } from 'drizzle-orm';
import { db } from '../db';
import { notificationJobs, notificationAttempts, schoolSmsSettings } from '../db/schema';
import { getSmsProvider } from './sms/smsProvider';

export interface WorkerProcessOptions {
  limit?: number;
  providerName?: string;
  maxRetries?: number;
  backoffBaseMs?: number;
}

/**
 * Processes QUEUED or FAILED notification jobs from PostgreSQL queue.
 * Implements bounded retries with exponential backoff and permanent-failure handling.
 */
export async function processNotificationQueue(options: WorkerProcessOptions = {}) {
  const limit = options.limit || 20;
  const maxRetries = options.maxRetries || 3;
  const backoffBaseMs = options.backoffBaseMs || 1000;
  const provider = getSmsProvider(options.providerName);

  // Fetch pending jobs
  const candidateJobs = await db
    .select()
    .from(notificationJobs)
    .where(
      and(
        inArray(notificationJobs.status, ['QUEUED', 'FAILED']),
        lt(notificationJobs.attemptCount, maxRetries)
      )
    )
    .limit(limit);

  if (candidateJobs.length === 0) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      permanentFailures: 0,
    };
  }

  const now = Date.now();
  let processed = 0;
  let sent = 0;
  let failed = 0;
  let permanentFailures = 0;

  for (const job of candidateJobs) {
    // Exponential backoff check for FAILED retry attempts
    if (job.status === 'FAILED') {
      // Find the latest attempt timestamp from attempts table
      const [lastAttempt] = await db
        .select()
        .from(notificationAttempts)
        .where(eq(notificationAttempts.jobId, job.id))
        .orderBy(desc(notificationAttempts.attemptedAt))
        .limit(1);

      if (lastAttempt) {
        const timeSinceLastAttempt = now - new Date(lastAttempt.attemptedAt).getTime();
        const requiredBackoff = Math.pow(2, job.attemptCount) * backoffBaseMs;
        if (timeSinceLastAttempt < requiredBackoff) {
          // Skip for now due to exponential backoff window
          continue;
        }
      }
    }

    // Atomic job claim: set status to SENDING only if still QUEUED or FAILED
    const [claimedJob] = await db
      .update(notificationJobs)
      .set({ status: 'SENDING' })
      .where(
        and(
          eq(notificationJobs.id, job.id),
          inArray(notificationJobs.status, ['QUEUED', 'FAILED'])
        )
      )
      .returning();

    if (!claimedJob) {
      // Job claimed by another concurrent worker
      continue;
    }

    // Fetch school SMS settings for DLT entity ID and header
    const [settings] = await db
      .select()
      .from(schoolSmsSettings)
      .where(eq(schoolSmsSettings.schoolId, job.schoolId));

    const nextAttemptNumber = job.attemptCount + 1;

    try {
      const sendResult = await provider.sendSms({
        to: job.recipientPhone,
        message: job.messageBody,
        dltPrincipalEntityId: settings?.dltPrincipalEntityId || undefined,
        dltHeader: settings?.dltHeader || undefined,
        jobId: job.id,
      });

      if (sendResult.success) {
        // Successful send
        await db
          .update(notificationJobs)
          .set({
            status: 'SENT',
            providerMessageId: sendResult.providerMessageId || null,
            attemptCount: nextAttemptNumber,
            sentAt: new Date(),
            failureReason: null,
          })
          .where(eq(notificationJobs.id, job.id));

        await db.insert(notificationAttempts).values({
          jobId: job.id,
          attemptNumber: nextAttemptNumber,
          status: 'SENT',
          responsePayload: { providerMessageId: sendResult.providerMessageId },
        });

        sent++;
      } else {
        // Failed send
        const isPermanent = sendResult.isPermanentFailure || nextAttemptNumber >= maxRetries;
        const finalStatus = isPermanent ? 'PERMANENT_FAILURE' : 'FAILED';

        await db
          .update(notificationJobs)
          .set({
            status: finalStatus,
            attemptCount: nextAttemptNumber,
            failureReason: sendResult.error || 'PROVIDER_SEND_ERROR',
          })
          .where(eq(notificationJobs.id, job.id));

        await db.insert(notificationAttempts).values({
          jobId: job.id,
          attemptNumber: nextAttemptNumber,
          status: finalStatus,
          errorMessage: sendResult.error || 'PROVIDER_SEND_ERROR',
        });

        if (isPermanent) {
          permanentFailures++;
        } else {
          failed++;
        }
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'UNKNOWN_WORKER_ERROR';
      const isPermanent = nextAttemptNumber >= maxRetries;
      const finalStatus = isPermanent ? 'PERMANENT_FAILURE' : 'FAILED';

      await db
        .update(notificationJobs)
        .set({
          status: finalStatus,
          attemptCount: nextAttemptNumber,
          failureReason: errorMsg,
        })
        .where(eq(notificationJobs.id, job.id));

      await db.insert(notificationAttempts).values({
        jobId: job.id,
        attemptNumber: nextAttemptNumber,
        status: finalStatus,
        errorMessage: errorMsg,
      });

      if (isPermanent) {
        permanentFailures++;
      } else {
        failed++;
      }
    }

    processed++;
  }

  return {
    processed,
    sent,
    failed,
    permanentFailures,
  };
}
