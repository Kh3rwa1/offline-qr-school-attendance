import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware';
import { translate } from '../i18n';
import { withTenantContext } from '../db';

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

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(targetSchoolId))) {
    return res.status(400).json({ error: 'INVALID_SCHOOL_ID' });
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

  // Keep the same transaction/connection alive for the complete request. The
  // db proxy routes service queries to this transaction and the RLS setting is
  // therefore never applied to an unrelated pooled connection.
  return withTenantContext(targetSchoolId, async () => new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    res.once('finish', finish);
    res.once('close', finish);
    try {
      next();
    } catch (err) {
      settled = true;
      reject(err);
    }
  })).catch((error) => next(error));
}
