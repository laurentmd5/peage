import { Router, Response } from 'express';
import { CashSessionUseCases } from '../../application/use-cases/CashSessionUseCases.ts';
import { AuthenticatedRequest, authMiddleware } from '../middlewares/AuthMiddleware.ts';
import { EventBroadcaster } from '../../infrastructure/realtime/EventBroadcaster.ts';

export function createCaisseRouter(caisseUseCases: CashSessionUseCases): Router {
  const router = Router();

  router.post('/open', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { boothId, initialFloat } = req.body;
      if (!req.user) {
        res.status(401).json({ error: 'Non authentifié' });
        return;
      }

      const session = await caisseUseCases.openSession({
        cashierId: req.user.userId,
        cashierName: req.user.fullName || req.user.username,
        boothId: boothId || 'CAISSE-01',
        initialFloat: Number(initialFloat) || 0
      });

      EventBroadcaster.broadcast('session:opened', session);
      res.status(201).json(session);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/active', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Non authentifié' });
        return;
      }

      const session = await caisseUseCases.getActiveSession(req.user.userId);
      res.json(session); // null if no active session
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/close', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId, realCashCounted } = req.body;
      if (!req.user) {
        res.status(401).json({ error: 'Non authentifié' });
        return;
      }

      const session = await caisseUseCases.closeSession(
        {
          sessionId,
          realCashCounted: Number(realCashCounted)
        },
        req.user.userId,
        req.user.fullName || req.user.username
      );

      EventBroadcaster.broadcast('session:closed', session);
      res.json(session);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
