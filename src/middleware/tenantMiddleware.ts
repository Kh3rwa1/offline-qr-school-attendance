import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware';
import { translate } from '../i18n';
import { setTenantContext } from '../db';

/**
 * Tenant middleware: verifies tenant membership and sets active school context GUC.
 */
export async function requireTenant(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
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

  const { memberships } = req.sessionContext;
  const isSuperAdmin = req.sessionContext.platformRole === 'SUPER_ADMIN' || req.sessionContext.user?.platformRole === 'SUPER_ADMIN' || memberships.some((membership) => membership.role === 'SUPER_ADMIN');
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

  try {
    await setTenantContext(String(targetSchoolId));
    next();
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'TENANT_CONTEXT_FAILED' });
    }
  }
}
