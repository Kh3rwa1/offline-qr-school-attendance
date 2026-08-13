import crypto from 'node:crypto';
import { eq, and, inArray, lt, lte, or, isNull, sql } from 'drizzle-orm';
import { db, withSystemContext, withTenantContext } from '../db';
import {
  notificationJobs,
  notificationAttempts,
  schoolSmsSettings,
  notificationTemplates,
  schools,
} from '../db/schema';
import { getSmsProvider, SmsProvider } from './sms/smsProvider';
import { estimateSmsSegments } from './sms/smsUtils';

export interface WorkerProcessOptions {
  limit?: number;
  providerName?: string;
  maxRetries?: number;
  backoffBaseMs?: number;
}

type ClaimedJob = typeof notificationJobs.$inferSelect;

function mapRowToJob(row: any): ClaimedJob {
  return {
    id: row.id,
    schoolId: row.school_id || row.schoolId,
    attendanceSessionId: row.attendance_session_id || row.attendanceSessionId || null,
    studentId: row.student_id || row.studentId || null,
    recipientPhone: row.recipient_phone || row.recipientPhone,
    language: row.language || 'en',
    messageBody: row.message_body || row.messageBody,
    status: row.status,
    notificationType: row.notification_type || row.notificationType,
    attemptCount: Number(row.attempt_count ?? row.attemptCount ?? 0),
    failureReason: row.failure_reason || row.failureReason || null,
    providerMessageId: row.provider_message_id || row.providerMessageId || null,
    claimedAt: row.claimed_at ? new Date(row.claimed_at) : (row.claimedAt || null),
    claimedBy: row.claimed_by || row.claimedBy || null,
    nextAttemptAt: row.next_attempt_at ? new Date(row.next_attempt_at) : (row.nextAttemptAt || null),
    queuedAt: row.queued_at ? new Date(row.queued_at) : (row.queuedAt || new Date()),
    sentAt: row.sent_at ? new Date(row.sent_at) : (row.sentAt || null),
    deliveredAt: row.delivered_at ? new Date(row.delivered_at) : (row.deliveredAt || null),
    finalizedAttendanceVersion: row.finalized_attendance_version || row.finalizedAttendanceVersion || null,
  };
}

async function claimEligibleJobs(limit: number, maxRetries: number, workerId: string): Promise<ClaimedJob[]> {
  return withSystemContext(async (tx: any) => {
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000);

    // Clean up stale claims (older than 10 minutes) inside system context transaction
    await tx.update(notificationJobs)
      .set({ status: 'QUEUED', claimedAt: null, claimedBy: null })
      .where(and(eq(notificationJobs.status, 'SENDING'), lt(notificationJobs.claimedAt, staleBefore)));

    if (process.env.DATABASE_URL) {
      try {
        // Atomic FOR UPDATE SKIP LOCKED claim query for multi-replica concurrency safety
        const claimedRows = await tx.execute(sql`
          WITH eligible AS (
            SELECT id FROM notification_jobs
            WHERE status IN ('QUEUED', 'FAILED')
              AND attempt_count < ${maxRetries}
              AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
            ORDER BY queued_at ASC
            LIMIT ${limit}
            FOR UPDATE SKIP LOCKED
          )
          UPDATE notification_jobs
          SET status = 'SENDING', claimed_at = NOW(), claimed_by = ${workerId}
          FROM eligible
          WHERE notification_jobs.id = eligible.id
          RETURNING notification_jobs.*;
        `);

        const rawRows = Array.isArray(claimedRows) ? claimedRows : (claimedRows?.rows || []);
        if (rawRows.length > 0) {
          return rawRows.map(mapRowToJob);
        }
      } catch (err: any) {
        if (process.env.NODE_ENV === 'production') {
          console.error('[NotificationWorker] Atomic queue claim failed in production:', err.message);
          throw new Error(`ATOMIC_QUEUE_CLAIM_FAILED: ${err.message}`);
        }
      }
    }

    const candidates = await tx
      .select()
      .from(notificationJobs)
      .where(and(
        inArray(notificationJobs.status, ['QUEUED', 'FAILED']),
        lt(notificationJobs.attemptCount, maxRetries),
        or(isNull(notificationJobs.nextAttemptAt), lte(notificationJobs.nextAttemptAt, new Date())),
      ))
      .orderBy(notificationJobs.queuedAt)
      .limit(limit);

    const claimed: ClaimedJob[] = [];
    for (const job of candidates) {
      const [updated] = await tx.update(notificationJobs)
        .set({ status: 'SENDING', claimedAt: new Date(), claimedBy: workerId })
        .where(and(
          eq(notificationJobs.id, job.id),
          inArray(notificationJobs.status, ['QUEUED', 'FAILED']),
        ))
        .returning();
      if (updated) claimed.push(updated);
    }
    return claimed;
  });
}

