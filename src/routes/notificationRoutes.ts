import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { notificationJobs, notificationAttempts } from '../db/schema';
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

  const verification = await provider.verifyCallback(req.headers, req.body);
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

  const [job] = await db
    .select()
    .from(notificationJobs)
    .where(eq(notificationJobs.providerMessageId, providerMessageId));

  if (!job) {
    return res.status(404).json({
      error: 'NOTIFICATION_JOB_NOT_FOUND',
      message: `No notification job found for providerMessageId: ${providerMessageId}`,
    });
  }

  if (job.status === 'DELIVERED' && status === 'DELIVERED') {
    return res.status(200).json({
      status: 'ALREADY_DELIVERED',
      jobId: job.id,
      providerMessageId,
      deliveredAt: job.deliveredAt,
    });
  }

  if (status === 'DELIVERED') {
    const deliveryTimestamp = deliveredAt || new Date();
    await db
      .update(notificationJobs)
      .set({
        status: 'DELIVERED',
        deliveredAt: deliveryTimestamp,
      })
      .where(eq(notificationJobs.id, job.id));

    await db.insert(notificationAttempts).values({
      jobId: job.id,
      attemptNumber: job.attemptCount,
      status: 'DELIVERED',
      responsePayload: { providerMessageId, status: 'DELIVERED', callbackPayload: req.body },
    });
  } else if (status === 'FAILED') {
    await db
      .update(notificationJobs)
      .set({
        status: 'PERMANENT_FAILURE',
        failureReason: failureReason || 'CALLBACK_DELIVERY_FAILED',
      })
      .where(eq(notificationJobs.id, job.id));

    await db.insert(notificationAttempts).values({
      jobId: job.id,
      attemptNumber: job.attemptCount,
      status: 'PERMANENT_FAILURE',
      errorMessage: failureReason || 'CALLBACK_DELIVERY_FAILED',
      responsePayload: { callbackPayload: req.body },
    });
  }

  return res.status(200).json({
    status: 'PROCESSED',
    jobId: job.id,
    deliveryStatus: status,
  });
});

// ==========================================
// 2. School SMS Settings Endpoints (Authenticated & Tenant Isolated)
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
// 3. Notification Templates Endpoints
// ==========================================
router.get(
  '/templates',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;

    try {
      const templates = await getNotificationTemplates(schoolId);
      return res.json({ templates });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
);

router.post(
  '/templates',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { templateCode, language, content, dltTemplateId } = req.body;

    if (!templateCode || !language || !content) {
      return res.status(400).json({ error: 'MISSING_REQUIRED_FIELDS' });
    }

    try {
      const template = await upsertNotificationTemplate(
        schoolId,
        templateCode,
        language,
        content,
        dltTemplateId
      );
      return res.json({ template });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }
);

// ==========================================
// 4. SMS Usage Report
// ==========================================
router.get(
  '/usage-report',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const schoolId = req.activeSchoolId!;
    const { startDate, endDate } = req.query;

    try {
      const report = await getSmsUsageReport(schoolId, startDate as string, endDate as string);
      return res.json(report);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// ==========================================
// 5. Trigger Queue Worker (Admin Only)
// ==========================================
router.post(
  '/process-queue',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { limit, providerName } = req.body;
      const result = await processNotificationQueue({ limit, providerName });
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// ==========================================
// 6. Student Delivery History
// ==========================================
router.get(
  '/history/:studentId',
  requireAuth,
  requireTenant,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  async (req: AuthenticatedRequest, res: Response) => {
    const { studentId } = req.params;
    const schoolId = req.activeSchoolId!;

    try {
      const jobs = await db
        .select()
        .from(notificationJobs)
        .where(and(eq(notificationJobs.studentId, studentId), eq(notificationJobs.schoolId, schoolId)))
        .orderBy(desc(notificationJobs.queuedAt));

      const sanitizedJobs = jobs.map((j: any) => ({
        ...j,
        recipientPhone: redactPhoneNumber(j.recipientPhone),
      }));

      return res.json({ jobs: sanitizedJobs });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
);

export default router;
