import { describe, it, expect } from 'vitest';
import { generateReceiptPdf, generateClosingReportPdf, formatCurrency } from '../../client/src/services/receiptPdf.ts';
import { TollTransaction, CashSession } from '../../client/src/types.ts';

describe('Bilingual PDF Receipt and Report Generation Unit Tests', () => {
  const dummyTx: TollTransaction = {
    id: 'tx-12345',
    ticketNumber: 'TCK-2026-0099',
    laneId: 'CAISSE-01',
    plateNumber: 'DK-1234-AA',
    categoryCode: 'VL',
    categoryLabel: 'Véhicule léger',
    amountDue: 500,
    amountPaid: 1000,
    changeReturned: 500,
    paymentMethod: 'ESPECES',
    cashierId: 'u-caisse1',
    cashierName: 'Awa Diop',
    status: 'COMPLETED',
    createdAt: new Date().toISOString(),
    qrCodeData: 'PEAGE-DK-1234-AA-500'
  };

  const dummySession: CashSession = {
    id: 'cs-001',
    boothId: 'CAISSE-01',
    cashierId: 'u-caisse1',
    cashierName: 'Awa Diop',
    openedAt: new Date().toISOString(),
    initialFloat: 20000,
    totalCollected: 15000,
    expectedCashInDrawer: 35000,
    realCashCounted: 35000,
    discrepancy: 0,
    status: 'CLOSED',
    breakdown: {
      ESPECES: { total: 15000, count: 10 },
      WAVE: { total: 0, count: 0 },
      ORANGE_MONEY: { total: 0, count: 0 },
      CARTE: { total: 0, count: 0 },
      RFID: { total: 0, count: 0 }
    }
  };

  it('should format currency with clean ASCII spaces without distorting characters', () => {
    expect(formatCurrency(1500)).toBe('1 500');
    expect(formatCurrency(250000)).toBe('250 000');
    expect(formatCurrency(0)).toBe('0');
  });

  it('should generate French thermal receipt PDF without errors', async () => {
    const docFr = await generateReceiptPdf(dummyTx, 'fr');
    expect(docFr).toBeDefined();
    expect(docFr.getNumberOfPages()).toBe(1);
  });

  it('should generate English thermal receipt PDF without errors', async () => {
    const docEn = await generateReceiptPdf(dummyTx, 'en');
    expect(docEn).toBeDefined();
    expect(docEn.getNumberOfPages()).toBe(1);
  });

  it('should generate French cash session closing report PDF', () => {
    const doc = generateClosingReportPdf(dummySession, 'fr');
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('should generate English cash session closing report PDF', () => {
    const doc = generateClosingReportPdf(dummySession, 'en');
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