async function recordFailure(job: ClaimedJob, errorMessage: string, maxRetries: number, permanent = false) {
  await withTenantContext(job.schoolId, async () => {
    const nextAttempt = job.attemptCount + 1;
    const isPermanent = permanent || nextAttempt >= maxRetries;
    const status = isPermanent ? 'PERMANENT_FAILURE' : 'FAILED';
    await db.update(notificationJobs)
      .set({
        status,
        attemptCount: nextAttempt,
        failureReason: errorMessage,
        claimedAt: null,
        claimedBy: null,
        nextAttemptAt: isPermanent ? null : new Date(Date.now() + Math.pow(2, nextAttempt) * 1000),
      })
      .where(and(eq(notificationJobs.id, job.id), eq(notificationJobs.schoolId, job.schoolId)));
    await db.insert(notificationAttempts).values({
      jobId: job.id,
      attemptNumber: nextAttempt,
      status,
      errorMessage,
    });
  });
}

async function processClaimedJob(job: ClaimedJob, provider: SmsProvider, maxRetries: number): Promise<'SENT' | 'FAILED' | 'PERMANENT_FAILURE' | 'CANCELLED'> {
  return withTenantContext(job.schoolId, async () => {
    const [school] = await db.select({ status: schools.status }).from(schools).where(eq(schools.id, job.schoolId));
    const [settings] = await db.select().from(schoolSmsSettings).where(eq(schoolSmsSettings.schoolId, job.schoolId));

    if (!school || school.status !== 'ACTIVE') {
      await db.update(notificationJobs).set({ status: 'CANCELLED', failureReason: 'SCHOOL_DISABLED', claimedAt: null, claimedBy: null }).where(eq(notificationJobs.id, job.id));
      return 'CANCELLED';
    }
    if (!settings && process.env.NODE_ENV === 'production') {
      await db.update(notificationJobs).set({ status: 'PERMANENT_FAILURE', failureReason: 'SMS_SETTINGS_REQUIRED', attemptCount: job.attemptCount + 1, claimedAt: null, claimedBy: null }).where(eq(notificationJobs.id, job.id));
      await db.insert(notificationAttempts).values({ jobId: job.id, attemptNumber: job.attemptCount + 1, status: 'PERMANENT_FAILURE', errorMessage: 'SMS_SETTINGS_REQUIRED' });
      return 'PERMANENT_FAILURE';
    }
    const effectiveSettings = settings || {
      smsEnabled: true,
      dltPrincipalEntityId: null,
      dltHeader: null,
      maxSegmentsPerMessage: 4,
      segmentBalance: null,
    };
    if (!effectiveSettings.smsEnabled) {
      await db.update(notificationJobs).set({ status: 'CANCELLED', failureReason: 'SMS_DISABLED', claimedAt: null, claimedBy: null }).where(eq(notificationJobs.id, job.id));
      return 'CANCELLED';
    }
    if (job.messageBody === 'GUARDIAN_OPTED_OUT' || job.messageBody === 'MISSING_GUARDIAN_PHONE' || job.messageBody === 'PHONE_NOT_IN_ALLOWLIST') {
      await db.update(notificationJobs).set({ status: 'CANCELLED', failureReason: job.messageBody, claimedAt: null, claimedBy: null }).where(eq(notificationJobs.id, job.id));
      return 'CANCELLED';
    }

    const isFake = provider.name === 'fake' || provider.name === 'console';
    if (process.env.NODE_ENV === 'production' && !isFake && (!effectiveSettings.dltPrincipalEntityId || !effectiveSettings.dltHeader)) {
      await db.update(notificationJobs).set({ status: 'PERMANENT_FAILURE', failureReason: 'DLT_CONFIGURATION_REQUIRED', attemptCount: job.attemptCount + 1, claimedAt: null, claimedBy: null }).where(eq(notificationJobs.id, job.id));
      await db.insert(notificationAttempts).values({ jobId: job.id, attemptNumber: job.attemptCount + 1, status: 'PERMANENT_FAILURE', errorMessage: 'DLT_CONFIGURATION_REQUIRED' });
      return 'PERMANENT_FAILURE';
    }

    const segments = estimateSmsSegments(job.messageBody).segmentCount;
    let balanceReserved = false;
    if (effectiveSettings.maxSegmentsPerMessage && segments > effectiveSettings.maxSegmentsPerMessage) {
      await db.update(notificationJobs).set({ status: 'PERMANENT_FAILURE', failureReason: 'SMS_SEGMENT_LIMIT_EXCEEDED', attemptCount: job.attemptCount + 1, claimedAt: null, claimedBy: null }).where(eq(notificationJobs.id, job.id));
      await db.insert(notificationAttempts).values({ jobId: job.id, attemptNumber: job.attemptCount + 1, status: 'PERMANENT_FAILURE', errorMessage: 'SMS_SEGMENT_LIMIT_EXCEEDED' });
      return 'PERMANENT_FAILURE';
    }

    if (effectiveSettings.segmentBalance !== null && effectiveSettings.segmentBalance !== undefined) {
      const [reserved] = await db.update(schoolSmsSettings)
        .set({ segmentBalance: sql`segment_balance - ${segments}` })
        .where(and(eq(schoolSmsSettings.schoolId, job.schoolId), sql`segment_balance >= ${segments}`))
        .returning();
      if (!reserved) {
        await db.update(notificationJobs).set({ status: 'PERMANENT_FAILURE', failureReason: 'SMS_BALANCE_EXCEEDED', attemptCount: job.attemptCount + 1, claimedAt: null, claimedBy: null }).where(eq(notificationJobs.id, job.id));
        await db.insert(notificationAttempts).values({ jobId: job.id, attemptNumber: job.attemptCount + 1, status: 'PERMANENT_FAILURE', errorMessage: 'SMS_BALANCE_EXCEEDED' });
        return 'PERMANENT_FAILURE';
      }
      balanceReserved = true;
    }

    const [template] = await db.select({ dltTemplateId: notificationTemplates.dltTemplateId })
      .from(notificationTemplates)
      .where(and(
        eq(notificationTemplates.schoolId, job.schoolId),
        eq(notificationTemplates.templateCode, job.notificationType),
        eq(notificationTemplates.language, job.language),
      ));

    try {
      const result = await provider.sendSms({
        to: job.recipientPhone,
        message: job.messageBody,
        dltPrincipalEntityId: effectiveSettings.dltPrincipalEntityId || undefined,
        dltHeader: effectiveSettings.dltHeader || undefined,
        dltTemplateId: template?.dltTemplateId || undefined,
        jobId: job.id,
      });
      const attemptNumber = job.attemptCount + 1;
      if (result.success) {
        await db.update(notificationJobs).set({
          status: 'SENT', providerMessageId: result.providerMessageId || null,
          attemptCount: attemptNumber, sentAt: new Date(), failureReason: null,
          claimedAt: null, claimedBy: null, nextAttemptAt: null,
        }).where(eq(notificationJobs.id, job.id));
        await db.insert(notificationAttempts).values({ jobId: job.id, attemptNumber, status: 'SENT', responsePayload: { providerMessageId: result.providerMessageId } });
        console.info('SMS job sent', { jobId: job.id, schoolId: job.schoolId });
        return 'SENT';
      }
      const permanent = Boolean(result.isPermanentFailure) || attemptNumber >= maxRetries;
      const status = permanent ? 'PERMANENT_FAILURE' : 'FAILED';
      if (balanceReserved) {
        await db.update(schoolSmsSettings)
          .set({ segmentBalance: sql`segment_balance + ${segments}` })
          .where(eq(schoolSmsSettings.schoolId, job.schoolId));
      }
      await db.update(notificationJobs).set({
        status, attemptCount: attemptNumber, failureReason: result.error || 'PROVIDER_SEND_ERROR',
        claimedAt: null, claimedBy: null,
        nextAttemptAt: permanent ? null : new Date(Date.now() + Math.pow(2, attemptNumber) * 1000),
      }).where(eq(notificationJobs.id, job.id));
      await db.insert(notificationAttempts).values({ jobId: job.id, attemptNumber, status, errorMessage: result.error || 'PROVIDER_SEND_ERROR' });
      return status;
    } catch (error: any) {
      const message = error?.message || 'UNKNOWN_WORKER_ERROR';
      const attemptNumber = job.attemptCount + 1;
      const permanent = attemptNumber >= maxRetries;
      const status = permanent ? 'PERMANENT_FAILURE' : 'FAILED';
      if (balanceReserved) {
        await db.update(schoolSmsSettings)
          .set({ segmentBalance: sql`segment_balance + ${segments}` })
          .where(eq(schoolSmsSettings.schoolId, job.schoolId));
      }
      await db.update(notificationJobs).set({
        status, attemptCount: attemptNumber, failureReason: message,
        claimedAt: null, claimedBy: null,
        nextAttemptAt: permanent ? null : new Date(Date.now() + Math.pow(2, attemptNumber) * 1000),
      }).where(eq(notificationJobs.id, job.id));
      await db.insert(notificationAttempts).values({ jobId: job.id, attemptNumber, status, errorMessage: message });
      return status;
    }
  });
}

