import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/authMiddleware';
import { withSystemContext } from '../db';
import { platformSettings } from '../db/schema';
import { createAuditLog } from '../services/auditLogService';

export const platformSettingsRouter = Router();

// Keys the super admin is allowed to set
export const EDITABLE_KEYS = [
  'pricing_amount',
  'pricing_per_student',
  'pricing_free_note',
  'testimonial_1_quote',
  'testimonial_1_name',
  'testimonial_1_role',
  'testimonial_1_count',
  'testimonial_2_quote',
  'testimonial_2_name',
  'testimonial_2_role',
  'testimonial_2_count',
  'demo_video_url',
  'hero_subtitle',
  'hero_subtitle_en',
  'hero_subtitle_bn',
  'hero_subtitle_hi',
] as const;

export type EditableKey = (typeof EDITABLE_KEYS)[number];

// GET /api/v1/admin/platform-settings (SUPER_ADMIN only)
platformSettingsRouter.get(
  '/',
  requireAuth,
  requireRole(['SUPER_ADMIN']),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const rows = await withSystemContext(async (tx) => tx.select().from(platformSettings));
      const settings: Record<string, string> = {};
      for (const row of rows) settings[row.key] = row.value;
      return res.status(200).json({ success: true, settings });
    } catch (err: unknown) {
      console.error('[platform-settings] GET error:', err);
      return res.status(500).json({ success: false, error: 'Failed to load settings' });
    }
  }
);

const singleUpdateSchema = z.object({
  key: z.enum(EDITABLE_KEYS),
  value: z.string().max(2000),
});

const batchUpdateSchema = z.object({
  settings: z.record(z.string(), z.string().max(2000)),
});

// PUT /api/v1/admin/platform-settings (SUPER_ADMIN only)
platformSettingsRouter.put(
  '/',
  requireAuth,
  requireRole(['SUPER_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    const actorId = req.sessionContext?.userId ?? null;

    // Check if batch payload or single payload
    const isBatch = req.body && typeof req.body.settings === 'object';

    if (isBatch) {
      const parsedBatch = batchUpdateSchema.safeParse(req.body);
      if (!parsedBatch.success) {
        return res.status(400).json({ success: false, error: 'INVALID_INPUT', details: parsedBatch.error.format() });
      }

      const updates = Object.entries(parsedBatch.data.settings).filter(([k]) =>
        (EDITABLE_KEYS as readonly string[]).includes(k)
      );

      try {
        await withSystemContext(async (tx) => {
          for (const [key, value] of updates) {
            const trimmedVal = typeof value === 'string' ? value.trim() : '';
            await tx
              .insert(platformSettings)
              .values({ key, value: trimmedVal, updatedBy: actorId ?? undefined })
              .onConflictDoUpdate({
                target: platformSettings.key,
                set: { value: trimmedVal, updatedAt: new Date(), updatedBy: actorId ?? undefined },
              });
          }
          await createAuditLog(
            {
              actorId,
              action: 'PLATFORM_SETTINGS_BATCH_UPDATED',
              resourceType: 'SYSTEM',
              resourceId: 'platform_settings',
              ipAddress: req.ip || req.socket.remoteAddress,
              userAgent: req.headers['user-agent'],
              metadata: { updatedKeys: updates.map(([k]) => k) },
            },
            tx
          );
        });
        return res.status(200).json({ success: true, count: updates.length });
      } catch (err: unknown) {
        console.error('[platform-settings] PUT batch error:', err);
        return res.status(500).json({ success: false, error: 'Failed to save settings' });
      }
    }

    const parsedSingle = singleUpdateSchema.safeParse(req.body);
    if (!parsedSingle.success) {
      return res.status(400).json({ success: false, error: 'INVALID_INPUT', details: parsedSingle.error.format() });
    }

    const { key, value } = parsedSingle.data;
    try {
      await withSystemContext(async (tx) => {
        await tx
          .insert(platformSettings)
          .values({ key, value: value.trim(), updatedBy: actorId ?? undefined })
          .onConflictDoUpdate({
            target: platformSettings.key,
            set: { value: value.trim(), updatedAt: new Date(), updatedBy: actorId ?? undefined },
          });
        await createAuditLog(
          {
            actorId,
            action: 'PLATFORM_SETTING_UPDATED',
            resourceType: 'SYSTEM',
            resourceId: key,
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            metadata: { key },
          },
          tx
        );
      });
      return res.status(200).json({ success: true, key, value: value.trim() });
    } catch (err: unknown) {
      console.error('[platform-settings] PUT error:', err);
      return res.status(500).json({ success: false, error: 'Failed to save setting' });
    }
  }
);
