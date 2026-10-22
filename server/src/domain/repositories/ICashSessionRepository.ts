import { CashSession } from '../entities/CashSession.ts';

export interface ICashSessionRepository {
  save(session: CashSession): Promise<void>;
  findById(id: string): Promise<CashSession | null>;
  findActiveByCashier(cashierId: string): Promise<CashSession | null>;
  findActiveByBooth(boothId: string): Promise<CashSession | null>;
  getAll(): Promise<CashSession[]>;
}
