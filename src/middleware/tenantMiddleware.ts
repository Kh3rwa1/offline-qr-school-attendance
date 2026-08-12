import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware';
import { executeSql } from '../db';
import { translate } from '../i18n';

export async function requireTenant(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.sessionContext) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  // Extract target school ID from params, header, or query
  const targetSchoolId =
    req.params.schoolId ||
    (req.headers['x-school-id'] as string) ||
    req.body.schoolId ||
    req.query.schoolId;

  if (!targetSchoolId) {
    return res.status(400).json({ error: 'MISSING_SCHOOL_ID', message: 'Target schoolId is required' });
  }

  const { memberships, user } = req.sessionContext;

  // Check if user is Super Admin
  const isSuperAdmin = memberships.some((m) => m.role === 'SUPER_ADMIN' && m.status === 'ACTIVE');

  // Find membership in target school
  const targetMembership = memberships.find((m) => m.schoolId === targetSchoolId);

  if (!isSuperAdmin) {
    if (!targetMembership) {
      return res.status(403).json({
        error: 'CROSS_TENANT_DENIED',
        message: translate('crossTenantDenied', 'en'),
      });
    }

    if (targetMembership.status === 'SUSPENDED') {
      return res.status(403).json({
        error: 'MEMBERSHIP_SUSPENDED',
        message: translate('suspendedAccount', 'en'),
      });
    }
  }

  req.activeSchoolId = targetSchoolId;
  req.userRole = targetMembership?.role || (isSuperAdmin ? 'SUPER_ADMIN' : 'TEACHER');

  // Set database RLS session setting
  try {
    await executeSql(`SET LOCAL app.current_school_id = '${targetSchoolId}';`);
  } catch (err) {
    // Session setting handled gracefully if not supported by driver
  }

  next();
}
