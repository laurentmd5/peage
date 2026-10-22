export interface ReconciliationResult {
  expectedCash: number;
  realCashCounted: number;
  discrepancy: number; // positive = surplus, negative = deficit, 0 = exact
  status: 'BALANCED' | 'DEFICIT' | 'SURPLUS';
  message: string;
}

export class ReconciliationService {
  reconcile(initialFloat: number, cashCollected: number, realCashCounted: number): ReconciliationResult {
    const expectedCash = initialFloat + cashCollected;
    const discrepancy = realCashCounted - expectedCash;

    let status: 'BALANCED' | 'DEFICIT' | 'SURPLUS' = 'BALANCED';
    let message = 'Caisse parfaitement équilibrée';

    if (discrepancy < 0) {
      status = 'DEFICIT';
      message = `Déficit de caisse constaté : ${Math.abs(discrepancy)} FCFA manquant(s)`;
    } else if (discrepancy > 0) {
      status = 'SURPLUS';
      message = `Excédent de caisse constaté : ${discrepancy} FCFA en trop`;
    }

    return {
      expectedCash,
      realCashCounted,
      discrepancy,
      status,
      message
    };
  }
}
