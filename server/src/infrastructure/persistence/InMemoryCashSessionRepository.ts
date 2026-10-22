import { ICashSessionRepository } from '../../domain/repositories/ICashSessionRepository.ts';
import { CashSession } from '../../domain/entities/CashSession.ts';

export class InMemoryCashSessionRepository implements ICashSessionRepository {
  private sessions: Map<string, CashSession> = new Map();

  async save(session: CashSession): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async findById(id: string): Promise<CashSession | null> {
    return this.sessions.get(id) || null;
  }

  async findActiveByCashier(cashierId: string): Promise<CashSession | null> {
    for (const session of this.sessions.values()) {
      if (session.cashierId === cashierId && session.status === 'OPEN') {
        return session;
      }
    }
    return null;
  }

  async findActiveByBooth(boothId: string): Promise<CashSession | null> {
    for (const session of this.sessions.values()) {
      if (session.boothId === boothId && session.status === 'OPEN') {
        return session;
      }
    }
    return null;
  }

  async getAll(): Promise<CashSession[]> {
    return Array.from(this.sessions.values());
  }
}
