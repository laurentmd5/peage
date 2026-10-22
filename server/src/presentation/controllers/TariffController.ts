import { Router, Response } from 'express';
import { TariffUseCases } from '../../application/use-cases/TariffUseCases.ts';
import { AuthenticatedRequest, authMiddleware } from '../middlewares/AuthMiddleware.ts';
import { roleMiddleware } from '../middlewares/RoleMiddleware.ts';
import { UserRole } from '../../domain/value-objects/Role.ts';
import { EventBroadcaster } from '../../infrastructure/realtime/EventBroadcaster.ts';

export function createTariffRouter(tariffUseCases: TariffUseCases): Router {
  const router = Router();

  // Consultation publique ou authentifiée des tarifs
  router.get('/', async (_req, res) => {
    try {
      const list = await tariffUseCases.getAll();
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Mise à jour de tarif (ADMIN uniquement)
  router.put(
    '/:code/rate',
    authMiddleware,
    roleMiddleware([UserRole.ADMIN]),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { newRate, reason } = req.body;
        const result = await tariffUseCases.updateRate(
          {
            code: req.params.code,
            newRate: Number(newRate),
            changedBy: req.user?.fullName || req.user?.username || 'Admin',
            reason
          },
          req.user!.userId
        );

        EventBroadcaster.broadcast('tariff:updated', result);
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    }
  );

  // Création d'une nouvelle catégorie (ADMIN uniquement)
  router.post(
    '/',
    authMiddleware,
    roleMiddleware([UserRole.ADMIN]),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { code, label, rate } = req.body;
        const result = await tariffUseCases.create(
          { code, label, rate: Number(rate) },
          req.user!.userId,
          req.user?.fullName || req.user?.username || 'Admin'
        );

        EventBroadcaster.broadcast('tariff:created', result);
        res.status(201).json(result);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    }
  );

  // Bascule activation / désactivation (ADMIN uniquement)
  router.put(
    '/:code/toggle',
    authMiddleware,
    roleMiddleware([UserRole.ADMIN]),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const result = await tariffUseCases.toggleActive(
          req.params.code,
          req.user!.userId,
          req.user?.fullName || req.user?.username || 'Admin'
        );

        EventBroadcaster.broadcast('tariff:updated', result);
        res.json(result);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
      }
    }
  );

  return router;
}
