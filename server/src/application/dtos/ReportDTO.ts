import { PaymentMethod } from '../../domain/value-objects/PaymentMethod.ts';

export interface ReportFilterDTO {
  startDate: string;
  endDate: string;
  cashierId?: string;
  laneId?: string;
  categoryCode?: string;
  paymentMethod?: PaymentMethod;
}

export interface ReportSummaryDTO {
  title: string;
  generatedAt: Date;
  generatedBy: string;
  period: { start: string; end: string };

  totalVehicles: number;
  totalRevenue: number;
  totalCancelled: number;
  totalManualOpenings: number;

  byCategory: Array<{ code: string; label: string; count: number; total: number }>;
  byPaymentMethod: Array<{ method: PaymentMethod; label: string; count: number; total: number }>;
  byCashier: Array<{ cashierId: string; cashierName: string; count: number; total: number }>;
  byLane: Array<{ laneId: string; count: number; total: number }>;

  cancellations: Array<{
    id: string;
    ticketNumber: string;
    plateNumber: string;
    amount: number;
    cancelledAt: Date;
    cancelledBy: string;
    reason: string;
  }>;

  manualOpenings: Array<{
    id: string;
    timestamp: Date;
    laneId: string;
    openedBy: string;
    reason: string;
  }>;
}