/** Discover/claim in system context, then process each job in its own tenant context. */
export async function processNotificationQueue(options: WorkerProcessOptions = {}) {
  const limit = options.limit || 20;
  const maxRetries = options.maxRetries || 3;
  const provider = getSmsProvider(options.providerName);
  const workerId = `sms-worker-${process.pid}-${crypto.randomUUID()}`;
  const jobs = await claimEligibleJobs(limit, maxRetries, workerId);
  let sent = 0;
  let failed = 0;
  let permanentFailures = 0;

  for (const job of jobs) {
    console.info('SMS job claimed', { jobId: job.id, schoolId: job.schoolId });
    try {
      const status = await processClaimedJob(job, provider, maxRetries);
      console.info('SMS job processed', { jobId: job.id, schoolId: job.schoolId, status });
      if (status === 'SENT') sent++;
      else if (status === 'FAILED') failed++;
      else if (status === 'PERMANENT_FAILURE') permanentFailures++;
    } catch (error: any) {
      console.error('SMS job processing failed', { jobId: job.id, schoolId: job.schoolId, error: error?.message || 'UNKNOWN_ERROR' });
      try { await recordFailure(job, error?.message || 'TENANT_PROCESSING_FAILED', maxRetries); } catch (recordError: any) {
        console.error('SMS job failure record failed', { jobId: job.id, schoolId: job.schoolId, error: recordError?.message || 'UNKNOWN_ERROR' });
      }
      failed++;
    }
  }

  return { processed: jobs.length, sent, failed, permanentFailures };
}
