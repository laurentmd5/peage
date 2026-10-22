export class Ticket {
  readonly ticketNumber: string;
  readonly qrCodeData: string;
  readonly issuedAt: Date;
  readonly laneId: string;

  constructor(ticketNumber: string, qrCodeData: string, laneId: string, issuedAt: Date = new Date()) {
    if (!ticketNumber) throw new Error('Le numéro de ticket est requis');
    if (!laneId) throw new Error("L'identifiant de la voie est requis");

    this.ticketNumber = ticketNumber;
    this.qrCodeData = qrCodeData;
    this.laneId = laneId;
    this.issuedAt = issuedAt;
  }

  static generate(laneId: string, plate: string, categoryCode: string, amount: number): Ticket {
    const timestamp = Date.now();
    const random = Math.floor(1000 + Math.random() * 9000);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const ticketNumber = `TK-${dateStr}-${random}`;

    const qrPayload = JSON.stringify({
      t: ticketNumber,
      l: laneId,
      p: plate,
      c: categoryCode,
      a: amount,
      d: timestamp
    });

    return new Ticket(ticketNumber, qrPayload, laneId);
  }
}
