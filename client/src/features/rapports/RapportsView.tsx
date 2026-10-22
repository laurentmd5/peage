import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from '../../services/receiptPdf.ts';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  Filter,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { useTranslation } from '../../services/i18n.tsx';

export const RapportsView: React.FC = () => {
  const { t, language } = useTranslation();
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const defaultEnd = now.toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const data = await api.getReportsSummary({ startDate, endDate });
      setReport(data);
    } catch (err) {
      console.error('Erreur rapport:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate]);

  const handleExportCsv = () => {
    window.open(`/api/reports/export-csv?startDate=${startDate}&endDate=${endDate}`, '_blank');
  };

  const handleExportPdf = () => {
    if (!report) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(language === 'fr' ? 'RAPPORT D\'EXPLOITATION DU PÉAGE' : 'TOLL OPERATIONAL REPORT', 105, 15, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${language === 'fr' ? 'Période : Du' : 'Period: From'} ${report.period.start} ${language === 'fr' ? 'au' : 'to'} ${report.period.end}`, 105, 21, { align: 'center' });
    doc.text(`${language === 'fr' ? 'Généré le :' : 'Generated on:'} ${new Date(report.generatedAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')} ${language === 'fr' ? 'par' : 'by'} ${report.generatedBy}`, 105, 26, { align: 'center' });

    // Summary Box
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(15, 30, 180, 20, 2, 2, 'FD');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${t('totalPassagesReport')} : ${report.totalVehicles}`, 25, 38);
    doc.text(`${t('totalRevenuesReport')} : ${formatCurrency(report.totalRevenue)} FCFA`, 25, 45);
    doc.text(`${t('totalCancellationsReport')} : ${report.totalCancelled}`, 115, 38);
    doc.text(`${t('totalManualOpeningsReport')} : ${report.totalManualOpenings}`, 115, 45);

    // Table 1: Category breakdown
    autoTable(doc, {
      startY: 55,
      head: [[language === 'fr' ? 'Code' : 'Code', language === 'fr' ? 'Catégorie' : 'Category', language === 'fr' ? 'Passages' : 'Passages', language === 'fr' ? 'Montant Total (FCFA)' : 'Total Amount (FCFA)']],
      body: report.byCategory.map((c: any) => [c.code, c.label, c.count, `${formatCurrency(c.total)} F`]),
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] }
    });

    // Table 2: Payment methods
    const y2 = (doc as any).lastAutoTable?.finalY + 10;
    autoTable(doc, {
      startY: y2,
      head: [[language === 'fr' ? 'Moyen de Paiement' : 'Payment Method', language === 'fr' ? 'Transactions' : 'Transactions', language === 'fr' ? 'Montant Encaissé (FCFA)' : 'Collected Amount (FCFA)']],
      body: report.byPaymentMethod.map((m: any) => [m.label, m.count, `${formatCurrency(m.total)} F`]),
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59] }
    });

    // Signatures
    const finalY = (doc as any).lastAutoTable?.finalY + 20;
    if (finalY < 260) {
      doc.setFontSize(10);
      doc.text(t('signatureExploitation'), 20, finalY);
      doc.line(20, finalY + 15, 80, finalY + 15);

      doc.text(t('signatureDirection'), 120, finalY);
      doc.line(120, finalY + 15, 180, finalY + 15);
    }

    doc.save(`Rapport-Peage-${report.period.start}-${report.period.end}.pdf`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header & Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <span>{t('reportsTitle')}</span>
          </h2>
          <p className="text-xs text-slate-400">
            {t('reportsSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-export-csv"
            onClick={handleExportCsv}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>{t('exportCsvBtn')}</span>
          </button>

          <button
            id="btn-export-pdf"
            onClick={handleExportPdf}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20"
          >
            <Printer className="w-4 h-4" />
            <span>{t('exportPdfBtn')}</span>
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">{t('periodFrom')}</span>
          <input
            id="input-report-start"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">{t('periodTo')}</span>
          <input
            id="input-report-end"
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
          />
        </div>

        {/* Quick presets */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => {
              const d = new Date().toISOString().slice(0, 10);
              setStartDate(d);
              setEndDate(d);
            }}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
          >
            {t('todayFilter')}
          </button>
          <button
            onClick={() => {
              const e = new Date().toISOString().slice(0, 10);
              const s = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
              setStartDate(s);
              setEndDate(e);
            }}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
          >
            {t('last7DaysFilter')}
          </button>
          <button
            onClick={() => {
              const e = new Date().toISOString().slice(0, 10);
              const s = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
              setStartDate(s);
              setEndDate(e);
            }}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
          >
            {t('thisMonthFilter')}
          </button>
        </div>
      </div>

      {/* Official Printable Report Container */}
      {report && (
        <div className="bg-white text-slate-900 rounded-2xl p-8 shadow-2xl space-y-6 max-w-4xl mx-auto border border-slate-200">
          {/* Official Letterhead */}
          <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
            <div>
              <div className="text-xl font-black tracking-wider uppercase">{t('officialReportHeader')}</div>
              <div className="text-xs text-slate-600">{t('centralStation')} • {t('officialReportSub')}</div>
              <div className="text-xs text-slate-600">Avenida dos Combatentes • Bissau, Guinée-Bissau • Tél : +245 955 00 00 00</div>
            </div>

            <div className="text-right text-xs">
              <div className="font-bold uppercase tracking-wider text-slate-900">{language === 'fr' ? 'RAPPORT OFFICIEL D\'EXPLOITATION' : 'OFFICIAL OPERATIONAL STATEMENT'}</div>
              <div className="text-slate-600">Réf : RPT-{startDate.replace(/-/g, '')}-{endDate.replace(/-/g, '')}</div>
              <div className="text-slate-600">{language === 'fr' ? 'Émis le :' : 'Issued on:'} {new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}</div>
            </div>
          </div>

          {/* Period & Summary Banner */}
          <div className="bg-slate-100 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-xs text-slate-500 uppercase font-semibold">{t('totalPassagesReport')}</div>
              <div className="text-2xl font-black text-slate-900">{report.totalVehicles}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase font-semibold">{t('totalRevenuesReport')}</div>
              <div className="text-2xl font-black text-emerald-600">
                {report.totalRevenue.toLocaleString('fr-FR')} FCFA
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase font-semibold">{t('totalCancellationsReport')}</div>
              <div className="text-2xl font-black text-red-600">{report.totalCancelled}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase font-semibold">{t('totalManualOpeningsReport')}</div>
              <div className="text-2xl font-black text-amber-600">{report.totalManualOpenings}</div>
            </div>
          </div>

          {/* Table 1: Category Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {t('ventilationByCategory')}
            </h4>
            <table className="w-full text-xs text-left border border-slate-300">
              <thead className="bg-slate-900 text-white uppercase text-[10px]">
                <tr>
                  <th className="p-2 border">{t('tableCodeHeader')}</th>
                  <th className="p-2 border">{t('tableCatHeader')}</th>
                  <th className="p-2 border text-center">{language === 'fr' ? 'Nombre' : 'Count'}</th>
                  <th className="p-2 border text-right">{language === 'fr' ? 'Montant Encaissé (FCFA)' : 'Amount Collected (FCFA)'}</th>
                </tr>
              </thead>
              <tbody>
                {report.byCategory.map((cat: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="p-2 border font-mono font-bold">{cat.code}</td>
                    <td className="p-2 border">{cat.label}</td>
                    <td className="p-2 border text-center font-bold">{cat.count}</td>
                    <td className="p-2 border text-right font-mono font-bold">
                      {cat.total.toLocaleString('fr-FR')} F
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table 2: Payment Methods Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {t('ventilationByPayment')}
            </h4>
            <table className="w-full text-xs text-left border border-slate-300">
              <thead className="bg-slate-800 text-white uppercase text-[10px]">
                <tr>
                  <th className="p-2 border">{t('paymentMethodLabel')}</th>
                  <th className="p-2 border text-center">{language === 'fr' ? 'Transactions' : 'Transactions'}</th>
                  <th className="p-2 border text-right">{language === 'fr' ? 'Recette (FCFA)' : 'Revenue (FCFA)'}</th>
                </tr>
              </thead>
              <tbody>
                {report.byPaymentMethod.map((pm: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="p-2 border font-medium">{pm.label}</td>
                    <td className="p-2 border text-center font-bold">{pm.count}</td>
                    <td className="p-2 border text-right font-mono font-bold">
                      {pm.total.toLocaleString('fr-FR')} F
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table 3: Cashier Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              {t('ventilationByCashier')}
            </h4>
            <table className="w-full text-xs text-left border border-slate-300">
              <thead className="bg-slate-800 text-white uppercase text-[10px]">
                <tr>
                  <th className="p-2 border">{language === 'fr' ? 'Opérateur' : 'Operator'}</th>
                  <th className="p-2 border text-center">{language === 'fr' ? 'Passages' : 'Passages'}</th>
                  <th className="p-2 border text-right">{language === 'fr' ? 'Total Encaissé (FCFA)' : 'Total Collected (FCFA)'}</th>
                </tr>
              </thead>
              <tbody>
                {report.byCashier.map((c: any, i: number) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="p-2 border font-semibold">{c.cashierName}</td>
                    <td className="p-2 border text-center font-bold">{c.count}</td>
                    <td className="p-2 border text-right font-mono font-bold">
                      {c.total.toLocaleString('fr-FR')} F
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Official Signatures & Stamp */}
          <div className="pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs">
            <div className="space-y-12">
              <div className="font-bold text-slate-700">{t('signatureExploitation')}</div>
              <div className="border-t border-slate-400 w-48 text-[11px] text-slate-500 pt-1">
                {t('dateAndSig')}
              </div>
            </div>

            <div className="space-y-12 text-right">
              <div className="font-bold text-slate-700">{t('signatureDirection')}</div>
              <div className="border-t border-slate-400 w-48 ml-auto text-[11px] text-slate-500 pt-1">
                {t('officialStamp')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
