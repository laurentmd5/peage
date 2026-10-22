import React, { useState } from 'react';
import { CashSession, User } from '../../types.ts';
import { api } from '../../services/api.ts';
import { generateClosingReportPdf } from '../../services/receiptPdf.ts';
import { Modal } from '../../components/Modal.tsx';
import {
  Wallet,
  Lock,
  Unlock,
  Printer,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Receipt
} from 'lucide-react';
import { useTranslation } from '../../services/i18n.tsx';

interface GestionCaisseProps {
  currentUser: User | null;
  activeSession: CashSession | null;
  onRefreshSession: () => void;
}

export const GestionCaisse: React.FC<GestionCaisseProps> = ({
  currentUser,
  activeSession,
  onRefreshSession
}) => {
  const { t, language } = useTranslation();
  // Open session form
  const [openBoothId, setOpenBoothId] = useState('CAISSE-01');
  const [initialFloat, setInitialFloat] = useState<number>(20000);
  const [openLoading, setOpenLoading] = useState(false);

  // Close session modal
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [realCashCounted, setRealCashCounted] = useState<number>(0);
  const [closeResult, setCloseResult] = useState<CashSession | null>(null);
  const [closeLoading, setCloseLoading] = useState(false);

  // Handle open session
  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpenLoading(true);
    try {
      await api.openCaisse(openBoothId, initialFloat);
      onRefreshSession();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setOpenLoading(false);
    }
  };

  // Handle close session
  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    setCloseLoading(true);
    try {
      const closed = await api.closeCaisse(activeSession.id, realCashCounted);
      setCloseResult(closed);
      setIsCloseModalOpen(false);
      onRefreshSession();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCloseLoading(false);
    }
  };

  // Download PDF closure report
  const handleDownloadClosingPdf = (session: CashSession) => {
    const doc = generateClosingReportPdf(session, language);
    doc.save(`Cloture-Caisse-${session.id}.pdf`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-400" />
          <span>{t('caisseSessionTitle')}</span>
        </h2>
        <p className="text-xs text-slate-400">
          {t('caisseSessionSubtitle')}
        </p>
      </div>

      {/* When NO Active Session: Open Session Screen */}
      {!activeSession && !closeResult && (
        <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6 shadow-xl">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/20">
              <Unlock className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white">{t('openNewSessionTitle')}</h3>
            <p className="text-xs text-slate-400">
              {language === 'fr' ? 'Déclarez votre fond de caisse initial pour démarrer la prise de poste.' : 'Declare your initial cash float to start your shift.'}
            </p>
          </div>

          <form onSubmit={handleOpenSession} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {language === 'fr' ? 'Cabine / Voie de Péage *' : 'Booth / Toll Lane *'}
              </label>
              <select
                id="select-open-booth"
                value={openBoothId}
                onChange={e => setOpenBoothId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="CAISSE-01">{language === 'fr' ? 'CAISSE-01 (Voie Principale Nord)' : 'BOOTH-01 (North Main Lane)'}</option>
                <option value="CAISSE-02">{language === 'fr' ? 'CAISSE-02 (Voie Principale Sud)' : 'BOOTH-02 (South Main Lane)'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {t('initialFloatLabel')}
              </label>
              <input
                id="input-initial-float"
                type="number"
                min="0"
                step="1000"
                required
                value={initialFloat}
                onChange={e => setInitialFloat(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-base font-bold font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              id="btn-confirm-open-session"
              type="submit"
              disabled={openLoading}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <Unlock className="w-4 h-4" />
              <span>{t('openShiftBtn')}</span>
            </button>
          </form>
        </div>
      )}

      {/* When ACTIVE Session: Live Balance & Breakdown */}
      {activeSession && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <h3 className="text-lg font-bold text-white">
                    {t('currentActiveSessionTitle')} : {activeSession.boothId}
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  {language === 'fr' ? 'Ouverte le' : 'Opened on'} {new Date(activeSession.openedAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')} {language === 'fr' ? 'par' : 'by'}{' '}
                  <span className="text-white font-semibold">{activeSession.cashierName}</span>
                </p>
              </div>

              <button
                id="btn-trigger-close-session"
                onClick={() => {
                  setRealCashCounted(activeSession.expectedCashInDrawer);
                  setIsCloseModalOpen(true);
                }}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-red-600/20"
              >
                <Lock className="w-4 h-4" />
                <span>{t('closeShiftBtn')}</span>
              </button>
            </div>

            {/* Shift Financial Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-1">
                <span className="text-xs text-slate-400">{t('initialFloat')}</span>
                <div className="text-2xl font-black text-white">
                  {activeSession.initialFloat.toLocaleString('fr-FR')} FCFA
                </div>
              </div>

              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-1">
                <span className="text-xs text-slate-400">{t('totalCollectedAll')}</span>
                <div className="text-2xl font-black text-emerald-400">
                  {activeSession.totalCollected.toLocaleString('fr-FR')} FCFA
                </div>
              </div>

              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-1">
                <span className="text-xs text-slate-400">{t('expectedCash')}</span>
                <div className="text-2xl font-black text-blue-400">
                  {activeSession.expectedCashInDrawer.toLocaleString('fr-FR')} FCFA
                </div>
              </div>
            </div>

            {/* Breakdown per payment method */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                {language === 'fr' ? 'Ventilation des encaissements par moyen de paiement' : 'Revenue breakdown by payment method'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {Object.entries(activeSession.breakdown).map(([method, data]) => (
                  <div
                    key={method}
                    className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1"
                  >
                    <div className="text-xs text-slate-400 font-semibold">{method}</div>
                    <div className="text-base font-bold text-white">
                      {data.total.toLocaleString('fr-FR')} FCFA
                    </div>
                    <div className="text-[11px] text-slate-400">{data.count} {language === 'fr' ? 'passage(s)' : 'passage(s)'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* When Session just closed: Display Result & Print Report */}
      {closeResult && (
        <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{language === 'fr' ? 'Session Clôturée avec Succès' : 'Session Successfully Closed'}</h3>
                <p className="text-xs text-slate-400">{language === 'fr' ? 'Rapprochement financier effectué' : 'Financial reconciliation completed'}</p>
              </div>
            </div>

            <button
              onClick={() => handleDownloadClosingPdf(closeResult)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>{t('generateReportBtn')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
              <span className="text-slate-400">{t('expectedTheoreticalCash')}</span>
              <div className="text-xl font-bold text-white mt-1">
                {closeResult.expectedCashInDrawer.toLocaleString('fr-FR')} FCFA
              </div>
            </div>

            <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
              <span className="text-slate-400">{language === 'fr' ? 'Réel Compté par Caissier :' : 'Actual Counted Cash :'}</span>
              <div className="text-xl font-bold text-blue-400 mt-1">
                {(closeResult.realCashCounted || 0).toLocaleString('fr-FR')} FCFA
              </div>
            </div>

            <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
              <span className="text-slate-400">{t('calculatedDiscrepancy')}</span>
              <div
                className={`text-xl font-black mt-1 ${
                  (closeResult.discrepancy || 0) === 0
                    ? 'text-emerald-400'
                    : (closeResult.discrepancy || 0) < 0
                    ? 'text-red-400'
                    : 'text-amber-400'
                }`}
              >
                {(closeResult.discrepancy || 0).toLocaleString('fr-FR')} FCFA
                <span className="text-xs font-normal ml-2">
                  {(closeResult.discrepancy || 0) === 0 ? `(${t('balancedCashNotice')})` : (closeResult.discrepancy || 0) < 0 ? `(${t('deficitNotice')})` : `(${t('surplusNotice')})`}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => setCloseResult(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs"
            >
              {language === 'fr' ? 'Ouvrir un nouveau poste' : 'Open new booth shift'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL: FERMETURE & CLÔTURE DE CAISSE */}
      <Modal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        title={t('closeReconciliationModalTitle')}
      >
        <form onSubmit={handleCloseSession} className="space-y-4">
          <div className="p-3 bg-slate-800 rounded-lg text-xs space-y-1 border border-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-400">{t('initialFloat')}</span>
              <span className="text-white font-mono">{activeSession?.initialFloat.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">{t('cashCollected')}</span>
              <span className="text-white font-mono">{activeSession?.breakdown.ESPECES?.total.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-700 font-bold">
              <span className="text-slate-300">{t('expectedTheoreticalCash')}</span>
              <span className="text-emerald-400 font-mono text-sm">{activeSession?.expectedCashInDrawer.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('realCountLabel')}
            </label>
            <input
              id="input-real-cash-counted"
              type="number"
              min="0"
              required
              value={realCashCounted}
              onChange={e => setRealCashCounted(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-base font-bold font-mono focus:outline-none focus:border-red-500"
            />
          </div>

          {activeSession && (
            <div className="text-xs">
              {t('calculatedDiscrepancy')}{' '}
              <span
                className={`font-bold font-mono ${
                  realCashCounted - activeSession.expectedCashInDrawer === 0
                    ? 'text-emerald-400'
                    : realCashCounted - activeSession.expectedCashInDrawer < 0
                    ? 'text-red-400'
                    : 'text-amber-400'
                }`}
              >
                {(realCashCounted - activeSession.expectedCashInDrawer).toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCloseModalOpen(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
            >
              {t('closeBtn')}
            </button>
            <button
              id="btn-confirm-close-session"
              type="submit"
              disabled={closeLoading}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs disabled:opacity-50"
            >
              {language === 'fr' ? 'Valider la clôture' : 'Validate Closing'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
