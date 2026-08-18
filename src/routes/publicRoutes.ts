import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { withSystemContext } from '../db';
import { schools, demoRequests, platformSettings } from '../db/schema';
import { eq } from 'drizzle-orm';
import { isValidSlug } from '../services/schoolSlug';
import { createAuditLog } from '../services/auditLogService';
import { rateLimitPolicies } from '../middleware/distributedRateLimiter';

export const publicRouter = Router();

// 1. Public Tenant Resolution: GET /api/v1/public/schools/by-slug/:slug
publicRouter.get(
  '/schools/by-slug/:slug',
  rateLimitPolicies.generalApi,
  async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const normalizedSlug = (slug || '').trim().toLowerCase();

      if (!isValidSlug(normalizedSlug)) {
        return res.status(404).json({
          success: false,
          error: 'SCHOOL_NOT_FOUND',
          message: 'This school workspace was not found',
        });
      }

      const [school] = await withSystemContext(async (tx) => {
        return tx
          .select({
            id: schools.id,
            name: schools.name,
            slug: schools.slug,
            district: schools.district,
            block: schools.block,
            status: schools.status,
            preferredLanguage: schools.preferredLanguage,
          })
          .from(schools)
          .where(eq(schools.slug, normalizedSlug));
      });

      if (!school) {
        return res.status(404).json({
          success: false,
          error: 'SCHOOL_NOT_FOUND',
          message: 'This school workspace was not found',
        });
      }

      if (school.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          error: 'SCHOOL_NOT_ACTIVE',
          message: 'This school workspace is suspended',
        });
      }

      return res.status(200).json({
        success: true,
        school: {
          id: school.id,
          name: school.name,
          slug: school.slug,
          district: school.district,
          status: school.status,
          preferredLanguage: school.preferredLanguage,
        },
      });
    } catch (err: any) {
      console.error('Public school lookup error:', err);
      return res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Unable to resolve school workspace at this time',
      });
    }
  }
);

// 2. Demo Requests: POST /api/v1/public/demo-requests
const phoneRegex = /^(\+?[1-9]\d{9,14}|[6-9]\d{9})$/;

const demoRequestSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(255)
    .transform((s) => s.trim().replace(/[<>]/g, '')),
  phone: z
    .string()
    .transform((s) => s.trim().replace(/[\s-]/g, ''))
    .refine((val) => phoneRegex.test(val), {
      message: 'Phone number must be a valid Indian or E.164 phone number',
    }),
  email: z
    .string()
    .email('Invalid email address')
    .max(255)
    .optional()
    .or(z.literal(''))
    .transform((s) => (s && s.trim() ? s.trim().toLowerCase() : undefined)),
  schoolName: z
    .string()
    .min(2, 'School name must be at least 2 characters')
    .max(255)
    .transform((s) => s.trim().replace(/[<>]/g, '')),
  district: z
    .string()
    .min(2, 'District must be at least 2 characters')
    .max(100)
    .transform((s) => s.trim().replace(/[<>]/g, '')),
  studentCount: z
    .string()
    .min(1, 'Student count range is required')
    .max(50)
    .transform((s) => s.trim()),
  preferredLanguage: z.enum(['en', 'bn', 'hi']).optional().default('bn'),
  consentGiven: z.boolean().refine((val) => val === true, {
    message: 'Explicit consent is required to process demonstration requests',
  }).optional().default(true),
  source: z.string().max(50).default('landing'),
});

publicRouter.post(
  '/demo-requests',
  rateLimitPolicies.demoRequests,
  async (req: Request, res: Response) => {
    const parsed = demoRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_INPUT',
        details: parsed.error.format(),
      });
    }

    try {
      const data = parsed.data;

      await withSystemContext(async (tx) => {
        const [inserted] = await tx
          .insert(demoRequests)
          .values({
            name: data.name,
            phone: data.phone,
            email: data.email || null,
            schoolName: data.schoolName,
            district: data.district,
            studentCount: data.studentCount,
            source: data.source || 'landing',
            status: 'NEW',
          })
          .returning();

        await createAuditLog(
          {
            actorId: null,
            action: 'DEMO_REQUEST_CREATED',
            resourceType: 'SYSTEM',
            resourceId: inserted.id,
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            metadata: {
              requestId: inserted.id,
              schoolName: inserted.schoolName,
              district: inserted.district,
              studentCount: inserted.studentCount,
              preferredLanguage: data.preferredLanguage,
              source: inserted.source,
            },
          },
          tx
        );
      });

      return res.status(201).json({
        success: true,
      });
    } catch (err: any) {
      console.error('Demo request submission failed:', err);
      return res.status(500).json({
        success: false,
        error: 'SUBMISSION_FAILED',
        message: 'Failed to record demo request',
      });
    }
  }
);

// 3. GET /api/v1/public/settings — landing page dynamic content (safe, no auth)
publicRouter.get(
  '/settings',
  rateLimitPolicies.generalApi,
  async (_req: Request, res: Response) => {
    try {
      const rows = await withSystemContext(async (tx) => tx.select().from(platformSettings));
      const s: Record<string, string> = {};
      for (const r of rows) s[r.key] = r.value;
      return res.status(200).json({ success: true, settings: s });
    } catch {
      // Non-fatal — landing page falls back to hardcoded defaults
      return res.status(200).json({ success: true, settings: {} });
    }
  }
);
