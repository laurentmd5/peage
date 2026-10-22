import { AuditEvent, AuditEventType } from '../entities/AuditEvent.ts';

export interface AuditFilter {
  eventType?: AuditEventType;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface IAuditRepository {
  save(event: AuditEvent): Promise<void>;
  search(filter: AuditFilter): Promise<AuditEvent[]>;
  getAll(): Promise<AuditEvent[]>;
}
