import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware';
import { translate } from '../i18n';
import { withTenantContext } from '../db';

export interface TenantContext {
  req: AuthenticatedRequest;
  res: Response;
  schoolId: string;
  user: any;
  userRole: string;
}

export type TenantHandlerFn = (ctx: TenantContext) => Promise<{
  status?: number;
  data?: any;
  body?: any;
  contentType?: string;
  headers?: Record<string, string>;
} | void>;

/**
 * Robust, non-monkey-patching tenant transaction wrapper.
 * Performs auth & role verification, opens database tenant context, awaits handler, commits, and sends response only after commit succeeds.
 */
export function tenantHandler(handler: TenantHandlerFn) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.sessionContext) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    }

    const urlMatch = req.originalUrl?.match(/\/schools\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i);
    const targetSchoolId =
      req.params.schoolId ||
      urlMatch?.[1] ||
      (req.headers['x-school-id'] as string) ||
      req.body?.schoolId ||
      req.query?.schoolId;

    if (!targetSchoolId) {
      return res.status(400).json({ success: false, error: 'MISSING_SCHOOL_ID', message: 'Target schoolId is required' });
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(targetSchoolId))) {
      return res.status(400).json({ success: false, error: 'INVALID_SCHOOL_ID' });
    }

    const { memberships, user } = req.sessionContext;
    const isSuperAdmin = memberships.some((m) => m.role === 'SUPER_ADMIN');
    const targetMembership = memberships.find((m) => m.schoolId === targetSchoolId);

    if (!isSuperAdmin) {
      if (!targetMembership) {
        return res.status(403).json({
          success: false,
          error: 'CROSS_TENANT_DENIED',
          message: translate('crossTenantDenied', 'en'),
        });
      }
      if (targetMembership.status === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          error: 'MEMBERSHIP_SUSPENDED',
          message: translate('suspendedAccount', 'en'),
        });
      }
    }

    const schoolId = String(targetSchoolId);
    const userRole = targetMembership?.role || (isSuperAdmin ? 'SUPER_ADMIN' : undefined);

    req.activeSchoolId = schoolId;
    req.userRole = userRole;

    try {
      // Execute handler inside database tenant context transaction
      const result = await withTenantContext(schoolId, async () => {
        return await handler({
          req,
          res,
          schoolId,
          user,
          userRole: userRole!,
        });
      });

      // Write response only AFTER transaction has committed successfully
      if (res.headersSent) return;

      if (result) {
        const statusCode = result.status || 200;
        if (result.headers) {
          for (const [k, v] of Object.entries(result.headers)) {
            res.setHeader(k, v);
          }
        }
        if (result.contentType) {
          res.setHeader('Content-Type', result.contentType);
        }

        const payload = result.data !== undefined ? { success: true, data: result.data } : (result.body !== undefined ? result.body : { success: true });

        if (typeof payload === 'string') {
          return res.status(statusCode).send(payload);
        }
        return res.status(statusCode).json(payload);
      }
    } catch (error: any) {
      if (res.headersSent) return;
      console.error('[tenantHandler] Transaction failed before response:', error);

      const statusMap: Record<string, number> = {
        UNAUTHORIZED_TEACHER_NOT_ASSIGNED: 403,
        FINALIZED_SESSION_LOCKED: 400,
        SESSION_NOT_FOUND: 404,
        CORRECTION_REASON_REQUIRED: 400,
        STUDENT_NOT_IN_SESSION_ROSTER: 400,
      };

      const statusCode = statusMap[error.message] || 500;
      return res.status(statusCode).json({
        success: false,
        error: error.message || 'TENANT_TRANSACTION_FAILED',
      });
    }
  };
}
