import { IAuditRepository, AuditFilter } from '../../domain/repositories/IAuditRepository.ts';
import { AuditEvent } from '../../domain/entities/AuditEvent.ts';

export class InMemoryAuditRepository implements IAuditRepository {
  private events: AuditEvent[] = [];

  async save(event: AuditEvent): Promise<void> {
    this.events.unshift(event);
  }

  async search(filter: AuditFilter): Promise<AuditEvent[]> {
    let result = [...this.events];

    if (filter.eventType) {
      result = result.filter(e => e.eventType === filter.eventType);
    }
    if (filter.userId) {
      result = result.filter(e => e.userId === filter.userId);
    }
    if (filter.startDate) {
      result = result.filter(e => new Date(e.timestamp) >= filter.startDate!);
    }
    if (filter.endDate) {
      result = result.filter(e => new Date(e.timestamp) <= filter.endDate!);
    }

    if (filter.limit) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  async getAll(): Promise<AuditEvent[]> {
    return [...this.events];
  }
}
