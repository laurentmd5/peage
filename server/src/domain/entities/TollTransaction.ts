import { PaymentMethod } from '../value-objects/PaymentMethod.ts';

export type TransactionStatus = 'COMPLETED' | 'CANCELLED';

export class TollTransaction {
  readonly id: string;
  readonly ticketNumber: string;
  readonly laneId: string;
  readonly plateNumber: string;
  readonly categoryCode: string;
  readonly categoryLabel: string;
  readonly amountDue: number;
  readonly amountPaid: number;
  readonly changeReturned: number;
  readonly paymentMethod: PaymentMethod;
  readonly cashierId: string;
  readonly cashierName: string;
  readonly createdAt: Date;
  readonly qrCodeData?: string;

  private _status: TransactionStatus;
  private _cancelledAt?: Date;
  private _cancellationReason?: string;
  private _cancelledBy?: string;

  constructor(
    id: string,
    ticketNumber: string,
    laneId: string,
    plateNumber: string,
    categoryCode: string,
    categoryLabel: string,
    amountDue: number,
    amountPaid: number,
    changeReturned: number,
    paymentMethod: PaymentMethod,
    cashierId: string,
    cashierName: string,
    status: TransactionStatus = 'COMPLETED',
    createdAt: Date = new Date(),
    cancelledAt?: Date,
    cancellationReason?: string,
    cancelledBy?: string,
    qrCodeData?: string
  ) {
    if (!id) throw new Error("L'identifiant de la transaction est requis");
    if (!ticketNumber) throw new Error('Le numéro de ticket est requis');
    if (!laneId) throw new Error("L'identifiant de la voie est requis");
    if (!plateNumber) throw new Error("La plaque d'immatriculation est requise");
    if (!categoryCode) throw new Error('Le code de catégorie est requis');
    if (amountDue < 0) throw new Error('Le montant dû ne peut pas être négatif');
    if (amountPaid < amountDue) throw new Error('Le montant payé doit couvrir le montant dû');

    this.id = id;
    this.ticketNumber = ticketNumber;
    this.laneId = laneId;
    this.plateNumber = plateNumber.toUpperCase().trim();
    this.categoryCode = categoryCode.toUpperCase().trim();
    this.categoryLabel = categoryLabel;
    this.amountDue = amountDue;
    this.amountPaid = amountPaid;
    this.changeReturned = Math.max(0, changeReturned);
    this.paymentMethod = paymentMethod;
    this.cashierId = cashierId;
    this.cashierName = cashierName;
    this._status = status;
    this.createdAt = createdAt;
    this._cancelledAt = cancelledAt;
    this._cancellationReason = cancellationReason;
    this._cancelledBy = cancelledBy;
    this.qrCodeData = qrCodeData;
  }

  get status(): TransactionStatus {
    return this._status;
  }

  get cancelledAt(): Date | undefined {
    return this._cancelledAt;
  }

  get cancellationReason(): string | undefined {
    return this._cancellationReason;
  }

  get cancelledBy(): string | undefined {
    return this._cancelledBy;
  }

  cancel(cancelledBy: string, reason: string): void {
    if (this._status === 'CANCELLED') {
      throw new Error('Cette transaction est déjà annulée');
    }
    if (!reason || reason.trim().length < 3) {
      throw new Error("Un motif d'annulation explicite (au moins 3 caractères) est obligatoire");
    }
    if (!cancelledBy) {
      throw new Error("L'identifiant de la personne annulant est requis");
    }

    this._status = 'CANCELLED';
    this._cancelledAt = new Date();
    this._cancellationReason = reason.trim();
    this._cancelledBy = cancelledBy;
  }

  toJSON() {
    return {
      id: this.id,
      ticketNumber: this.ticketNumber,
      laneId: this.laneId,
      plateNumber: this.plateNumber,
      categoryCode: this.categoryCode,
      categoryLabel: this.categoryLabel,
      amountDue: this.amountDue,
      amountPaid: this.amountPaid,
      changeReturned: this.changeReturned,
      paymentMethod: this.paymentMethod,
      cashierId: this.cashierId,
      cashierName: this.cashierName,
      status: this._status,
      createdAt: this.createdAt,
      cancelledAt: this._cancelledAt,
      cancellationReason: this._cancellationReason,
      cancelledBy: this._cancelledBy,
      qrCodeData: this.qrCodeData
    };
  }
}
