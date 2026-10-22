import { Request, Response, NextFunction } from 'express';
import { JwtService, TokenPayload } from '../../infrastructure/security/JwtService.ts';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token d\'authentification manquant' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = JwtService.verify(token);
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}
