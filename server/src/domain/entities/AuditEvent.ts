export type AuditEventType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'TRANSACTION_CREATED'
  | 'TRANSACTION_CANCELLED'
  | 'MANUAL_BARRIER_OPEN'
  | 'TARIFF_UPDATED'
  | 'SESSION_OPENED'
  | 'SESSION_CLOSED'
  | 'ACCESS_DENIED'
  | 'EQUIPMENT_ALERT';

export class AuditEvent {
  readonly id: string;
  readonly timestamp: Date;
  readonly eventType: AuditEventType;
  readonly userId: string;
  readonly username: string;
  readonly details: Record<string, any>;
  readonly ipAddress?: string;

  constructor(
    id: string,
    eventType: AuditEventType,
    userId: string,
    username: string,
    details: Record<string, any> = {},
    timestamp: Date = new Date(),
    ipAddress?: string
  ) {
    if (!id) throw new Error("L'identifiant d'audit est requis");
    if (!eventType) throw new Error("Le type d'événement est requis");
    if (!userId) throw new Error("L'identifiant utilisateur est requis");
    if (!username) throw new Error("Le nom d'utilisateur est requis");

    this.id = id;
    this.eventType = eventType;
    this.userId = userId;
    this.username = username;
    this.details = details;
    this.timestamp = timestamp;
    this.ipAddress = ipAddress;
  }
}
