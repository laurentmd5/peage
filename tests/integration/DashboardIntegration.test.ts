import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../../server/src/app.ts';
import { seedDatabase } from '../../server/src/infrastructure/persistence/SeedData.ts';
import { DashboardUseCases } from '../../server/src/application/use-cases/DashboardUseCases.ts';

describe('Dashboard Integration Tests', () => {
  let appInstance: ReturnType<typeof createApp>;
  let dashboardUseCases: DashboardUseCases;

  beforeEach(async () => {
    appInstance = createApp();
    await seedDatabase(
      appInstance.repos.userRepo,
      appInstance.repos.tariffRepo,
      appInstance.repos.transactionRepo,
      appInstance.repos.sessionRepo,
      appInstance.repos.auditRepo
    );
    dashboardUseCases = new DashboardUseCases(
      appInstance.repos.transactionRepo,
      appInstance.repos.auditRepo,
      appInstance.repos.sessionRepo
    );
  });

  it('should return aggregated real-time dashboard KPIs', async () => {
    const stats = await dashboardUseCases.getStats();

    expect(stats.todayVehiclesCount).toBeGreaterThan(0);
    expect(stats.todayRevenue).toBeGreaterThan(0);
    expect(stats.categoryDistribution.length).toBeGreaterThan(0);
    expect(stats.paymentDistribution.length).toBeGreaterThan(0);
    expect(stats.revenueByHour.length).toBeGreaterThan(0);
    expect(stats.equipmentHealth.barrier).toBe('OK');
    expect(stats.equipmentHealth.anprCamera).toBe('OK');
  });
});
