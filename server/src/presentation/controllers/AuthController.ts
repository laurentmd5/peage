import { Router, Response } from 'express';
import { AuthUseCases } from '../../application/use-cases/AuthUseCases.ts';
import { AuthenticatedRequest, authMiddleware } from '../middlewares/AuthMiddleware.ts';

export function createAuthRouter(authUseCases: AuthUseCases): Router {
  const router = Router();

  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        res.status(400).json({ error: "Nom d'utilisateur et mot de passe requis" });
        return;
      }

      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
      const result = await authUseCases.login({ username, password }, ip);
      res.json(result);
    } catch (err: any) {
      res.status(401).json({ error: err.message || 'Échec de connexion' });
    }
  });

  router.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user) {
        await authUseCases.logout(req.user.userId, req.user.username);
      }
      res.json({ success: true, message: 'Déconnexion réussie' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.user });
  });

  router.get('/users', authMiddleware, async (_req, res) => {
    try {
      const users = await authUseCases.listUsers();
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
