import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware';
import { translate } from '../i18n';
import { withTenantContext } from '../db';

type CapturedResponse = {
  method: 'json' | 'send' | 'end';
  args: any[];
};

/**
 * Express 4 does not await async route handlers. The response methods are
 * therefore buffered while the route runs inside the tenant transaction; the
 * response is emitted only after the transaction has committed. This prevents
 * a successful response from racing a failed commit.
 */
export async function requireTenant(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.sessionContext) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

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

  const { memberships } = req.sessionContext;
  const isSuperAdmin = memberships.some((membership) => membership.role === 'SUPER_ADMIN');
  const targetMembership = memberships.find((membership) => membership.schoolId === targetSchoolId);

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

  req.activeSchoolId = String(targetSchoolId);
  req.userRole = targetMembership?.role || (isSuperAdmin ? 'SUPER_ADMIN' : undefined);

  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  const originalEnd = res.end.bind(res);
  let captured: CapturedResponse | null = null;
  let resolveResponse!: (value: CapturedResponse) => void;
  const responsePromise = new Promise<CapturedResponse>((resolve) => { resolveResponse = resolve; });

  (res as any).json = (...args: any[]) => {
    if (!captured) {
      captured = { method: 'json', args };
      resolveResponse(captured);
    }
    return res;
  };
  (res as any).send = (...args: any[]) => {
    if (!captured) {
      captured = { method: 'send', args };
      resolveResponse(captured);
    }
    return res;
  };
  (res as any).end = (...args: any[]) => {
    if (!captured) {
      captured = { method: 'end', args };
      resolveResponse(captured);
    }
    return res;
  };

  try {
    const response = await withTenantContext(String(targetSchoolId), async () => {
      next();
      return responsePromise;
    });

    (res as any).json = originalJson;
    (res as any).send = originalSend;
    (res as any).end = originalEnd;

    if (response.method === 'json') originalJson(...response.args);
    else if (response.method === 'send') originalSend(...response.args);
    else originalEnd(...response.args);
  } catch (error) {
    (res as any).json = originalJson;
    (res as any).send = originalSend;
    (res as any).end = originalEnd;
    console.error('Tenant transaction failed before response:', error);
    if (!res.headersSent) {
      res.status(500);
      originalJson({ error: 'TENANT_TRANSACTION_FAILED' });
    }
  }
}
