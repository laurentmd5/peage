import { Router, Response } from 'express';
import { IAuditRepository } from '../../domain/repositories/IAuditRepository.ts';
import { AuthenticatedRequest, authMiddleware } from '../middlewares/AuthMiddleware.ts';

export function createAuditRouter(auditRepo: IAuditRepository): Router {
  const router = Router();

  router.get('/logs', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { eventType, userId, startDate, endDate, limit } = req.query;

      const filter: any = {};
      if (eventType) filter.eventType = eventType as any;
      if (userId) filter.userId = userId as string;
      if (startDate) filter.startDate = new Date(startDate as string);
      if (endDate) filter.endDate = new Date(endDate as string);
      if (limit) filter.limit = parseInt(limit as string, 10);

      const logs = await auditRepo.search(filter);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
