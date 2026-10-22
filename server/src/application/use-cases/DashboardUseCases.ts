import { ITransactionRepository } from '../../domain/repositories/ITransactionRepository.ts';
import { IAuditRepository } from '../../domain/repositories/IAuditRepository.ts';
import { ICashSessionRepository } from '../../domain/repositories/ICashSessionRepository.ts';
import { DashboardStatsDTO } from '../dtos/DashboardDTO.ts';
import { PaymentMethod, PAYMENT_METHOD_LABELS } from '../../domain/value-objects/PaymentMethod.ts';
import { TransactionDTO } from '../dtos/TransactionDTO.ts';

export class DashboardUseCases {
  constructor(
    private readonly transactionRepo: ITransactionRepository,
    private readonly auditRepo: IAuditRepository,
    private readonly cashSessionRepo: ICashSessionRepository
  ) {}

  async getStats(): Promise<DashboardStatsDTO> {
    const allTransactions = await this.transactionRepo.getAll();
    const allAuditEvents = await this.auditRepo.getAll();
    const allSessions = await this.cashSessionRepo.getAll();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayTransactions = allTransactions.filter(t => new Date(t.createdAt) >= startOfToday);
    const todayCompleted = todayTransactions.filter(t => t.status === 'COMPLETED');
    const todayCancelled = todayTransactions.filter(t => t.status === 'CANCELLED');

    const todayManualOpenings = allAuditEvents.filter(
      a => a.eventType === 'MANUAL_BARRIER_OPEN' && new Date(a.timestamp) >= startOfToday
    );

    const activeSessions = allSessions.filter(s => s.status === 'OPEN');

    const todayRevenue = todayCompleted.reduce((acc, t) => acc + t.amountDue, 0);

    // Revenue by hour (0h to 23h)
    const hoursMap: Record<number, { revenue: number; count: number }> = {};
    for (let h = 6; h <= 22; h++) {
      hoursMap[h] = { revenue: 0, count: 0 };
    }

    for (const t of todayCompleted) {
      const h = new Date(t.createdAt).getHours();
      if (!hoursMap[h]) {
        hoursMap[h] = { revenue: 0, count: 0 };
      }
      hoursMap[h].revenue += t.amountDue;
      hoursMap[h].count += 1;
    }

    const revenueByHour = Object.entries(hoursMap).map(([hour, data]) => ({
      hour: `${hour.padStart(2, '0')}h00`,
      revenue: data.revenue,
      count: data.count
    }));

    // Category distribution
    const catMap: Record<string, { label: string; count: number }> = {};
    for (const t of todayCompleted) {
      if (!catMap[t.categoryCode]) {
        catMap[t.categoryCode] = { label: t.categoryLabel, count: 0 };
      }
      catMap[t.categoryCode].count += 1;
    }

    const totalCount = todayCompleted.length || 1;
    const categoryDistribution = Object.entries(catMap).map(([code, val]) => ({
      code,
      label: val.label,
      count: val.count,
      percentage: Math.round((val.count / totalCount) * 100)
    }));

    // Payment method distribution
    const payMap: Record<PaymentMethod, { count: number; total: number }> = {
      [PaymentMethod.ESPECES]: { count: 0, total: 0 },
      [PaymentMethod.CARTE]: { count: 0, total: 0 },
      [PaymentMethod.WAVE]: { count: 0, total: 0 },
      [PaymentMethod.ORANGE_MONEY]: { count: 0, total: 0 },
      [PaymentMethod.RFID]: { count: 0, total: 0 }
    };

    for (const t of todayCompleted) {
      if (payMap[t.paymentMethod]) {
        payMap[t.paymentMethod].count += 1;
        payMap[t.paymentMethod].total += t.amountDue;
      }
    }

    const paymentDistribution = Object.entries(payMap).map(([method, data]) => ({
      method: method as PaymentMethod,
      label: PAYMENT_METHOD_LABELS[method as PaymentMethod],
      count: data.count,
      total: data.total
    }));

    // Lane distribution
    const laneMap: Record<string, { count: number; total: number }> = {};
    for (const t of todayCompleted) {
      if (!laneMap[t.laneId]) {
        laneMap[t.laneId] = { count: 0, total: 0 };
      }
      laneMap[t.laneId].count += 1;
      laneMap[t.laneId].total += t.amountDue;
    }

    const laneDistribution = Object.entries(laneMap).map(([laneId, val]) => ({
      laneId,
      count: val.count,
      total: val.total
    }));

    // Cashier ranking
    const cashierMap: Record<string, { count: number; total: number }> = {};
    for (const t of todayCompleted) {
      if (!cashierMap[t.cashierName]) {
        cashierMap[t.cashierName] = { count: 0, total: 0 };
      }
      cashierMap[t.cashierName].count += 1;
      cashierMap[t.cashierName].total += t.amountDue;
    }

    const cashierRanking = Object.entries(cashierMap).map(([name, val]) => ({
      cashierName: name,
      count: val.count,
      total: val.total
    }));

    // Recent 10 transactions
    const sorted = [...allTransactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const recentTransactions: TransactionDTO[] = sorted.slice(0, 10).map(t => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      laneId: t.laneId,
      plateNumber: t.plateNumber,
      categoryCode: t.categoryCode,
      categoryLabel: t.categoryLabel,
      amountDue: t.amountDue,
      amountPaid: t.amountPaid,
      changeReturned: t.changeReturned,
      paymentMethod: t.paymentMethod,
      cashierId: t.cashierId,
      cashierName: t.cashierName,
      status: t.status,
      createdAt: t.createdAt,
      cancelledAt: t.cancelledAt,
      cancellationReason: t.cancellationReason,
      cancelledBy: t.cancelledBy
    }));

    return {
      todayVehiclesCount: todayCompleted.length,
      todayRevenue,
      todayCancelledCount: todayCancelled.length,
      todayManualOpeningsCount: todayManualOpenings.length,
      activeSessionsCount: activeSessions.length,
      revenueByHour,
      categoryDistribution,
      paymentDistribution,
      laneDistribution,
      cashierRanking,
      recentTransactions,
      equipmentHealth: {
        barrier: 'OK',
        anprCamera: 'OK',
        loopDetector: 'OK',
        receiptPrinter: 'OK',
        paymentTerminal: 'OK',
        displayPanel: 'OK'
      }
    };
  }
}
