import { describe, it, expect } from 'vitest';
import { Ticket } from '../../../server/src/domain/value-objects/Ticket.ts';

describe('Ticket Value Object', () => {
  it('should generate valid ticket with unique number and QR code payload', () => {
    const ticket = Ticket.generate('CAISSE-01', 'DK-1234-AA', 'VL', 500);

    expect(ticket.ticketNumber).toMatch(/^TK-\d{8}-\d{4}$/);
    expect(ticket.laneId).toBe('CAISSE-01');
    expect(ticket.issuedAt).toBeInstanceOf(Date);

    const payload = JSON.parse(ticket.qrCodeData);
    expect(payload.t).toBe(ticket.ticketNumber);
    expect(payload.l).toBe('CAISSE-01');
    expect(payload.p).toBe('DK-1234-AA');
    expect(payload.c).toBe('VL');
    expect(payload.a).toBe(500);
  });

  it('should throw if ticket number or laneId is missing', () => {
    expect(() => new Ticket('', '{}', 'CAISSE-01')).toThrow('Le numéro de ticket est requis');
    expect(() => new Ticket('TK-123', '{}', '')).toThrow("L'identifiant de la voie est requis");
  });
});
