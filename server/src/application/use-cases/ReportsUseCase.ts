import { ITransactionRepository } from '../../domain/repositories/ITransactionRepository.ts';
import { IAuditRepository } from '../../domain/repositories/IAuditRepository.ts';
import { ReportFilterDTO, ReportSummaryDTO } from '../dtos/ReportDTO.ts';
import { PaymentMethod, PAYMENT_METHOD_LABELS } from '../../domain/value-objects/PaymentMethod.ts';

export class ReportsUseCase {
  constructor(
    private readonly transactionRepo: ITransactionRepository,
    private readonly auditRepo: IAuditRepository
  ) {}

  async generate(filter: ReportFilterDTO, generatedBy: string = 'Administrateur'): Promise<ReportSummaryDTO> {
    const allTransactions = await this.transactionRepo.getAll();
    const allAuditEvents = await this.auditRepo.getAll();

    const start = new Date(filter.startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(filter.endDate);
    end.setHours(23, 59, 59, 999);

    const filtered = allTransactions.filter(t => {
      const d = new Date(t.createdAt);
      if (d < start || d > end) return false;
      if (filter.cashierId && t.cashierId !== filter.cashierId) return false;
      if (filter.laneId && t.laneId !== filter.laneId) return false;
      if (filter.categoryCode && t.categoryCode !== filter.categoryCode) return false;
      if (filter.paymentMethod && t.paymentMethod !== filter.paymentMethod) return false;
      return true;
    });

    const completed = filtered.filter(t => t.status === 'COMPLETED');
    const cancelled = filtered.filter(t => t.status === 'CANCELLED');

    const totalRevenue = completed.reduce((sum, t) => sum + t.amountDue, 0);

    // Audit events in range
    const filteredAudits = allAuditEvents.filter(a => {
      const d = new Date(a.timestamp);
      return d >= start && d <= end;
    });

    const manualOpeningsEvents = filteredAudits.filter(a => a.eventType === 'MANUAL_BARRIER_OPEN');

    // Breakdown category
    const catMap: Record<string, { label: string; count: number; total: number }> = {};
    for (const t of completed) {
      if (!catMap[t.categoryCode]) {
        catMap[t.categoryCode] = { label: t.categoryLabel, count: 0, total: 0 };
      }
      catMap[t.categoryCode].count += 1;
      catMap[t.categoryCode].total += t.amountDue;
    }
    const byCategory = Object.entries(catMap).map(([code, d]) => ({
      code,
      label: d.label,
      count: d.count,
      total: d.total
    }));

    // Breakdown payment method
    const payMap: Record<PaymentMethod, { count: number; total: number }> = {
      [PaymentMethod.ESPECES]: { count: 0, total: 0 },
      [PaymentMethod.CARTE]: { count: 0, total: 0 },
      [PaymentMethod.WAVE]: { count: 0, total: 0 },
      [PaymentMethod.ORANGE_MONEY]: { count: 0, total: 0 },
      [PaymentMethod.RFID]: { count: 0, total: 0 }
    };
    for (const t of completed) {
      if (payMap[t.paymentMethod]) {
        payMap[t.paymentMethod].count += 1;
        payMap[t.paymentMethod].total += t.amountDue;
      }
    }
    const byPaymentMethod = Object.entries(payMap).map(([method, d]) => ({
      method: method as PaymentMethod,
      label: PAYMENT_METHOD_LABELS[method as PaymentMethod],
      count: d.count,
      total: d.total
    }));

    // Breakdown cashier
    const cashierMap: Record<string, { cashierName: string; count: number; total: number }> = {};
    for (const t of completed) {
      if (!cashierMap[t.cashierId]) {
        cashierMap[t.cashierId] = { cashierName: t.cashierName, count: 0, total: 0 };
      }
      cashierMap[t.cashierId].count += 1;
      cashierMap[t.cashierId].total += t.amountDue;
    }
    const byCashier = Object.entries(cashierMap).map(([cashierId, d]) => ({
      cashierId,
      cashierName: d.cashierName,
      count: d.count,
      total: d.total
    }));

    // Breakdown lane
    const laneMap: Record<string, { count: number; total: number }> = {};
    for (const t of completed) {
      if (!laneMap[t.laneId]) {
        laneMap[t.laneId] = { count: 0, total: 0 };
      }
      laneMap[t.laneId].count += 1;
      laneMap[t.laneId].total += t.amountDue;
    }
    const byLane = Object.entries(laneMap).map(([laneId, d]) => ({
      laneId,
      count: d.count,
      total: d.total
    }));

    return {
      title: `Rapport d'Exploitation du Péage`,
      generatedAt: new Date(),
      generatedBy,
      period: {
        start: filter.startDate,
        end: filter.endDate
      },
      totalVehicles: completed.length,
      totalRevenue,
      totalCancelled: cancelled.length,
      totalManualOpenings: manualOpeningsEvents.length,
      byCategory,
      byPaymentMethod,
      byCashier,
      byLane,
      cancellations: cancelled.map(c => ({
        id: c.id,
        ticketNumber: c.ticketNumber,
        plateNumber: c.plateNumber,
        amount: c.amountDue,
        cancelledAt: c.cancelledAt || c.createdAt,
        cancelledBy: c.cancelledBy || 'Non spécifié',
        reason: c.cancellationReason || 'Sans motif'
      })),
      manualOpenings: manualOpeningsEvents.map(m => ({
        id: m.id,
        timestamp: m.timestamp,
        laneId: m.details?.laneId || 'CAISSE-01',
        openedBy: m.username,
        reason: m.details?.reason || 'Non spécifié'
      }))
    };
  }
}
