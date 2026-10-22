import { PaymentMethod } from '../value-objects/PaymentMethod.ts';

export interface MethodBreakdown {
  count: number;
  total: number;
}

export class CashSession {
  readonly id: string;
  readonly cashierId: string;
  readonly cashierName: string;
  readonly boothId: string;
  readonly openedAt: Date;
  readonly initialFloat: number;

  private _closedAt?: Date;
  private _status: 'OPEN' | 'CLOSED';
  private _totalCollected: number;
  private _realCashCounted?: number;
  private _discrepancy?: number;
  private _breakdown: Record<PaymentMethod, MethodBreakdown>;

  constructor(
    id: string,
    cashierId: string,
    cashierName: string,
    boothId: string,
    initialFloat: number = 0,
    openedAt: Date = new Date(),
    status: 'OPEN' | 'CLOSED' = 'OPEN',
    totalCollected: number = 0,
    breakdown?: Record<PaymentMethod, MethodBreakdown>,
    closedAt?: Date,
    realCashCounted?: number,
    discrepancy?: number
  ) {
    if (!id) throw new Error("L'identifiant de session est requis");
    if (!cashierId) throw new Error("L'identifiant du caissier est requis");
    if (!boothId) throw new Error("L'identifiant de la cabine/voie est requis");
    if (initialFloat < 0) throw new Error('Le fond de caisse initial ne peut pas être négatif');

    this.id = id;
    this.cashierId = cashierId;
    this.cashierName = cashierName;
    this.boothId = boothId;
    this.initialFloat = initialFloat;
    this.openedAt = openedAt;
    this._status = status;
    this._totalCollected = totalCollected;
    this._closedAt = closedAt;
    this._realCashCounted = realCashCounted;
    this._discrepancy = discrepancy;

    this._breakdown = breakdown || {
      [PaymentMethod.ESPECES]: { count: 0, total: 0 },
      [PaymentMethod.CARTE]: { count: 0, total: 0 },
      [PaymentMethod.WAVE]: { count: 0, total: 0 },
      [PaymentMethod.ORANGE_MONEY]: { count: 0, total: 0 },
      [PaymentMethod.RFID]: { count: 0, total: 0 }
    };
  }

  get status(): 'OPEN' | 'CLOSED' {
    return this._status;
  }

  get closedAt(): Date | undefined {
    return this._closedAt;
  }

  get totalCollected(): number {
    return this._totalCollected;
  }

  get realCashCounted(): number | undefined {
    return this._realCashCounted;
  }

  get discrepancy(): number | undefined {
    return this._discrepancy;
  }

  get breakdown(): Readonly<Record<PaymentMethod, MethodBreakdown>> {
    return { ...this._breakdown };
  }

  get expectedCashInDrawer(): number {
    const cashTotal = this._breakdown[PaymentMethod.ESPECES]?.total || 0;
    return this.initialFloat + cashTotal;
  }

  registerTransaction(method: PaymentMethod, amount: number): void {
    if (this._status !== 'OPEN') {
      throw new Error('Impossible d\'enregistrer une transaction sur une caisse fermée');
    }
    if (amount < 0) {
      throw new Error('Le montant de la transaction ne peut pas être négatif');
    }

    if (!this._breakdown[method]) {
      this._breakdown[method] = { count: 0, total: 0 };
    }

    this._breakdown[method].count += 1;
    this._breakdown[method].total += amount;
    this._totalCollected += amount;
  }

  close(realCashCounted: number): { expectedCash: number; realCash: number; discrepancy: number } {
    if (this._status !== 'OPEN') {
      throw new Error('Cette session de caisse est déjà fermée');
    }
    if (realCashCounted < 0) {
      throw new Error('Le montant compté ne peut pas être négatif');
    }

    const expectedCash = this.expectedCashInDrawer;
    const discrepancy = realCashCounted - expectedCash;

    this._realCashCounted = realCashCounted;
    this._discrepancy = discrepancy;
    this._closedAt = new Date();
    this._status = 'CLOSED';

    return {
      expectedCash,
      realCash: realCashCounted,
      discrepancy
    };
  }

  toJSON() {
    return {
      id: this.id,
      cashierId: this.cashierId,
      cashierName: this.cashierName,
      boothId: this.boothId,
      openedAt: this.openedAt,
      closedAt: this._closedAt,
      initialFloat: this.initialFloat,
      totalCollected: this._totalCollected,
      expectedCashInDrawer: this.expectedCashInDrawer,
      realCashCounted: this._realCashCounted,
      discrepancy: this._discrepancy,
      status: this._status,
      breakdown: this._breakdown
    };
  }
}
