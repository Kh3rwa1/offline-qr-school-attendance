import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db, withTenantContext } from '../db';
import { notificationJobs, notificationAttempts } from '../db/schema';
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
// 1. Delivery Callback Endpoint
// ==========================================
/**
 * POST /api/notifications/callback
 * Vendor-agnostic or provider-specific delivery callback endpoint.
 * Handles signature verification, idempotent processing, and status history recording.
 */
router.post('/callback', async (req: Request, res: Response) => {
  const providerName = (req.query.provider as string) || (req.body?.provider as string) || 'fake';

  let provider;
  try {
    provider = getSmsProvider(providerName);
  } catch (err) {
    return res.status(400).json({ error: 'UNKNOWN_PROVIDER', message: `Unknown SMS provider: ${providerName}` });
  }

  // Verification Abstraction
  const verification = await provider.verifyCallback(req.headers, req.body);
  if (!verification.valid) {
    return res.status(401).json({
      error: 'INVALID_CALLBACK_AUTH',
      message: verification.error || 'Callback authentication check failed',
    });
  }

  // Parse Callback Payload
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

  // Find corresponding job
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

  // IDEMPOTENCY CHECK: If already marked as DELIVERED, return success without duplicating history
  if (job.status === 'DELIVERED' && status === 'DELIVERED') {
    return res.status(200).json({
      status: 'ALREADY_DELIVERED',
      jobId: job.id,
      providerMessageId,
      deliveredAt: job.deliveredAt,
    });
  }

  // Update Status & Record Attempt / Delivery History
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
// 2. School SMS Settings Endpoints
// ==========================================
router.get('/settings', async (req: Request, res: Response) => {
  const schoolId = (req as any).user?.schoolId || (req.query.schoolId as string);
  if (!schoolId) {
    return res.status(400).json({ error: 'MISSING_SCHOOL_ID' });
  }

  try {
    const settings = await getSchoolSmsSettings(schoolId);
    return res.json({ settings });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/settings', async (req: Request, res: Response) => {
  const schoolId = (req as any).user?.schoolId || req.body.schoolId;
  if (!schoolId) {
    return res.status(400).json({ error: 'MISSING_SCHOOL_ID' });
  }

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
});

// ==========================================
// 3. Notification Templates Endpoints
// ==========================================
router.get('/templates', async (req: Request, res: Response) => {
  const schoolId = (req as any).user?.schoolId || (req.query.schoolId as string);
  if (!schoolId) {
    return res.status(400).json({ error: 'MISSING_SCHOOL_ID' });
  }

  try {
    const templates = await getNotificationTemplates(schoolId);
    return res.json({ templates });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/templates', async (req: Request, res: Response) => {
  const schoolId = (req as any).user?.schoolId || req.body.schoolId;
  const { templateCode, language, content, dltTemplateId } = req.body;

  if (!schoolId || !templateCode || !language || !content) {
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
});

// ==========================================
// 4. SMS Usage Report
// ==========================================
router.get('/usage-report', async (req: Request, res: Response) => {
  const schoolId = (req as any).user?.schoolId || (req.query.schoolId as string);
  const { startDate, endDate } = req.query;

  if (!schoolId) {
    return res.status(400).json({ error: 'MISSING_SCHOOL_ID' });
  }

  try {
    const report = await getSmsUsageReport(schoolId, startDate as string, endDate as string);
    return res.json(report);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. Trigger Queue Worker (Admin)
// ==========================================
router.post('/process-queue', async (req: Request, res: Response) => {
  try {
    const { limit, providerName } = req.body;
    const result = await processNotificationQueue({ limit, providerName });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. Student Delivery History with Redacted Numbers
// ==========================================
router.get('/history/:studentId', async (req: Request, res: Response) => {
  const { studentId } = req.params;
  const schoolId = (req as any).user?.schoolId || (req.query.schoolId as string);

  try {
    const jobs = await db
      .select()
      .from(notificationJobs)
      .where(
        schoolId
          ? and(eq(notificationJobs.studentId, studentId), eq(notificationJobs.schoolId, schoolId))
          : eq(notificationJobs.studentId, studentId)
      )
      .orderBy(desc(notificationJobs.queuedAt));

    // Redact phone numbers for privacy
    const sanitizedJobs = jobs.map((j: any) => ({
      ...j,
      recipientPhone: redactPhoneNumber(j.recipientPhone),
    }));

    return res.json({ jobs: sanitizedJobs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
