import type { Request, Response, NextFunction } from 'express';
import type { EnterpriseStore } from '../store/file-store.js';
import type { SafeUser, UserRole } from '../types.js';
import { AuthService, globalAuthService } from './auth-service.js';

export interface AuthenticatedRequest extends Request {
  user?: SafeUser;
  token?: string;
}

export function extractToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (req.headers['x-session-token']) {
    return String(req.headers['x-session-token']).trim();
  }

  // Check cookie if present
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/session_token=([^;]+)/);
    if (match) {
      return match[1];
    }
  }

  return undefined;
}

export function createAuthMiddleware(
  store: EnterpriseStore,
  authService: AuthService = globalAuthService,
) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (token) {
      const user = authService.getSessionUser(token, store);
      if (user) {
        req.user = user;
        req.token = token;
      }
    }
    next();
  };
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication required. Please log in.',
      code: 'UNAUTHENTICATED',
    });
    return;
  }
  next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required.',
        code: 'UNAUTHENTICATED',
      });
      return;
    }

    if (allowedRoles.includes(req.user.role)) {
      next();
      return;
    }

    res.status(403).json({
      error: `Access denied. Role "${req.user.role}" does not have sufficient permissions.`,
      code: 'FORBIDDEN',
      requiredRoles: allowedRoles,
    });
  };
}

export function forbidViewerMutation(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.user?.role === 'viewer') {
    res.status(403).json({
      error: 'Viewer role is read-only. Modifications are not allowed.',
      code: 'READ_ONLY_ACCESS',
    });
    return;
  }
  next();
}

// RBAC middleware validated for 5-role model

// Feature RBAC enforcement
