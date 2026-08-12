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

    const activeRole = req.userRole || req.sessionContext.activeMembership?.role;

    // SUPER_ADMIN has global role permissions
    if (activeRole === 'SUPER_ADMIN') {
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
