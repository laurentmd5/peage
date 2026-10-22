import { PaymentMethod } from '../../domain/value-objects/PaymentMethod.ts';
import { MethodBreakdown } from '../../domain/entities/CashSession.ts';

export interface OpenSessionRequestDTO {
  cashierId: string;
  cashierName: string;
  boothId: string;
  initialFloat: number;
}

export interface CloseSessionRequestDTO {
  sessionId: string;
  realCashCounted: number;
}

export interface CashSessionDTO {
  id: string;
  cashierId: string;
  cashierName: string;
  boothId: string;
  openedAt: Date;
  closedAt?: Date;
  initialFloat: number;
  totalCollected: number;
  expectedCashInDrawer: number;
  realCashCounted?: number;
  discrepancy?: number;
  status: 'OPEN' | 'CLOSED';
  breakdown: Record<PaymentMethod, MethodBreakdown>;
}
