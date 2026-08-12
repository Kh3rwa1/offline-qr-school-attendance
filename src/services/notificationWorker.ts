import crypto from 'node:crypto';
import { eq, and, inArray, lt, lte, or, desc, isNull, sql } from 'drizzle-orm';
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

async function claimEligibleJobs(limit: number, maxRetries: number, workerId: string): Promise<ClaimedJob[]> {
  return withSystemContext(async () => {
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
    await db.update(notificationJobs)
      .set({ status: 'QUEUED', claimedAt: null, claimedBy: null })
      .where(and(eq(notificationJobs.status, 'SENDING'), lt(notificationJobs.claimedAt, staleBefore)));

    const candidates = await db
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
      if (job.status === 'FAILED') {
        const [lastAttempt] = await db.select()
          .from(notificationAttempts)
          .where(eq(notificationAttempts.jobId, job.id))
          .orderBy(desc(notificationAttempts.attemptedAt))
          .limit(1);
        if (lastAttempt) {
          const backoffMs = Math.pow(2, job.attemptCount) * 1000;
          if (Date.now() - new Date(lastAttempt.attemptedAt).getTime() < backoffMs) continue;
        }
      }

      const [updated] = await db.update(notificationJobs)
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

    const isFake = provider.name === 'fake';
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
