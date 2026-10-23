import React, { useState, useEffect } from 'react';
import { TollTransaction, User } from '../../types.ts';
import { api } from '../../services/api.ts';
import { generateReceiptPdf } from '../../services/receiptPdf.ts';
import { Modal } from '../../components/Modal.tsx';
import {
  Search,
  Filter,
  Printer,
  AlertTriangle,
  Download,
  Eye,
  FileText,
  RotateCcw
} from 'lucide-react';
import { useTranslation } from '../../services/i18n.tsx';

interface TransactionsListProps {
  currentUser: User | null;
}

export const TransactionsList: React.FC<TransactionsListProps> = ({ currentUser }) => {
  const { t, language, tCategory } = useTranslation();
  const [transactions, setTransactions] = useState<TollTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchPlate, setSearchPlate] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Selected for detail modal
  const [selectedTx, setSelectedTx] = useState<TollTransaction | null>(null);

  // Cancel modal
  const [txToCancel, setTxToCancel] = useState<TollTransaction | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (searchPlate.trim()) params.plateNumber = searchPlate.trim();
      if (filterMethod) params.paymentMethod = filterMethod;
      if (filterStatus) params.status = filterStatus;

      const data = await api.getTransactions(params);
      setTransactions(data.transactions);
      setTotal(data.total);
    } catch (err) {
      console.error('Erreur chargement transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [searchPlate, filterMethod, filterStatus]);

  const handleDownloadReceipt = async (tx: TollTransaction) => {
    const doc = await generateReceiptPdf(tx, language);
    doc.save(`Recu-Peage-${tx.ticketNumber}.pdf`);
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txToCancel || !cancelReason.trim()) return;

    setCancelLoading(true);
    setCancelError(null);
    try {
      await api.cancelTransaction(txToCancel.id, cancelReason);
      setTxToCancel(null);
      setCancelReason('');
      fetchTransactions();
    } catch (err: any) {
      setCancelError(err.message);
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">{t('txRegistryTitle')}</h2>
          <p className="text-xs text-slate-400">
            {total} {t('txTotalCount')}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-3">
        {/* Search by plate */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-plate"
            type="text"
            placeholder={t('searchByPlatePlaceholder')}
            value={searchPlate}
            onChange={e => setSearchPlate(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Payment Method Filter */}
        <select
          value={filterMethod}
          onChange={e => setFilterMethod(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
        >
          <option value="">{t('allPaymentMethods')}</option>
          <option value="ESPECES">{t('cashLabel')}</option>
          <option value="WAVE">{t('waveLabel')}</option>
          <option value="ORANGE_MONEY">{t('orangeLabel')}</option>
          <option value="CARTE">{t('cardLabel')}</option>
          <option value="RFID">{t('rfidLabel')}</option>
        </select>

        {/* Status Filter */}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
        >
          <option value="">{t('allStatuses')}</option>
          <option value="COMPLETED">{t('statusCompleted')}</option>
          <option value="CANCELLED">{t('statusCancelled')}</option>
        </select>

        <button
          onClick={fetchTransactions}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1.5 border border-slate-700"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t('refreshBtn')}</span>
        </button>
      </div>

      {/* Transactions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-800/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-700">
              <tr>
                <th className="px-4 py-3">{t('tableDateHeader')}</th>
                <th className="px-4 py-3">{t('tableTicketHeader')}</th>
                <th className="px-4 py-3">{t('tableLaneHeader')}</th>
                <th className="px-4 py-3">{t('tablePlateHeader')}</th>
                <th className="px-4 py-3">{t('tableCatHeader')}</th>
                <th className="px-4 py-3">{t('tableRateHeader')}</th>
                <th className="px-4 py-3">{t('tableMethodHeader')}</th>
                <th className="px-4 py-3">{t('tableCashierHeader')}</th>
                <th className="px-4 py-3">{t('tableStatusHeader')}</th>
                <th className="px-4 py-3 text-right">{t('tableActionsHeader')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                    {language === 'fr' ? 'Aucune transaction trouvée pour ces critères.' : 'No transactions found matching criteria.'}
                  </td>
                </tr>
              ) : (
                transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 text-slate-400 font-mono whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')} {new Date(tx.createdAt).toLocaleTimeString(language === 'fr' ? 'fr-FR' : 'en-US')}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-300 whitespace-nowrap">
                      {tx.ticketNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{tx.laneId}</td>
                    <td className="px-4 py-3 font-mono font-bold text-white">
                      {tx.plateNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      [{tx.categoryCode}] {tCategory(tx.categoryCode, tx.categoryLabel)}
                    </td>
                    <td className="px-4 py-3 font-bold text-emerald-400 whitespace-nowrap">
                      {tx.amountDue.toLocaleString('fr-FR')} FCFA
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      {tx.paymentMethod}
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {tx.cashierName}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {tx.status === 'COMPLETED' ? t('statusCompleted').toUpperCase() : t('statusCancelled').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                      <button
                        onClick={() => setSelectedTx(tx)}
                        title={language === 'fr' ? 'Voir détails' : 'View details'}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDownloadReceipt(tx)}
                        title={t('reprintReceiptBtn')}
                        className="p-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>

                      {tx.status === 'COMPLETED' && (currentUser?.role === 'admin' || currentUser?.role === 'superviseur') && (
                        <button
                          onClick={() => setTxToCancel(tx)}
                          title={language === 'fr' ? 'Annuler la transaction (Supervision)' : 'Cancel transaction (Supervisor)'}
                          className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: DETAIL TRANSACTION */}
      <Modal
        isOpen={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        title={t('txDetailsModalTitle')}
      >
        {selectedTx && (
          <div className="space-y-4 text-xs">
            <div className="bg-slate-800/80 p-4 rounded-xl space-y-2 border border-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-400">{language === 'fr' ? 'Identifiant :' : 'ID:'}</span>
                <span className="font-mono text-white">{selectedTx.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{language === 'fr' ? 'Ticket N° :' : 'Ticket No.:'}</span>
                <span className="font-mono font-bold text-white">{selectedTx.ticketNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{language === 'fr' ? "Plaque d'immatriculation :" : 'License Plate:'}</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">{selectedTx.plateNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{language === 'fr' ? 'Catégorie :' : 'Category:'}</span>
                <span className="text-white font-semibold">[{selectedTx.categoryCode}] {tCategory(selectedTx.categoryCode, selectedTx.categoryLabel)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{language === 'fr' ? 'Voie / Cabine :' : 'Lane / Booth:'}</span>
                <span className="text-white">{selectedTx.laneId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{language === 'fr' ? 'Caissier :' : 'Cashier:'}</span>
                <span className="text-white">{selectedTx.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{language === 'fr' ? 'Date et heure :' : 'Date & Time:'}</span>
                <span className="text-white">{new Date(selectedTx.createdAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{language === 'fr' ? 'Mode de paiement :' : 'Payment Method:'}</span>
                <span className="font-bold text-white">{selectedTx.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{language === 'fr' ? 'Montant dû :' : 'Amount Due:'}</span>
                <span className="font-bold text-white">{selectedTx.amountDue} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{language === 'fr' ? 'Montant reçu :' : 'Amount Received:'}</span>
                <span className="text-white">{selectedTx.amountPaid} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{language === 'fr' ? 'Monnaie rendue :' : 'Change Returned:'}</span>
                <span className="text-white">{selectedTx.changeReturned} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{language === 'fr' ? 'Statut :' : 'Status:'}</span>
                <span className={selectedTx.status === 'COMPLETED' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                  {selectedTx.status}
                </span>
              </div>
              {selectedTx.cancelledAt && (
                <div className="border-t border-slate-700 pt-2 space-y-1 text-red-300">
                  <div>{language === 'fr' ? 'Annulée le :' : 'Cancelled on:'} {new Date(selectedTx.cancelledAt).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}</div>
                  <div>{language === 'fr' ? 'Par :' : 'By:'} {selectedTx.cancelledBy}</div>
                  <div>{language === 'fr' ? 'Motif :' : 'Reason:'} {selectedTx.cancellationReason}</div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => handleDownloadReceipt(selectedTx)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{language === 'fr' ? 'Imprimer Reçu PDF' : 'Print PDF Receipt'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: ANNULATION SUPERVISÉE */}
      <Modal
        isOpen={!!txToCancel}
        onClose={() => setTxToCancel(null)}
        title={t('cancelTxModalTitle')}
      >
        <form onSubmit={handleCancelSubmit} className="space-y-4">
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300">
            {t('cancelTxModalDesc')}
          </div>

          {txToCancel && (
            <div className="bg-slate-800 p-3 rounded-lg text-xs space-y-1">
              <div>{language === 'fr' ? 'Ticket :' : 'Ticket:'} <span className="font-mono text-white">{txToCancel.ticketNumber}</span></div>
              <div>{language === 'fr' ? 'Plaque :' : 'Plate:'} <span className="font-bold text-white">{txToCancel.plateNumber}</span></div>
              <div>{language === 'fr' ? 'Montant :' : 'Amount:'} <span className="font-bold text-emerald-400">{txToCancel.amountDue} FCFA</span></div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('cancelReasonLabel')}
            </label>
            <input
              type="text"
              required
              minLength={3}
              placeholder={language === 'fr' ? 'Ex: Erreur de saisie caissier, double encaissement...' : 'E.g.: Cashier entry error, duplicate charge...'}
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
            />
          </div>

          {cancelError && (
            <div className="text-xs text-red-400">{cancelError}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setTxToCancel(null)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
            >
              {t('closeBtn')}
            </button>
            <button
              type="submit"
              disabled={cancelLoading || cancelReason.trim().length < 3}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs disabled:opacity-50"
            >
              {t('confirmCancelBtn')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
