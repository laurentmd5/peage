import { describe, it, expect } from 'vitest';
import { CashSession } from '../../../server/src/domain/entities/CashSession.ts';
import { PaymentMethod } from '../../../server/src/domain/value-objects/PaymentMethod.ts';

describe('CashSession Entity', () => {
  it('should initialize with initial float and OPEN status', () => {
    const session = new CashSession('cs-1', 'u-caisse1', 'Awa Diop', 'CAISSE-01', 20000);

    expect(session.id).toBe('cs-1');
    expect(session.cashierId).toBe('u-caisse1');
    expect(session.initialFloat).toBe(20000);
    expect(session.status).toBe('OPEN');
    expect(session.totalCollected).toBe(0);
    expect(session.expectedCashInDrawer).toBe(20000);
  });

  it('should register transactions across multiple payment methods', () => {
    const session = new CashSession('cs-1', 'u-caisse1', 'Awa Diop', 'CAISSE-01', 10000);

    session.registerTransaction(PaymentMethod.ESPECES, 500);
    session.registerTransaction(PaymentMethod.ESPECES, 1000);
    session.registerTransaction(PaymentMethod.WAVE, 2000);
    session.registerTransaction(PaymentMethod.CARTE, 1500);

    expect(session.totalCollected).toBe(5000);
    expect(session.breakdown[PaymentMethod.ESPECES].count).toBe(2);
    expect(session.breakdown[PaymentMethod.ESPECES].total).toBe(1500);
    expect(session.breakdown[PaymentMethod.WAVE].total).toBe(2000);
    expect(session.breakdown[PaymentMethod.CARTE].total).toBe(1500);
    // Expected cash = 10000 (float) + 1500 (cash) = 11500
    expect(session.expectedCashInDrawer).toBe(11500);
  });

  it('should close session and compute exact discrepancy', () => {
    const session = new CashSession('cs-1', 'u-caisse1', 'Awa Diop', 'CAISSE-01', 10000);
    session.registerTransaction(PaymentMethod.ESPECES, 1500);

    // Expected is 11500. Cashier counts 11000 -> deficit of -500
    const result = session.close(11000);

    expect(session.status).toBe('CLOSED');
    expect(session.closedAt).toBeInstanceOf(Date);
    expect(result.expectedCash).toBe(11500);
    expect(result.realCash).toBe(11000);
    expect(result.discrepancy).toBe(-500);
    expect(session.discrepancy).toBe(-500);
  });

  it('should reject transactions on closed session', () => {
    const session = new CashSession('cs-1', 'u-caisse1', 'Awa Diop', 'CAISSE-01', 10000);
    session.close(10000);

    expect(() => session.registerTransaction(PaymentMethod.ESPECES, 500)).toThrow('caisse fermée');
  });

  it('should reject closing already closed session', () => {
    const session = new CashSession('cs-1', 'u-caisse1', 'Awa Diop', 'CAISSE-01', 10000);
    session.close(10000);

    expect(() => session.close(10000)).toThrow('déjà fermée');
  });
});
