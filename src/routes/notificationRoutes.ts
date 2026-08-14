import { Router, Request, Response } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db, withSystemContext, withTenantContext } from '../db';
import { notificationJobs, notificationAttempts, students } from '../db/schema';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';
import { getSmsProvider } from '../services/sms/smsProvider';
import {
  getSchoolSmsSettings,
  updateSchoolSmsSettings,
  getNotificationTemplates,
  upsertNotificationTemplate,
  getSmsUsageReport,
} from '../services/notificationService';
import { processNotificationQueue } from '../services/notificationWorker';
import { redactPhoneNumber } from '../services/sms/smsUtils';
import { createAuditLog } from '../services/auditLogService';

const router = Router();

// ==========================================
// 1. Public Delivery Callback Endpoint (Signature Protected)
// ==========================================
router.post('/callback', async (req: Request, res: Response) => {
  const providerName = (req.query.provider as string) || (req.body?.provider as string) || 'fake';

  let provider;
  try {
    provider = getSmsProvider(providerName);
  } catch (err) {
    return res.status(400).json({ error: 'UNKNOWN_PROVIDER', message: `Unknown SMS provider: ${providerName}` });
  }

  const rawBody = (req as any).rawBody || req.body;
  const verification = await provider.verifyCallback(req.headers, req.body, rawBody);
  if (!verification.valid) {
    return res.status(401).json({
      error: 'INVALID_CALLBACK_AUTH',
      message: verification.error || 'Callback authentication check failed',
    });
  }

  let parsedPayload;
  try {
    parsedPayload = await provider.parseCallback(req.body);
  } catch (err: any) {
    return res.status(400).json({
      error: 'MALFORMED_CALLBACK_PAYLOAD',
      message: err.message,
    });
  }

  const { providerMessageId, status, failureReason, deliveredAt } = parsedPayload;

  const [job] = await withSystemContext(async (tx) => tx
    .select()
    .from(notificationJobs)
    .where(eq(notificationJobs.providerMessageId, providerMessageId)));

  if (!job) {
    return res.status(404).json({
      error: 'NOTIFICATION_JOB_NOT_FOUND',
      message: `No notification job found for providerMessageId: ${providerMessageId}`,
    });
  }

  if (job.status === 'DELIVERED') {
    return res.status(200).json({
      status: 'ALREADY_DELIVERED',
      jobId: job.id,
      providerMessageId,
      deliveredAt: job.deliveredAt,
    });
  }

  const sanitizedBody = {
    ...req.body,
    to: req.body?.to ? redactPhoneNumber(req.body.to) : undefined,
    phoneNumber: req.body?.phoneNumber ? redactPhoneNumber(req.body.phoneNumber) : undefined,
  };

  await withTenantContext(job.schoolId, async () => {
    if (status === 'DELIVERED') {
      const deliveryTimestamp = deliveredAt || new Date();
      await db.update(notificationJobs).set({ status: 'DELIVERED', deliveredAt: deliveryTimestamp }).where(and(eq(notificationJobs.id, job.id), eq(notificationJobs.schoolId, job.schoolId)));
      await db.insert(notificationAttempts).values({ jobId: job.id, attemptNumber: job.attemptCount, status: 'DELIVERED', responsePayload: { providerMessageId, status: 'DELIVERED', callbackPayload: sanitizedBody } });
    } else if (status === 'FAILED') {
      await db.update(notificationJobs).set({ status: 'PERMANENT_FAILURE', failureReason: failureReason || 'CALLBACK_DELIVERY_FAILED' }).where(and(eq(notificationJobs.id, job.id), eq(notificationJobs.schoolId, job.schoolId)));
      await db.insert(notificationAttempts).values({ jobId: job.id, attemptNumber: job.attemptCount, status: 'PERMANENT_FAILURE', errorMessage: failureReason || 'CALLBACK_DELIVERY_FAILED', responsePayload: { callbackPayload: sanitizedBody } });
    }
  });

  return res.status(200).json({
    status: 'PROCESSED',
    jobId: job.id,
    deliveryStatus: status,
  });
});

