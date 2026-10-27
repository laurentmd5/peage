/**
 * Hardware Printing Service (HAL - Hardware Abstraction Layer)
 * Supports:
 * 1. Standard Office Printer / Kiosk Silent Auto-Printing (80mm thermal receipt emulation)
 * 2. WebSerial / WebUSB direct ESC/POS for rented or production thermal printers
 */

import QRCode from 'qrcode';

export interface TollTicketData {
  ticketNumber: string;
  laneId: string;
  plateNumber: string;
  categoryCode: string;
  categoryLabel: string;
  amountDue: number;
  amountPaid: number;
  changeReturned: number;
  paymentMethod: string;
  cashierName: string;
  timestamp?: string;
  qrCodeData?: string;
}

class HardwarePrintingService {
  private escposDevice: any = null;
  private isAutoPrintEnabled: boolean = true;

  setAutoPrint(enabled: boolean) {
    this.isAutoPrintEnabled = enabled;
  }

  getAutoPrint(): boolean {
    return this.isAutoPrintEnabled;
  }

  /**
   * Connect to an ESC/POS USB or Serial Thermal Printer via Web Serial API
   */
  async connectThermalPrinter(): Promise<{ success: boolean; message: string }> {
    if (!('serial' in navigator)) {
      return {
        success: false,
        message: "L'API Web Serial n'est pas supportée par ce navigateur. Utilisez Chrome ou Edge."
      };
    }

    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      this.escposDevice = port;
      return {
        success: true,
        message: 'Imprimante thermique ESC/POS connectée avec succès sur le port série.'
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Connexion annulée ou erreur: ${err.message}`
      };
    }
  }

  /**
   * Main entry point: Auto-prints ticket immediately upon payment validation
   */
  async printTicket(data: TollTicketData, options?: { silent?: boolean }): Promise<void> {
    if (!this.isAutoPrintEnabled && !options?.silent) return;

    // 1. Generate QR code as data URL
    const qrData = data.qrCodeData || `${data.ticketNumber}|${data.plateNumber}|${data.amountDue}|AREZKI_BISSAU`;
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(qrData, { width: 120, margin: 1 });
    } catch {
      // Fallback if qr generation fails
    }

    // 2. If raw ESC/POS device connected, send raw binary bytes
    if (this.escposDevice && this.escposDevice.writable) {
      try {
        await this.sendEscPosRaw(data);
        return;
      } catch (err) {
        console.warn('ESC/POS direct print failed, falling back to standard print spooler:', err);
      }
    }

    // 3. Standard Office Printer / Kiosk Auto-Print (80mm Thermal Receipt Layout)
    this.printViaHiddenFrame(data, qrDataUrl);
  }

  /**
   * Generates a clean 80mm thermal receipt and sends it to the default printer driver
   */
  private printViaHiddenFrame(data: TollTicketData, qrDataUrl: string): void {
    const frameId = 'peage-thermal-print-frame';
    let frame = document.getElementById(frameId) as HTMLIFrameElement;

    if (!frame) {
      frame = document.createElement('iframe');
      frame.id = frameId;
      frame.style.position = 'fixed';
      frame.style.right = '0';
      frame.style.bottom = '0';
      frame.style.width = '0';
      frame.style.height = '0';
      frame.style.border = '0';
      document.body.appendChild(frame);
    }

    const doc = frame.contentWindow?.document || frame.contentDocument;
    if (!doc) return;

    const formattedDate = data.timestamp 
      ? new Date(data.timestamp).toLocaleString('fr-FR')
      : new Date().toLocaleString('fr-FR');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Ticket de Péage - ${data.ticketNumber}</title>
        <style>
          @page {
            size: 80mm 145mm;
            margin: 0mm;
          }
          html, body {
            width: 80mm;
            max-width: 80mm;
            margin: 0;
            padding: 2mm;
            box-sizing: border-box;
            font-family: 'Courier New', Courier, monospace;
            color: #000;
            background: #fff;
            font-size: 11px;
            line-height: 1.25;
            text-align: center;
          }
          .bold { font-weight: bold; }
          .title { font-size: 14px; font-weight: 900; margin-bottom: 2px; }
          .sub { font-size: 10px; margin-bottom: 6px; }
          .divider { border-top: 1px dashed #000; margin: 5px 0; }
          .row { display: flex; justify-content: space-between; text-align: left; }
          .plate-box {
            border: 2px solid #000;
            padding: 4px;
            margin: 6px 0;
            font-size: 16px;
            font-weight: 900;
            letter-spacing: 2px;
          }
          .amount-box {
            font-size: 18px;
            font-weight: 900;
            margin: 6px 0;
          }
          .qr-img { width: 110px; height: 110px; margin: 4px auto; display: block; }
          .footer { font-size: 9px; margin-top: 6px; }
        </style>
      </head>
      <body>
        <div class="title">PÉAGE AREZKI BISSAU</div>
        <div class="sub">Gare Centrale de Péage - Bissau<br/>Tél: +245 955 00 00 00</div>
        <div class="divider"></div>

        <div class="row">
          <span>Date: ${formattedDate}</span>
          <span>Voie: ${data.laneId}</span>
        </div>
        <div class="row">
          <span>Ticket: ${data.ticketNumber}</span>
          <span>Caisse: ${data.cashierName}</span>
        </div>

        <div class="plate-box">${data.plateNumber}</div>

        <div class="row">
          <span class="bold">Catégorie :</span>
          <span class="bold">[${data.categoryCode}]</span>
        </div>
        <div style="font-size: 10px; text-align: left; margin-bottom: 4px;">${data.categoryLabel}</div>

        <div class="divider"></div>

        <div class="amount-box">${Math.round(data.amountDue).toLocaleString('fr-FR')} FCFA</div>

        <div class="row">
          <span>Mode de Règlement :</span>
          <span class="bold">${data.paymentMethod}</span>
        </div>
        <div class="row">
          <span>Montant perçu :</span>
          <span>${Math.round(data.amountPaid).toLocaleString('fr-FR')} FCFA</span>
        </div>
        <div class="row">
          <span>Monnaie rendue :</span>
          <span>${Math.round(data.changeReturned).toLocaleString('fr-FR')} FCFA</span>
        </div>

        <div class="divider"></div>

        ${qrDataUrl ? `<img src="${qrDataUrl}" class="qr-img" alt="QR" />` : ''}

        <div class="footer">
          Merci de votre passage - Bonne route<br/>
          Conservez ce ticket pour tout contrôle.<br/>
          *** SYSTÈME DE PÉAGE AUTOMATISÉ ***
        </div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Trigger auto print
    setTimeout(() => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch (e) {
        console.error('Auto print trigger error:', e);
      }
    }, 250);
  }

  /**
   * ESC/POS binary driver for raw USB/Serial thermal printers
   */
  private async sendEscPosRaw(data: TollTicketData): Promise<void> {
    if (!this.escposDevice) return;
    const writer = this.escposDevice.writable.getWriter();

    const ESC = 0x1b;
    const GS = 0x1d;

    const encoder = new TextEncoder();
    const commands: number[] = [
      ESC, 0x40, // Initialize printer
      ESC, 0x61, 0x01, // Center justification
      ESC, 0x21, 0x30, // Double height & width
      ...Array.from(encoder.encode("AREZKI BISSAU\n")),
      ESC, 0x21, 0x00, // Standard size
      ...Array.from(encoder.encode("Gare Centrale de Peage - Bissau\n")),
      ...Array.from(encoder.encode("--------------------------------\n")),
      ESC, 0x61, 0x00, // Left justification
      ...Array.from(encoder.encode(`Ticket: ${data.ticketNumber}\n`)),
      ...Array.from(encoder.encode(`Voie: ${data.laneId} | Caisse: ${data.cashierName}\n`)),
      ...Array.from(encoder.encode(`Plaque: ${data.plateNumber}\n`)),
      ...Array.from(encoder.encode(`Categorie: [${data.categoryCode}] ${data.categoryLabel}\n`)),
      ESC, 0x61, 0x01, // Center
      ESC, 0x21, 0x20, // Bold large
      ...Array.from(encoder.encode(`TOTAL: ${data.amountDue} FCFA\n`)),
      ESC, 0x21, 0x00, // Normal
      ...Array.from(encoder.encode(`Mode: ${data.paymentMethod}\n`)),
      ...Array.from(encoder.encode("--------------------------------\n")),
      ...Array.from(encoder.encode("Conservez ce recu\n\n\n")),
      GS, 0x56, 0x41, 0x10 // Partial/Full guillotine paper cut
    ];

    await writer.write(new Uint8Array(commands));
    writer.releaseLock();
  }
}

export const hardwarePrintingService = new HardwarePrintingService();
