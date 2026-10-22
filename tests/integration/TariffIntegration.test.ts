import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../../server/src/app.ts';
import { seedDatabase } from '../../server/src/infrastructure/persistence/SeedData.ts';
import { TariffUseCases } from '../../server/src/application/use-cases/TariffUseCases.ts';

describe('Tariff Management Integration Tests', () => {
  let appInstance: ReturnType<typeof createApp>;
  let tariffUseCases: TariffUseCases;

  beforeEach(async () => {
    appInstance = createApp();
    await seedDatabase(
      appInstance.repos.userRepo,
      appInstance.repos.tariffRepo,
      appInstance.repos.transactionRepo,
      appInstance.repos.sessionRepo,
      appInstance.repos.auditRepo
    );
    tariffUseCases = new TariffUseCases(appInstance.repos.tariffRepo, appInstance.repos.auditRepo);
  });

  it('should list all 6 seeded categories (AREZKI BISSAU)', async () => {
    const list = await tariffUseCases.getAll();
    expect(list.length).toBe(6);
    const codes = list.map(c => c.code);
    expect(codes).toContain('CAT1');
    expect(codes).toContain('CAT2');
    expect(codes).toContain('CAT3');
    expect(codes).toContain('CAT4');
    expect(codes).toContain('CAT5');
    expect(codes).toContain('EXEMPT');
  });

  it('should update rate with reason and record in history and audit', async () => {
    const updated = await tariffUseCases.updateRate(
      {
        code: 'CAT2',
        newRate: 600,
        changedBy: 'Administrateur',
        reason: 'Hausse coût carburant'
      },
      'u-admin'
    );

    expect(updated.currentRate).toBe(600);
    expect(updated.history.length).toBeGreaterThanOrEqual(2);

    const lastHistory = updated.history[updated.history.length - 1];
    expect(lastHistory.rate).toBe(600);
    expect(lastHistory.reason).toBe('Hausse coût carburant');

    // Check audit log
    const audits = await appInstance.repos.auditRepo.getAll();
    const tariffEvent = audits.find(a => a.eventType === 'TARIFF_UPDATED');
    expect(tariffEvent).toBeDefined();
    expect(tariffEvent?.details.newRate).toBe(600);
  });
});
