import { describe, it, expect } from 'vitest';
import { TollTransaction } from '../../../server/src/domain/entities/TollTransaction.ts';
import { PaymentMethod } from '../../../server/src/domain/value-objects/PaymentMethod.ts';

describe('TollTransaction Entity', () => {
  it('should initialize completed transaction correctly', () => {
    const tx = new TollTransaction(
      'tx-1',
      'TK-20260928-1001',
      'CAISSE-01',
      'AB-123-CD',
      'VL',
      'Véhicule léger',
      500,
      1000,
      500,
      PaymentMethod.ESPECES,
      'user-caisse1',
      'Awa Diop'
    );

    expect(tx.id).toBe('tx-1');
    expect(tx.status).toBe('COMPLETED');
    expect(tx.amountDue).toBe(500);
    expect(tx.amountPaid).toBe(1000);
    expect(tx.changeReturned).toBe(500);
    expect(tx.cancelledAt).toBeUndefined();
  });

  it('should reject payment if amount paid is strictly less than amount due', () => {
    expect(() => new TollTransaction(
      'tx-2',
      'TK-20260928-1002',
      'CAISSE-01',
      'AB-123-CD',
      'VL',
      'Véhicule léger',
      500,
      300,
      0,
      PaymentMethod.ESPECES,
      'user-caisse1',
      'Awa Diop'
    )).toThrow('Le montant payé doit couvrir le montant dû');
  });

  it('should cancel transaction with a mandatory reason and user trace', () => {
    const tx = new TollTransaction(
      'tx-1',
      'TK-20260928-1001',
      'CAISSE-01',
      'AB-123-CD',
      'VL',
      'Véhicule léger',
      500,
      500,
      0,
      PaymentMethod.ESPECES,
      'user-caisse1',
      'Awa Diop'
    );

    tx.cancel('user-super', 'Erreur de saisie catégorie');

    expect(tx.status).toBe('CANCELLED');
    expect(tx.cancellationReason).toBe('Erreur de saisie catégorie');
    expect(tx.cancelledBy).toBe('user-super');
    expect(tx.cancelledAt).toBeInstanceOf(Date);
  });

  it('should throw if cancellation reason is missing or too short', () => {
    const tx = new TollTransaction(
      'tx-1',
      'TK-20260928-1001',
      'CAISSE-01',
      'AB-123-CD',
      'VL',
      'Véhicule léger',
      500,
      500,
      0,
      PaymentMethod.ESPECES,
      'user-caisse1',
      'Awa Diop'
    );

    expect(() => tx.cancel('user-super', '')).toThrow("Un motif d'annulation explicite");
    expect(() => tx.cancel('user-super', 'ab')).toThrow("Un motif d'annulation explicite");
  });

  it('should throw if already cancelled', () => {
    const tx = new TollTransaction(
      'tx-1',
      'TK-20260928-1001',
      'CAISSE-01',
      'AB-123-CD',
      'VL',
      'Véhicule léger',
      500,
      500,
      0,
      PaymentMethod.ESPECES,
      'user-caisse1',
      'Awa Diop'
    );

    tx.cancel('user-super', 'Erreur de saisie');
    expect(() => tx.cancel('user-super', 'Autre motif')).toThrow('déjà annulée');
  });
});
