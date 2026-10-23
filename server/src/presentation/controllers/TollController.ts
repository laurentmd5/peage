import { Router, Response } from 'express';
import { DetectVehicleUseCase } from '../../application/use-cases/DetectVehicleUseCase.ts';
import { ProcessPaymentUseCase } from '../../application/use-cases/ProcessPaymentUseCase.ts';
import { CancelTransactionUseCase } from '../../application/use-cases/CancelTransactionUseCase.ts';
import { ManualBarrierOpenUseCase } from '../../application/use-cases/ManualBarrierOpenUseCase.ts';
import { ITransactionRepository } from '../../domain/repositories/ITransactionRepository.ts';
import { AuthenticatedRequest, authMiddleware } from '../middlewares/AuthMiddleware.ts';
import { EventBroadcaster } from '../../infrastructure/realtime/EventBroadcaster.ts';
import { parseHikvisionPayload } from '../../infrastructure/hikvision/HikvisionWebhookParser.ts';
import { NetworkService } from '../../infrastructure/network/NetworkService.ts';

// In-memory cache for latest ANPR detections per lane
export const latestHikvisionDetections = new Map<string, any>();
export let lastSeenCameraIp: string | null = null;

export function createTollRouter(
  detectUseCase: DetectVehicleUseCase,
  payUseCase: ProcessPaymentUseCase,
  cancelUseCase: CancelTransactionUseCase,
  manualBarrierUseCase: ManualBarrierOpenUseCase,
  transactionRepo: ITransactionRepository
): Router {
  const router = Router();

  // 1. Simuler détection véhicule + ANPR + classification + ticket
  router.post('/detect', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { laneId, plate, category } = req.body;
      const result = await detectUseCase.execute(laneId || 'CAISSE-01', plate, category);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 2. Traiter le paiement & générer transaction + reçu
  router.post('/pay', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await payUseCase.execute(req.body);
      // Diffuser l'événement en temps réel vers le Dashboard
      EventBroadcaster.broadcast('transaction:completed', result);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 3. Liste des transactions avec recherche et filtres
  router.get('/transactions', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        startDate,
        endDate,
        cashierId,
        laneId,
        paymentMethod,
        categoryCode,
        status,
        plateNumber,
        limit,
        offset
      } = req.query;

      const filter: any = {};
      if (startDate) filter.startDate = new Date(startDate as string);
      if (endDate) filter.endDate = new Date(endDate as string);
      if (cashierId) filter.cashierId = cashierId as string;
      if (laneId) filter.laneId = laneId as string;
      if (paymentMethod) filter.paymentMethod = paymentMethod as string;
      if (categoryCode) filter.categoryCode = categoryCode as string;
      if (status) filter.status = status as string;
      if (plateNumber) filter.plateNumber = plateNumber as string;
      if (limit) filter.limit = parseInt(limit as string, 10);
      if (offset) filter.offset = parseInt(offset as string, 10);

      const data = await transactionRepo.search(filter);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Détail d'une transaction
  router.get('/transactions/:id', authMiddleware, async (req, res) => {
    try {
      const tx = await transactionRepo.findById(req.params.id);
      if (!tx) {
        res.status(404).json({ error: 'Transaction non trouvée' });
        return;
      }
      res.json(tx);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Annulation d'une transaction avec motif
  router.post('/transactions/:id/cancel', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { reason } = req.body;
      if (!req.user) {
        res.status(401).json({ error: 'Utilisateur non authentifié' });
        return;
      }

      const result = await cancelUseCase.execute({
        transactionId: req.params.id,
        reason,
        cancelledBy: req.user.fullName || req.user.username,
        userId: req.user.userId,
        userRole: req.user.role
      });

      EventBroadcaster.broadcast('transaction:cancelled', result);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 6. Ouverture manuelle de barrière avec motif
  router.post('/barrier/open-manual', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { laneId, reason } = req.body;
      if (!req.user) {
        res.status(401).json({ error: 'Utilisateur non authentifié' });
        return;
      }

      const result = await manualBarrierUseCase.execute({
        laneId: laneId || 'CAISSE-01',
        reason,
        userId: req.user.userId,
        username: req.user.fullName || req.user.username
      });

      EventBroadcaster.broadcast('barrier:manual-open', result);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // 7. Webhook Réception Caméras Réelles LAPI / ANPR (Hikvision, Dahua, Axis, Multi-Marques)
  router.post(['/camera-webhook', '/anpr-webhook', '/hikvision-webhook'], async (req, res) => {
    try {
      const parsed = parseHikvisionPayload(req.body);
      if (!parsed || !parsed.plateNumber) {
        res.status(400).json({
          ResponseStatus: 'INVALID_PAYLOAD',
          message: 'No readable license plate in camera ANPR payload'
        });
        return;
      }

      // Détection automatique et dynamique de l'IP réelle de la caméra émettrice
      const remote = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || req.ip || '';
      const cleanIp = remote.replace(/^.*:/, '');
      if (cleanIp && cleanIp !== '1' && cleanIp !== '127.0.0.1') {
        lastSeenCameraIp = cleanIp;
      } else if (parsed.cameraIp) {
        lastSeenCameraIp = parsed.cameraIp;
      }

      console.log(`[CAMERA LAPI] 🎥 Détection reçue pour ${parsed.laneId}: Plaque ${parsed.plateNumber} (${parsed.vehicleType} -> ${parsed.categoryCode}, conf: ${parsed.confidence}%, IP caméra: ${lastSeenCameraIp || 'auto'})`);

      const result = await detectUseCase.execute(parsed.laneId, parsed.plateNumber, parsed.categoryCode);
      if (parsed.vehicleImageUrl) {
        result.vehicleImageUrl = parsed.vehicleImageUrl;
      }
      result.confidence = parsed.confidence;

      latestHikvisionDetections.set(parsed.laneId, result);

      EventBroadcaster.broadcast('camera:vehicle-detected', result);
      EventBroadcaster.broadcast('hikvision:vehicle-detected', result);
      EventBroadcaster.broadcast('vehicle:detected', result);

      res.status(200).json({
        ResponseStatus: 'OK',
        statusCode: 1,
        statusString: 'OK',
        message: 'ANPR camera event processed successfully',
        detection: result
      });
    } catch (err: any) {
      console.error('[CAMERA LAPI] Error processing webhook:', err);
      res.status(500).json({ ResponseStatus: 'ERROR', message: err.message });
    }
  });

  // 8. Simulation de réception Webhook Caméra LAPI pour banc d'essai et techniciens
  router.post(['/camera-webhook/simulate', '/anpr-webhook/simulate', '/hikvision-webhook/simulate'], async (req, res) => {
    try {
      const { plateNumber, vehicleType, confidence, laneId, vehicleImageUrl } = req.body || {};
      const plate = plateNumber || 'AB-864-HM';
      const vType = vehicleType || 'car';
      const conf = confidence || 98;
      const lane = laneId || 'VOIE-01';

      const parsed = parseHikvisionPayload({
        plateNumber: plate,
        vehicleType: vType,
        confidence: conf,
        laneId: lane,
        vehicleImageUrl: vehicleImageUrl || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=500&auto=format&fit=crop&q=80'
      });

      if (!parsed) {
        res.status(400).json({ error: 'Simulation payload could not be parsed' });
        return;
      }

      const result = await detectUseCase.execute(parsed.laneId, parsed.plateNumber, parsed.categoryCode);
      if (parsed.vehicleImageUrl) {
        result.vehicleImageUrl = parsed.vehicleImageUrl;
      }
      result.confidence = parsed.confidence;

      latestHikvisionDetections.set(parsed.laneId, result);

      EventBroadcaster.broadcast('camera:vehicle-detected', result);
      EventBroadcaster.broadcast('hikvision:vehicle-detected', result);
      EventBroadcaster.broadcast('vehicle:detected', result);

      res.status(200).json({
        ResponseStatus: 'OK',
        statusCode: 1,
        message: 'Camera simulation event triggered successfully',
        detection: result
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 9. Récupération de la dernière détection reçue par la caméra LAPI
  router.get(['/camera-latest', '/anpr-latest', '/hikvision-latest'], async (req, res) => {
    const laneId = (req.query.laneId as string) || 'VOIE-01';
    const detection = latestHikvisionDetections.get(laneId) || null;
    res.json({ laneId, detection });
  });

  // 10. Statut dynamique de la passerelle Caméra LAPI & Réseau (Multi-Marques)
  router.get(['/camera-status', '/anpr-status', '/hikvision-status'], async (_req, res) => {
    const serverPort = Number(process.env.PORT) || 3001;
    const network = NetworkService.getNetworkInfo(serverPort);
    res.json({
      status: 'LISTENING',
      supportedVendors: ['Hikvision (ISAPI)', 'Dahua (ANPR/ITC)', 'Axis (VAPIX/LPR)', 'Uniview', 'Standard HTTP/JSON ANPR'],
      supportedModel: 'DS-2CD4626FWD-IZHS/P (Hikvision), Dahua, Axis & Multi-Marques',
      serverIps: network.serverIps,
      primaryServerIp: network.primaryIp,
      serverPort: network.port,
      webhookUrls: network.webhookUrls,
      webhookEndpoint: '/api/toll/camera-webhook',
      hikvisionEndpoint: '/api/toll/hikvision-webhook',
      activeCameraIp: lastSeenCameraIp,
      activeDetectionsCount: latestHikvisionDetections.size,
      time: new Date().toISOString()
    });
  });

  // 11. Informations Réseau Dynamiques (pour configuration caméra sans IP en dur)
  router.get('/network-info', async (_req, res) => {
    const serverPort = Number(process.env.PORT) || 3001;
    res.json(NetworkService.getNetworkInfo(serverPort));
  });

  // 12. Proxy de flux vidéo direct MJPEG pour affichage temps réel dans le navigateur
  router.get(['/camera-stream', '/anpr-stream', '/camera-live'], async (_req, res) => {
    try {
      const http = await import('http');
      const proxyReq = http.request('http://127.0.0.1:1984/api/stream.mjpeg?src=hikvision', (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, {
          'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Connection': 'close',
          'Pragma': 'no-cache'
        });
        proxyRes.pipe(res);
      });

      proxyReq.on('error', () => {
        if (!res.headersSent) {
          res.status(502).json({ error: 'Flux vidéo indisponible' });
        }
      });

      _req.on('close', () => {
        proxyReq.destroy();
      });

      proxyReq.end();
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    }
  });

  // 13. Instantané en direct (Snapshot JPEG)
  router.get(['/camera-snapshot', '/camera/snapshot'], async (_req, res) => {
    try {
      const http = await import('http');
      const proxyReq = http.request('http://127.0.0.1:1984/api/frame.jpeg?src=hikvision', (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        });
        proxyRes.pipe(res);
      });

      proxyReq.on('error', () => {
        if (!res.headersSent) {
          res.status(502).json({ error: 'Instantané indisponible' });
        }
      });

      proxyReq.end();
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    }
  });

  return router;
}
