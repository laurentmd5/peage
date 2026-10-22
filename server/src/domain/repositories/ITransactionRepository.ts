import { TollTransaction } from '../entities/TollTransaction.ts';

export interface TransactionFilter {
  startDate?: Date;
  endDate?: Date;
  cashierId?: string;
  laneId?: string;
  paymentMethod?: string;
  categoryCode?: string;
  status?: string;
  plateNumber?: string;
  limit?: number;
  offset?: number;
}

export interface ITransactionRepository {
  save(transaction: TollTransaction): Promise<void>;
  findById(id: string): Promise<TollTransaction | null>;
  findByTicketNumber(ticketNumber: string): Promise<TollTransaction | null>;
  search(filter: TransactionFilter): Promise<{ transactions: TollTransaction[]; total: number }>;
  getAll(): Promise<TollTransaction[]>;
}
