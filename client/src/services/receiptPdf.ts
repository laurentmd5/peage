import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { TollTransaction, CashSession } from '../types.ts';

export type PdfLanguage = 'fr' | 'en';

export function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0';
  // Use regex to format with standard ASCII space (0x20) so jsPDF / Helvetica fonts don't corrupt characters with '/' or distort widths
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function getActiveLanguage(lang?: PdfLanguage): PdfLanguage {
  if (lang) return lang;
  try {
    const stored = localStorage.getItem('peage_lang');
    if (stored === 'en' || stored === 'fr') return stored;
  } catch (_) {}
  return 'fr';
}

export async function generateReceiptPdf(tx: TollTransaction, lang?: PdfLanguage): Promise<jsPDF> {
  const currentLang = getActiveLanguage(lang);
  const isEn = currentLang === 'en';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 150] // Format ticket thermique 80mm
  });

  // Header
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(isEn ? 'AREZKI BISSAU TOLLWAY' : 'PÉAGE AREZKI BISSAU', 40, 10, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(isEn ? 'Bissau Central Toll Plaza' : 'Gare Centrale de Péage - Bissau', 40, 15, { align: 'center' });
  doc.text(isEn ? 'Customer Service: +245 955 00 00 00 • Bissau' : 'Service Client: +245 955 00 00 00 • Bissau', 40, 19, { align: 'center' });

  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, 23, 75, 23);

  // Ticket Details
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(isEn ? `TICKET NO. ${tx.ticketNumber}` : `TICKET N° ${tx.ticketNumber}`, 40, 28, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const d = new Date(tx.createdAt);
  const dateStr = d.toLocaleDateString(isEn ? 'en-US' : 'fr-FR');
  const timeStr = d.toLocaleTimeString(isEn ? 'en-US' : 'fr-FR');

  doc.text(`${isEn ? 'Date:' : 'Date:'} ${dateStr} ${isEn ? 'at' : 'à'} ${timeStr}`, 5, 34);
  doc.text(`${isEn ? 'Lane / Booth:' : 'Voie / Cabine:'} ${tx.laneId}`, 5, 39);
  doc.text(`${isEn ? 'Cashier:' : 'Opérateur:'} ${tx.cashierName}`, 5, 44);

  doc.line(5, 47, 75, 47);

  // Vehicle & Category
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${isEn ? 'PLATE:' : 'PLAQUE:'} ${tx.plateNumber}`, 40, 53, { align: 'center' });

  const CATEGORY_NAMES_EN: Record<string, string> = {
    CAT1: 'Category 1 (Motos, Tricycles & Taxis)',
    CAT2: 'Category 2 (Cars & Double-Cab Pickups)',
    CAT3: 'Category 3 (Canter, Buses & Mini-Trucks)',
    CAT4: 'Category 4 (Trucks 7t to 20t)',
    CAT5: 'Category 5 (Semi-Trailers & Heavy Trailers >20t)',
    MOTO: 'Motorcycle',
    VL: 'Light Vehicle',
    TAXI: 'Taxi / Rideshare',
    MINIBUS: 'Minibus',
    BUS: 'Bus',
    UTIL: 'Utility / Van',
    PL: 'Heavy Goods / Truck',
    SPECIAL: 'Special Vehicle',
    EXEMPT: 'Exempted Vehicle'
  };

  const catLabel = isEn && CATEGORY_NAMES_EN[tx.categoryCode]
    ? CATEGORY_NAMES_EN[tx.categoryCode]
    : tx.categoryLabel;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${isEn ? 'Category:' : 'Catégorie:'} [${tx.categoryCode}] ${catLabel}`, 5, 60);
  doc.text(`${isEn ? 'Payment method:' : 'Mode de paiement:'} ${tx.paymentMethod}`, 5, 65);

  doc.line(5, 68, 75, 68);

  // Payment Breakdown
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(isEn ? 'TOTAL AMOUNT:' : 'TOTAL TTC:', 6, 75);
  doc.text(`${formatCurrency(tx.amountDue)} FCFA`, 74, 75, { align: 'right' });

  if (tx.paymentMethod === 'ESPECES') {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(isEn ? 'Amount received:' : 'Montant reçu:', 6, 81);
    doc.text(`${formatCurrency(tx.amountPaid)} FCFA`, 74, 81, { align: 'right' });
    doc.text(isEn ? 'Change returned:' : 'Monnaie rendue:', 6, 86);
    doc.text(`${formatCurrency(tx.changeReturned)} FCFA`, 74, 86, { align: 'right' });
  } else {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(isEn ? 'Payment status:' : 'Statut règlement:', 6, 81);
    doc.text(isEn ? 'PAID / VALIDATED' : 'PAYÉ / VALIDÉ', 74, 81, { align: 'right' });
  }

  // QR Code
  try {
    const qrData = tx.qrCodeData || tx.ticketNumber;
    const qrDataUrl = await QRCode.toDataURL(qrData, { margin: 1, width: 90 });
    doc.addImage(qrDataUrl, 'PNG', 27, 92, 26, 26);
  } catch (err) {
    // If QR code generation fails, skip image
  }

  // Footer
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.text(isEn ? 'Please keep this receipt for inspection.' : 'Conservez ce reçu pour tout contrôle.', 40, 125, { align: 'center' });
  doc.text(isEn ? 'Have a safe trip and drive carefully!' : 'Bonne route et roulez en sécurité !', 40, 130, { align: 'center' });
  doc.text(isEn ? 'Automated Toll System Prototype' : 'Prototype de Démonstration Péage DDD', 40, 136, { align: 'center' });

  return doc;
}

