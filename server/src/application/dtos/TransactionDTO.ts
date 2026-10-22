import { PaymentMethod } from '../../domain/value-objects/PaymentMethod.ts';
import { TransactionStatus } from '../../domain/entities/TollTransaction.ts';

export interface DetectVehicleResponseDTO {
  plateNumber: string;
  confidence: number;
  categoryCode: string;
  categoryLabel: string;
  amountDue: number;
  ticketNumber: string;
  qrCodeData: string;
  detectedAt: Date;
  vehicleImageUrl: string;
}

export interface ProcessPaymentRequestDTO {
  sessionId?: string;
  laneId: string;
  plateNumber: string;
  categoryCode: string;
  categoryLabel: string;
  amountDue: number;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  cashierId: string;
  cashierName: string;
  ticketNumber: string;
  qrCodeData?: string;
}

export interface TransactionDTO {
  id: string;
  ticketNumber: string;
  laneId: string;
  plateNumber: string;
  categoryCode: string;
  categoryLabel: string;
  amountDue: number;
  amountPaid: number;
  changeReturned: number;
  paymentMethod: PaymentMethod;
  cashierId: string;
  cashierName: string;
  status: TransactionStatus;
  createdAt: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  cancelledBy?: string;
  qrCodeData?: string;
}

export interface CancelTransactionRequestDTO {
  transactionId: string;
  reason: string;
  cancelledBy: string;
  userId: string;
  userRole: string;
}
