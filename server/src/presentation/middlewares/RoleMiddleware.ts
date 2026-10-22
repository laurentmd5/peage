import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './AuthMiddleware.ts';
import { UserRole } from '../../domain/value-objects/Role.ts';

export function roleMiddleware(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Accès refusé. Rôle(s) autorisé(s): ${allowedRoles.join(', ')}`
      });
      return;
    }

    next();
  };
}
