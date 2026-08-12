import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware';
import { translate } from '../i18n';
import { withTenantContext } from '../db';

/**
 * Backward compatibility tenant middleware wrapper.
 * Opens database tenant context safely without response monkey-patching.
 */
export async function requireTenant(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.sessionContext) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
  }

  const targetSchoolId =
    req.params.schoolId ||
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
  const isSuperAdmin = memberships.some((membership) => membership.role === 'SUPER_ADMIN');
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
    await withTenantContext(String(targetSchoolId), async () => {
      next();
    });
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'TENANT_TRANSACTION_FAILED' });
    }
  }
}
