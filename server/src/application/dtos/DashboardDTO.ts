import { PaymentMethod } from '../../domain/value-objects/PaymentMethod.ts';
import { TransactionDTO } from './TransactionDTO.ts';

export interface DashboardStatsDTO {
  todayVehiclesCount: number;
  todayRevenue: number;
  todayCancelledCount: number;
  todayManualOpeningsCount: number;
  activeSessionsCount: number;

  revenueByHour: Array<{ hour: string; revenue: number; count: number }>;
  categoryDistribution: Array<{ code: string; label: string; count: number; percentage: number }>;
  paymentDistribution: Array<{ method: PaymentMethod; label: string; count: number; total: number }>;
  laneDistribution: Array<{ laneId: string; count: number; total: number }>;
  cashierRanking: Array<{ cashierName: string; count: number; total: number }>;

  recentTransactions: TransactionDTO[];
  equipmentHealth: {
    barrier: 'OK' | 'WARN' | 'ERROR';
    anprCamera: 'OK' | 'WARN' | 'ERROR';
    loopDetector: 'OK' | 'WARN' | 'ERROR';
    receiptPrinter: 'OK' | 'WARN' | 'ERROR';
    paymentTerminal: 'OK' | 'WARN' | 'ERROR';
    displayPanel: 'OK' | 'WARN' | 'ERROR';
  };
}
