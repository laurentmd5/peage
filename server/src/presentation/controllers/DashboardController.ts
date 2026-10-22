import { Router, Request, Response } from 'express';
import { DashboardUseCases } from '../../application/use-cases/DashboardUseCases.ts';
import { EventBroadcaster } from '../../infrastructure/realtime/EventBroadcaster.ts';
import { authMiddleware } from '../middlewares/AuthMiddleware.ts';

export function createDashboardRouter(dashboardUseCases: DashboardUseCases): Router {
  const router = Router();

  router.get('/stats', authMiddleware, async (_req, res) => {
    try {
      const stats = await dashboardUseCases.getStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Flux temps réel SSE (Server-Sent Events)
  router.get('/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    EventBroadcaster.subscribe(res);

    // Envoi d'un battement de cœur initial
    res.write(`event: ping\ndata: ${JSON.stringify({ time: new Date() })}\n\n`);

    req.on('close', () => {
      EventBroadcaster.unsubscribe(res);
    });
  });

  return router;
}
