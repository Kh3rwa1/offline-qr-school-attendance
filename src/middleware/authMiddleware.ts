import { Request, Response, NextFunction } from 'express';
import { getSession, SessionContext } from '../auth/session';
import { translate, Language } from '../i18n';

export interface AuthenticatedRequest extends Request {
  sessionContext?: SessionContext;
  user?: SessionContext['user'];
  activeSchoolId?: string;
  userRole?: string;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const cookieToken = req.cookies?.session;
  const headerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const token = cookieToken || headerToken;

  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: translate('sessionExpired', (req.headers['accept-language'] as Language) || 'en'),
    });
  }

  const session = await getSession(token);
  if (!session) {
    return res.status(401).json({
      error: 'INVALID_SESSION',
      message: translate('sessionExpired', (req.headers['accept-language'] as Language) || 'en'),
    });
  }

  if (session.user.status === 'SUSPENDED') {
    return res.status(403).json({
      error: 'USER_SUSPENDED',
      message: translate('suspendedAccount', (req.headers['accept-language'] as Language) || 'en'),
    });
  }

  req.sessionContext = session;
  req.user = session.user;
  next();
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.sessionContext) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const isPlatformSuperAdmin = req.sessionContext.platformRole === 'SUPER_ADMIN' || req.sessionContext.user?.platformRole === 'SUPER_ADMIN';
    const activeRole = req.userRole || req.sessionContext.activeMembership?.role;

    // SUPER_ADMIN has global role permissions
    if (isPlatformSuperAdmin || activeRole === 'SUPER_ADMIN') {
      return next();
    }

    if (!activeRole || !allowedRoles.includes(activeRole)) {
      return res.status(403).json({
        error: 'FORBIDDEN_ROLE',
        message: translate('unauthorized', 'en'),
      });
    }

    next();
  };
}

export function requirePlatformRole(allowedPlatformRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.sessionContext) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }

    const platformRole = req.sessionContext.platformRole || req.sessionContext.user?.platformRole || (req.sessionContext.memberships.some((m) => m.role === 'SUPER_ADMIN') ? 'SUPER_ADMIN' : null);

    if (!platformRole || !allowedPlatformRoles.includes(platformRole)) {
      return res.status(403).json({
        error: 'FORBIDDEN_PLATFORM_ROLE',
        message: translate('unauthorized', 'en'),
      });
    }

    next();
  };
}