// ==========================================
// 2. Notification Queue Listing (School Scoped)
// ==========================================
router.get(
  '/queue',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;

    try {
      const jobs = await db
        .select({
          id: notificationJobs.id,
          studentId: notificationJobs.studentId,
          studentName: students.name,
          recipientPhone: notificationJobs.recipientPhone,
          language: notificationJobs.language,
          messageText: notificationJobs.messageBody,
          status: notificationJobs.status,
          attemptCount: notificationJobs.attemptCount,
          failureReason: notificationJobs.failureReason,
          queuedAt: notificationJobs.queuedAt,
          deliveredAt: notificationJobs.deliveredAt,
        })
        .from(notificationJobs)
        .leftJoin(students, eq(notificationJobs.studentId, students.id))
        .where(eq(notificationJobs.schoolId, schoolId))
        .orderBy(desc(notificationJobs.queuedAt))
        .limit(100);

      const sanitizedJobs = jobs.map((j: any) => ({
        ...j,
        recipientPhone: redactPhoneNumber(j.recipientPhone),
      }));

      const totalCount = jobs.length;
      const deliveredCount = jobs.filter((j: any) => j.status === 'DELIVERED').length;
      const failedCount = jobs.filter((j: any) => j.status === 'PERMANENT_FAILURE' || j.status === 'FAILED').length;
      const queuedCount = jobs.filter((j: any) => j.status === 'QUEUED' || j.status === 'PROCESSING').length;

      return res.json({
        success: true,
        summary: {
          total: totalCount,
          delivered: deliveredCount,
          failed: failedCount,
          queued: queuedCount,
        },
        jobs: sanitizedJobs,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ==========================================
// 2.5. Student Notification History
// ==========================================
router.get(
  '/history/:studentId',
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { studentId } = req.params;

    try {
      const jobs = await db
        .select()
        .from(notificationJobs)
        .where(and(eq(notificationJobs.schoolId, schoolId), eq(notificationJobs.studentId, studentId)))
        .orderBy(desc(notificationJobs.queuedAt))
        .limit(50);

      return res.json({ success: true, history: jobs });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ==========================================
// 3. Retry Notification Job
// ==========================================
router.post(
  '/jobs/:jobId/retry',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { jobId } = req.params;

    try {
      const [updated] = await db
        .update(notificationJobs)
        .set({
          status: 'QUEUED',
          attemptCount: sql`${notificationJobs.attemptCount} + 1`,
          failureReason: null,
          nextAttemptAt: new Date(),
        })
        .where(and(eq(notificationJobs.id, jobId), eq(notificationJobs.schoolId, schoolId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ success: false, error: 'JOB_NOT_FOUND' });
      }

      await createAuditLog({
        schoolId,
        actorId: req.user!.id,
        action: 'NOTIFICATION_JOB_RETRIED',
        resourceType: 'NOTIFICATION_JOB',
        resourceId: jobId,
      });

      return res.json({ success: true, job: updated });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ==========================================
// 4. School SMS Settings Endpoints
// ==========================================
router.get(
  '/settings',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;

    try {
      const settings = await getSchoolSmsSettings(schoolId);
      return res.json({ settings });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
);

router.put(
  '/settings',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;

    try {
      const { smsEnabled, dltPrincipalEntityId, dltHeader, allowlistEnabled, allowlist } = req.body;
      const updated = await updateSchoolSmsSettings(schoolId, {
        smsEnabled,
        dltPrincipalEntityId,
        dltHeader,
        allowlistEnabled,
        allowlist,
      });
      return res.json({ settings: updated });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// ==========================================
// 5. Trigger Queue Worker (Super Admin & School Admin)
// ==========================================
router.post(
  '/process-queue',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const isSuperAdmin = Boolean(
        req.sessionContext?.platformRole === 'SUPER_ADMIN' ||
        req.user?.platformRole === 'SUPER_ADMIN' ||
        req.userRole === 'SUPER_ADMIN' ||
        req.sessionContext?.memberships?.some((m) => m.role === 'SUPER_ADMIN')
      );

      const isSchoolAdmin = Boolean(
        req.userRole === 'SCHOOL_ADMIN' ||
        req.sessionContext?.activeMembership?.role === 'SCHOOL_ADMIN' ||
        req.sessionContext?.memberships?.some((m) => m.role === 'SCHOOL_ADMIN')
      );

      if (!isSuperAdmin && !isSchoolAdmin) {
        return res.status(403).json({ error: 'FORBIDDEN_ROLE', message: 'Unauthorized' });
      }

      const activeSchoolId = req.activeSchoolId || req.sessionContext?.schoolId || req.sessionContext?.activeMembership?.schoolId || req.sessionContext?.memberships?.[0]?.schoolId;
      const schoolId = isSuperAdmin ? (req.body?.schoolId || activeSchoolId || undefined) : activeSchoolId;

      if (!isSuperAdmin && !schoolId) {
        return res.status(403).json({ success: false, error: 'SCHOOL_CONTEXT_REQUIRED' });
      }

      const { limit, providerName } = req.body || {};
      const result = await processNotificationQueue({ limit, providerName, schoolId: schoolId || undefined });
      return res.json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;
