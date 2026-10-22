import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

// Repositories
import { InMemoryUserRepository } from './infrastructure/persistence/InMemoryUserRepository.ts';
import { InMemoryTariffRepository } from './infrastructure/persistence/InMemoryTariffRepository.ts';
import { InMemoryTransactionRepository } from './infrastructure/persistence/InMemoryTransactionRepository.ts';
import { InMemoryCashSessionRepository } from './infrastructure/persistence/InMemoryCashSessionRepository.ts';
import { InMemoryAuditRepository } from './infrastructure/persistence/InMemoryAuditRepository.ts';

// Use Cases
import { AuthUseCases } from './application/use-cases/AuthUseCases.ts';
import { DetectVehicleUseCase } from './application/use-cases/DetectVehicleUseCase.ts';
import { ProcessPaymentUseCase } from './application/use-cases/ProcessPaymentUseCase.ts';
import { CancelTransactionUseCase } from './application/use-cases/CancelTransactionUseCase.ts';
import { ManualBarrierOpenUseCase } from './application/use-cases/ManualBarrierOpenUseCase.ts';
import { CashSessionUseCases } from './application/use-cases/CashSessionUseCases.ts';
import { TariffUseCases } from './application/use-cases/TariffUseCases.ts';
import { DashboardUseCases } from './application/use-cases/DashboardUseCases.ts';
import { ReportsUseCase } from './application/use-cases/ReportsUseCase.ts';

// Controllers
import { createAuthRouter } from './presentation/controllers/AuthController.ts';
import { createTollRouter } from './presentation/controllers/TollController.ts';
import { createCaisseRouter } from './presentation/controllers/CaisseController.ts';
import { createTariffRouter } from './presentation/controllers/TariffController.ts';
import { createDashboardRouter } from './presentation/controllers/DashboardController.ts';
import { createReportsRouter } from './presentation/controllers/ReportsController.ts';
import { createAuditRouter } from './presentation/controllers/AuditController.ts';

export interface AppDependencies {
  userRepo?: InMemoryUserRepository;
  tariffRepo?: InMemoryTariffRepository;
  transactionRepo?: InMemoryTransactionRepository;
  sessionRepo?: InMemoryCashSessionRepository;
  auditRepo?: InMemoryAuditRepository;
}

export function createApp(deps: AppDependencies = {}): {
  app: Express;
  repos: {
    userRepo: InMemoryUserRepository;
    tariffRepo: InMemoryTariffRepository;
    transactionRepo: InMemoryTransactionRepository;
    sessionRepo: InMemoryCashSessionRepository;
    auditRepo: InMemoryAuditRepository;
  };
} {
  const userRepo = deps.userRepo || new InMemoryUserRepository();
  const tariffRepo = deps.tariffRepo || new InMemoryTariffRepository();
  const transactionRepo = deps.transactionRepo || new InMemoryTransactionRepository();
  const sessionRepo = deps.sessionRepo || new InMemoryCashSessionRepository();
  const auditRepo = deps.auditRepo || new InMemoryAuditRepository();

  const authUseCases = new AuthUseCases(userRepo, auditRepo);
  const detectVehicleUseCase = new DetectVehicleUseCase(tariffRepo);
  const processPaymentUseCase = new ProcessPaymentUseCase(transactionRepo, sessionRepo, auditRepo);
  const cancelTransactionUseCase = new CancelTransactionUseCase(transactionRepo, auditRepo);
  const manualBarrierOpenUseCase = new ManualBarrierOpenUseCase(auditRepo);
  const cashSessionUseCases = new CashSessionUseCases(sessionRepo, auditRepo);
  const tariffUseCases = new TariffUseCases(tariffRepo, auditRepo);
  const dashboardUseCases = new DashboardUseCases(transactionRepo, auditRepo, sessionRepo);
  const reportsUseCase = new ReportsUseCase(transactionRepo, auditRepo);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));
  app.use(express.text({ type: ['text/xml', 'application/xml', 'text/plain'], limit: '20mb' }));

  // Mount API Routers
  app.use('/api/auth', createAuthRouter(authUseCases));
  app.use('/api/toll', createTollRouter(detectVehicleUseCase, processPaymentUseCase, cancelTransactionUseCase, manualBarrierOpenUseCase, transactionRepo));
  app.use('/api/caisse', createCaisseRouter(cashSessionUseCases));
  app.use('/api/tariffs', createTariffRouter(tariffUseCases));
  app.use('/api/dashboard', createDashboardRouter(dashboardUseCases));
  app.use('/api/reports', createReportsRouter(reportsUseCase));
  app.use('/api/audit', createAuditRouter(auditRepo));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'UP', service: 'Systeme de Peage Automatise', time: new Date() });
  });

  // Serve static public assets (images, vehicles)
  const publicPath = path.resolve(process.cwd(), 'client/public');
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
  }

  // Serve static UI if dist exists
  const distPath = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.join(distPath, 'index.html'));
      }
      next();
    });
  }

  return {
    app,
    repos: { userRepo, tariffRepo, transactionRepo, sessionRepo, auditRepo }
  };
}
