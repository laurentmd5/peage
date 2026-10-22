import { ITransactionRepository, TransactionFilter } from '../../domain/repositories/ITransactionRepository.ts';
import { TollTransaction } from '../../domain/entities/TollTransaction.ts';

export class InMemoryTransactionRepository implements ITransactionRepository {
  private transactions: Map<string, TollTransaction> = new Map();

  async save(transaction: TollTransaction): Promise<void> {
    this.transactions.set(transaction.id, transaction);
  }

  async findById(id: string): Promise<TollTransaction | null> {
    return this.transactions.get(id) || null;
  }

  async findByTicketNumber(ticketNumber: string): Promise<TollTransaction | null> {
    for (const tx of this.transactions.values()) {
      if (tx.ticketNumber === ticketNumber) return tx;
    }
    return null;
  }

  async search(filter: TransactionFilter): Promise<{ transactions: TollTransaction[]; total: number }> {
    let result = Array.from(this.transactions.values());

    if (filter.startDate) {
      result = result.filter(t => new Date(t.createdAt) >= filter.startDate!);
    }
    if (filter.endDate) {
      result = result.filter(t => new Date(t.createdAt) <= filter.endDate!);
    }
    if (filter.cashierId) {
      result = result.filter(t => t.cashierId === filter.cashierId);
    }
    if (filter.laneId) {
      result = result.filter(t => t.laneId === filter.laneId);
    }
    if (filter.paymentMethod) {
      result = result.filter(t => t.paymentMethod === filter.paymentMethod);
    }
    if (filter.categoryCode) {
      result = result.filter(t => t.categoryCode === filter.categoryCode);
    }
    if (filter.status) {
      result = result.filter(t => t.status === filter.status);
    }
    if (filter.plateNumber) {
      const q = filter.plateNumber.toUpperCase().trim();
      result = result.filter(t => t.plateNumber.includes(q));
    }

    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = result.length;
    const offset = filter.offset || 0;
    const limit = filter.limit || 50;

    return {
      transactions: result.slice(offset, offset + limit),
      total
    };
  }

  async getAll(): Promise<TollTransaction[]> {
    return Array.from(this.transactions.values());
  }
}