export function generateClosingReportPdf(session: CashSession, lang?: PdfLanguage): jsPDF {
  const currentLang = getActiveLanguage(lang);
  const isEn = currentLang === 'en';

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(isEn ? 'CASH SHIFT CLOSING REPORT' : 'RAPPORT DE CLÔTURE DE CAISSE', 105, 20, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Session ID: ${session.id}`, 20, 32);
  doc.text(`${isEn ? 'Lane / Booth:' : 'Voie / Cabine:'} ${session.boothId}`, 20, 38);
  doc.text(`${isEn ? 'Cashier:' : 'Caissier:'} ${session.cashierName}`, 20, 44);

  const openDate = new Date(session.openedAt).toLocaleString(isEn ? 'en-US' : 'fr-FR');
  const closeDate = session.closedAt ? new Date(session.closedAt).toLocaleString(isEn ? 'en-US' : 'fr-FR') : (isEn ? 'In progress' : 'En cours');
  doc.text(`${isEn ? 'Opened:' : 'Ouverture:'} ${openDate}`, 120, 32);
  doc.text(`${isEn ? 'Closed:' : 'Fermeture:'} ${closeDate}`, 120, 38);
  doc.text(`${isEn ? 'Status:' : 'Statut:'} ${session.status === 'CLOSED' ? (isEn ? 'CLOSED' : 'CLÔTURÉE') : (isEn ? 'OPEN' : 'OUVERTE')}`, 120, 44);

  // Financial summary
  const tableData = [
    [isEn ? 'Initial cash float' : 'Fond de caisse initial', `${formatCurrency(session.initialFloat)} FCFA`],
    [isEn ? 'Cash collected' : 'Espèces encaissées', `${formatCurrency(session.breakdown.ESPECES?.total || 0)} FCFA (${session.breakdown.ESPECES?.count || 0} ${isEn ? 'passages' : 'passages'})`],
    ['Wave Mobile Money', `${formatCurrency(session.breakdown.WAVE?.total || 0)} FCFA (${session.breakdown.WAVE?.count || 0} ${isEn ? 'passages' : 'passages'})`],
    ['Orange Money', `${formatCurrency(session.breakdown.ORANGE_MONEY?.total || 0)} FCFA (${session.breakdown.ORANGE_MONEY?.count || 0} ${isEn ? 'passages' : 'passages'})`],
    [isEn ? 'Credit/Debit Card' : 'Carte Bancaire', `${formatCurrency(session.breakdown.CARTE?.total || 0)} FCFA (${session.breakdown.CARTE?.count || 0} ${isEn ? 'passages' : 'passages'})`],
    [isEn ? 'RFID / E-Pass Tag' : 'Badge / Télépéage RFID', `${formatCurrency(session.breakdown.RFID?.total || 0)} FCFA (${session.breakdown.RFID?.count || 0} ${isEn ? 'passages' : 'passages'})`],
    [isEn ? 'TOTAL REVENUES COLLECTED' : 'TOTAL DES RECETTES', `${formatCurrency(session.totalCollected)} FCFA`],
    [isEn ? 'THEORETICAL CASH IN DRAWER' : 'THÉORIQUE ESPÈCES EN CAISSE', `${formatCurrency(session.expectedCashInDrawer)} FCFA`],
    [isEn ? 'ACTUAL CASH COUNTED' : 'RÉEL COMPTÉ PAR LE CAISSIER', `${formatCurrency(session.realCashCounted || 0)} FCFA`],
    [isEn ? 'RECORDED CASH DISCREPANCY' : 'ÉCART DE CAISSE CONSTATÉ', `${formatCurrency(session.discrepancy || 0)} FCFA`]
  ];

  autoTable(doc, {
    startY: 55,
    head: [[isEn ? 'Description' : 'Désignation', isEn ? 'Amount / Detail' : 'Montant / Détail']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42] },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 180;

  // Signatures
  doc.setFontSize(10);
  doc.text(isEn ? 'Cashier Signature:' : 'Signature du Caissier :', 30, finalY + 30);
  doc.line(30, finalY + 45, 80, finalY + 45);

  doc.text(isEn ? 'Supervisor Visa & Stamp:' : 'Visa & Cachet Superviseur :', 130, finalY + 30);
  doc.line(130, finalY + 45, 180, finalY + 45);

  return doc;
}
