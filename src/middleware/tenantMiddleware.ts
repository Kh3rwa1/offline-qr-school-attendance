import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware';
import { translate } from '../i18n';
import { withTenantContext } from '../db';
import { isPlatformSuperAdmin } from '../auth/session';
import { isUuid } from '../lib/ids';

/**
 * Tenant middleware: verifies tenant membership and wraps the request in transaction-local tenant context.
 */
export async function requireTenant(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.sessionContext) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
  }

  const urlMatch = req.originalUrl?.match(/\/schools\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i);
  const targetSchoolId =
    req.params.schoolId ||
    urlMatch?.[1] ||
    (req.headers['x-school-id'] as string) ||
    req.body?.schoolId ||
    req.query?.schoolId;

  if (!targetSchoolId) {
    return res.status(400).json({ success: false, error: 'MISSING_SCHOOL_ID', message: 'Target schoolId is required' });
  }

  if (!isUuid(String(targetSchoolId))) {
    return res.status(400).json({ success: false, error: 'INVALID_SCHOOL_ID' });
  }

  const { memberships } = req.sessionContext;
  const isSuperAdmin = isPlatformSuperAdmin(req.sessionContext);
  const targetMembership = memberships.find((membership) => membership.schoolId === targetSchoolId);

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

  req.activeSchoolId = String(targetSchoolId);
  req.userRole = targetMembership?.role || (isSuperAdmin ? 'SUPER_ADMIN' : undefined);

  return withTenantContext(String(targetSchoolId), async () => {
    return new Promise<void>((resolve, reject) => {
      res.once('finish', () => resolve());
      res.once('close', () => resolve());
      try {
        next();
      } catch (err) {
        reject(err);
      }
    });
  }).catch((err) => {
    if (!res.headersSent) {
      next(err);
    }
  });
}
