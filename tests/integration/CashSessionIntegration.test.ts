import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../../server/src/app.ts';
import { seedDatabase } from '../../server/src/infrastructure/persistence/SeedData.ts';
import { CashSessionUseCases } from '../../server/src/application/use-cases/CashSessionUseCases.ts';

describe('Cash Session Management Integration Tests', () => {
  let appInstance: ReturnType<typeof createApp>;
  let sessionUseCases: CashSessionUseCases;

  beforeEach(async () => {
    appInstance = createApp();
    await seedDatabase(
      appInstance.repos.userRepo,
      appInstance.repos.tariffRepo,
      appInstance.repos.transactionRepo,
      appInstance.repos.sessionRepo,
      appInstance.repos.auditRepo
    );
    sessionUseCases = new CashSessionUseCases(appInstance.repos.sessionRepo, appInstance.repos.auditRepo);
  });

  it('should retrieve active session for caissier1 with initial float', async () => {
    const active = await sessionUseCases.getActiveSession('u-caisse1');
    expect(active).not.toBeNull();
    expect(active?.initialFloat).toBe(25000);
    expect(active?.status).toBe('OPEN');
  });

  it('should close cash session, record real cash counted, and compute discrepancy', async () => {
    const active = await sessionUseCases.getActiveSession('u-caisse1');
    expect(active).not.toBeNull();

    // Close session with real cash
    const expected = active!.expectedCashInDrawer;
    const counted = expected - 500; // 500 FCFA deficit

    const closed = await sessionUseCases.closeSession(
      { sessionId: active!.id, realCashCounted: counted },
      'u-caisse1',
      'Caissier 1'
    );

    expect(closed.status).toBe('CLOSED');
    expect(closed.realCashCounted).toBe(counted);
    expect(closed.discrepancy).toBe(-500);

    // Verify session closed in audit
    const audits = await appInstance.repos.auditRepo.getAll();
    const closeEvent = audits.find(a => a.eventType === 'SESSION_CLOSED' && a.details.sessionId === active!.id);
    expect(closeEvent).toBeDefined();
    expect(closeEvent?.details.discrepancy).toBe(-500);
  });
});
