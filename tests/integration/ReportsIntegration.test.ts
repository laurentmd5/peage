import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../../server/src/app.ts';
import { seedDatabase } from '../../server/src/infrastructure/persistence/SeedData.ts';
import { ReportsUseCase } from '../../server/src/application/use-cases/ReportsUseCase.ts';

describe('Reports Integration Tests', () => {
  let appInstance: ReturnType<typeof createApp>;
  let reportsUseCase: ReportsUseCase;

  beforeEach(async () => {
    appInstance = createApp();
    await seedDatabase(
      appInstance.repos.userRepo,
      appInstance.repos.tariffRepo,
      appInstance.repos.transactionRepo,
      appInstance.repos.sessionRepo,
      appInstance.repos.auditRepo
    );
    reportsUseCase = new ReportsUseCase(appInstance.repos.transactionRepo, appInstance.repos.auditRepo);
  });

  it('should generate report summary for past 7 days', async () => {
    const now = new Date();
    const start = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const end = now.toISOString().slice(0, 10);

    const report = await reportsUseCase.generate({
      startDate: start,
      endDate: end
    }, 'Administrateur');

    expect(report.totalVehicles).toBeGreaterThan(0);
    expect(report.totalRevenue).toBeGreaterThan(0);
    expect(report.byCategory.length).toBeGreaterThan(0);
    expect(report.byPaymentMethod.length).toBeGreaterThan(0);
    expect(report.byCashier.length).toBeGreaterThan(0);
    expect(report.cancellations.length).toBeGreaterThanOrEqual(1);
    expect(report.manualOpenings.length).toBeGreaterThanOrEqual(1);
  });
});
