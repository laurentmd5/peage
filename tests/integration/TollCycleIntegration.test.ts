import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../../server/src/app.ts';
import { seedDatabase } from '../../server/src/infrastructure/persistence/SeedData.ts';
import { DetectVehicleUseCase } from '../../server/src/application/use-cases/DetectVehicleUseCase.ts';
import { ProcessPaymentUseCase } from '../../server/src/application/use-cases/ProcessPaymentUseCase.ts';
import { CancelTransactionUseCase } from '../../server/src/application/use-cases/CancelTransactionUseCase.ts';
import { ManualBarrierOpenUseCase } from '../../server/src/application/use-cases/ManualBarrierOpenUseCase.ts';
import { PaymentMethod } from '../../server/src/domain/value-objects/PaymentMethod.ts';
import { UserRole } from '../../server/src/domain/value-objects/Role.ts';

describe('Toll Cycle End-to-End Domain Integration Tests', () => {
  let appInstance: ReturnType<typeof createApp>;
  let detectUseCase: DetectVehicleUseCase;
  let payUseCase: ProcessPaymentUseCase;
  let cancelUseCase: CancelTransactionUseCase;
  let barrierUseCase: ManualBarrierOpenUseCase;

  beforeEach(async () => {
    appInstance = createApp();
    await seedDatabase(
      appInstance.repos.userRepo,
      appInstance.repos.tariffRepo,
      appInstance.repos.transactionRepo,
      appInstance.repos.sessionRepo,
      appInstance.repos.auditRepo
    );

    detectUseCase = new DetectVehicleUseCase(appInstance.repos.tariffRepo);
    payUseCase = new ProcessPaymentUseCase(
      appInstance.repos.transactionRepo,
      appInstance.repos.sessionRepo,
      appInstance.repos.auditRepo
    );
    cancelUseCase = new CancelTransactionUseCase(
      appInstance.repos.transactionRepo,
      appInstance.repos.auditRepo
    );
    barrierUseCase = new ManualBarrierOpenUseCase(appInstance.repos.auditRepo);
  });

  it('Step 1: Should simulate vehicle detection with valid ANPR and category fee', async () => {
    const detection = await detectUseCase.execute('CAISSE-01', 'GB-1234-AA', 'CAT2');

    expect(detection.plateNumber).toBe('GB-1234-AA');
    expect(detection.confidence).toBeGreaterThanOrEqual(85);
    expect(detection.categoryCode).toBe('CAT2');
    expect(detection.amountDue).toBe(500);
    expect(detection.ticketNumber).toMatch(/^TK-/);
    expect(detection.qrCodeData).toContain('GB-1234-AA');
  });

  it('Step 2: Should process cash payment with change calculation and update session', async () => {
    const detection = await detectUseCase.execute('CAISSE-01', 'GB-1234-AA', 'CAT2');

    const paymentResult = await payUseCase.execute({
      laneId: 'CAISSE-01',
      plateNumber: detection.plateNumber,
      categoryCode: detection.categoryCode,
      categoryLabel: detection.categoryLabel,
      amountDue: detection.amountDue,
      amountPaid: 1000,
      paymentMethod: PaymentMethod.ESPECES,
      cashierId: 'u-caisse1',
      cashierName: 'Awa Diop',
      ticketNumber: detection.ticketNumber,
      qrCodeData: detection.qrCodeData
    });

    expect(paymentResult.id).toBeDefined();
    expect(paymentResult.amountDue).toBe(500);
    expect(paymentResult.amountPaid).toBe(1000);
    expect(paymentResult.changeReturned).toBe(500);
    expect(paymentResult.status).toBe('COMPLETED');

    // Verify transaction exists in repository
    const saved = await appInstance.repos.transactionRepo.findById(paymentResult.id);
    expect(saved).not.toBeNull();
    expect(saved?.ticketNumber).toBe(detection.ticketNumber);

    // Verify active cash session received the payment
    const session = await appInstance.repos.sessionRepo.findActiveByCashier('u-caisse1');
    expect(session).not.toBeNull();
    expect(session!.breakdown[PaymentMethod.ESPECES].count).toBeGreaterThan(0);
  });

  it('Step 3: Should cancel transaction when requested by supervisor with mandatory reason', async () => {
    const detection = await detectUseCase.execute('CAISSE-01', 'TH-9012-CC', 'TAXI');

    const tx = await payUseCase.execute({
      laneId: 'CAISSE-01',
      plateNumber: detection.plateNumber,
      categoryCode: detection.categoryCode,
      categoryLabel: detection.categoryLabel,
      amountDue: detection.amountDue,
      amountPaid: 500,
      paymentMethod: PaymentMethod.WAVE,
      cashierId: 'u-caisse1',
      cashierName: 'Awa Diop',
      ticketNumber: detection.ticketNumber
    });

    const cancelled = await cancelUseCase.execute({
      transactionId: tx.id,
      reason: 'Double prélèvement Wave signalé par client',
      cancelledBy: 'Superviseur Principal',
      userId: 'u-super',
      userRole: UserRole.SUPERVISEUR
    });

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancellationReason).toBe('Double prélèvement Wave signalé par client');

    // Verify audit log has the event
    const audits = await appInstance.repos.auditRepo.getAll();
    const cancelEvent = audits.find(a => a.eventType === 'TRANSACTION_CANCELLED' && a.details.transactionId === tx.id);
    expect(cancelEvent).toBeDefined();
    expect(cancelEvent?.details.reason).toBe('Double prélèvement Wave signalé par client');
  });

  it('Step 4: Should open barrier manually and log audit trace', async () => {
    const result = await barrierUseCase.execute({
      laneId: 'CAISSE-01',
      reason: 'Ambulance Samu en urgence vitale',
      userId: 'u-caisse1',
      username: 'Awa Diop'
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('ouverte manuellement');

    const audits = await appInstance.repos.auditRepo.getAll();
    const barrierEvent = audits.find(a => a.eventType === 'MANUAL_BARRIER_OPEN');
    expect(barrierEvent).toBeDefined();
    expect(barrierEvent?.details.reason).toBe('Ambulance Samu en urgence vitale');
  });
});
